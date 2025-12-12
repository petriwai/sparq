'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, createRideRequest, cancelRide } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import confetti from 'canvas-confetti'

// --- TYPES ---
type Screen = 'home' | 'request' | 'searching' | 'found' | 'in-ride' | 'complete' | 'auth' | 'add-place' | 'payment-required' | 'forgot-password' | 'magic-link-sent' | 'reset-sent'

type SearchResult = { lat: number; lng: number; formatted_address: string; name?: string }
type RideOption = { id: string; name: string; icon: string; description: string; multiplier: number; eta: string }
type SavedPlace = { id: string; label: string; icon: string; address: string; lat: number; lng: number }
type PaymentMethod = { id: string; brand: string; last4: string; exp_month: number; exp_year: number }

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

// Ultra-clean dark map style - hides POIs and clutter
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
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
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0)
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
  const [quietRide, setQuietRide] = useState(false)
  const [petFriendly, setPetFriendly] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [liveETA, setLiveETA] = useState<string>('')
  const [loadingPlaces, setLoadingPlaces] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const userMarkerRef = useRef<google.maps.Circle | null>(null)
  const destMarkerRef = useRef<google.maps.Circle | null>(null)
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const routePathRef = useRef<google.maps.LatLng[]>([])
  const carMarkerRef = useRef<google.maps.Marker | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [driverInfo] = useState({ name: 'Marcus T.', rating: 4.9, car: 'White Toyota Camry', plate: 'IL-7829', photo: '👨‍✈️', eta: 3 })

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { 
        loadSavedPlaces(session.user.id)
        loadPaymentMethods(session.user.id) 
      } else {
        setLoadingPlaces(false)
        setLoadingPayments(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { 
        loadSavedPlaces(session.user.id)
        loadPaymentMethods(session.user.id)
      } else {
        setLoadingPlaces(false)
        setLoadingPayments(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadSavedPlaces = async (userId: string) => {
    setLoadingPlaces(true)
    try {
      const { data } = await supabase.from('saved_places').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (data) setSavedPlaces(data)
    } finally {
      setLoadingPlaces(false)
    }
  }

  const loadPaymentMethods = async (userId: string) => {
    setLoadingPayments(true)
    try {
      const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).single()
      if (profile?.stripe_customer_id) {
        setStripeCustomerId(profile.stripe_customer_id)
        const methods = await stripeApi('get-payment-methods', { customerId: profile.stripe_customer_id })
        if (methods?.length > 0) { setPaymentMethods(methods); setSelectedPaymentMethod(methods[0].id) }
      }
    } catch (err) { 
      console.error('Error loading payment methods:', err) 
    } finally {
      setLoadingPayments(false)
    }
  }

  const stripeApi = async (action: string, data: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const response = await fetch('/api/stripe', { method: 'POST', headers, body: JSON.stringify({ action, ...data }) })
      const result = await response.json()
      if (!response.ok) {
        console.error('Stripe API error:', result)
        return { error: result.error || result.details || 'API request failed', code: response.status }
      }
      return result
    } catch (err) { 
      console.error('Stripe API error:', err)
      return { error: 'Network error - please check your connection' }
    }
  }

  // Geolocation
  useEffect(() => {
    const defaultLocation = { address: 'Springfield, IL', lat: 39.7817, lng: -89.6501 }
    const fallbackTimeout = setTimeout(() => { if (!pickup) setPickup(defaultLocation) }, 5000)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(fallbackTimeout)
          const { latitude, longitude } = position.coords
          setPickup({ address: 'Getting address...', lat: latitude, lng: longitude })
          try {
            const address = await reverseGeocode(latitude, longitude)
            setPickup({ address, lat: latitude, lng: longitude })
          } catch { setPickup({ address: 'Current Location', lat: latitude, lng: longitude }) }
        },
        () => { clearTimeout(fallbackTimeout); setPickup(defaultLocation) },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
      )
    } else { clearTimeout(fallbackTimeout); setPickup(defaultLocation) }
    return () => clearTimeout(fallbackTimeout)
  }, [])

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }) })
      const data = await response.json()
      return data.success && data.address ? data.address : 'Current Location'
    } catch { return 'Current Location' }
  }

  const geocodeAddress = async (address: string): Promise<{ single?: SearchResult; multiple?: SearchResult[]; error?: string } | null> => {
    try {
      setSearchError('')
      const response = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, userLat: pickup?.lat, userLng: pickup?.lng }) })
      const data = await response.json()
      if (!data.success) return { error: data.message || data.details?.places_error_message || 'Search failed' }
      if (data.multiple && data.results) return { multiple: data.results }
      return { single: { lat: data.lat, lng: data.lng, formatted_address: data.formatted_address, name: data.name } }
    } catch { return { error: 'Search request failed' } }
  }

  // Map initialization
  useEffect(() => {
    if (!mapRef.current || !pickup) return
    if (screen === 'auth' || screen === 'add-place' || screen === 'forgot-password' || screen === 'magic-link-sent' || screen === 'reset-sent') return

    const initMap = () => {
      // Check that Maps is fully loaded (Map constructor exists)
      if (typeof google === 'undefined' || !google.maps?.Map || !mapRef.current || mapInstanceRef.current) return

      try {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: pickup.lat, lng: pickup.lng },
          zoom: 15,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
          clickableIcons: false,
          styles: MAP_STYLES,
        })
        mapInstanceRef.current = map

        directionsServiceRef.current = new google.maps.DirectionsService()
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#F59E0B', strokeWeight: 6, strokeOpacity: 0.9 },
        })

        // User location marker
        userMarkerRef.current = new google.maps.Circle({
          map, center: { lat: pickup.lat, lng: pickup.lng }, radius: 12,
          fillColor: '#F59E0B', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3, zIndex: 999,
        })
        new google.maps.Circle({
          map, center: { lat: pickup.lat, lng: pickup.lng }, radius: 40,
          fillColor: '#F59E0B', fillOpacity: 0.15, strokeColor: '#F59E0B', strokeWeight: 1, strokeOpacity: 0.3, zIndex: 998,
        })
      } catch (err) {
        console.error('Map initialization error:', err)
        setMapError('Failed to initialize map. Please refresh the page.')
      }
    }

    // Check if Google Maps is ready using the callback flag
    const isGoogleMapsReady = () => {
      return (
        typeof google !== 'undefined' && 
        typeof google.maps?.Map === 'function' && 
        (window as any).googleMapsReady === true
      )
    }

    if (isGoogleMapsReady()) {
      initMap()
    } else {
      let attempts = 0
      const maxAttempts = 150 // 15 seconds max
      const check = setInterval(() => { 
        attempts++
        if (isGoogleMapsReady()) { 
          clearInterval(check)
          initMap() 
        } else if (attempts >= maxAttempts) {
          clearInterval(check)
          setMapError('Google Maps failed to load. Please check your internet connection and try again.')
        }
      }, 100)
      return () => clearInterval(check)
    }
  }, [pickup, screen])

  // Real road routing
  useEffect(() => {
    const map = mapInstanceRef.current
    const svc = directionsServiceRef.current
    const rdr = directionsRendererRef.current
    if (!map || !svc || !rdr || !pickup || !destination) {
      if (rdr) rdr.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult)
      if (destMarkerRef.current) { destMarkerRef.current.setMap(null); destMarkerRef.current = null }
      routePathRef.current = []
      return
    }

    if (destMarkerRef.current) destMarkerRef.current.setMap(null)
    destMarkerRef.current = new google.maps.Circle({
      map, center: { lat: destination.lat, lng: destination.lng }, radius: 25,
      fillColor: '#EF4444', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3, zIndex: 999,
    })

    svc.route(
      { origin: { lat: pickup.lat, lng: pickup.lng }, destination: { lat: destination.lat, lng: destination.lng }, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status !== 'OK' || !result) return
        rdr.setDirections(result)
        const path: google.maps.LatLng[] = []
        result.routes[0].legs.forEach(leg => { leg.steps.forEach(step => { step.path.forEach(point => path.push(point)) }) })
        routePathRef.current = path
        const leg = result.routes[0].legs[0]
        if (leg?.distance?.value) setEstimatedDistance(leg.distance.value / 1609.34)
        if (leg?.duration?.value) setEstimatedDuration(Math.ceil(leg.duration.value / 60))
        const bounds = result.routes[0].bounds
        if (bounds) map.fitBounds(bounds, { top: 140, bottom: 320, left: 40, right: 40 })
      }
    )
  }, [destination, pickup])

  const handleSearchDestination = async () => {
    if (!destinationInput.trim()) return
    setIsSearching(true); setSearchResults([]); setSearchError('')
    const result = await geocodeAddress(destinationInput)
    setIsSearching(false)
    if (!result) { setSearchError('No results found.'); return }
    if (result.error) { setSearchError(result.error); return }
    if (result.multiple?.length) { setSearchResults(result.multiple); return }
    if (result.single) {
      const displayAddress = result.single.name ? `${result.single.name}, ${result.single.formatted_address}` : result.single.formatted_address
      setDestination({ address: displayAddress, lat: result.single.lat, lng: result.single.lng })
      setDestinationInput(displayAddress)
      setSearchResults([])
    }
  }

  const handleSelectLocation = (result: SearchResult) => {
    const displayAddress = result.name ? `${result.name}, ${result.formatted_address}` : result.formatted_address
    setDestination({ address: displayAddress, lat: result.lat, lng: result.lng })
    setDestinationInput(displayAddress)
    setSearchResults([])
  }

  const calculatePrice = (distance: number, multiplier: number) => {
    const price = 3.50 + (distance * 2.25 * multiplier)
    return Math.max(price, 5).toFixed(2)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getUserFirstName = () => (user?.user_metadata?.full_name || user?.email || '').split(' ')[0].split('@')[0]
  const getDisplayPlaces = () => savedPlaces.length > 0 ? savedPlaces : DEFAULT_PLACES

  const handleRequestRide = async () => {
    if (!user) { setScreen('auth'); return }
    if (!selectedPaymentMethod || paymentMethods.length === 0) { setScreen('payment-required'); return }
    if (!destination || !pickup) return
    
    const selectedOption = RIDE_OPTIONS.find(r => r.id === selectedRide)
    const fare = parseFloat(calculatePrice(estimatedDistance, selectedOption?.multiplier || 1))
    setRideFare(fare)
    
    // Convert scheduled time to ISO format if scheduled
    const scheduledForIso = isScheduled && scheduledTime ? new Date(scheduledTime).toISOString() : null
    
    // Create ride with all preferences
    const ride = await createRideRequest({
      rider_id: user.id,
      pickup_address: pickup.address,
      dropoff_address: destination.address,
      ride_type: selectedRide,
      estimated_fare: fare,
      status: isScheduled ? 'scheduled' : 'requested',
      scheduled_for: scheduledForIso,
      is_scheduled: isScheduled,
      quiet_ride: quietRide,
      pet_friendly: petFriendly,
    })
    
    setCurrentRideId(ride.id)
    
    // Don't charge for scheduled rides yet - charge at dispatch time
    if (isScheduled) {
      setScreen('home')
      setDestination(null)
      setDestinationInput('')
      // TODO: Show "Ride Scheduled" confirmation toast
      return
    }
    
    const result = await stripeApi('create-payment-intent', { customerId: stripeCustomerId, amount: fare, rideId: ride.id, paymentMethodId: selectedPaymentMethod })
    
    if (result?.error) {
      setAuthError(result.error)
      return
    }
    
    if (result?.status === 'requires_capture' || result?.status === 'succeeded') { 
      setScreen('searching')
      simulateDriverSearch() 
    } else {
      setAuthError('Payment authorization failed. Please try again.')
    }
  }

  const simulateDriverSearch = () => {
    setSearchProgress(0)
    const interval = setInterval(() => {
      setSearchProgress(prev => { if (prev >= 100) { clearInterval(interval); setScreen('found'); return 100 }; return prev + 2 })
    }, 100)
  }

  const playArrivalSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
    } catch { }
  }

  const triggerConfetti = () => {
    const defaults = { origin: { y: 0.6 }, zIndex: 9999, colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff', '#fef3c7'] }
    confetti({ ...defaults, spread: 26, startVelocity: 55, particleCount: 50 })
    confetti({ ...defaults, spread: 60, particleCount: 40 })
    confetti({ ...defaults, spread: 100, decay: 0.91, scalar: 0.8, particleCount: 70 })
    confetti({ ...defaults, spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, particleCount: 20 })
    confetti({ ...defaults, spread: 120, startVelocity: 45, particleCount: 20 })
  }

  const handleStartRide = () => {
    setRideTimer(0); setScreen('in-ride'); setLiveETA('')
    setTimeout(() => {
      if (routePathRef.current.length < 2 || !mapInstanceRef.current) return
      if (carMarkerRef.current) carMarkerRef.current.setMap(null)

      const carMarker = new google.maps.Marker({
        map: mapInstanceRef.current, position: routePathRef.current[0], zIndex: 10000,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: '#F59E0B', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 4 }
      })
      carMarkerRef.current = carMarker

      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current)
      hapticIntervalRef.current = setInterval(() => { if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]) }, 10000)
      if ('vibrate' in navigator) navigator.vibrate(50)

      const totalPoints = routePathRef.current.length
      const rideDurationSeconds = 45
      const startTime = Date.now()

      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000
        const progress = Math.min(elapsed / rideDurationSeconds, 1)
        const i = Math.min(Math.floor(progress * totalPoints), totalPoints - 1)

        if (i >= totalPoints - 1 || progress >= 1) {
          setLiveETA('Arrived!')
          playArrivalSound()
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 200])
          if (hapticIntervalRef.current) { clearInterval(hapticIntervalRef.current); hapticIntervalRef.current = null }
          setTimeout(triggerConfetti, 300)
          return
        }

        carMarker.setPosition(routePathRef.current[i])
        if (i < totalPoints - 5 && window.google?.maps?.geometry) {
          const heading = google.maps.geometry.spherical.computeHeading(routePathRef.current[i], routePathRef.current[Math.min(i + 5, totalPoints - 1)])
          carMarker.setIcon({ path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 8, fillColor: '#F59E0B', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3, rotation: heading })
        }

        const remainingSeconds = Math.max(0, Math.ceil(rideDurationSeconds - elapsed))
        const mins = Math.floor(remainingSeconds / 60)
        const secs = remainingSeconds % 60
        setLiveETA(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
        setRideTimer(Math.floor(elapsed))
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }, 800)
  }

  useEffect(() => { return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current) } }, [])
  useEffect(() => { if (screen !== 'in-ride' && hapticIntervalRef.current) { clearInterval(hapticIntervalRef.current); hapticIntervalRef.current = null } }, [screen])

  const handleCompleteRide = async () => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null }
    if (hapticIntervalRef.current) { clearInterval(hapticIntervalRef.current); hapticIntervalRef.current = null }
    setScreen('complete'); triggerConfetti()
    if (currentRideId && stripeCustomerId) await stripeApi('capture-payment', { rideId: currentRideId })
  }

  const handleAddTip = async (tip: number) => {
    setTipAmount(tip)
    if (tip > 0 && currentRideId && selectedPaymentMethod) await stripeApi('charge-tip', { customerId: stripeCustomerId, amount: tip, paymentMethodId: selectedPaymentMethod })
  }

  const handleFinishRide = () => {
    setScreen('home'); setDestination(null); setDestinationInput(''); setCurrentRideId(null); setTipAmount(0); setRideTimer(0); setLiveETA('')
    setQuietRide(false); setPetFriendly(false); setCarSeatNeeded(false); setIsScheduled(false); setScheduledTime('')
    if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult)
    if (carMarkerRef.current) { carMarkerRef.current.setMap(null); carMarkerRef.current = null }
    if (destMarkerRef.current) { destMarkerRef.current.setMap(null); destMarkerRef.current = null }
    routePathRef.current = []
  }

  const handleSignIn = async () => { setAuthLoading(true); setAuthError(''); const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); if (error) setAuthError(error.message); else { setScreen('home'); setAuthEmail(''); setAuthPassword('') }; setAuthLoading(false) }
  const handleSignUp = async () => { setAuthLoading(true); setAuthError(''); const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } }); if (error) setAuthError(error.message); else setAuthSuccess('Check your email!'); setAuthLoading(false) }
  const handleMagicLink = async () => { setAuthLoading(true); setAuthError(''); const { error } = await supabase.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: `${window.location.origin}/` } }); if (error) setAuthError(error.message); else setScreen('magic-link-sent'); setAuthLoading(false) }
  const handleForgotPassword = async () => { setAuthLoading(true); setAuthError(''); const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: `${window.location.origin}/reset-password` }); if (error) setAuthError(error.message); else setScreen('reset-sent'); setAuthLoading(false) }

  const handleSavePlace = async () => {
    if (!user || !destination || !newPlaceLabel.trim()) return
    await supabase.from('saved_places').insert({ user_id: user.id, label: newPlaceLabel, icon: newPlaceIcon, address: destination.address, lat: destination.lat, lng: destination.lng })
    loadSavedPlaces(user.id); setNewPlaceLabel(''); setNewPlaceIcon('📍'); setScreen('home')
  }

  const Header = () => (
    <header className="absolute top-0 left-0 right-0 z-30 pt-safe px-5 pt-6 pb-4 flex items-center justify-between">
      {/* VIGNETTE GRADIENT FOR LEGIBILITY - taller gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/80 to-transparent pointer-events-none h-40 -z-10"></div>
      
      <div className="flex items-center gap-4">
        <h1 className="text-4xl font-black text-white tracking-tighter text-shadow-sm">IN<span className="text-amber-400 drop-shadow-lg" style={{ textShadow: '0 0 25px rgba(245, 158, 11, 0.6)' }}>O</span>KA</h1>
        <div className="hidden sm:flex flex-col">
          <span className="text-slate-200 text-sm font-semibold text-shadow-sm">Springfield, IL</span>
          <span className="text-slate-400 text-xs">The Real Ones</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-slate-200 text-sm font-medium text-shadow-sm">Hi, {getUserFirstName()}</span>
              <span className="text-slate-400 text-xs">Welcome back</span>
            </div>
            <button onClick={() => setShowMenu(!showMenu)} className="w-12 h-12 glass hover:bg-slate-800/60 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-md shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </>
        ) : (
          <button onClick={() => setScreen('auth')} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 rounded-full text-sm font-bold text-white shadow-lg shadow-amber-500/30">Sign In</button>
        )}
      </div>
      {showMenu && user && (
        <div className="absolute top-24 right-4 glass-card rounded-2xl z-50 overflow-hidden min-w-[240px] animate-slide-down">
          <div className="p-4 border-b border-slate-700/50"><p className="text-white font-semibold">{user.user_metadata?.full_name || 'User'}</p><p className="text-slate-400 text-sm truncate">{user.email}</p></div>
          <nav className="py-2">
            <a href="/payment-methods" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors"><span>💳</span><span>Payment Methods</span></a>
            <a href="/driver" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors"><span>🚗</span><span>Drive with Inoka</span></a>
            <a href="/terms" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 transition-colors"><span>📄</span><span>Terms of Service</span></a>
            <button onClick={async () => { await supabase.auth.signOut(); setUser(null); setShowMenu(false) }} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700/50 w-full text-left transition-colors"><span>🚪</span><span>Sign Out</span></button>
          </nav>
        </div>
      )}
    </header>
  )

  if (screen === 'auth') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/30 flex flex-col p-6">
      <button onClick={() => setScreen('home')} className="self-start text-slate-400 hover:text-white mb-8">← Back</button>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-8"><h1 className="text-5xl font-black text-white mb-2">IN<span className="text-amber-400">O</span>KA</h1><p className="text-slate-400">The Real Ones</p></div>
        <div className="w-full max-w-sm glass-card rounded-2xl p-6">
          <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-xl p-1">
            <button onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess('') }} className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${authMode === 'signin' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>Sign In</button>
            <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess('') }} className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${authMode === 'signup' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>Sign Up</button>
            <button onClick={() => { setAuthMode('magic-link'); setAuthError(''); setAuthSuccess('') }} className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${authMode === 'magic-link' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>Magic</button>
          </div>
          {authMode === 'signup' && <input type="text" placeholder="Full Name" value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500 transition-colors" />}
          <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500 transition-colors" />
          {authMode !== 'magic-link' && <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500 transition-colors" />}
          {authError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{authError}</p>}
          {authSuccess && <p className="text-green-400 text-sm mb-4 bg-green-500/10 p-3 rounded-lg border border-green-500/20">{authSuccess}</p>}
          <button onClick={authMode === 'signin' ? handleSignIn : authMode === 'signup' ? handleSignUp : handleMagicLink} disabled={authLoading} className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">{authLoading ? 'Loading...' : authMode === 'signin' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Magic Link'}</button>
          {authMode === 'signin' && <button onClick={() => setScreen('forgot-password')} className="mt-4 text-amber-400 hover:text-amber-300 text-sm w-full text-center transition-colors">Forgot password?</button>}
        </div>
      </div>
    </div>
  )

  if (screen === 'forgot-password') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/30 flex flex-col p-6">
      <button onClick={() => setScreen('auth')} className="self-start text-slate-400 hover:text-white mb-8">← Back</button>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm glass-card rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your email to receive a reset link</p>
          <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
          {authError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-3 rounded-lg">{authError}</p>}
          <button onClick={handleForgotPassword} disabled={authLoading} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 shadow-lg shadow-amber-500/20">{authLoading ? 'Sending...' : 'Send Reset Link'}</button>
        </div>
      </div>
    </div>
  )

  if (screen === 'magic-link-sent' || screen === 'reset-sent') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/30 flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30"><span className="text-4xl">✉️</span></div>
      <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
      <p className="text-slate-400 text-center mb-8">We've sent a {screen === 'magic-link-sent' ? 'magic link' : 'reset link'} to {authEmail}</p>
      <button onClick={() => setScreen('auth')} className="text-amber-400 hover:text-amber-300 font-medium">Back to Sign In</button>
    </div>
  )

  if (screen === 'payment-required') return (
    <div className="min-h-screen bg-slate-900 flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-gradient-to-br from-amber-400/20 to-amber-600/20 rounded-full flex items-center justify-center mb-6 border border-amber-500/30"><span className="text-4xl">💳</span></div>
        <h2 className="text-2xl font-bold text-white mb-2">Payment Method Required</h2>
        <p className="text-slate-400 text-center mb-8">Add a payment method to request rides</p>
        <a href="/payment-methods" className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20">Add Payment Method</a>
        <button onClick={() => setScreen('home')} className="mt-4 text-slate-400 hover:text-white">Back</button>
      </div>
    </div>
  )

  if (screen === 'add-place') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/30 flex flex-col p-6">
      <button onClick={() => setScreen('home')} className="self-start text-slate-400 hover:text-white mb-8">← Back</button>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm glass-card rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Save Place</h2>
          <p className="text-slate-400 text-sm mb-6 truncate">{destination?.address}</p>
          <input type="text" placeholder="Label (e.g., Home, Work)" value={newPlaceLabel} onChange={(e) => setNewPlaceLabel(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
          <div className="flex gap-2 mb-6">{['🏠', '💼', '🏋️', '🛒', '❤️', '📍'].map(icon => (<button key={icon} onClick={() => setNewPlaceIcon(icon)} className={`w-12 h-12 rounded-xl text-xl flex items-center justify-center transition-all ${newPlaceIcon === icon ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-slate-700 hover:bg-slate-600'}`}>{icon}</button>))}</div>
          <button onClick={handleSavePlace} disabled={!newPlaceLabel.trim()} className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 shadow-lg shadow-amber-500/20">Save Place</button>
        </div>
      </div>
    </div>
  )

  if (screen === 'complete') return (
    <div className="min-h-screen bg-slate-900 flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 animate-pulse-ring"><span className="text-5xl">✓</span></div>
        <h2 className="text-3xl font-black text-white mb-2">Ride Complete!</h2>
        <p className="text-slate-400 mb-8">Thanks for riding with Inoka</p>
        <div className="w-full max-w-sm glass-card rounded-2xl p-6 mb-6">
          <div className="text-center mb-6"><p className="text-slate-400 text-sm mb-1">Ride Fare</p><p className="text-5xl font-black text-amber-400" style={{ textShadow: '0 0 30px rgba(245, 158, 11, 0.4)' }}>${rideFare.toFixed(2)}</p></div>
          <div className="border-t border-slate-700/50 pt-4 mb-4">
            <p className="text-slate-400 text-sm mb-3">Add a tip for {driverInfo.name}</p>
            <div className="flex gap-2">{[0, 2, 5, 10].map(tip => (<button key={tip} onClick={() => handleAddTip(tip)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${tipAmount === tip ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{tip === 0 ? 'None' : `$${tip}`}</button>))}</div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-700/50"><span className="text-white font-semibold">Total</span><span className="text-amber-400 font-black text-2xl">${(rideFare + tipAmount).toFixed(2)}</span></div>
        </div>
        <button onClick={handleFinishRide} className="w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">Done</button>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden relative">
      {/* Absolute Header Overlay */}
      <Header />
      
      {/* MAP LAYER - with top padding to account for header */}
      <div ref={mapRef} className="flex-1 relative bg-slate-900 pt-20">
        {!pickup && !mapError && (<div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10"><div className="text-center"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-400">Finding your location...</p></div></div>)}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🗺️</span>
              </div>
              <p className="text-white font-semibold mb-2">Map unavailable</p>
              <p className="text-slate-400 text-sm mb-4">{mapError}</p>
              <button onClick={() => { setMapError(null); window.location.reload() }} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">Retry</button>
            </div>
          </div>
        )}
      </div>
      
      {/* BOTTOM SHEET - taller to show less map */}
      <div className="glass border-t border-slate-700/50 rounded-t-3xl absolute bottom-0 left-0 right-0 z-20 min-h-[45vh] max-h-[85vh] overflow-y-auto">
        <div className="w-full flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-slate-600/50 rounded-full"></div></div>

        {screen === 'home' && (
          <div className="p-5 pb-8">
            <p className="text-slate-400 text-sm mb-3 font-medium ml-1">Where to?</p>
            <div className="relative mb-4 group">
              <input type="text" placeholder="Enter destination" value={destinationInput} onChange={(e) => setDestinationInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchDestination()} className="w-full px-4 py-4 pl-12 pr-24 bg-slate-800/80 border border-slate-600/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:bg-slate-800 text-lg shadow-inner transition-all" />
              <span className="absolute left-4 top-4 text-slate-400 text-xl group-focus-within:text-amber-400 transition-colors">🔍</span>
              {destinationInput && <button onClick={() => { setDestinationInput(''); setDestination(null); setSearchResults([]); setSearchError('') }} className="absolute right-16 top-4 text-slate-400 hover:text-white p-1">✕</button>}
              <button onClick={handleSearchDestination} disabled={isSearching} className="absolute right-2 top-2 bottom-2 w-12 bg-amber-500 hover:bg-amber-600 rounded-xl flex items-center justify-center text-white font-bold text-xl disabled:opacity-50 shadow-lg shadow-amber-500/20 transition-all active:scale-95">{isSearching ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '→'}</button>
            </div>
            {searchError && <div className="mb-4 bg-red-900/30 border border-red-800 text-red-300 rounded-xl p-3 text-sm">⚠️ {searchError}</div>}
            {searchResults.length > 0 && (
              <div className="mb-4 bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800"><p className="text-white font-semibold">Choose destination</p><button onClick={() => setSearchResults([])} className="text-slate-400 hover:text-white text-sm">Clear</button></div>
                <div className="max-h-64 overflow-y-auto">{searchResults.map((r, i) => (<button key={i} onClick={() => handleSelectLocation(r)} className="w-full text-left px-4 py-4 hover:bg-slate-700/60 border-b border-slate-700/50 last:border-b-0 flex items-center gap-3"><span className="text-xl">📍</span><div className="overflow-hidden"><p className="text-white font-medium truncate">{r.name || 'Location'}</p><p className="text-slate-400 text-sm truncate">{r.formatted_address}</p></div></button>))}</div>
              </div>
            )}
            {searchResults.length === 0 && (
              <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
                {user && <button onClick={() => setScreen('add-place')} className="flex-shrink-0 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 font-medium active:scale-95 transition-transform">➕ Add</button>}
                {loadingPlaces ? (
                  // Skeleton loading state
                  <>
                    <div className="flex-shrink-0 w-24 h-12 skeleton rounded-2xl"></div>
                    <div className="flex-shrink-0 w-28 h-12 skeleton rounded-2xl"></div>
                    <div className="flex-shrink-0 w-20 h-12 skeleton rounded-2xl"></div>
                  </>
                ) : (
                  getDisplayPlaces().map((item, index) => (<button key={`place-${index}`} className="flex-shrink-0 px-5 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-2xl text-sm font-medium text-slate-300 flex items-center gap-2 active:scale-95 transition-transform" onClick={() => { setDestination({ address: item.address, lat: item.lat, lng: item.lng }); setDestinationInput(item.address); setSearchResults([]); setSearchError('') }}><span>{item.icon}</span><span>{item.label}</span></button>))
                )}
              </div>
            )}
            {destination && estimatedDistance > 0 && <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl"><div className="flex justify-between items-center text-sm"><span className="text-slate-400">Trip estimate</span><span className="text-white font-medium">{estimatedDistance.toFixed(1)} mi • ~{estimatedDuration || Math.ceil(estimatedDistance * 3)} min</span></div></div>}
            {destination && <button onClick={() => { setAuthError(''); setScreen('request') }} className="w-full mt-4 py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">Choose Ride</button>}
          </div>
        )}

        {screen === 'request' && (
          <div className="p-5 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4"><button onClick={() => setScreen('home')} className="text-slate-400 hover:text-white flex items-center gap-1">← Back</button><p className="text-white font-semibold">Choose a ride</p><div className="w-12"></div></div>
            {paymentMethods.length > 0 && <div className="glass-card rounded-xl p-3 mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span>💳</span><span className="text-white text-sm">{paymentMethods[0].brand} •••• {paymentMethods[0].last4}</span></div><a href="/payment-methods" className="text-amber-400 text-sm font-medium">Change</a></div>}
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto hide-scrollbar">{RIDE_OPTIONS.map(option => (<button key={option.id} onClick={() => setSelectedRide(option.id)} className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${selectedRide === option.id ? 'border-amber-500 bg-amber-500/10 shadow-md shadow-amber-900/20' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50'}`}><div className="text-3xl">{option.icon}</div><div className="flex-1 text-left"><p className="text-white font-semibold">{option.name}</p><p className="text-slate-400 text-sm">{option.description} • {option.eta} min</p></div><div className="text-right"><p className="text-white font-bold text-lg">${calculatePrice(estimatedDistance, option.multiplier)}</p></div></button>))}</div>
            <div className="glass-card rounded-xl p-4 mb-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-3">Preferences</p><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer"><input type="checkbox" checked={quietRide} onChange={(e) => setQuietRide(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" /><span>🤫 Quiet</span></label><label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer"><input type="checkbox" checked={petFriendly} onChange={(e) => setPetFriendly(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" /><span>🐕 Pets</span></label></div></div>
            <div className="glass-card rounded-xl p-4 mb-4"><label className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-2"><span>📅</span><span className="text-white text-sm">Schedule for later</span></div><input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="w-5 h-5 rounded accent-amber-500" /></label>{isScheduled && <input type="datetime-local" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="w-full mt-3 bg-slate-700 text-white px-4 py-3 rounded-xl border border-slate-600 focus:border-amber-500 focus:outline-none" />}</div>
            {authError && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{authError}</div>}
            <button onClick={handleRequestRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">{isScheduled ? 'Schedule Inoka' : 'Confirm Inoka'}</button>
          </div>
        )}

        {screen === 'searching' && (
          <div className="p-6 text-center animate-slide-up">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 border-4 border-amber-500/30 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
              <div className="absolute inset-4 border-4 border-slate-700 rounded-full"></div>
              <div className="absolute inset-4 border-4 border-amber-500 rounded-full animate-spin" style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }}></div>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-4xl animate-float">🚗</span></div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Connecting you...</h3>
            <p className="text-slate-400 mb-1">Payment authorized: <span className="text-amber-400 font-semibold">${rideFare.toFixed(2)}</span></p>
            <div className="flex justify-center gap-2 mb-4 text-slate-500 text-sm">{quietRide && <span>🤫</span>}{petFriendly && <span>🐕</span>}</div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-6"><div className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all duration-300" style={{ width: `${searchProgress}%` }}></div></div>
            <button onClick={() => { if (currentRideId) cancelRide(currentRideId); setScreen('home') }} className="px-6 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl">Cancel Request</button>
          </div>
        )}

        {screen === 'found' && (
          <div className="p-5 pb-8 animate-slide-up">
            <div className="text-center mb-4"><div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full text-sm font-medium"><span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>Driver on the way</div></div>
            <div className="glass-card rounded-xl p-4 mb-4">
              <div className="flex items-center gap-4"><div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-3xl">{driverInfo.photo}</div><div className="flex-1"><p className="text-white font-semibold text-lg">{driverInfo.name}</p><div className="flex items-center gap-1 text-amber-400 text-sm"><span>⭐</span><span>{driverInfo.rating}</span></div></div><div className="text-right"><p className="text-3xl font-bold text-amber-400">{driverInfo.eta}</p><p className="text-slate-400 text-sm">min</p></div></div>
              <div className="mt-4 pt-4 border-t border-slate-600/50"><p className="text-slate-400 text-sm">{driverInfo.car}</p><p className="text-white font-mono text-lg">{driverInfo.plate}</p></div>
            </div>
            <div className="flex gap-3 mb-4"><button className="flex-1 py-3 glass-card hover:bg-slate-700/50 text-white rounded-xl flex items-center justify-center gap-2"><span>📞</span> Call</button><button className="flex-1 py-3 glass-card hover:bg-slate-700/50 text-white rounded-xl flex items-center justify-center gap-2"><span>💬</span> Message</button></div>
            <button onClick={handleStartRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">Start Ride</button>
          </div>
        )}

        {screen === 'in-ride' && (
          <div className="p-5 pb-8 bg-gradient-to-t from-amber-500/10 to-slate-900 border-t-2 border-amber-500">
            <div className="flex justify-between items-center mb-2"><span className="text-amber-400 font-bold tracking-wider text-sm uppercase">On Trip</span><span className="text-slate-400 text-sm">{formatTime(rideTimer)}</span></div>
            <div className="text-center mb-6"><p className="text-6xl font-black text-amber-400 tracking-tighter" style={{ textShadow: '0 0 30px rgba(245, 158, 11, 0.4)' }}>{liveETA || formatTime(rideTimer)}</p><p className="text-xl font-medium text-amber-300 mt-2">{liveETA && liveETA !== 'Arrived!' ? 'Until arrival' : liveETA === 'Arrived!' ? '🎉 You\'ve arrived!' : 'Ride time'}</p></div>
            <h3 className="text-white text-lg font-semibold mb-4">Heading to {destination?.address.split(',')[0]}</h3>
            <button onClick={handleCompleteRide} className="w-full py-4 glass-card hover:bg-slate-700/50 text-white font-semibold rounded-xl">Complete Ride (Demo)</button>
          </div>
        )}
      </div>
    </div>
  )
}
