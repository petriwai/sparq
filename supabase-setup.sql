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
-- MESSAGES TABLE (Premium Chat with Voice Support)
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  message_type text not null default 'text' check (message_type in ('text', 'voice')),
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

-- Index for fast message retrieval
create index if not exists messages_ride_created_idx
  on public.messages (ride_id, created_at);

alter table public.messages enable row level security;

-- Select: only ride participants (rider OR driver)
create policy "messages_select_participants"
on public.messages for select
using (
  exists (
    select 1 from public.rides r
    where r.id = messages.ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
  )
);

-- Insert: only participants, sender_id must be you
create policy "messages_insert_participants"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.rides r
    where r.id = messages.ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
  )
);

-- No direct UPDATE from clients (use RPC for read receipts)
revoke update on public.messages from authenticated;

-- RPC to mark messages read (security definer)
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
-- MIGRATION: Add new columns to existing rides table
-- ============================================================================
-- Run these if upgrading an existing database:
-- 
-- alter table public.rides add column if not exists scheduled_for timestamptz null;
-- alter table public.rides add column if not exists is_scheduled boolean default false;
-- alter table public.rides add column if not exists quiet_ride boolean default false;
-- alter table public.rides add column if not exists pet_friendly boolean default false;
