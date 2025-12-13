import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Action =
  | 'get_stats'
  | 'list_rides'
  | 'update_ride'
  | 'list_drivers'
  | 'update_driver'
  | 'list_flagged_messages'
  | 'get_ride_chat'

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, message: 'Missing Bearer token' }
  }

  // Validate JWT as the user
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return { ok: false as const, status: 401, message: 'Invalid session' }
  }

  const userId = userData.user.id

  // Check role using service client (bypasses RLS)
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: profile, error: profErr } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profErr || !profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403, message: 'Not authorized - admin role required' }
  }

  return { ok: true as const, adminClient, userId }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  const adminClient = gate.adminClient
  const body = await req.json().catch(() => ({}))
  const action: Action | undefined = body.action

  try {
    // ========== STATS ==========
    if (action === 'get_stats') {
      // Active rides
      const { count: activeRides } = await adminClient
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .in('status', ['requested', 'accepted', 'in-progress'])

      // Pending drivers
      const { count: pendingDrivers } = await adminClient
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Total revenue (completed rides)
      const { data: revenueData } = await adminClient
        .from('rides')
        .select('paid_amount, tip_amount')
        .eq('status', 'completed')

      const totalRevenue = (revenueData || []).reduce((sum, r) => 
        sum + (Number(r.paid_amount) || 0) + (Number(r.tip_amount) || 0), 0
      )

      // Today's rides
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: todayRides } = await adminClient
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // Flagged messages
      const { count: flaggedMessages } = await adminClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('flagged', true)

      return NextResponse.json({
        data: {
          activeRides: activeRides || 0,
          pendingDrivers: pendingDrivers || 0,
          totalRevenue,
          todayRides: todayRides || 0,
          flaggedMessages: flaggedMessages || 0,
        }
      })
    }

    // ========== RIDES ==========
    if (action === 'list_rides') {
      const statuses = body.statuses ?? ['requested', 'scheduled', 'accepted', 'in-progress']
      const limit = body.limit ?? 50

      const { data, error } = await adminClient
        .from('rides')
        .select(`
          *,
          rider:profiles!rides_rider_id_fkey(id, full_name),
          driver:drivers!rides_driver_id_fkey(user_id, name)
        `)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return NextResponse.json({ data })
    }

    if (action === 'update_ride') {
      const { rideId, patch } = body as { rideId: string; patch: Record<string, any> }
      if (!rideId || !patch) {
        return NextResponse.json({ error: 'rideId + patch required' }, { status: 400 })
      }

      const { data, error } = await adminClient
        .from('rides')
        .update(patch)
        .eq('id', rideId)
        .select('*')
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // ========== DRIVERS ==========
    if (action === 'list_drivers') {
      const { data, error } = await adminClient
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ data })
    }

    if (action === 'update_driver') {
      const { userId, patch } = body as { userId: string; patch: Record<string, any> }
      if (!userId || !patch) {
        return NextResponse.json({ error: 'userId + patch required' }, { status: 400 })
      }

      const { data, error } = await adminClient
        .from('drivers')
        .update(patch)
        .eq('user_id', userId)
        .select('*')
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // ========== MESSAGES ==========
    if (action === 'list_flagged_messages') {
      const { data, error } = await adminClient
        .from('messages')
        .select(`
          *,
          ride:rides(id, pickup_address, dropoff_address, rider_id, driver_id)
        `)
        .eq('flagged', true)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return NextResponse.json({ data })
    }

    if (action === 'get_ride_chat') {
      const { rideId } = body
      if (!rideId) {
        return NextResponse.json({ error: 'rideId required' }, { status: 400 })
      }

      const { data, error } = await adminClient
        .from('messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (e: any) {
    console.error('Admin API error:', e)
    return NextResponse.json({ error: e?.message || 'Admin API error' }, { status: 500 })
  }
}
