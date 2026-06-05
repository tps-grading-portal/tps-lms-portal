'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function StudentAuthPage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/gradebook/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, pin }),
    })
    setLoading(false)
    if (res.ok) {
      router.push(`/gradebook/${token}`)
    } else {
      const { error: msg } = await res.json()
      setError(msg ?? 'Incorrect PIN.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-tps-orange uppercase tracking-widest">TPS Test Foundations</p>
          <h1 className="text-xl font-bold text-tps-navy">Student Gradebook</h1>
          <p className="text-sm text-gray-500">Enter your PIN to view your grades</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="field-input text-center text-2xl font-mono tracking-widest"
            maxLength={20}
            autoFocus
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={loading || !pin} className="btn-primary w-full">
            {loading ? 'Checking…' : 'View My Gradebook'}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center">
          No PIN? Contact your instructor or admin to get your access link and PIN.
        </p>
      </div>
    </main>
  )
}
