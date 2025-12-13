'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { sendText, markRead, getMessages, subscribeToMessages, broadcastTyping, type ChatMessage as DBChatMessage } from '@/lib/chat'
import type { User } from '@supabase/supabase-js'

type DriverScreen = 'auth' | 'register' | 'home' | 'request' | 'pickup' | 'in-ride' | 'complete'
type ChatMessage = { 
  id: string
  sender: 'rider' | 'driver'
  text: string
  timestamp: Date
  status: 'sending' | 'sent' | 'delivered' | 'read'
  reaction?: string
}

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

  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

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

  // --- CHAT FUNCTIONS ---
  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Subscribe to real messages when we have a ride
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  
  useEffect(() => {
    if (!currentRide?.id || !showChat) return
    
    const rideId = currentRide.id
    
    // Load existing messages
    getMessages(rideId).then(msgs => {
      if (msgs.length > 0) {
        const converted: ChatMessage[] = msgs.map(m => ({
          id: m.id,
          sender: m.sender_id === user?.id ? 'driver' : 'rider',
          text: m.content,
          timestamp: new Date(m.created_at),
          status: m.read_at ? 'read' : 'delivered'
        }))
        setChatMessages(converted)
        markRead(rideId)
        scrollToBottom()
      }
    }).catch(console.error)
    
    // Subscribe to new messages
    const channel = subscribeToMessages(
      rideId,
      (msg) => {
        const converted: ChatMessage = {
          id: msg.id,
          sender: msg.sender_id === user?.id ? 'driver' : 'rider',
          text: msg.content,
          timestamp: new Date(msg.created_at),
          status: msg.read_at ? 'read' : 'delivered'
        }
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, converted])
        markRead(rideId)
        scrollToBottom()
        if (!showChat && msg.sender_id !== user?.id) {
          setUnreadCount(prev => prev + 1)
          if (navigator.vibrate) navigator.vibrate(50)
        }
      },
      () => {
        setIsTyping(true)
        setTimeout(() => setIsTyping(false), 1500)
      }
    )
    chatChannelRef.current = channel
    
    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current)
        chatChannelRef.current = null
      }
    }
  }, [currentRide?.id, showChat, user?.id])

  const sendMessage = async () => {
    if (!chatInput.trim()) return
    
    const messageText = chatInput.trim()
    setChatInput('')
    
    // Optimistic UI update
    const tempId = Date.now().toString()
    const newMessage: ChatMessage = {
      id: tempId,
      sender: 'driver',
      text: messageText,
      timestamp: new Date(),
      status: 'sending'
    }
    
    setChatMessages(prev => [...prev, newMessage])
    scrollToBottom()
    
    // If we have a real ride, send to Supabase
    if (currentRide?.id) {
      try {
        await sendText(currentRide.id, messageText)
        if (chatChannelRef.current) {
          broadcastTyping(chatChannelRef.current)
        }
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m))
        setTimeout(() => {
          setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'delivered' } : m))
        }, 500)
      } catch (err) {
        console.error('Failed to send message:', err)
        setChatMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } else {
      // Demo mode - simulate responses
      setTimeout(() => {
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m))
      }, 300)
      setTimeout(() => {
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'delivered' } : m))
      }, 800)
      setTimeout(() => {
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'read' } : m))
      }, 1500)
      simulateRiderResponse(messageText)
    }
  }

  const handleTyping = () => {
    if (currentRide?.id && chatChannelRef.current) {
      broadcastTyping(chatChannelRef.current)
    }
  }

  const simulateRiderResponse = (driverMessage: string) => {
    // Show typing indicator
    setTimeout(() => setIsTyping(true), 1200)
    
    // Generate contextual response
    const responses: Record<string, string> = {
      'here': "Coming out now!",
      'outside': "On my way! 1 minute.",
      'arrived': "See you! Walking to the car now.",
      'where': "I'm by the main entrance, near the blue sign.",
      'wait': "Thanks! Almost ready.",
      'hello': "Hi! I'll be right out.",
      'hi': "Hey there! Coming down now.",
    }
    
    let response = "Got it, thanks!"
    const lowerMessage = driverMessage.toLowerCase()
    for (const [key, value] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) { response = value; break }
    }
    
    // Send rider response
    setTimeout(() => {
      setIsTyping(false)
      const riderMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'rider',
        text: response,
        timestamp: new Date(),
        status: 'read'
      }
      setChatMessages(prev => [...prev, riderMessage])
      scrollToBottom()
      
      // Increment unread if chat is closed
      if (!showChat) setUnreadCount(prev => prev + 1)
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50)
    }, 2800)
  }

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const openChat = async () => {
    setShowChat(true)
    setUnreadCount(0)
    if (currentRide?.id) {
      await markRead(currentRide.id).catch(console.error)
    }
    scrollToBottom()
  }

  // --- ULTRA-PREMIUM CHAT COMPONENT FOR DRIVER ---
  const ChatModal = () => {
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null)
    const [showReactions, setShowReactions] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    
    const riderInfo = currentRide || { riderName: 'Rider', pickup: 'Pickup location' }
    const reactions = ['❤️', '😂', '👍', '😮', '😢', '🔥']
    
    const addReaction = (messageId: string, emoji: string) => {
      setChatMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, reaction: emoji } : m
      ))
      setShowReactions(false)
      setSelectedMessage(null)
      if (navigator.vibrate) navigator.vibrate(30)
    }
    
    return (
      <div className={`fixed inset-0 z-[100] transition-all duration-500 ease-out ${showChat ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Animated Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity duration-500 ${showChat ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setShowChat(false)} 
        />
        
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl transition-transform duration-1000 ${showChat ? 'scale-100' : 'scale-0'}`} />
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl transition-transform duration-1000 delay-200 ${showChat ? 'scale-100' : 'scale-0'}`} />
        </div>
        
        {/* Chat Container */}
        <div className={`absolute inset-x-0 bottom-0 max-h-[92vh] flex flex-col transition-all duration-500 ease-out ${showChat ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="mx-2 mb-2 rounded-[28px] bg-gradient-to-b from-slate-800/95 via-slate-900/98 to-slate-950 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
            
            {/* Premium Header */}
            <div className="relative px-5 py-4 border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-amber-500/5" />
              
              <div className="relative flex items-center gap-4">
                {/* Avatar with pulse */}
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl opacity-75 blur animate-pulse" />
                  <div className="relative w-14 h-14 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                    👤
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <div className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping opacity-75" />
                    <div className="relative w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900" />
                  </div>
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-lg">{riderInfo.riderName || 'Rider'}</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">Online</span>
                  </div>
                  <p className="text-slate-400 text-sm truncate">{riderInfo.pickup}</p>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <a href="tel:+12175559876" className="w-11 h-11 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                  <button onClick={() => setShowChat(false)} className="w-11 h-11 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[320px] max-h-[55vh]">
              {chatMessages.length === 0 && (
                <div className="text-center py-16">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-3xl blur-xl" />
                    <div className="relative w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl flex items-center justify-center border border-white/10">
                      <span className="text-5xl">💬</span>
                    </div>
                  </div>
                  <p className="text-white font-semibold text-lg mb-2">Message your rider</p>
                  <p className="text-slate-500 text-sm max-w-[200px] mx-auto">Let them know you're on the way</p>
                </div>
              )}
              
              {chatMessages.map((msg, idx) => {
                const isOwn = msg.sender === 'driver'
                const showAvatar = !isOwn && (idx === 0 || chatMessages[idx - 1]?.sender !== 'rider')
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
                    style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  >
                    {!isOwn && (
                      <div className={`w-8 mr-2 flex-shrink-0 ${showAvatar ? '' : 'opacity-0'}`}>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">
                          👤
                        </div>
                      </div>
                    )}
                    
                    <div 
                      className={`relative max-w-[75%]`}
                      onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(msg.id); setShowReactions(true) }}
                    >
                      {selectedMessage === msg.id && showReactions && (
                        <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 z-10`} style={{ animation: 'slideUp 0.2s ease-out' }}>
                          <div className="flex gap-1 p-2 bg-slate-800 rounded-2xl border border-white/10 shadow-xl">
                            {reactions.map(emoji => (
                              <button 
                                key={emoji} 
                                onClick={(e) => { e.stopPropagation(); addReaction(msg.id, emoji) }}
                                className="w-9 h-9 hover:bg-white/10 rounded-xl flex items-center justify-center text-lg transition-transform hover:scale-125"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className={`px-4 py-3 rounded-2xl ${
                        isOwn 
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-tr-sm shadow-lg shadow-amber-500/20' 
                          : 'bg-slate-800/80 text-white rounded-tl-sm border border-white/5'
                      }`}>
                        <p className="text-[15px] leading-relaxed">{msg.text}</p>
                      </div>
                      
                      {msg.reaction && (
                        <div className={`absolute -bottom-2 ${isOwn ? 'left-2' : 'right-2'} px-1.5 py-0.5 bg-slate-800 rounded-full border border-white/10 text-sm shadow-lg`}>
                          {msg.reaction}
                        </div>
                      )}
                      
                      <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-slate-500 text-[11px]">{formatMessageTime(msg.timestamp)}</span>
                        {isOwn && (
                          <span className="text-xs flex items-center">
                            {msg.status === 'read' ? (
                              <div className="flex -space-x-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : msg.status === 'delivered' ? (
                              <div className="flex -space-x-1.5">
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {isTyping && (
                <div className="flex justify-start" style={{ animation: 'slideUp 0.4s ease-out' }}>
                  <div className="w-8 mr-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-sm">👤</div>
                  </div>
                  <div className="bg-slate-800/80 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Quick Replies */}
            <div className="px-4 py-3 border-t border-white/5 bg-slate-900/50">
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {["I've arrived 📍", "On my way 🚗", "2 min away ⏱️", "White Camry 🚙", "See you! 👋"].map((text, i) => (
                  <button
                    key={text}
                    onClick={() => setChatInput(text.replace(/[^\w\s'!?]/g, '').trim())}
                    className="flex-shrink-0 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 rounded-full text-sm text-slate-300 transition-all hover:scale-105 active:scale-95"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Premium Input */}
            <div className="px-4 pb-6 pt-3 bg-gradient-to-t from-slate-950 to-transparent">
              <div className="flex items-center gap-3">
                <button 
                  onMouseDown={() => setIsRecording(true)}
                  onMouseUp={() => setIsRecording(false)}
                  onMouseLeave={() => setIsRecording(false)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isRecording ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isRecording ? 'text-white animate-pulse' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <div className="flex-1">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => { setChatInput(e.target.value); handleTyping() }}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Message..."
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="relative w-12 h-12 group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur transition-opacity ${chatInput.trim() ? 'opacity-50 group-hover:opacity-75' : 'opacity-0'}`} />
                  <div className={`relative w-full h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center transition-all ${chatInput.trim() ? 'opacity-100 active:scale-95' : 'opacity-40'}`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                </button>
              </div>
              
              {isRecording && (
                <div className="mt-3 flex items-center justify-center gap-2 text-red-400 animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-sm font-medium">Recording...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
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
        <ChatModal />
        
        <div ref={mapRef} className="flex-1 bg-slate-800 flex items-center justify-center relative">
          <p className="text-slate-500">Map: Navigate to pickup</p>
          
          {/* Floating Chat Button */}
          <button
            onClick={openChat}
            className="absolute bottom-4 right-4 w-14 h-14 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 transition-all active:scale-95"
          >
            <span className="text-xl">💬</span>
            {unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
                {unreadCount}
              </div>
            )}
          </button>
        </div>
        
        <div className="bg-slate-800 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-xl">👤</div>
            <div className="flex-1">
              <p className="text-white font-semibold">{currentRide.riderName}</p>
              <p className="text-slate-400 text-sm">{currentRide.pickup}</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-4">
            <a href="tel:+12175559876" className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center gap-2"><span>📞</span> Call</a>
            <button onClick={openChat} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center gap-2 relative"><span>💬</span> Message{unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">{unreadCount}</span>}</button>
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
      <header className="pt-safe bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
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
