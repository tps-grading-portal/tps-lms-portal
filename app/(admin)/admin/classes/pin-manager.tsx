'use client'

import { useActionState, useState } from 'react'
import { rotatePinAction } from '../actions'

interface PinManagerProps {
  classId: string
  graderPinSet:    boolean
  chairPinSet:     boolean
}

export function PinManager({ classId, graderPinSet, chairPinSet }: PinManagerProps) {
  const [rotatePinResult, rotatePinFormAction, rotatePending] = useActionState(rotatePinAction, null)
  const [expandedRole, setExpandedRole] = useState<'GRADER' | 'PANEL_CHAIR' | null>(null)

  return (
    <div className="space-y-3">
      {(['GRADER', 'PANEL_CHAIR'] as const).map((role) => {
        const label   = role === 'GRADER' ? 'Grader PIN' : 'Panel Chair PIN'
        const isSet   = role === 'GRADER' ? graderPinSet : chairPinSet
        const isOpen  = expandedRole === role

        return (
          <div key={role} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-800">{label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isSet ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSet ? '✓ Set' : 'Not configured'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedRole(isOpen ? null : role)}
                className="btn-secondary text-xs"
              >
                {isOpen ? 'Cancel' : 'Rotate PIN'}
              </button>
            </div>

            {isOpen && (
              <form action={rotatePinFormAction} className="flex gap-2 items-end border-t border-gray-100 pt-3">
                <input type="hidden" name="classId" value={classId} />
                <input type="hidden" name="role"    value={role} />
                <div className="flex-1">
                  <label className="field-label text-xs">
                    New PIN{' '}
                    <span className="font-normal text-gray-400">(leave blank to auto-generate)</span>
                  </label>
                  <input
                    name="customPin"
                    type="text"
                    inputMode="numeric"
                    placeholder="Auto-generate"
                    maxLength={20}
                    className="field-input font-mono tracking-widest text-sm"
                  />
                </div>
                <button type="submit" disabled={rotatePending} className="btn-primary text-sm">
                  {rotatePending ? '…' : 'Set PIN'}
                </button>
              </form>
            )}

            {/* Show new PIN once after rotation */}
            {rotatePinResult && 'success' in rotatePinResult && rotatePinResult.success && rotatePinResult.role === role && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-800 mb-1">
                  ⚠️ New {label} — save this, it won&apos;t be shown again
                </p>
                <p className="font-mono text-xl font-bold tracking-widest text-gray-900">
                  {rotatePinResult.newPin}
                </p>
              </div>
            )}
            {rotatePinResult && 'error' in rotatePinResult && !rotatePinResult.success && (rotatePinResult as { role?: string }).role === role && (
              <p className="text-sm text-red-600">{rotatePinResult.error}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
