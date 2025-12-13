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

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) {
        try {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', u.id)
            .single()
          
          if (error) {
            console.error('Profile fetch error:', error.message)
            // If role column doesn't exist, default to null
            setRole(null)
          } else {
            setRole(prof?.role ?? null)
          }
        } catch (e) {
          console.error('Profile fetch exception:', e)
          setRole(null)
        }
      }
      setLoading(false)
    }).catch((e) => {
      console.error('Session fetch error:', e)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        try {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', u.id)
            .single()
          
          if (error) {
            setRole(null)
          } else {
            setRole(prof?.role ?? null)
          }
        } catch {
          setRole(null)
        }
      } else {
        setRole(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const isAdmin = role === 'admin'

  async function signIn() {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  async function loadAll() {
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
      setError(e.message)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadAll()
    const t = setInterval(loadAll, 10000) // Refresh every 10s
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
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
        </div>
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">
            Your account ({user.email}) does not have admin privileges.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Inoka Admin</h1>
              <p className="text-slate-400 text-xs">Dispatch & Operations</p>
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
        {tab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="Active Rides" value={stats.activeRides} icon="🚗" color="amber" />
            <StatCard label="Today's Rides" value={stats.todayRides} icon="📅" color="blue" />
            <StatCard label="Pending Drivers" value={stats.pendingDrivers} icon="⏳" color="yellow" />
            <StatCard label="Flagged Messages" value={stats.flaggedMessages} icon="⚠️" color="red" />
            <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} icon="💰" color="green" />
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
                      <div className="text-slate-400 text-sm mt-1 flex flex-wrap gap-x-4">
                        <span>Status: <StatusBadge status={ride.status} /></span>
                        <span>Fare: <span className="text-amber-400">${Number(ride.estimated_fare || 0).toFixed(2)}</span></span>
                        {ride.scheduled_for && (
                          <span>Scheduled: {new Date(ride.scheduled_for).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="text-slate-500 text-xs mt-1">
                        ID: {ride.id.slice(0, 8)}... • Created: {new Date(ride.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => viewRideDetails(ride)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => updateRideStatus(ride.id, 'cancelled')}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                      {ride.status === 'accepted' && (
                        <button
                          onClick={() => updateRideStatus(ride.id, 'in-progress')}
                          className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm"
                        >
                          Start
                        </button>
                      )}
                      {ride.status === 'in-progress' && (
                        <button
                          onClick={() => updateRideStatus(ride.id, 'completed')}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                  {(ride.status === 'requested' || ride.status === 'scheduled') && (
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                      <span className="text-slate-400 text-sm">Assign driver:</span>
                      <select
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
                        defaultValue=""
                        onChange={(e) => e.target.value && assignDriver(ride.id, e.target.value)}
                      >
                        <option value="" disabled>Select driver...</option>
                        {drivers
                          .filter((d) => d.status === 'approved' || d.status === 'active')
                          .map((d) => (
                            <option key={d.user_id} value={d.user_id}>
                              {d.name || 'Driver'} ({d.status})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {rides.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  No active rides right now.
                </div>
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
                <div key={driver.user_id} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-semibold">{driver.name || 'Unnamed Driver'}</div>
                    <div className="text-slate-400 text-sm">
                      License: {driver.license_number || 'N/A'} • Status: <StatusBadge status={driver.status} />
                    </div>
                    <div className="text-slate-500 text-xs truncate">ID: {driver.user_id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateDriverStatus(driver.user_id, 'approved')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        driver.status === 'approved'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => updateDriverStatus(driver.user_id, 'pending')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        driver.status === 'pending'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => updateDriverStatus(driver.user_id, 'suspended')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        driver.status === 'suspended'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                      }`}
                    >
                      Suspend
                    </button>
                  </div>
                </div>
              ))}
              {drivers.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  No drivers registered yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flagged Messages Tab */}
        {tab === 'messages' && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-bold">Flagged Messages (Profanity Filter)</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {flaggedMessages.map((msg) => (
                <div key={msg.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span>⚠️</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white bg-slate-800 rounded-lg p-3 mb-2">
                        {msg.content}
                      </div>
                      <div className="text-slate-400 text-sm">
                        Ride: {msg.ride_id?.slice(0, 8)}... • 
                        Sender: {msg.sender_id?.slice(0, 8)}... • 
                        {new Date(msg.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {flaggedMessages.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  No flagged messages. All clear! ✓
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Ride Details Modal */}
      {selectedRide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-bold">Ride Details</h3>
              <button
                onClick={() => { setSelectedRide(null); setRideChat([]) }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-slate-400 text-sm">Pickup</div>
                  <div className="text-white">{selectedRide.pickup_address}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Dropoff</div>
                  <div className="text-white">{selectedRide.dropoff_address}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Status</div>
                  <StatusBadge status={selectedRide.status} />
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Fare</div>
                  <div className="text-amber-400 font-bold">${Number(selectedRide.estimated_fare || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Rider ID</div>
                  <div className="text-white text-sm font-mono">{selectedRide.rider_id}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Driver ID</div>
                  <div className="text-white text-sm font-mono">{selectedRide.driver_id || 'Not assigned'}</div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-white font-bold mb-3">Chat Log ({rideChat.length} messages)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {rideChat.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.flagged ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800'
                      }`}
                    >
                      <div className="text-white text-sm">{msg.content}</div>
                      <div className="text-slate-500 text-xs mt-1">
                        {msg.sender_id?.slice(0, 8)}... • {new Date(msg.created_at).toLocaleTimeString()}
                        {msg.flagged && <span className="text-red-400 ml-2">⚠️ Flagged</span>}
                      </div>
                    </div>
                  ))}
                  {rideChat.length === 0 && (
                    <div className="text-slate-400 text-sm">No messages in this ride.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Stat Card Component
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    requested: 'bg-blue-500/20 text-blue-400',
    scheduled: 'bg-purple-500/20 text-purple-400',
    accepted: 'bg-yellow-500/20 text-yellow-400',
    'in-progress': 'bg-amber-500/20 text-amber-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-emerald-500/20 text-emerald-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    suspended: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-slate-500/20 text-slate-400'}`}>
      {status}
    </span>
  )
}
