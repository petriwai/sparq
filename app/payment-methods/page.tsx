'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { User } from '@supabase/supabase-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type PaymentMethod = {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

// Helper to make authenticated API calls
async function stripeApi(action: string, data: any = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json' 
  }
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch('/api/stripe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...data })
  })
  return response.json()
}

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    try {
      const { clientSecret, error: apiError } = await stripeApi('create-setup-intent')
      
      if (apiError) {
        setError(apiError)
        setLoading(false)
        return
      }

      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! }
      })

      if (stripeError) {
        setError(stripeError.message || 'Failed to add card')
      } else {
        onSuccess()
      }
    } catch (err) {
      setError('Failed to add card')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-4">
      <CardElement options={{
        style: {
          base: {
            fontSize: '16px',
            color: '#ffffff',
            '::placeholder': { color: '#64748b' }
          }
        }
      }} />
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <button type="submit" disabled={loading || !stripe} className="w-full mt-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl">
        {loading ? 'Adding...' : 'Add Card'}
      </button>
    </form>
  )
}

export default function PaymentMethods() {
  const [user, setUser] = useState<User | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [showAddCard, setShowAddCard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadCustomer(session.user)
      } else {
        window.location.href = '/'
      }
    })
  }, [])

  const loadCustomer = async (user: User) => {
    setLoading(true)
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      setCustomerId(profile.stripe_customer_id)
      await loadPaymentMethods()
    } else {
      // Create new Stripe customer
      const { customerId: newCustomerId } = await stripeApi('create-customer')
      setCustomerId(newCustomerId)
    }
    
    setLoading(false)
  }

  const loadPaymentMethods = async () => {
    const methods = await stripeApi('get-payment-methods')
    if (Array.isArray(methods)) {
      setPaymentMethods(methods)
    }
  }

  const handleDeleteCard = async (paymentMethodId: string) => {
    await stripeApi('delete-payment-method', { paymentMethodId })
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentMethodId))
  }

  const handleCardAdded = () => {
    setShowAddCard(false)
    loadPaymentMethods()
  }

  const getCardIcon = (brand: string) => {
    const icons: Record<string, string> = { visa: '💳', mastercard: '💳', amex: '💳', discover: '💳' }
    return icons[brand.toLowerCase()] || '💳'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="pt-safe bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
        <a href="/" className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">←</a>
        <h1 className="text-lg font-semibold text-white">Payment Methods</h1>
      </header>

      <div className="p-4">
        {paymentMethods.length > 0 ? (
          <div className="space-y-3 mb-6">
            {paymentMethods.map(pm => (
              <div key={pm.id} className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCardIcon(pm.brand)}</span>
                  <div>
                    <p className="text-white font-medium capitalize">{pm.brand} •••• {pm.last4}</p>
                    <p className="text-slate-400 text-sm">Expires {pm.exp_month}/{pm.exp_year}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteCard(pm.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-6">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">💳</span></div>
            <p className="text-white font-medium mb-2">No payment methods</p>
            <p className="text-slate-400 text-sm">Add a card to request rides</p>
          </div>
        )}

        {showAddCard ? (
          <Elements stripe={stripePromise}>
            <AddCardForm onSuccess={handleCardAdded} />
            <button onClick={() => setShowAddCard(false)} className="w-full mt-3 py-3 text-slate-400 hover:text-white">Cancel</button>
          </Elements>
        ) : (
          <button onClick={() => setShowAddCard(true)} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl">Add Payment Method</button>
        )}
      </div>
    </div>
  )
}
