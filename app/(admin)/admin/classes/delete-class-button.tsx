'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteClassAction } from '../actions'

interface Props {
  classId:      string
  className:    string
  sessionCount: number
  studentCount: number
}

/**
 * 3-step delete confirmation.
 *
 * Each confirmation action is deliberately placed in a DIFFERENT screen location
 * so the flow cannot be completed by rapid clicking in one spot.
 *
 * Step 1 — BOTTOM LEFT of card  : low-key "Delete class" link
 * Step 2 — TOP RIGHT of modal   : "I understand, continue" after reading the warning
 * Step 3 — BOTTOM LEFT of modal : type class name → "Permanently Delete" (enabled only when name matches)
 */
export function DeleteClassButton({ classId, className, sessionCount, studentCount }: Props) {
  const [step,         setStep]         = useState<0 | 1 | 2 | 3>(0)
  const [typedName,    setTypedName]    = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [, startTransition]             = useTransition()
  const [deleting,     setDeleting]     = useState(false)
  const router = useRouter()

  const nameMatches = typedName.trim().toUpperCase() === className.toUpperCase()

  const handleDelete = async () => {
    if (!nameMatches) return
    setDeleting(true)
    setError(null)
    const result = await deleteClassAction(classId, typedName)
    if (result.error) {
      setError(result.error)
      setDeleting(false)
    } else {
      startTransition(() => router.push('/admin/classes'))
    }
  }

  const reset = () => {
    setStep(0)
    setTypedName('')
    setError(null)
  }

  return (
    <>
      {/* ── Step 0: Entry point — bottom left, intentionally subtle ────────── */}
      {step === 0 && (
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors mt-3 block"
        >
          Delete class…
        </button>
      )}

      {/* ── Step 1: Warning overlay ──────────────────────────────────────── */}
      {step >= 1 && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={reset}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-red-600 px-5 py-4">
              <h2 className="text-white font-bold text-lg">Delete Class {className}</h2>
              <p className="text-red-200 text-sm mt-0.5">This action is permanent and cannot be undone.</p>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              {step === 1 && (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
                    <p className="font-semibold">The following will be permanently deleted:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li><strong>{studentCount}</strong> student number record{studentCount !== 1 ? 's' : ''}</li>
                      <li><strong>{sessionCount}</strong> grading session{sessionCount !== 1 ? 's' : ''} and all associated grades</li>
                      <li>All grader assessments and criterion grades</li>
                      <li>All student and instructor survey responses</li>
                      <li>The frozen criteria snapshot for this class</li>
                      <li>All access PINs for this class</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-600">
                    If you created this class by mistake and need to update the grading criteria,
                    deleting the class and creating a new one via the wizard is the correct approach.
                  </p>

                  {/* Step 1 button — TOP RIGHT */}
                  <div className="flex justify-end pt-2">
                    <div className="flex gap-3">
                      <button type="button" onClick={reset} className="btn-secondary text-sm">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg min-h-[44px] transition-colors"
                      >
                        I understand, continue →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                    <strong>Final confirmation required.</strong> Type the class name exactly to enable deletion.
                  </div>

                  <div>
                    <label className="field-label">
                      Type <span className="font-mono font-bold text-red-700">{className}</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => { setTypedName(e.target.value); setError(null) }}
                      placeholder={`Type "${className}" here`}
                      className="field-input font-mono"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {!nameMatches && typedName.length > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Does not match — type exactly: {className}
                      </p>
                    )}
                    {nameMatches && (
                      <p className="text-xs text-green-600 mt-1 font-medium">✓ Name confirmed</p>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </p>
                  )}

                  {/* Step 2 button — BOTTOM LEFT (opposite of Step 1) */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => { if (!deleting && nameMatches) handleDelete() }}
                      disabled={!nameMatches || deleting}
                      className={`text-sm font-semibold px-4 py-2 rounded-lg min-h-[44px] transition-colors ${
                        nameMatches && !deleting
                          ? 'bg-red-700 hover:bg-red-800 text-white'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {deleting ? 'Deleting…' : `Permanently Delete Class ${className}`}
                    </button>
                    <button type="button" onClick={reset} className="btn-ghost text-sm text-gray-500">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
