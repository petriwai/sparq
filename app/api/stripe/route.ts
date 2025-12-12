import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// Service role client for database operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to verify session and get user
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Actions that require authentication
    const authRequiredActions = [
      'create-customer', 
      'create-setup-intent', 
      'get-payment-methods',
      'delete-payment-method',
      'create-payment-intent',
      'capture-payment',
      'charge-tip'
    ]

    let user = null
    if (authRequiredActions.includes(action)) {
      user = await getAuthenticatedUser(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    switch (action) {
      case 'create-customer': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const customer = await stripe.customers.create({ email: user.email })
        
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', user.id)
        
        return NextResponse.json({ customerId: customer.id })
      }

      case 'create-setup-intent': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        // Get customer ID from database, not from request
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        
        if (!profile?.stripe_customer_id) {
          return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
        }
        
        const setupIntent = await stripe.setupIntents.create({
          customer: profile.stripe_customer_id,
          payment_method_types: ['card']
        })
        return NextResponse.json({ clientSecret: setupIntent.client_secret })
      }

      case 'get-payment-methods': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        // Get customer ID from database, not from request
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        
        if (!profile?.stripe_customer_id) {
          return NextResponse.json([])
        }
        
        const paymentMethods = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card'
        })
        return NextResponse.json(paymentMethods.data.map(pm => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year
        })))
      }

      case 'delete-payment-method': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const { paymentMethodId } = body
        
        // Verify the payment method belongs to this user
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        
        if (!profile?.stripe_customer_id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        
        // Get the payment method to verify ownership
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
        if (pm.customer !== profile.stripe_customer_id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        
        await stripe.paymentMethods.detach(paymentMethodId)
        return NextResponse.json({ success: true })
      }

      case 'create-payment-intent': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const { amount, rideId, paymentMethodId } = body
        
        // Get customer ID from database
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        
        if (!profile?.stripe_customer_id) {
          return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
        }
        
        // Verify the ride belongs to this user
        const { data: ride } = await supabaseAdmin
          .from('rides')
          .select('id, rider_id')
          .eq('id', rideId)
          .single()
        
        if (!ride || ride.rider_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          customer: profile.stripe_customer_id,
          payment_method: paymentMethodId,
          capture_method: 'manual',
          confirm: true,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/`
        })

        await supabaseAdmin
          .from('rides')
          .update({ 
            payment_intent_id: paymentIntent.id,
            payment_status: 'authorized'
          })
          .eq('id', rideId)

        return NextResponse.json({ 
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status
        })
      }

      case 'capture-payment': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const { rideId } = body
        
        // Verify the ride belongs to this user
        const { data: ride } = await supabaseAdmin
          .from('rides')
          .select('payment_intent_id, estimated_fare, rider_id')
          .eq('id', rideId)
          .single()

        if (!ride || ride.rider_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (ride?.payment_intent_id) {
          const paymentIntent = await stripe.paymentIntents.capture(
            ride.payment_intent_id
          )

          await supabaseAdmin
            .from('rides')
            .update({ 
              payment_status: 'captured',
              paid_amount: ride.estimated_fare
            })
            .eq('id', rideId)

          return NextResponse.json({ status: paymentIntent.status })
        }
        
        return NextResponse.json({ error: 'No payment intent found' }, { status: 400 })
      }

      case 'charge-tip': {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const { amount, paymentMethodId } = body
        
        // Get customer ID from database
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        
        if (!profile?.stripe_customer_id) {
          return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          customer: profile.stripe_customer_id,
          payment_method: paymentMethodId,
          confirm: true,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/`
        })

        return NextResponse.json({ status: paymentIntent.status })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Stripe API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
