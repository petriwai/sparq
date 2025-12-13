'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)

  useEffect(() => {
    // Handle the password recovery flow
    const handleRecovery = async () => {
      try {
        // Check if there's a hash fragment with tokens (Supabase sends these)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        // If we have tokens in the URL, set the session
        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          
          if (error) {
            console.error('Session error:', error)
            setError('Invalid or expired recovery link. Please request a new one.')
            setLoading(false)
            return
          }
          
          setIsValidSession(true)
          setLoading(false)
          return
        }

        // Also check for code-based recovery (newer Supabase PKCE flow)
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('Code exchange error:', error)
            setError('Invalid or expired recovery link. Please request a new one.')
            setLoading(false)
            return
          }
          
          setIsValidSession(true)
          setLoading(false)
          return
        }

        // Check if user already has a valid session (e.g., from PASSWORD_RECOVERY event)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          setIsValidSession(true)
        } else {
          setError('No valid recovery session. Please request a new password reset link.')
        }
        
      } catch (err: any) {
        console.error('Recovery error:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode active')
        setIsValidSession(true)
        setLoading(false)
      }
      
      if (event === 'SIGNED_IN' && session) {
        setIsValidSession(true)
        setLoading(false)
      }
    })

    handleRecovery()

    return () => subscription.unsubscribe()
  }, [])

  const handleResetPassword = async () => {
    setError('')
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setUpdating(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      // Sign out after password change for security
      await supabase.auth.signOut()
    }
    
    setUpdating(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400">Verifying recovery link...</p>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Updated!</h2>
            <p className="text-slate-400 mb-6">Your password has been successfully reset. You can now sign in with your new password.</p>
            <a href="/" className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-center transition-colors">
              Sign In
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Error state (no valid session)
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Link Expired</h2>
            <p className="text-slate-400 mb-6">{error || 'This password reset link is invalid or has expired.'}</p>
            <a href="/" className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-center transition-colors mb-3">
              Request New Link
            </a>
            <a href="/" className="block w-full text-center text-slate-400 hover:text-white text-sm transition-colors">
              ← Back to App
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Password entry form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">
            IN<span className="text-amber-400">O</span>KA
          </h1>
          <p className="text-slate-400">Set New Password</p>
        </div>
        
        <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Create New Password</h2>
            <p className="text-slate-400 text-sm">Enter your new password below.</p>
          </div>
          
          <input 
            type="password" 
            placeholder="New Password (min 6 characters)" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500" 
          />
          <input 
            type="password" 
            placeholder="Confirm New Password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" 
          />
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <button 
            onClick={handleResetPassword} 
            disabled={updating || !password || !confirmPassword} 
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {updating ? 'Updating...' : 'Update Password'}
          </button>
          
          <a href="/" className="block w-full mt-4 text-center text-slate-400 hover:text-white text-sm transition-colors">
            ← Back to App
          </a>
        </div>
      </div>
    </div>
  )
}
