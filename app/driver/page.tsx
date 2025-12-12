'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type DriverScreen = 'auth' | 'register' | 'home' | 'request' | 'pickup' | 'in-ride' | 'complete'

export default function DriverApp() {
  const [screen, setScreen] = useState<DriverScreen>('auth')
  const [user, setUser] = useState<User | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  
  // Driver registration
  const [driverName, setDriverName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')
  
  // Ride state
  const [currentRide, setCurrentRide] = useState<any>(null)
  const [rideTimer, setRideTimer] = useState(0)
  const [requestTimer, setRequestTimer] = useState(30)
  
  // Earnings
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [weekEarnings, setWeekEarnings] = useState(0)
  const [totalRides, setTotalRides] = useState(0)
  const [rating, setRating] = useState(4.9)
  const [acceptanceRate, setAcceptanceRate] = useState(95)

  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkDriverStatus(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        checkDriverStatus(session.user.id)
      } else {
        setUser(null)
        setScreen('auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkDriverStatus = async (userId: string) => {
    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (driver) {
      setScreen('home')
      loadEarnings(userId)
    } else {
      setScreen('register')
    }
  }

  const loadEarnings = async (userId: string) => {
    setTodayEarnings(67.50)
    setWeekEarnings(423.25)
    setTotalRides(156)
  }

  const handleSignIn = async () => {
    setAuthLoading(true)
    setAuthError('')
    
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    })
    
    if (error) {
      setAuthError(error.message)
    }
    setAuthLoading(false)
  }

  const handleRegisterDriver = async () => {
    if (!user) return
    
    const { error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: user.id,
        name: driverName,
        license_number: licenseNumber,
        status: 'pending'
      })

    if (driverError) {
      setAuthError(driverError.message)
      return
    }

    const { error: vehicleError } = await supabase
      .from('vehicles')
      .insert({
        driver_id: user.id,
        make: vehicleMake,
        model: vehicleModel,
        year: parseInt(vehicleYear),
        plate: vehiclePlate,
        color: vehicleColor
      })

    if (vehicleError) {
      setAuthError(vehicleError.message)
      return
    }

    setScreen('home')
  }

  const handleGoOnline = () => {
    setIsOnline(true)
    setTimeout(() => simulateRideRequest(), 5000)
  }

  const handleGoOffline = () => {
    setIsOnline(false)
  }

  const simulateRideRequest = () => {
    if (!isOnline) return
    
    setCurrentRide({
      id: 'ride-' + Date.now(),
      pickup: '123 Main St, Springfield, IL',
      dropoff: 'Abraham Lincoln Capital Airport',
      riderName: 'Sarah M.',
      riderRating: 4.8,
      estimatedFare: 24.50,
      distance: 8.2,
      duration: 15
    })
    setRequestTimer(30)
    setScreen('request')
  }

  // Request countdown
  useEffect(() => {
    if (screen !== 'request') return
    
    const interval = setInterval(() => {
      setRequestTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          handleDeclineRide()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [screen])

  const handleAcceptRide = () => {
    setScreen('pickup')
  }

  const handleDeclineRide = () => {
    setCurrentRide(null)
    setScreen('home')
    if (isOnline) {
      setTimeout(() => simulateRideRequest(), 10000)
    }
  }

  const handleArrivedAtPickup = () => {
    // In real app, notify rider
  }

  const handleStartRide = () => {
    setRideTimer(0)
    setScreen('in-ride')
  }

  useEffect(() => {
    if (screen !== 'in-ride') return
    
    const interval = setInterval(() => {
      setRideTimer(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [screen])

  const handleCompleteRide = () => {
    setTodayEarnings(prev => prev + (currentRide?.estimatedFare || 0))
    setTotalRides(prev => prev + 1)
    setScreen('complete')
  }

  const handleFinishRide = () => {
    setCurrentRide(null)
    setScreen('home')
    if (isOnline) {
      setTimeout(() => simulateRideRequest(), 8000)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setScreen('auth')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Auth Screen
  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2">IN<span className="text-amber-400">O</span>KA</h1>
            <p className="text-slate-400">Driver Portal</p>
          </div>
          
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
            <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500" />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
            
            {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
            
            <button onClick={handleSignIn} disabled={authLoading} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50">{authLoading ? 'Loading...' : 'Sign In'}</button>
          </div>
          
          <a href="/" className="mt-6 text-slate-400 hover:text-white transition-colors">← Back to Rider App</a>
        </div>
      </div>
    )
  }

  // Register Screen
  if (screen === 'register') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">Become a Driver</h1>
          <p className="text-slate-400 text-sm">Complete your driver profile</p>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">Personal Info</h2>
            <input type="text" placeholder="Full Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 mb-3 focus:outline-none focus:border-amber-500" />
            <input type="text" placeholder="Driver's License Number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
          </div>
          
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">Vehicle Info</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Make" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              <input type="text" placeholder="Model" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" placeholder="Year" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              <input type="text" placeholder="Color" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              <input type="text" placeholder="Plate" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          
          {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
          
          <button onClick={handleRegisterDriver} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">Complete Registration</button>
        </div>
      </div>
    )
  }

  // Ride Request Screen
  if (screen === 'request' && currentRide) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 rounded-full border-4 border-amber-500 flex items-center justify-center mb-6 relative">
            <span className="text-3xl font-bold text-amber-500">{requestTimer}</span>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#F59E0B" strokeWidth="4" strokeDasharray={`${(requestTimer / 30) * 289} 289`} strokeLinecap="round" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-6">New Ride Request</h2>
          
          <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">👤</div>
              <div>
                <p className="text-white font-semibold">{currentRide.riderName}</p>
                <p className="text-amber-400 text-sm">⭐ {currentRide.riderRating}</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-slate-400 text-xs">PICKUP</p>
                  <p className="text-white text-sm">{currentRide.pickup}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-slate-400 text-xs">DROPOFF</p>
                  <p className="text-white text-sm">{currentRide.dropoff}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t border-slate-700">
              <div><p className="text-slate-400 text-xs">Distance</p><p className="text-white font-semibold">{currentRide.distance} mi</p></div>
              <div><p className="text-slate-400 text-xs">Duration</p><p className="text-white font-semibold">{currentRide.duration} min</p></div>
              <div><p className="text-slate-400 text-xs">Est. Fare</p><p className="text-amber-400 font-semibold">${currentRide.estimatedFare}</p></div>
            </div>
          </div>
          
          <div className="w-full max-w-sm flex gap-3">
            <button onClick={handleDeclineRide} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all">Decline</button>
            <button onClick={handleAcceptRide} className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">Accept</button>
          </div>
        </div>
      </div>
    )
  }

  // Pickup Screen
  if (screen === 'pickup' && currentRide) {
    return (
      <div className="h-screen flex flex-col bg-slate-900">
        <div ref={mapRef} className="flex-1 bg-slate-800 flex items-center justify-center">
          <p className="text-slate-500">Map: Navigate to pickup</p>
        </div>
        
        <div className="bg-slate-800 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">👤</div>
            <div className="flex-1">
              <p className="text-white font-semibold">{currentRide.riderName}</p>
              <p className="text-slate-400 text-sm">{currentRide.pickup}</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-4">
            <button className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center gap-2"><span>📞</span> Call</button>
            <button className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center gap-2"><span>💬</span> Message</button>
          </div>
          
          <button onClick={handleArrivedAtPickup} className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl mb-3">I've Arrived</button>
          <button onClick={handleStartRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl">Start Ride</button>
        </div>
      </div>
    )
  }

  // In-Ride Screen
  if (screen === 'in-ride' && currentRide) {
    return (
      <div className="h-screen flex flex-col bg-slate-900">
        <div ref={mapRef} className="flex-1 bg-slate-800 flex items-center justify-center">
          <p className="text-slate-500">Map: Navigate to dropoff</p>
        </div>
        
        <div className="bg-slate-800 p-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm">Heading to</p>
              <p className="text-white font-semibold">{currentRide.dropoff}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-400">{formatTime(rideTimer)}</p>
              <p className="text-slate-400 text-sm">Ride Time</p>
            </div>
          </div>
          
          <div className="flex justify-between mb-4 p-3 bg-slate-700/50 rounded-xl">
            <div><p className="text-slate-400 text-xs">Distance</p><p className="text-white font-semibold">{currentRide.distance} mi</p></div>
            <div><p className="text-slate-400 text-xs">Est. Fare</p><p className="text-amber-400 font-semibold">${currentRide.estimatedFare}</p></div>
          </div>
          
          <button onClick={handleCompleteRide} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl">Complete Ride</button>
        </div>
      </div>
    )
  }

  // Complete Screen
  if (screen === 'complete' && currentRide) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mb-6"><span className="text-5xl">✓</span></div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Ride Complete!</h2>
        <p className="text-slate-400 mb-6">Great job!</p>
        
        <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 mb-6">
          <div className="text-center mb-4">
            <p className="text-slate-400 text-sm">You Earned</p>
            <p className="text-4xl font-bold text-amber-400">${currentRide.estimatedFare}</p>
          </div>
          
          <div className="flex justify-between pt-4 border-t border-slate-700">
            <div><p className="text-slate-400 text-xs">Distance</p><p className="text-white">{currentRide.distance} mi</p></div>
            <div><p className="text-slate-400 text-xs">Duration</p><p className="text-white">{formatTime(rideTimer)}</p></div>
          </div>
        </div>
        
        <button onClick={handleFinishRide} className="w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl">Done</button>
      </div>
    )
  }

  // Home Screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">IN<span className="text-amber-400">O</span>KA</h1>
          <p className="text-slate-500 text-xs">Driver</p>
        </div>
        <button onClick={handleSignOut} className="text-slate-400 hover:text-white text-sm">Sign Out</button>
      </header>
      
      <div className="p-4">
        <div className="bg-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm">Status</p>
              <p className={`text-lg font-semibold ${isOnline ? 'text-green-400' : 'text-slate-400'}`}>{isOnline ? 'Online' : 'Offline'}</p>
            </div>
            <button onClick={isOnline ? handleGoOffline : handleGoOnline} className={`px-6 py-3 rounded-full font-semibold transition-all ${isOnline ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>{isOnline ? 'Go Offline' : 'Go Online'}</button>
          </div>
          
          {isOnline && (
            <div className="flex items-center gap-2 text-amber-400">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Searching for rides...</span>
            </div>
          )}
        </div>
        
        <div className="bg-slate-800 rounded-2xl p-4 mb-4">
          <h2 className="text-white font-semibold mb-3">Today's Earnings</h2>
          <p className="text-4xl font-bold text-amber-400 mb-4">${todayEarnings.toFixed(2)}</p>
          
          <div className="flex justify-between text-sm">
            <div><p className="text-slate-400">This Week</p><p className="text-white font-semibold">${weekEarnings.toFixed(2)}</p></div>
            <div><p className="text-slate-400">Total Rides</p><p className="text-white font-semibold">{totalRides}</p></div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-2xl p-4">
          <h2 className="text-white font-semibold mb-3">Performance</h2>
          <div className="flex justify-between">
            <div><p className="text-slate-400 text-sm">Rating</p><p className="text-white font-semibold">⭐ {rating}</p></div>
            <div><p className="text-slate-400 text-sm">Acceptance</p><p className="text-white font-semibold">{acceptanceRate}%</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
