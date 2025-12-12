'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode active')
      }
    })
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

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✓</span></div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Updated!</h2>
            <p className="text-slate-400 mb-6">Your password has been successfully reset.</p>
            <a href="/" className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-center">Back to App</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">IN<span className="text-amber-400">O</span>KA</h1>
          <p className="text-slate-400">Set New Password</p>
        </div>
        
        <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🔐</span></div>
            <h2 className="text-xl font-semibold text-white mb-2">Create New Password</h2>
            <p className="text-slate-400 text-sm">Enter your new password below.</p>
          </div>
          
          <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-amber-500" />
          <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-amber-500" />
          
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          
          <button onClick={handleResetPassword} disabled={loading || !password || !confirmPassword} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button>
          
          <a href="/" className="block w-full mt-4 text-center text-slate-400 hover:text-white text-sm">← Back to App</a>
        </div>
      </div>
    </div>
  )
}
