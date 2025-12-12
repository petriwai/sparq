'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, createRideRequest, cancelRide } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type Screen = 'home' | 'request' | 'searching' | 'found' | 'in-ride' | 'complete' | 'auth' | 'add-place' | 'payment-required' | 'forgot-password' | 'magic-link-sent' | 'reset-sent' | 'choose-location'

type SearchResult = {
  lat: number
  lng: number
  formatted_address: string
  name?: string
}

type RideOption = {
  id: string
  name: string
  icon: string
  description: string
  multiplier: number
  eta: string
}

type SavedPlace = {
  id: string
  label: string
  icon: string
  address: string
  lat: number
  lng: number
}

type PaymentMethod = {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

const RIDE_OPTIONS: RideOption[] = [
  { id: 'saver', name: 'Inoka Saver', icon: '🚗', description: 'Affordable rides', multiplier: 0.8, eta: '5-10' },
  { id: 'standard', name: 'Inoka', icon: '⚡', description: 'Everyday rides', multiplier: 1, eta: '3-5' },
  { id: 'xl', name: 'Inoka XL', icon: '🚐', description: 'Extra seats', multiplier: 1.5, eta: '5-8' },
  { id: 'black', name: 'Inoka Black', icon: '✨', description: 'Premium experience', multiplier: 2.2, eta: '3-5' },
]

const DEFAULT_PLACES = [
  { icon: '✈️', label: 'Airport', address: 'Abraham Lincoln Capital Airport, Springfield, IL', lat: 39.8441, lng: -89.6779 },
  { icon: '🏛️', label: 'Capitol', address: 'Illinois State Capitol, Springfield, IL', lat: 39.7983, lng: -89.6548 },
  { icon: '🏥', label: 'Memorial', address: 'Memorial Medical Center, Springfield, IL', lat: 39.8011, lng: -89.6437 },
]

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home')
  const [user, setUser] = useState<User | null>(null)
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [destinationInput, setDestinationInput] = useState('')
  const [selectedRide, setSelectedRide] = useState<string>('standard')
  const [searchProgress, setSearchProgress] = useState(0)
  const [estimatedDistance, setEstimatedDistance] = useState<number>(0)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic-link'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authSuccess, setAuthSuccess] = useState('')
  const [newPlaceLabel, setNewPlaceLabel] = useState('')
  const [newPlaceIcon, setNewPlaceIcon] = useState('📍')
  const [rideTimer, setRideTimer] = useState(0)
  const [rideFare, setRideFare] = useState(0)
  const [tipAmount, setTipAmount] = useState(0)
  const [currentRideId, setCurrentRideId] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState('')
  
  // Ride preferences
  const [quietRide, setQuietRide] = useState(false)
  const [petFriendly, setPetFriendly] = useState(false)
  const [carSeatNeeded, setCarSeatNeeded] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')
  
  // Payment state
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const userMarkerRef = useRef<google.maps.Circle | null>(null)
  const destMarkerRef = useRef<google.maps.Circle | null>(null)
  const routeLineRef = useRef<google.maps.Polyline | null>(null)

  const [driverInfo] = useState({
    name: 'Marcus T.',
    rating: 4.9,
    car: 'White Toyota Camry',
    plate: 'IL-7829',
    photo: '👨‍✈️',
    eta: 3
  })

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadSavedPlaces(session.user.id)
        loadPaymentMethods(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadSavedPlaces(session.user.id)
        loadPaymentMethods(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load saved places
  const loadSavedPlaces = async (userId: string) => {
    const { data, error } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (data && !error) {
      setSavedPlaces(data)
    }
  }

  // Load payment methods
  const loadPaymentMethods = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
      
      if (profile?.stripe_customer_id) {
        setStripeCustomerId(profile.stripe_customer_id)
        const methods = await stripeApi('get-payment-methods', { customerId: profile.stripe_customer_id })
        if (methods && methods.length > 0) {
          setPaymentMethods(methods)
          setSelectedPaymentMethod(methods[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading payment methods:', err)
    }
  }

  // Stripe API helper with auth
  const stripeApi = async (action: string, data: any) => {
    try {
      // Get current session for auth header
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
      return await response.json()
    } catch (err) {
      console.error('Stripe API error:', err)
      return null
    }
  }

  // Get user's current location with timeout to prevent hanging
  useEffect(() => {
    // Set default location immediately so UI doesn't hang
    const defaultLocation = { 
      address: 'Springfield, IL', 
      lat: 39.7817, 
      lng: -89.6501 
    }
    
    // Timeout fallback - if geolocation takes too long, use default
    const fallbackTimeout = setTimeout(() => {
      if (!pickup) {
        setPickup(defaultLocation)
      }
    }, 5000) // 5 second timeout
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(fallbackTimeout)
          const { latitude, longitude } = position.coords
          
          // Set pickup immediately with coordinates
          setPickup({ 
            address: 'Getting address...', 
            lat: latitude, 
            lng: longitude 
          })
          
          // Then update address asynchronously (with abort timeout)
          const controller = new AbortController()
          const addressTimeout = setTimeout(() => controller.abort(), 5000)
          
          try {
            const address = await reverseGeocode(latitude, longitude)
            clearTimeout(addressTimeout)
            setPickup({ address, lat: latitude, lng: longitude })
          } catch (err) {
            clearTimeout(addressTimeout)
            // Keep coordinates, just use fallback address
            setPickup({ 
              address: 'Current Location', 
              lat: latitude, 
              lng: longitude 
            })
          }
        },
        () => {
          clearTimeout(fallbackTimeout)
          setPickup(defaultLocation)
        },
        { 
          timeout: 10000, // 10 second timeout for geolocation
          maximumAge: 60000, // Accept cached position up to 1 minute old
          enableHighAccuracy: false // Faster, less accurate
        }
      )
    } else {
      clearTimeout(fallbackTimeout)
      setPickup(defaultLocation)
    }
    
    return () => clearTimeout(fallbackTimeout)
  }, [])

  // Reverse geocode via server API
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      })
      const data = await response.json()
      if (data.success && data.address) {
        return data.address
      }
    } catch (err) {
      console.error('Geocoding error:', err)
    }
    return 'Current Location'
  }

  // Forward geocode via server API
  const geocodeAddress = async (address: string): Promise<{ single?: { lat: number; lng: number; formatted_address: string; name?: string }; multiple?: SearchResult[]; error?: string } | null> => {
    try {
      setSearchError('')
      console.log('Geocoding address:', address)
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address,
          userLat: pickup?.lat,
          userLng: pickup?.lng
        })
      })
      const data = await response.json()
      console.log('Geocode response:', data)
      
      if (!data.success) {
        // Extract the most useful error message
        const errorMsg = 
          data.message ||
          data.error ||
          data.details?.places_error_message ||
          data.details?.geocode_error_message ||
          'Search failed'
        
        // Log detailed error info for debugging
        if (data.details) {
          console.error('Geocode error details:', data.details)
        }
        
        return { error: errorMsg }
      }
      
      if (data.multiple && data.results) {
        return { multiple: data.results }
      }
      return { 
        single: { 
          lat: data.lat, 
          lng: data.lng, 
          formatted_address: data.formatted_address,
          name: data.name
        } 
      }
    } catch (err) {
      console.error('Geocoding error:', err)
      return { error: 'Search request failed - check your connection' }
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !pickup) return
    if (screen === 'auth' || screen === 'add-place' || screen === 'forgot-password' || screen === 'magic-link-sent' || screen === 'reset-sent') return

    const initMap = () => {
      if (!window.google?.maps || !mapRef.current) return

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: pickup.lat, lng: pickup.lng },
        zoom: 15,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e4d64' }] },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3d1a' }] },
        ]
      })

      mapInstanceRef.current = map

      userMarkerRef.current = new google.maps.Circle({
        map,
        center: { lat: pickup.lat, lng: pickup.lng },
        radius: 30,
        fillColor: '#F59E0B',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      })
    }

    if (window.google?.maps) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`
      script.async = true
      script.onload = initMap
      document.head.appendChild(script)
    }
  }, [pickup, screen])

  // Update map when destination changes
  useEffect(() => {
    if (!mapInstanceRef.current || !destination || !pickup) return

    if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null)
    }

    destMarkerRef.current = new google.maps.Circle({
      map: mapInstanceRef.current,
      center: { lat: destination.lat, lng: destination.lng },
      radius: 25,
      fillColor: '#EF4444',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    })

    if (routeLineRef.current) {
      routeLineRef.current.setMap(null)
    }

    routeLineRef.current = new google.maps.Polyline({
      map: mapInstanceRef.current,
      path: [
        { lat: pickup.lat, lng: pickup.lng },
        { lat: destination.lat, lng: destination.lng }
      ],
      strokeColor: '#F59E0B',
      strokeWeight: 4,
      strokeOpacity: 0.8
    })

    const bounds = new google.maps.LatLngBounds()
    bounds.extend({ lat: pickup.lat, lng: pickup.lng })
    bounds.extend({ lat: destination.lat, lng: destination.lng })
    mapInstanceRef.current.fitBounds(bounds, 80)

    if (window.google?.maps?.geometry) {
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(pickup.lat, pickup.lng),
        new google.maps.LatLng(destination.lat, destination.lng)
      )
      setEstimatedDistance(distance / 1609.34)
    }
  }, [destination, pickup])

  // Search destination
  const handleSearchDestination = async () => {
    console.log('handleSearchDestination called, input:', destinationInput)
    if (!destinationInput.trim()) {
      console.log('Empty input, returning')
      return
    }
    
    setIsSearching(true)
    setSearchResults([])
    setSearchError('')
    
    const result = await geocodeAddress(destinationInput)
    setIsSearching(false)
    
    console.log('Result returned:', result)
    
    if (!result) {
      setSearchError('No results. Try a more specific search.')
      return
    }
    
    if (result.error) {
      setSearchError(result.error)
      return
    }
    
    if (result.multiple && result.multiple.length > 0) {
      // Multiple results - show inline in bottom sheet (stay on home screen)
      setSearchResults(result.multiple)
      // Don't change screen - results will show inline
      return
    }
    
    if (result.single) {
      // Single result - use it directly
      const displayAddress = result.single.name 
        ? `${result.single.name}, ${result.single.formatted_address}`
        : result.single.formatted_address
      setDestination({ 
        address: displayAddress, 
        lat: result.single.lat, 
        lng: result.single.lng 
      })
      setDestinationInput(displayAddress)
      setSearchResults([])
    }
  }

  // Select from multiple search results
  const handleSelectLocation = (result: SearchResult) => {
    const displayAddress = result.name 
      ? `${result.name}, ${result.formatted_address}`
      : result.formatted_address
    setDestination({ 
      address: displayAddress, 
      lat: result.lat, 
      lng: result.lng 
    })
    setDestinationInput(displayAddress)
    setSearchResults([])
    setScreen('home')
  }

  // Calculate price
  const calculatePrice = (distance: number, multiplier: number) => {
    const basePrice = 3.50
    const perMile = 2.25
    const price = basePrice + (distance * perMile * multiplier)
    return Math.max(price, 5).toFixed(2)
  }

  // Handle ride request
  const handleRequestRide = async () => {
    if (!user) {
      setScreen('auth')
      return
    }

    if (!selectedPaymentMethod || paymentMethods.length === 0) {
      setScreen('payment-required')
      return
    }

    if (!destination || !pickup) return

    const selectedOption = RIDE_OPTIONS.find(r => r.id === selectedRide)
    const fare = parseFloat(calculatePrice(estimatedDistance, selectedOption?.multiplier || 1))
    setRideFare(fare)
    
    const ride = await createRideRequest(user.id, pickup.address, destination.address, selectedRide, fare)
    setCurrentRideId(ride.id)
    
    const { paymentIntentId, status } = await stripeApi('create-payment-intent', { 
      customerId: stripeCustomerId, 
      amount: fare, 
      rideId: ride.id, 
      paymentMethodId: selectedPaymentMethod 
    })
    
    if (status === 'requires_capture' || status === 'succeeded') {
      setScreen('searching')
      simulateDriverSearch()
    } else {
      setAuthError('Payment authorization failed. Please try again.')
    }
  }

  // Simulate driver search
  const simulateDriverSearch = () => {
    setSearchProgress(0)
    const interval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setScreen('found')
          return 100
        }
        return prev + 2
      })
    }, 100)
  }

  // Start ride
  const handleStartRide = () => {
    setRideTimer(0)
    setScreen('in-ride')
  }

  // Ride timer
  useEffect(() => {
    if (screen !== 'in-ride') return
    
    const interval = setInterval(() => {
      setRideTimer(prev => {
        if (prev >= 180) {
          clearInterval(interval)
          handleCompleteRide()
          return prev
        }
        return prev + 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [screen])

  // Complete ride
  const handleCompleteRide = async () => {
    setScreen('complete')
    
    if (currentRideId && stripeCustomerId) {
      await stripeApi('capture-payment', { rideId: currentRideId })
    }
  }

  // Handle tip
  const handleAddTip = async (tip: number) => {
    setTipAmount(tip)
    if (tip > 0 && currentRideId && selectedPaymentMethod) {
      await stripeApi('charge-tip', { 
        customerId: stripeCustomerId, 
        amount: tip, 
        paymentMethodId: selectedPaymentMethod 
      })
    }
  }

  // Finish ride flow
  const handleFinishRide = () => {
    setScreen('home')
    setDestination(null)
    setDestinationInput('')
    setCurrentRideId(null)
    setTipAmount(0)
    setRideTimer(0)
  }

  // Auth handlers
  const handleSignIn = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    })
    
    if (error) {
      setAuthError(error.message)
    } else {
      setScreen('home')
    }
    setAuthLoading(false)
  }

  const handleSignUp = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: {
        data: { full_name: authName }
      }
    })
    
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthSuccess('Check your email to confirm your account!')
    }
    setAuthLoading(false)
  }

  const handleMagicLink = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })
    
    if (error) {
      setAuthError(error.message)
    } else {
      setScreen('magic-link-sent')
    }
    setAuthLoading(false)
  }

  const handlePasswordReset = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    
    if (error) {
      setAuthError(error.message)
    } else {
      setScreen('reset-sent')
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSavedPlaces([])
    setPaymentMethods([])
    setStripeCustomerId(null)
    setShowMenu(false)
  }

  // Save new place
  const handleSavePlace = async () => {
    if (!user || !destination || !newPlaceLabel) return
    
    const { data, error } = await supabase
      .from('saved_places')
      .insert({
        user_id: user.id,
        label: newPlaceLabel,
        icon: newPlaceIcon,
        address: destination.address,
        lat: destination.lat,
        lng: destination.lng
      })
      .select()
      .single()
    
    if (data && !error) {
      setSavedPlaces([data, ...savedPlaces])
      setScreen('home')
      setNewPlaceLabel('')
      setNewPlaceIcon('📍')
    }
  }

  // Get places to display
  const getDisplayPlaces = () => {
    if (savedPlaces.length > 0) {
      return savedPlaces.map(p => ({ ...p, isSaved: true }))
    }
    return DEFAULT_PLACES.map((p, i) => ({ ...p, id: `default-${i}`, isSaved: false }))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getUserFirstName = () => {
    if (!user) return ''
    const fullName = user.user_metadata?.full_name || user.email || ''
    return fullName.split(' ')[0].split('@')[0]
  }

  // Header Component
  const Header = () => (
    <header className="glass border-b border-slate-700/50 px-4 py-3 flex items-center justify-between relative">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black text-white tracking-tighter">
          IN<span className="text-amber-400 text-shadow-amber drop-shadow-lg">O</span>KA
        </h1>
        <span className="text-slate-500 text-xs hidden sm:block">Springfield, IL</span>
      </div>
      
      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="text-slate-400 text-sm hidden sm:block">
              Hi, {getUserFirstName()}
            </span>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 glass hover:bg-slate-700/50 rounded-full flex items-center justify-center border border-slate-700 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => setScreen('auth')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-full text-sm font-bold text-white transition-colors shadow-lg shadow-amber-500/20"
          >
            Sign In
          </button>
        )}
      </div>
      
      {showMenu && user && (
        <div className="absolute top-16 right-4 glass border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[200px] animate-slide-down">
          <div className="p-4 border-b border-slate-700">
            <p className="text-white font-medium">{user.user_metadata?.full_name || 'User'}</p>
            <p className="text-slate-400 text-sm truncate">{user.email}</p>
          </div>
          <nav className="py-2">
            <a href="/payment-methods" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors">
              <span>💳</span><span>Payment Methods</span>
            </a>
            <a href="/driver" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors">
              <span>🚗</span><span>Drive with Inoka</span>
            </a>
            <a href="/terms" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors">
              <span>📄</span><span>Terms of Service</span>
            </a>
            <a href="/privacy" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 transition-colors">
              <span>🔒</span><span>Privacy Policy</span>
            </a>
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors">
              <span>🚪</span><span>Sign Out</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  )

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) setShowMenu(false)
    }
    if (showMenu) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 100)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMenu])

  // Auth Screen
  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2">
              IN<span className="text-amber-400">O</span>KA
            </h1>
            <p className="text-slate-400">The Real Ones</p>
          </div>
          
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
            <div className="flex gap-1 mb-6 bg-slate-700/50 rounded-lg p-1">
              <button onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess(''); }} className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${authMode === 'signin' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
              <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess(''); }} className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${authMode === 'signup' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>Sign Up</button>
              <button onClick={() => { setAuthMode('magic-link'); setAuthError(''); setAuthSuccess(''); }} className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${authMode === 'magic-link' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>Email Link</button>
            </div>
            
            {authMode === 'signup' && (
              <input type="text" placeholder="Full Name" value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500" />
            )}
            
            <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500" />
            
            {(authMode === 'signin' || authMode === 'signup') && (
              <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
            )}
            
            {authMode === 'magic-link' && (
              <p className="text-slate-400 text-sm mb-4">We'll send you a sign-in link. No password needed!</p>
            )}
            
            {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
            {authSuccess && <p className="text-green-400 text-sm mb-4">{authSuccess}</p>}
            
            <button onClick={authMode === 'signin' ? handleSignIn : authMode === 'signup' ? handleSignUp : handleMagicLink} disabled={authLoading} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50">
              {authLoading ? 'Loading...' : authMode === 'signin' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Magic Link'}
            </button>
            
            {authMode === 'signin' && (
              <button onClick={() => { setScreen('forgot-password'); setAuthError(''); }} className="w-full mt-3 text-amber-400 hover:text-amber-300 text-sm transition-colors">Forgot your password?</button>
            )}
            
            {authMode === 'signup' && (
              <p className="text-slate-500 text-xs text-center mt-4">
                By creating an account, you agree to our <a href="/terms" className="text-amber-400 hover:underline">Terms of Service</a> and <a href="/privacy" className="text-amber-400 hover:underline">Privacy Policy</a>
              </p>
            )}
          </div>
          
          <button onClick={() => setScreen('home')} className="mt-6 text-slate-400 hover:text-white transition-colors">Continue without account</button>
        </div>
      </div>
    )
  }

  // Forgot Password Screen
  if (screen === 'forgot-password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2">IN<span className="text-amber-400">O</span>KA</h1>
            <p className="text-slate-400">Reset Password</p>
          </div>
          
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🔑</span></div>
              <h2 className="text-xl font-semibold text-white mb-2">Forgot Password?</h2>
              <p className="text-slate-400 text-sm">Enter your email and we'll send you a link to reset your password.</p>
            </div>
            
            <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
            
            {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
            
            <button onClick={handlePasswordReset} disabled={authLoading || !authEmail} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50">{authLoading ? 'Sending...' : 'Send Reset Link'}</button>
            
            <button onClick={() => { setScreen('auth'); setAuthError(''); }} className="w-full mt-4 text-slate-400 hover:text-white transition-colors text-sm">← Back to Sign In</button>
          </div>
        </div>
      </div>
    )
  }

  // Magic Link Sent Screen
  if (screen === 'magic-link-sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✉️</span></div>
            <h2 className="text-2xl font-bold text-white mb-2">Check Your Email!</h2>
            <p className="text-slate-400 mb-6">We sent a sign-in link to<br /><span className="text-amber-400 font-medium">{authEmail}</span></p>
            <p className="text-slate-500 text-sm mb-6">Click the link in the email to sign in. The link will expire in 1 hour.</p>
            <button onClick={() => { setScreen('auth'); setAuthMode('magic-link'); }} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all">← Back</button>
          </div>
        </div>
      </div>
    )
  }

  // Reset Sent Screen
  if (screen === 'reset-sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✓</span></div>
            <h2 className="text-2xl font-bold text-white mb-2">Reset Link Sent!</h2>
            <p className="text-slate-400 mb-6">We sent a password reset link to<br /><span className="text-amber-400 font-medium">{authEmail}</span></p>
            <p className="text-slate-500 text-sm mb-6">Click the link in the email to reset your password. The link will expire in 1 hour.</p>
            <button onClick={() => { setScreen('auth'); setAuthMode('signin'); }} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">Back to Sign In</button>
          </div>
        </div>
      </div>
    )
  }

  // Payment Required Screen
  if (screen === 'payment-required') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6"><span className="text-4xl">💳</span></div>
          <h2 className="text-2xl font-bold text-white mb-2">Add Payment Method</h2>
          <p className="text-slate-400 text-center mb-8">A payment method is required to request rides</p>
          <a href="/payment-methods" className="w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-600 text-white text-center font-semibold rounded-xl transition-all block">Add Payment Method</a>
          <button onClick={() => setScreen('request')} className="mt-4 text-slate-400 hover:text-white transition-colors">← Back</button>
        </div>
      </div>
    )
  }

  // Add Place Screen
  if (screen === 'add-place') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="p-4 flex items-center gap-4 border-b border-slate-800">
          <button onClick={() => setScreen('home')} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">←</button>
          <h2 className="text-lg font-semibold text-white">Save Place</h2>
        </div>
        
        <div className="flex-1 p-4">
          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <p className="text-slate-400 text-sm mb-1">Location</p>
            <p className="text-white">{destination?.address || 'No location selected'}</p>
          </div>
          
          <div className="mb-4">
            <label className="text-slate-400 text-sm mb-2 block">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {['🏠', '💼', '🏋️', '🛒', '🏥', '📍', '⭐', '❤️'].map(icon => (
                <button key={icon} onClick={() => setNewPlaceIcon(icon)} className={`w-12 h-12 rounded-xl text-2xl transition-all ${newPlaceIcon === icon ? 'bg-amber-500' : 'bg-slate-800 hover:bg-slate-700'}`}>{icon}</button>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="text-slate-400 text-sm mb-2 block">Label</label>
            <input type="text" placeholder="e.g., Home, Work, Gym" value={newPlaceLabel} onChange={(e) => setNewPlaceLabel(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
          </div>
          
          <button onClick={handleSavePlace} disabled={!newPlaceLabel || !destination} className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">Save Place</button>
        </div>
      </div>
    )
  }

  // Choose Location Screen (multiple search results)
  if (screen === 'choose-location') {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
        <div className="p-4 flex items-center gap-4 border-b border-slate-800">
          <button onClick={() => { setScreen('home'); setSearchResults([]); }} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">←</button>
          <div>
            <h2 className="text-lg font-semibold text-white">Choose Location</h2>
            <p className="text-slate-400 text-sm">Multiple results for "{destinationInput}"</p>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto bg-slate-900">
          <p className="text-amber-400 mb-4">Found {searchResults.length} locations:</p>
          <div className="space-y-3">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectLocation(result)}
                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-all border border-slate-700 hover:border-amber-500"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-amber-400">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {result.name && (
                      <p className="text-white font-semibold truncate">{result.name}</p>
                    )}
                    <p className="text-slate-400 text-sm leading-relaxed">{result.formatted_address}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {searchResults.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No locations found. Try a different search.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // In-Ride Screen
  if (screen === 'in-ride') {
    return (
      <div className="h-screen flex flex-col bg-slate-900">
        <Header />
        <div ref={mapRef} className="flex-1 relative">
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-amber-500 text-white px-4 py-2 rounded-full text-center font-medium">🚗 Ride in Progress</div>
          </div>
        </div>
        
        <div className="bg-slate-800 p-6 rounded-t-3xl border-t border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-2xl">{driverInfo.photo}</div>
              <div>
                <p className="text-white font-semibold">{driverInfo.name}</p>
                <p className="text-slate-400 text-sm">{driverInfo.car}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-400">{formatTime(rideTimer)}</p>
              <p className="text-slate-400 text-sm">Ride Time</p>
            </div>
          </div>
          
          <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <div>
                <p className="text-slate-400 text-xs">HEADING TO</p>
                <p className="text-white text-sm">{destination?.address}</p>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-slate-400 text-sm">Estimated Fare</p>
            <p className="text-2xl font-bold text-white">${rideFare.toFixed(2)}</p>
          </div>
        </div>
      </div>
    )
  }

  // Ride Complete Screen
  if (screen === 'complete') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 animate-pulse-ring">
            <span className="text-5xl">✓</span>
          </div>
          
          <h2 className="text-3xl font-black text-white mb-2">Ride Complete!</h2>
          <p className="text-slate-400 mb-8">Thanks for riding with Inoka</p>
          
          <div className="w-full max-w-sm glass rounded-2xl p-6 mb-6">
            {/* Large fare display */}
            <div className="text-center mb-6">
              <p className="text-slate-400 text-sm mb-1">Ride Fare</p>
              <p className="text-5xl font-black text-amber-400 text-shadow-amber">${rideFare.toFixed(2)}</p>
            </div>
            
            <div className="border-t border-slate-700 pt-4 mb-4">
              <p className="text-slate-400 text-sm mb-3">Add a tip for {driverInfo.name}</p>
              <div className="flex gap-2">
                {[0, 2, 5, 10].map(tip => (
                  <button key={tip} onClick={() => handleAddTip(tip)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${tipAmount === tip ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {tip === 0 ? 'None' : `$${tip}`}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <span className="text-white font-semibold">Total</span>
              <span className="text-amber-400 font-black text-2xl">${(rideFare + tipAmount).toFixed(2)}</span>
            </div>
          </div>
          
          <button onClick={handleFinishRide} className="w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">
            Done
          </button>
        </div>
      </div>
    )
  }

  // Main App
  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <Header />
      
      <div ref={mapRef} className="flex-1 relative">
        {!pickup && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Finding your location...</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass border-t border-slate-700/50 rounded-t-3xl">
        {screen === 'home' && (
          <div className="p-4">
            <div className="mb-4">
              <p className="text-slate-400 text-sm mb-2">Where are you going?</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter destination"
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearchDestination()
                      }
                    }}
                    className="w-full px-4 py-3 pr-10 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                  {destinationInput && (
                    <button 
                      onClick={() => { 
                        setDestinationInput('')
                        setDestination(null)
                        setSearchResults([])
                        setSearchError('')
                      }} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    console.log('Button clicked!')
                    handleSearchDestination()
                  }}
                  disabled={isSearching}
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition-all"
                >
                  {isSearching ? '...' : '→'}
                </button>
              </div>
            </div>
            
            {/* Search Error Display */}
            {searchError && (
              <div className="mb-4 bg-red-900/30 border border-red-800 text-red-300 rounded-xl p-3 text-sm">
                ⚠️ {searchError}
              </div>
            )}
            
            {/* Inline Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-4 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <p className="text-white font-semibold">Choose a destination ({searchResults.length})</p>
                  <button
                    onClick={() => setSearchResults([])}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    Clear
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-4 py-4 hover:bg-slate-700/60 transition-colors border-b border-slate-700/50 last:border-b-0"
                    >
                      <p className="text-white font-medium truncate">{r.name || 'Location'}</p>
                      <p className="text-slate-400 text-sm leading-snug truncate">{r.formatted_address}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Saved Places - only show when no search results */}
            {searchResults.length === 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {getDisplayPlaces().map((item, index) => (
                  <button
                    key={`place-${index}`}
                    className="flex-shrink-0 py-3 px-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm font-medium text-slate-300 flex items-center gap-2 transition-all"
                    onClick={() => {
                      setDestination({ address: item.address, lat: item.lat, lng: item.lng })
                      setDestinationInput(item.address)
                      setSearchResults([])
                      setSearchError('')
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                {user && (
                  <button onClick={() => destination && setScreen('add-place')} className="flex-shrink-0 py-3 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-xl text-sm font-medium text-amber-400 flex items-center gap-2 transition-all">
                    <span>➕</span><span>Add</span>
                  </button>
                )}
              </div>
            )}
            
            {destination && (
              <button onClick={() => setScreen('request')} className="w-full mt-4 py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">Continue</button>
            )}
          </div>
        )}

        {screen === 'request' && (
          <div className="p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setScreen('home')} className="text-slate-400 hover:text-white">← Back</button>
              <p className="text-white font-medium">Choose a ride</p>
              <div className="w-12"></div>
            </div>

            {paymentMethods.length > 0 && (
              <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>💳</span>
                  <span className="text-white text-sm">{paymentMethods[0].brand} •••• {paymentMethods[0].last4}</span>
                </div>
                <a href="/payment-methods" className="text-amber-400 text-sm">Change</a>
              </div>
            )}
            
            {/* Ride Options */}
            <div className="space-y-3 mb-4 max-h-56 overflow-y-auto hide-scrollbar">
              {RIDE_OPTIONS.map(option => (
                <button key={option.id} onClick={() => setSelectedRide(option.id)} className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedRide === option.id ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-700/50 hover:border-slate-600'}`}>
                  <div className="text-3xl">{option.icon}</div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">{option.name}</p>
                    <p className="text-slate-400 text-sm">{option.description} • {option.eta} min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">${calculatePrice(estimatedDistance, option.multiplier)}</p>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Ride Preferences */}
            <div className="glass rounded-xl p-4 mb-4 space-y-3">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Ride Preferences</p>
              
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🤫</span>
                  <span className="text-white text-sm">Quiet ride preferred</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={quietRide} 
                  onChange={(e) => setQuietRide(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🐕</span>
                  <span className="text-white text-sm">Pet-friendly</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={petFriendly} 
                  onChange={(e) => setPetFriendly(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">👶</span>
                  <span className="text-white text-sm">Car seat needed</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={carSeatNeeded} 
                  onChange={(e) => setCarSeatNeeded(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                />
              </label>
            </div>
            
            {/* Schedule Ride */}
            <div className="glass rounded-xl p-4 mb-4">
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📅</span>
                  <span className="text-white text-sm">Schedule for later</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={isScheduled} 
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                />
              </label>
              
              {isScheduled && (
                <input 
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-xl border border-slate-600 focus:border-amber-500 focus:outline-none"
                />
              )}
            </div>
            
            <button onClick={handleRequestRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">
              {isScheduled ? 'Schedule Inoka' : 'Request Inoka'}
            </button>
          </div>
        )}

        {screen === 'searching' && (
          <div className="p-6 text-center animate-slide-up">
            {/* Animated Driver Search */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              {/* Outer pulse rings */}
              <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 border-4 border-amber-500/30 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
              
              {/* Center spinner */}
              <div className="absolute inset-4 border-4 border-slate-700 rounded-full"></div>
              <div className="absolute inset-4 border-4 border-amber-500 rounded-full animate-spin" style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }}></div>
              
              {/* Car icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl animate-float">🚗</span>
              </div>
            </div>
            
            {/* Animated fake driver dots */}
            <div className="relative h-16 mb-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-8 h-8 bg-amber-500/60 rounded-full flex items-center justify-center text-sm animate-pulse"
                  style={{
                    left: `${15 + i * 18}%`,
                    top: `${Math.sin(i) * 20 + 20}%`,
                    animationDelay: `${i * 0.3}s`
                  }}
                >
                  🚗
                </div>
              ))}
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">Finding the perfect driver...</h3>
            <p className="text-slate-400 mb-1">Payment authorized: <span className="text-amber-400 font-semibold">${rideFare.toFixed(2)}</span></p>
            
            {/* Preferences reminder */}
            <div className="flex justify-center gap-2 mb-4 text-slate-500 text-sm">
              {quietRide && <span>🤫</span>}
              {petFriendly && <span>🐕</span>}
              {carSeatNeeded && <span>👶</span>}
            </div>
            
            <div className="w-full bg-slate-700 rounded-full h-2 mb-6">
              <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all duration-300" style={{ width: `${searchProgress}%` }}></div>
            </div>
            
            <button onClick={() => { if (currentRideId) cancelRide(currentRideId); setScreen('home'); }} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors">
              Cancel Request
            </button>
          </div>
        )}

        {screen === 'found' && (
          <div className="p-4">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>Driver on the way
              </div>
            </div>
            
            <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center text-3xl">{driverInfo.photo}</div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">{driverInfo.name}</p>
                  <div className="flex items-center gap-1 text-amber-400"><span>⭐</span><span>{driverInfo.rating}</span></div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">{driverInfo.eta}</p>
                  <p className="text-slate-400 text-sm">min</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-600">
                <p className="text-slate-400 text-sm">{driverInfo.car}</p>
                <p className="text-white font-mono text-lg">{driverInfo.plate}</p>
              </div>
            </div>
            
            <div className="flex gap-3 mb-4">
              <button className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"><span>📞</span> Call</button>
              <button className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"><span>💬</span> Message</button>
            </div>
            
            <button onClick={handleStartRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">Start Ride</button>
          </div>
        )}
      </div>
    </div>
  )
}
