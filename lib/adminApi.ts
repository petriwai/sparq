import { supabase } from '@/lib/supabase'

async function getBearer() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return `Bearer ${token}`
}

export async function adminCall<T = any>(
  action: string, 
  payload: Record<string, any> = {}
): Promise<T> {
  const auth = await getBearer()
  
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      Authorization: auth 
    },
    body: JSON.stringify({ action, ...payload }),
  })
  
  const json = await res.json()
  
  if (!res.ok) {
    throw new Error(json?.error || 'Admin request failed')
  }
  
  return json.data as T
}

// Typed helpers for common actions
export const adminApi = {
  getStats: () => adminCall<{
    activeRides: number
    pendingDrivers: number
    totalRevenue: number
    todayRides: number
    flaggedMessages: number
  }>('get_stats'),

  listRides: (statuses?: string[], limit?: number) => 
    adminCall<any[]>('list_rides', { statuses, limit }),

  updateRide: (rideId: string, patch: Record<string, any>) =>
    adminCall<any>('update_ride', { rideId, patch }),

  listDrivers: () => adminCall<any[]>('list_drivers'),

  updateDriver: (userId: string, patch: Record<string, any>) =>
    adminCall<any>('update_driver', { userId, patch }),

  listFlaggedMessages: () => adminCall<any[]>('list_flagged_messages'),

  getRideChat: (rideId: string) => adminCall<any[]>('get_ride_chat', { rideId }),
}
