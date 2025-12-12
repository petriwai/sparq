import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a ride request - supports both positional and object arguments
export async function createRideRequest(
  riderIdOrOptions: string | {
    rider_id: string
    pickup_address: string
    dropoff_address: string
    ride_type: string
    estimated_fare: number
    payment_intent_id?: string
    payment_status?: string
    status?: string
    scheduled_for?: string | null
    is_scheduled?: boolean
    quiet_ride?: boolean
    pet_friendly?: boolean
  },
  pickupAddress?: string,
  dropoffAddress?: string,
  rideType?: string,
  estimatedFare?: number
) {
  let rideData: any
  
  if (typeof riderIdOrOptions === 'object') {
    rideData = {
      ...riderIdOrOptions,
      status: riderIdOrOptions.status || 'requested'
    }
  } else {
    rideData = {
      rider_id: riderIdOrOptions,
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      ride_type: rideType,
      estimated_fare: estimatedFare,
      status: 'requested'
    }
  }

  const { data, error } = await supabase
    .from('rides')
    .insert(rideData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cancelRide(rideId: string) {
  const { data, error } = await supabase
    .from('rides')
    .update({ status: 'cancelled' })
    .eq('id', rideId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateRideStatus(rideId: string, status: string) {
  const { data, error } = await supabase
    .from('rides')
    .update({ status })
    .eq('id', rideId)
    .select()
    .single()

  if (error) throw error
  return data
}
