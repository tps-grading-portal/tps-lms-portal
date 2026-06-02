'use client'

import { useActionState, useState } from 'react'
import { createClassAction } from './actions'

export function CreateClassForm() {
  const [result, formAction, pending] = useActionState(createClassAction, null)
  const [showPins, setShowPins] = useState(false)

  // Show success panel with revealed PINs after creation
  if (result?.success && showPins) {
    return (
      <div className="card border border-green-300 bg-green-50 space-y-4 max-w-lg">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">✓</span>
          <h3 className="font-semibold text-green-800">
            Class <strong>{result.className}</strong> created
          </h3>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
            ⚠️ Save these PINs now — they cannot be retrieved later
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PinReveal label="Grader PIN" pin={result.graderPin} />
            <PinReveal label="Chair PIN" pin={result.chairPin} />
          </div>
        </div>

        <button
          onClick={() => setShowPins(false)}
          className="btn-secondary text-sm"
        >
          Create Another Class
        </button>
      </div>
    )
  }

  // After creation success but before revealing PINs
  if (result?.success && !showPins) {
    setShowPins(true)
    return null
  }

  return (
    <form action={formAction} className="card max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="className" className="field-label">
            Class Name <span className="text-gray-400 font-normal">(e.g. 26A, 26B)</span>
          </label>
          <input
            id="className"
            name="name"
            type="text"
            required
            maxLength={20}
            className="field-input uppercase"
            placeholder="26A"
          />
        </div>

        <div>
          <label htmlFor="graderPin" className="field-label">
            Grader PIN
          </label>
          <input
            id="graderPin"
            name="graderPin"
            type="text"
            required
            minLength={4}
            maxLength={20}
            inputMode="numeric"
            className="field-input font-mono tracking-widest"
            placeholder="4–8 digits"
          />
        </div>

        <div>
          <label htmlFor="chairPin" className="field-label">
            Panel Chair PIN
          </label>
          <input
            id="chairPin"
            name="chairPin"
            type="text"
            required
            minLength={4}
            maxLength={20}
            inputMode="numeric"
            className="field-input font-mono tracking-widest"
            placeholder="4–8 digits"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="makeActive"
          name="makeActive"
          type="checkbox"
          value="on"
          defaultChecked
          className="h-4 w-4 rounded border-gray-300 text-tps-blue"
        />
        <label htmlFor="makeActive" className="text-sm text-gray-700">
          Set as active class (deactivates any current active class)
        </label>
      </div>

      {result && !result.success && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {result.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Creating…' : 'Create Class'}
      </button>
    </form>
  )
}

function PinReveal({ label, pin }: { label: string; pin: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(pin).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-lg border border-amber-200 p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-mono text-xl font-bold text-gray-900 tracking-widest">{pin}</p>
      <button
        type="button"
        onClick={copy}
        className="text-xs text-tps-blue hover:underline mt-1"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
