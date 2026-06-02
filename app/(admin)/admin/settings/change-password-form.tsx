'use client'

import { useActionState } from 'react'
import { changePasswordAction } from './actions'

export function ChangePasswordForm() {
  const [result, formAction, pending] = useActionState(changePasswordAction, null)

  if (result?.success) {
    return (
      <div className="card border border-green-300 bg-green-50 text-green-800 text-sm">
        ✓ Password changed successfully.
      </div>
    )
  }

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label htmlFor="currentPassword" className="field-label">Current Password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="field-input"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="field-label">New Password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="field-label">Confirm New Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="field-input"
        />
      </div>
      {result?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {result.error}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  )
}
