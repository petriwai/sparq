-- INOKA Supabase Database Setup
-- Run this in Supabase SQL Editor: SQL Editor → New Query → paste and run

-- ============================================================================
-- IMPORTANT: CONFIGURE AUTH REDIRECT URLS
-- ============================================================================
-- In Supabase Dashboard: Authentication → URL Configuration → Redirect URLs
-- Add these URLs:
--   https://inoka.online/*
--   http://localhost:3000/*
-- 
-- This is required for magic link and password reset to work!
-- ============================================================================

-- Ensure UUID generator exists
create extension if not exists pgcrypto;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  stripe_customer_id text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

-- Create profile row on signup (trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============================================================================
-- SAVED PLACES TABLE
-- ============================================================================
create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  icon text not null default '📍',
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

alter table public.saved_places enable row level security;

create policy "saved_places_crud_own"
on public.saved_places for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================================
-- RIDES TABLE
-- ============================================================================
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  pickup_address text not null,
  dropoff_address text not null,
  ride_type text not null,
  estimated_fare numeric not null,
  status text not null default 'requested',
  payment_intent_id text,
  payment_status text,
  paid_amount numeric,
  -- Tip tracking (prevents double-charging)
  tip_amount numeric,
  tip_payment_id text,
  -- Scheduling and preferences
  scheduled_for timestamptz null,
  is_scheduled boolean default false,
  quiet_ride boolean default false,
  pet_friendly boolean default false,
  -- Timestamps
  created_at timestamptz default now()
);

alter table public.rides enable row level security;

create policy "rides_insert_own"
on public.rides for insert
with check (auth.uid() = rider_id);

create policy "rides_select_own"
on public.rides for select
using (auth.uid() = rider_id);

-- Riders can only cancel their own rides (status update only)
-- Payment fields are updated by server with service role key
create policy "rides_update_own_status"
on public.rides for update
using (auth.uid() = rider_id)
with check (auth.uid() = rider_id);

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
create table if not exists public.drivers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  license_number text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.drivers enable row level security;

create policy "drivers_crud_own"
on public.drivers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================================
-- VEHICLES TABLE
-- ============================================================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  make text,
  model text,
  year int,
  plate text,
  color text,
  created_at timestamptz default now()
);

alter table public.vehicles enable row level security;

create policy "vehicles_crud_own"
on public.vehicles for all
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

-- ============================================================================
-- SECURITY HARDENING: Column-Level Privileges
-- ============================================================================
-- Prevent users from updating payment fields directly
-- Only the server (service role) can update payment_intent_id, payment_status, paid_amount

-- Revoke general update, grant only specific columns
revoke update on table public.rides from anon, authenticated;
grant update (status) on table public.rides to authenticated;

-- Prevent drivers from self-approving (only allow name/license updates)
revoke update on table public.drivers from anon, authenticated;
grant update (name, license_number) on table public.drivers to authenticated;

-- ============================================================================
-- MESSAGES TABLE (Premium Chat with Voice Support + Moderation)
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  message_type text not null default 'text' check (message_type in ('text', 'voice')),
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  flagged boolean default false  -- For content moderation
);

-- Index for fast message retrieval
create index if not exists messages_ride_created_idx
  on public.messages (ride_id, created_at);

alter table public.messages enable row level security;

-- Select: ride participants can read messages (even after ride completes - for disputes)
create policy "messages_select_participants"
on public.messages for select
using (
  exists (
    select 1 from public.rides r
    where r.id = messages.ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
  )
);

-- Insert: only participants, only during ACTIVE rides (prevents post-ride harassment)
create policy "messages_insert_participants_active_only"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.rides r
    where r.id = messages.ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
      and r.status not in ('completed', 'cancelled')  -- Locks chat after ride ends
  )
);

-- No direct UPDATE from clients (use RPC for read receipts)
revoke update on public.messages from authenticated;

-- ============================================================================
-- CONTENT MODERATION (Profanity filter function + trigger)
-- ============================================================================

-- Reusable function to check for profanity (can be used in RLS policies too)
create or replace function public.contains_profanity(text_content text)
returns boolean
language plpgsql
immutable
as $$
begin
  -- Customize this word list for production
  -- Using word boundaries (\m and \M) to avoid false positives
  return text_content ~* '\m(fuck|shit|bitch|dick|pussy|cock|cunt|nigger|faggot)\M';
end;
$$;

-- Trigger to flag messages (still allows insert, just marks for review)
create or replace function flag_inappropriate_messages()
returns trigger as $$
begin
  if public.contains_profanity(new.content) then
    new.flagged = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists flag_messages on public.messages;
create trigger flag_messages
  before insert on public.messages
  for each row
  execute function flag_inappropriate_messages();

-- ============================================================================
-- RPC: Mark Messages Read (Security Definer for safe updates)
-- ============================================================================
create or replace function public.mark_messages_read(p_ride_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.messages
  set read_at = now()
  where ride_id = p_ride_id
    and sender_id <> auth.uid()
    and read_at is null
    and exists (
      select 1 from public.rides r
      where r.id = p_ride_id
        and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
    );
end;
$$;

grant execute on function public.mark_messages_read(uuid) to authenticated;

-- Enable Realtime for messages
alter publication supabase_realtime add table messages;

-- ============================================================================
-- ADD DRIVER_ID TO RIDES (for chat participant lookup)
-- ============================================================================
alter table public.rides add column if not exists driver_id uuid references auth.users(id) null;

-- ============================================================================
-- STORAGE POLICIES FOR VOICE MESSAGES
-- ============================================================================
-- IMPORTANT: First create bucket "chat-audio" in Dashboard > Storage (set to PRIVATE)
-- Then run these policies:

-- Robust Upload Policy - enforces path structure: ride_id/user_id/filename.webm
create policy "Allow ride participants to upload audio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-audio'
  -- Enforce EXACTLY 2 folder levels: ride_id/user_id/filename
  and array_length(storage.foldername(name), 1) = 2
  -- First folder must be non-null
  and (storage.foldername(name))[1] is not null
  -- Second folder MUST be the authenticated user's ID (prevents spoofing)
  and (storage.foldername(name))[2] = auth.uid()::text
  -- Only allow .webm audio files
  and name ~* '\.webm$'
  -- User must be participant in an active ride
  and exists (
    select 1 from public.rides r
    where r.id::text = (storage.foldername(name))[1]  -- First folder = ride ID
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
      and r.status not in ('completed', 'cancelled')
  )
);

-- Allow ride participants to download/listen
create policy "Allow ride participants to read audio"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-audio'
  and exists (
    select 1 from public.rides r
    where r.id::text = (storage.foldername(name))[1]
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
  )
);

-- Allow users to delete their own voice messages
create policy "Allow users to delete own audio"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-audio'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================================================
-- MIGRATION: Add new columns to existing rides table
-- ============================================================================
-- Run these if upgrading an existing database:
-- 
-- alter table public.rides add column if not exists scheduled_for timestamptz null;
-- alter table public.rides add column if not exists is_scheduled boolean default false;
-- alter table public.rides add column if not exists quiet_ride boolean default false;
-- alter table public.rides add column if not exists pet_friendly boolean default false;
