'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createUserAction } from '../actions'
import type { UserRole } from '@prisma/client'

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'STUDENT',         label: 'Student',         description: 'Syllabus roadmap, own grades, chat' },
  { value: 'LINE_INSTRUCTOR', label: 'Line Instructor', description: 'Grade entry, content submission, lessons' },
  { value: 'DEPT_CHAIR',      label: 'Dept Chair',      description: 'Content review, dept analytics, scheduling' },
  { value: 'A9_STANDARDS',    label: 'A9 Standards',    description: 'Content vault gatekeeper, survey shield' },
  { value: 'DEAN_COMMANDER',  label: 'Dean / Commander',description: 'Weighting matrix, standings, strategic view' },
  { value: 'SYSTEM_ADMIN',    label: 'System Admin',    description: 'Full system access' },
]

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let pw = ''
  const arr = new Uint32Array(16)
  crypto.getRandomValues(arr)
  for (const n of arr) pw += chars[n % chars.length]
  return pw
}

export function NewUserForm() {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const [email,     setEmail]     = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [role,      setRole]      = useState<UserRole>('STUDENT')
  const [password,  setPassword]  = useState(generatePassword())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTx(async () => {
      const result = await createUserAction({ email, firstName, lastName, role, password })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      setCreated({ email: email.trim().toLowerCase(), password })
    })
  }

  // Success state — show credentials once
  if (created) {
    return (
      <div className="card space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <p className="font-semibold mb-1">Account created.</p>
          <p>Share these credentials securely — the password is not shown again.</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-1">
          <p><span className="text-gray-400">Email:</span> {created.email}</p>
          <p><span className="text-gray-400">Password:</span> {created.password}</p>
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(`Email: ${created.email}\nPassword: ${created.password}`)}
          className="btn-secondary text-sm px-4 py-2"
        >
          Copy Credentials
        </button>
        <div className="flex gap-3 pt-1">
          <button onClick={() => router.push('/portal/users')} className="btn-primary text-sm px-5 py-2">
            Done
          </button>
          <button
            onClick={() => {
              setCreated(null)
              setEmail(''); setFirstName(''); setLastName('')
              setPassword(generatePassword())
            }}
            className="btn-secondary text-sm px-4 py-2"
          >
            Add Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">First Name *</label>
          <input value={firstName} onChange={e => setFirstName(e.target.value)} className="field-input" disabled={pending} autoFocus />
        </div>
        <div>
          <label className="field-label">Last Name *</label>
          <input value={lastName} onChange={e => setLastName(e.target.value)} className="field-input" disabled={pending} />
        </div>
      </div>

      <div>
        <label className="field-label">Email *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-input" placeholder="name@us.af.mil" disabled={pending} />
        <p className="text-xs text-gray-400 mt-1">
          For students: use the same email as their student profile to auto-link accounts.
        </p>
      </div>

      <div>
        <label className="field-label">Role *</label>
        <div className="space-y-1.5">
          {ROLE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                role === opt.value ? 'border-tps-orange bg-tps-orange/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="mt-0.5 text-tps-orange focus:ring-tps-orange"
                disabled={pending}
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">Initial Password *</label>
        <div className="flex gap-2">
          <input value={password} onChange={e => setPassword(e.target.value)} className="field-input flex-1 font-mono" disabled={pending} />
          <button type="button" onClick={() => setPassword(generatePassword())} className="btn-secondary text-xs px-3" disabled={pending}>
            Regenerate
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Minimum 12 characters. User should change it on first login.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={pending} className="btn-primary text-sm px-5 py-2.5">
          {pending ? 'Creating…' : 'Create User'}
        </button>
        <button type="button" onClick={() => router.push('/portal/users')} className="btn-secondary text-sm px-4 py-2.5" disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
