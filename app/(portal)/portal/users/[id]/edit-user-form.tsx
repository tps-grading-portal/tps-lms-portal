'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateUserAction, toggleUserActiveAction, resetUserPasswordAction } from '../actions'
import type { UserRole, Track } from '@prisma/client'

const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: 'System Admin', DEAN_COMMANDER: 'Dean / Commander', A9_STANDARDS: 'A9 Standards',
  DEPT_CHAIR: 'Dept Chair', LINE_INSTRUCTOR: 'Line Instructor', STUDENT: 'Student',
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let pw = ''
  const arr = new Uint32Array(16)
  crypto.getRandomValues(arr)
  for (const n of arr) pw += chars[n % chars.length]
  return pw
}

type Props = {
  user: {
    id:          string
    email:       string
    firstName:   string
    lastName:    string
    role:        UserRole
    isActive:    boolean
    lastLoginAt: string | null
    createdAt:   string
    isSelf:      boolean
    studentProfile: {
      id: string; classId: string; className: string; number: number; track: Track
    } | null
  }
}

export function EditUserForm({ user }: Props) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [saved,   setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName,  setLastName]  = useState(user.lastName)
  const [role,      setRole]      = useState<UserRole>(user.role)

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await updateUserAction(user.id, { firstName, lastName, role })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  function handleToggleActive() {
    const verb = user.isActive ? 'Deactivate' : 'Reactivate'
    if (!confirm(`${verb} ${user.firstName} ${user.lastName}? ${user.isActive ? 'They will no longer be able to log in.' : ''}`)) return
    startTx(async () => {
      const result = await toggleUserActiveAction(user.id)
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.refresh()
    })
  }

  function handleResetPassword() {
    const pw = generatePassword()
    if (!confirm(`Reset password for ${user.email}? A new password will be generated and shown once.`)) return
    startTx(async () => {
      const result = await resetUserPasswordAction(user.id, pw)
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      setNewPassword(pw)
    })
  }

  return (
    <div className="space-y-5">
      {/* Status banner */}
      {!user.isActive && (
        <div className="rounded-lg bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          This account is <strong>deactivated</strong> — the user cannot log in.
        </div>
      )}

      {/* New password reveal */}
      {newPassword && (
        <div className="card border-green-200 bg-green-50 space-y-3">
          <p className="text-sm text-green-800 font-semibold">Password reset. Share securely — shown only once:</p>
          <p className="font-mono text-sm bg-white rounded-lg px-3 py-2 border border-green-200">{newPassword}</p>
          <button
            onClick={() => navigator.clipboard?.writeText(newPassword)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Copy Password
          </button>
        </div>
      )}

      {/* Edit form */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="field-input" disabled={pending} />
          </div>
          <div>
            <label className="field-label">Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className="field-input" disabled={pending} />
          </div>
        </div>

        <div>
          <label className="field-label">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="field-input"
            disabled={pending || user.isSelf}
          >
            {Object.entries(ROLE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {user.isSelf && <p className="text-xs text-gray-400 mt-1">You cannot change your own role.</p>}
        </div>

        <div className="text-xs text-gray-400 space-y-0.5 pt-1">
          <p>Created {new Date(user.createdAt).toLocaleDateString()}</p>
          <p>Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Saved.</div>}

        <div className="flex gap-3 pt-1">
          <button onClick={handleSave} disabled={pending} className="btn-primary text-sm px-5 py-2.5">
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => router.push('/portal/users')} className="btn-secondary text-sm px-4 py-2.5" disabled={pending}>
            Back
          </button>
        </div>
      </div>

      {/* Linked student profile */}
      {user.studentProfile && (
        <div className="card flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-tps-navy">Linked Student Profile</p>
            <p className="text-xs text-gray-500">
              {user.studentProfile.className}-{user.studentProfile.number} · {user.studentProfile.track} track
            </p>
          </div>
          <Link
            href={`/portal/classes/${user.studentProfile.classId}/students/${user.studentProfile.id}`}
            className="btn-secondary text-sm px-4 py-2 shrink-0"
          >
            View Student Record
          </Link>
        </div>
      )}

      {/* Danger zone */}
      {!user.isSelf && (
        <div className="card space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Actions</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleResetPassword} disabled={pending} className="btn-secondary text-sm px-4 py-2">
              Reset Password
            </button>
            <button
              onClick={handleToggleActive}
              disabled={pending}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                user.isActive
                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
              }`}
            >
              {user.isActive ? 'Deactivate Account' : 'Reactivate Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
