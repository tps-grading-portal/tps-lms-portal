'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InstructorAuthPage() {
  const router  = useRouter()
  const [name,    setName]    = useState('')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/instructor/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name.trim(), pin }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/instructor/gradebook')
    } else {
      const { error: msg } = await res.json()
      setError(msg ?? 'Incorrect name or PIN.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/grad-patch.png" alt="TPS" width={48} height={48} className="mx-auto object-contain" />
          <p className="text-xs font-bold text-tps-orange uppercase tracking-widest mt-2">TPS Test Foundations</p>
          <h1 className="text-xl font-bold text-tps-navy">Instructor Login</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Your Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Maj. Smith" className="field-input" autoFocus />
          </div>
          <div>
            <label className="field-label">PIN</label>
            <input type="password" inputMode="numeric" value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN" className="field-input font-mono tracking-widest" />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={loading || !name || !pin} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  )
}
