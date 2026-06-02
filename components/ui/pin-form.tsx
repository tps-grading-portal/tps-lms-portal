'use client'

import { useActionState } from 'react'

interface ClassOption {
  id: string
  name: string
}

interface PinFormProps {
  action: (prev: string | null, formData: FormData) => Promise<string | null>
  classes: ClassOption[]
  role: 'GRADER' | 'PANEL_CHAIR'
  submitLabel: string
}

export function PinForm({ action, classes, submitLabel }: PinFormProps) {
  const [error, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Class selector — only show if more than one active class */}
      {classes.length > 1 ? (
        <div>
          <label htmlFor="classId" className="field-label">
            Class
          </label>
          <select id="classId" name="classId" required className="field-select">
            <option value="">Select class…</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                Class {cls.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          {/* Single active class — pre-select silently */}
          <input type="hidden" name="classId" value={classes[0]?.id ?? ''} />
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
            Class <strong>{classes[0]?.name}</strong>
          </div>
        </>
      )}

      {/* PIN input — numeric keyboard on mobile */}
      <div>
        <label htmlFor="pin" className="field-label">
          Room PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          required
          className="field-input font-mono text-center text-2xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-base"
          placeholder="Enter PIN"
          autoFocus
          maxLength={20}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full text-base py-4"
      >
        {pending ? 'Verifying…' : submitLabel}
      </button>
    </form>
  )
}
