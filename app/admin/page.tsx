'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adminApi } from '@/lib/adminApi'
import type { User } from '@supabase/supabase-js'

type Ride = any
type Driver = any
type Message = any

type Stats = {
  activeRides: number
  pendingDrivers: number
  totalRevenue: number
  todayRides: number
  flaggedMessages: number
}

// Timeout wrapper to prevent hanging promises (properly typed)
function withTimeout<T>(
  promise: Promise<T>,
  ms = 5000,
  label = 'Operation'
): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (id) clearTimeout(id)
  }) as Promise<T>
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false) // In-flight guard for polling
  const [debugInfo, setDebugInfo] = useState<string>('')

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [rides, setRides] = useState<Ride[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [flaggedMessages, setFlaggedMessages] = useState<Message[]>([])
  const [tab, setTab] = useState<'overview' | 'rides' | 'drivers' | 'messages'>('overview')
  const [error, setError] = useState<string>('')

  // Ride details modal
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [rideChat, setRideChat] = useState<Message[]>([])

  // Auth form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let mounted = true
    
    const checkAuth = async () => {
      const debug: string[] = ['Starting auth check...']
      
      try {
        debug.push('Calling getSession with 5s timeout...')
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          5000
        )
        
        if (!mounted) return
        
        if (sessionError) {
          debug.push(`Session error: ${sessionError.message}`)
          setUser(null)
          setRole(null)
          return
        }
        
        const currentUser = session?.user ?? null
        debug.push(`Session exists: ${!!session}, User: ${!!currentUser}`)
        
        setUser(currentUser)
        
        // Deterministically set role to null when no user
        if (!currentUser) {
          debug.push('No user - setting role to null')
          setRole(null)
          return
        }
        
        debug.push(`User ID: ${currentUser.id}`)
        debug.push('Fetching profile role...')
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single() as { data: { role: string } | null; error: { message: string; code: string } | null }
        
        // Check mounted again after await
        if (!mounted) return
        
        if (profileError) {
          debug.push(`Profile error: ${profileError.message} (code: ${profileError.code})`)
          setRole('rider') // Default to rider
        } else {
          debug.push(`Profile role: ${profile?.role}`)
          setRole(profile?.role ?? 'rider')
        }
        
      } catch (err: any) {
        debug.push(`Exception: ${err.message}`)
        console.error('Auth check failed:', err)
        if (mounted) {
          setUser(null)
          setRole(null)
        }
      } finally {
        debug.push('Auth check complete')
        if (mounted) {
          setDebugInfo(debug.join('\n'))
          setLoading(false)
        }
      }
    }

    checkAuth()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (!currentUser) {
        setRole(null)
        setLoading(false)
        return
      }
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single() as { data: { role: string } | null; error: unknown }
        
        // Check mounted after await
        if (!mounted) return
        setRole(data?.role ?? 'rider')
      } catch {
        if (mounted) setRole('rider')
      }
      
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const isAdmin = role === 'admin'

  async function signIn() {
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
      // onAuthStateChange handles success
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function loadAll() {
    // In-flight guard - prevent overlapping calls
    if (loadingData) return
    setLoadingData(true)
    setError('')
    
    try {
      const [s, r, d, m] = await Promise.all([
        adminApi.getStats(),
        adminApi.listRides(['requested', 'scheduled', 'accepted', 'in-progress', 'completed'], 100),
        adminApi.listDrivers(),
        adminApi.listFlaggedMessages(),
      ])
      setStats(s)
      setRides(r)
      setDrivers(d)
      setFlaggedMessages(m)
    } catch (e: any) {
      console.error('Load error:', e)
      setError(e.message || 'Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadAll()
    const t = setInterval(loadAll, 10000)
    return () => clearInterval(t)
  }, [isAdmin])

  async function updateRideStatus(rideId: string, status: string) {
    try {
      await adminApi.updateRide(rideId, { status })
      await loadAll()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function assignDriver(rideId: string, driverUserId: string) {
    try {
      await adminApi.updateRide(rideId, { driver_id: driverUserId, status: 'accepted' })
      await loadAll()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function updateDriverStatus(driverUserId: string, status: string) {
    try {
      await adminApi.updateDriver(driverUserId, { status })
      await loadAll()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function viewRideDetails(ride: Ride) {
    setSelectedRide(ride)
    try {
      const chat = await adminApi.getRideChat(ride.id)
      setRideChat(chat)
    } catch {
      setRideChat([])
    }
  }

  // ============ RENDERING ============

  // Loading State - Full screen overlay
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Admin Portal...</p>
        </div>
      </div>
    )
  }

  // Not Signed In - Show Login Form
  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🛡️</span>
            </div>
            <h1 className="text-2xl font-black text-white">Inoka Admin</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in to access the dashboard</p>
          </div>

          <input
            className="w-full mb-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full mb-4 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && signIn()}
          />

          {error && (
            <div className="mb-4 text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={signIn}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
          >
            Sign In
          </button>
          
          {/* Debug info */}
          {debugInfo && (
            <details className="mt-4 text-xs text-slate-500">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 p-2 bg-slate-900 rounded overflow-x-auto">{debugInfo}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }

  // Signed In but Not Admin
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-2">
            Your account ({user.email}) does not have admin privileges.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Current role: <code className="bg-slate-800 px-2 py-1 rounded">{role || 'none'}</code>
          </p>
          
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left text-sm">
            <p className="text-slate-300 font-medium mb-2">To get admin access:</p>
            <ol className="text-slate-400 space-y-1 list-decimal list-inside">
              <li>Go to Supabase SQL Editor</li>
              <li>Run the admin-setup.sql migration</li>
              <li>Update your profile role to admin</li>
            </ol>
          </div>
          
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Sign Out
          </button>
          
          {/* Debug info */}
          {debugInfo && (
            <details className="mt-4 text-xs text-slate-500 text-left">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 p-2 bg-slate-900 rounded overflow-x-auto">{debugInfo}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }

  // ============ ADMIN DASHBOARD ============
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 overflow-y-auto">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Inoka Admin</h1>
              <p className="text-slate-400 text-xs">Dispatch and Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:inline">{user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['overview', 'rides', 'drivers', 'messages'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                tab === t
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t === 'overview' && '📊 Overview'}
              {t === 'rides' && `🚗 Rides (${rides.length})`}
              {t === 'drivers' && `👤 Drivers (${drivers.length})`}
              {t === 'messages' && `⚠️ Flagged (${flaggedMessages.length})`}
            </button>
          ))}
          <button
            onClick={loadAll}
            className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🚗</span>
                <span className="text-slate-400 text-sm">Active Rides</span>
              </div>
              <div className="text-2xl font-black text-white">{stats?.activeRides ?? 0}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📅</span>
                <span className="text-slate-400 text-sm">Today</span>
              </div>
              <div className="text-2xl font-black text-white">{stats?.todayRides ?? 0}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⏳</span>
                <span className="text-slate-400 text-sm">Pending Drivers</span>
              </div>
              <div className="text-2xl font-black text-white">{stats?.pendingDrivers ?? 0}</div>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚠️</span>
                <span className="text-slate-400 text-sm">Flagged</span>
              </div>
              <div className="text-2xl font-black text-white">{stats?.flaggedMessages ?? 0}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">💰</span>
                <span className="text-slate-400 text-sm">Revenue</span>
              </div>
              <div className="text-2xl font-black text-white">${(stats?.totalRevenue ?? 0).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Rides Tab */}
        {tab === 'rides' && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-bold">Live Ride Queue</h2>
              <span className="text-slate-400 text-sm">Auto-refresh every 10s</span>
            </div>
            <div className="divide-y divide-slate-800">
              {rides.filter(r => r.status !== 'completed' && r.status !== 'cancelled').map((ride) => (
                <div key={ride.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-semibold truncate">
                        {ride.pickup_address} → {ride.dropoff_address}
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Status: <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ride.status === 'requested' ? 'bg-blue-500/20 text-blue-400' :
                          ride.status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>{ride.status}</span>
                        {' • '}Fare: <span className="text-amber-400">${Number(ride.estimated_fare || 0).toFixed(2)}</span>
                      </div>
                      <div className="text-slate-500 text-xs mt-1">
                        ID: {ride.id.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => viewRideDetails(ride)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">View</button>
                      <button onClick={() => updateRideStatus(ride.id, 'cancelled')} className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm">Cancel</button>
                      {ride.status === 'in-progress' && (
                        <button onClick={() => updateRideStatus(ride.id, 'completed')} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold">Complete</button>
                      )}
                    </div>
                  </div>
                  {(ride.status === 'requested' || ride.status === 'scheduled') && drivers.length > 0 && (
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                      <span className="text-slate-400 text-sm">Assign:</span>
                      <select
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
                        defaultValue=""
                        onChange={(e) => e.target.value && assignDriver(ride.id, e.target.value)}
                      >
                        <option value="" disabled>Select driver...</option>
                        {drivers.filter(d => d.status === 'approved' || d.status === 'active').map((d) => (
                          <option key={d.user_id} value={d.user_id}>{d.name || 'Driver'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {rides.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length === 0 && (
                <div className="p-12 text-center text-slate-400">No active rides.</div>
              )}
            </div>
          </div>
        )}

        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-bold">Driver Management</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {drivers.map((driver) => (
                <div key={driver.user_id} className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{driver.name || 'Unnamed Driver'}</div>
                    <div className="text-slate-400 text-sm">
                      License: {driver.license_number || 'N/A'} • Status: <span className={`px-2 py-0.5 rounded text-xs ${
                        driver.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        driver.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{driver.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateDriverStatus(driver.user_id, 'approved')} className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-sm">Approve</button>
                    <button onClick={() => updateDriverStatus(driver.user_id, 'suspended')} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm">Suspend</button>
                  </div>
                </div>
              ))}
              {drivers.length === 0 && (
                <div className="p-12 text-center text-slate-400">No drivers registered.</div>
              )}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {tab === 'messages' && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-bold">Flagged Messages</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {flaggedMessages.map((msg) => (
                <div key={msg.id} className="p-5">
                  <div className="bg-slate-800 rounded-lg p-3 mb-2 text-white">{msg.content}</div>
                  <div className="text-slate-400 text-sm">
                    Ride: {msg.ride_id?.slice(0, 8)}... • {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {flaggedMessages.length === 0 && (
                <div className="p-12 text-center text-slate-400">No flagged messages. ✓</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Ride Details Modal */}
      {selectedRide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-bold">Ride Details</h3>
              <button onClick={() => { setSelectedRide(null); setRideChat([]) }} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><div className="text-slate-400 text-sm">Pickup</div><div className="text-white">{selectedRide.pickup_address}</div></div>
                <div><div className="text-slate-400 text-sm">Dropoff</div><div className="text-white">{selectedRide.dropoff_address}</div></div>
                <div><div className="text-slate-400 text-sm">Status</div><div className="text-white">{selectedRide.status}</div></div>
                <div><div className="text-slate-400 text-sm">Fare</div><div className="text-amber-400 font-bold">${Number(selectedRide.estimated_fare || 0).toFixed(2)}</div></div>
              </div>
              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-white font-bold mb-3">Chat Log ({rideChat.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {rideChat.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.flagged ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800'}`}>
                      <div className="text-white text-sm">{msg.content}</div>
                      <div className="text-slate-500 text-xs mt-1">{new Date(msg.created_at).toLocaleTimeString()}</div>
                    </div>
                  ))}
                  {rideChat.length === 0 && <div className="text-slate-400 text-sm">No messages.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
