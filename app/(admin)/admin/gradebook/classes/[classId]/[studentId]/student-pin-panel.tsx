'use client'

import { useState } from 'react'
import { resetStudentPinAction } from '../../../actions'

export function StudentPinPanel({
  studentId, studentUrl, pinIsSet, isTempPin,
}: {
  studentId:  string
  studentUrl: string | null
  pinIsSet:   boolean
  isTempPin:  boolean
}) {
  const [copied,   setCopied]   = useState(false)
  const [resetting, setResetting] = useState(false)
  const [tempPin,  setTempPin]  = useState<string | null>(null)

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleReset = async () => {
    setResetting(true)
    const res = await resetStudentPinAction(studentId)
    setResetting(false)
    if ('tempPin' in res) setTempPin(res.tempPin)
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Student Gradebook Link</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {pinIsSet ? (
            isTempPin
              ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⚠ Temp PIN (must change)</span>
              : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ PIN set</span>
          ) : (
            <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">No PIN yet</span>
          )}
        </div>
      </div>

      {studentUrl ? (
        <div className="flex gap-2 items-center">
          <code className="text-xs bg-white border border-gray-200 rounded px-2 py-1.5 flex-1 break-all text-gray-600">
            {studentUrl}
          </code>
          <button onClick={() => copy(studentUrl)} className="btn-secondary text-xs flex-shrink-0">
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">No link generated yet — re-create this student to generate one.</p>
      )}

      {/* Temp PIN display */}
      {tempPin && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 space-y-1">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">⚠ New Temp PIN — share with student now</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-widest text-tps-navy">{tempPin}</span>
            <button onClick={() => copy(tempPin)} className="btn-secondary text-xs">Copy</button>
          </div>
          <p className="text-[10px] text-amber-700">Student must change this PIN on their first login.</p>
        </div>
      )}

      <button onClick={handleReset} disabled={resetting}
        className="text-xs text-tps-orange hover:underline">
        {resetting ? 'Resetting…' : pinIsSet ? '↺ Reset PIN (generates temp PIN)' : '↺ Generate temp PIN for student'}
      </button>
    </div>
  )
}
