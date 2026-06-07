'use client'

import { useState, useTransition } from 'react'
import { resetUserPasswordAction } from './actions'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let pw = ''
  const arr = new Uint32Array(16)
  crypto.getRandomValues(arr)
  for (const n of arr) pw += chars[n % chars.length]
  return pw
}

/** One-click password reset for any student or staff account. */
export function QuickReset({ userId, name, email }: { userId: string; name: string; email: string }) {
  const [pending, startTx] = useTransition()
  const [result,  setResult] = useState<string | null>(null)
  const [error,   setError]  = useState<string | null>(null)

  function handleReset() {
    if (!confirm(`Reset password for ${name} (${email})? A new password will be generated and shown once.`)) return
    const pw = generatePassword()
    setError(null)
    startTx(async () => {
      const res = await resetUserPasswordAction(userId, pw)
      if ('error' in res && res.error) { setError(res.error); return }
      setResult(pw)
    })
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); handleReset() }}
        disabled={pending}
        className="text-xs text-tps-blue hover:underline disabled:opacity-40"
        title="Generate a new password for this account"
      >
        {pending ? '…' : 'Reset PW'}
      </button>
      {error && <span className="text-[10px] text-red-600 ml-1">{error}</span>}

      {result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setResult(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-tps-navy">Password Reset — {name}</h3>
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              Share securely — the password is not shown again.
            </div>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-1">
              <p><span className="text-gray-400">Email:</span> {email}</p>
              <p><span className="text-gray-400">Password:</span> {result}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard?.writeText(`Email: ${email}\nPassword: ${result}`)}
                className="btn-secondary text-sm px-4 py-2"
              >
                Copy Credentials
              </button>
              <button onClick={() => setResult(null)} className="btn-primary text-sm px-4 py-2">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
