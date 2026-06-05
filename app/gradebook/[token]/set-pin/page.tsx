'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function SetPinPage() {
  const { token }  = useParams<{ token: string }>()
  const router     = useRouter()
  const search     = useSearchParams()
  const isChange   = search.get('change') === '1'
  const [pin,      setPin]      = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [tempPin,  setTempPin]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN must be at least 4 characters.'); return }
    if (pin !== confirm)  { setError('PINs do not match.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/gradebook/set-pin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, pin, tempPin: isChange ? tempPin : undefined }),
    })
    setLoading(false)
    if (res.ok) {
      router.push(`/gradebook/${token}`)
    } else {
      const { error: msg } = await res.json()
      setError(msg ?? 'Could not set PIN.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-tps-orange uppercase tracking-widest">TPS Test Foundations</p>
          <h1 className="text-xl font-bold text-tps-navy">
            {isChange ? 'Change Your PIN' : 'Set Your PIN'}
          </h1>
          <p className="text-sm text-gray-500">
            {isChange
              ? 'Your admin has reset your PIN. Enter the temporary PIN you were given, then choose a new one.'
              : 'Choose a PIN to protect your gradebook. You will use this every time you log in.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isChange && (
            <div>
              <label className="field-label text-xs">Temporary PIN (from your instructor)</label>
              <input
                type="password"
                inputMode="numeric"
                value={tempPin}
                onChange={(e) => setTempPin(e.target.value)}
                placeholder="Temp PIN"
                className="field-input text-center font-mono tracking-widest"
                autoFocus
              />
            </div>
          )}
          <div>
            <label className="field-label text-xs">New PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Choose a PIN (min 4 digits)"
              className="field-input text-center text-xl font-mono tracking-widest"
              autoFocus={!isChange}
            />
          </div>
          <div>
            <label className="field-label text-xs">Confirm PIN</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat PIN"
              className="field-input text-center text-xl font-mono tracking-widest"
            />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={loading || !pin || !confirm} className="btn-primary w-full">
            {loading ? 'Saving…' : isChange ? 'Change PIN & Continue' : 'Set PIN & View Gradebook'}
          </button>
        </form>
      </div>
    </main>
  )
}
