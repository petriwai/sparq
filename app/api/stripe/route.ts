import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create-customer': {
        const { email, userId } = body
        const customer = await stripe.customers.create({ email })
        
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', userId)
        
        return NextResponse.json({ customerId: customer.id })
      }

      case 'create-setup-intent': {
        const { customerId } = body
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ['card']
        })
        return NextResponse.json({ clientSecret: setupIntent.client_secret })
      }

      case 'get-payment-methods': {
        const { customerId } = body
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
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
        const { paymentMethodId } = body
        await stripe.paymentMethods.detach(paymentMethodId)
        return NextResponse.json({ success: true })
      }

      case 'create-payment-intent': {
        const { customerId, amount, rideId, paymentMethodId } = body
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          capture_method: 'manual',
          confirm: true,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/`
        })

        await supabase
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
        const { rideId } = body
        
        const { data: ride } = await supabase
          .from('rides')
          .select('payment_intent_id, estimated_fare')
          .eq('id', rideId)
          .single()

        if (ride?.payment_intent_id) {
          const paymentIntent = await stripe.paymentIntents.capture(
            ride.payment_intent_id
          )

          await supabase
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
        const { customerId, amount, paymentMethodId } = body
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          customer: customerId,
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
