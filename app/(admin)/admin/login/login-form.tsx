'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="username" className="field-label">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="field-input"
          placeholder="admin"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
