'use client'

import { useActionState, useState } from 'react'
import { setActiveClassAction, deactivateClassAction, rotatePinAction, setCompOralCurrentAction } from './actions'
import { cn } from '@/lib/utils'

type ClassRow = {
  id:                string
  name:              string
  isActive:          boolean
  isCompOralCurrent: boolean
  createdAt:         Date
  _count:            { students: number; sessions: number }
}

export function ClassTable({ classes }: { classes: ClassRow[] }) {
  return (
    <div className="space-y-3">
      {classes.map((cls) => (
        <ClassCard key={cls.id} cls={cls} />
      ))}
    </div>
  )
}

function ClassCard({ cls }: { cls: ClassRow }) {
  const [rotatePinResult, rotatePinFormAction, rotatePending] = useActionState(rotatePinAction, null)
  const [showRotate, setShowRotate] = useState<'GRADER' | 'PANEL_CHAIR' | null>(null)

  return (
    <div className={cn('card border', cls.isCompOralCurrent ? 'border-tps-orange bg-orange-50' : cls.isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-200')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-tps-navy text-lg">{cls.name}</span>
            {cls.isCompOralCurrent && (
              <span className="text-xs bg-tps-orange text-white px-2 py-0.5 rounded-full font-medium">
                Comp Oral — Current
              </span>
            )}
            {cls.isActive && !cls.isCompOralCurrent && (
              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {cls._count.students} student{cls._count.students !== 1 ? 's' : ''} ·{' '}
            {cls._count.sessions} session{cls._count.sessions !== 1 ? 's' : ''} ·{' '}
            Created {new Date(cls.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap flex-shrink-0">
          {/* Comp Oral current selector */}
          {!cls.isCompOralCurrent && cls.isActive && (
            <form action={async () => { await setCompOralCurrentAction(cls.id) }}>
              <button type="submit" className="btn-primary text-xs">
                Set Comp Oral Current
              </button>
            </form>
          )}

          {/* Active toggle */}
          <form action={async () => {
            if (cls.isActive) await deactivateClassAction(cls.id)
            else await setActiveClassAction(cls.id)
          }}>
            <button type="submit" className={cls.isActive ? 'btn-ghost text-xs' : 'btn-secondary text-xs'}>
              {cls.isActive ? 'Deactivate' : 'Set Active'}
            </button>
          </form>
        </div>
      </div>

      {/* PIN management */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
        {(['GRADER', 'PANEL_CHAIR'] as const).map((role) => (
          <button key={role} type="button"
            onClick={() => setShowRotate(showRotate === role ? null : role)}
            className="btn-ghost text-xs border border-gray-300">
            Rotate {role === 'GRADER' ? 'Grader' : 'Chair'} PIN
          </button>
        ))}
      </div>

      {showRotate && (
        <form action={rotatePinFormAction} className="mt-3 flex gap-2 items-end">
          <input type="hidden" name="classId" value={cls.id} />
          <input type="hidden" name="role" value={showRotate} />
          <div className="flex-1">
            <label className="field-label text-xs">
              New {showRotate === 'GRADER' ? 'Grader' : 'Chair'} PIN{' '}
              <span className="font-normal text-gray-400">(leave blank to auto-generate)</span>
            </label>
            <input name="customPin" type="text" inputMode="numeric"
              className="field-input font-mono tracking-widest text-sm"
              placeholder="Auto-generate" maxLength={20} />
          </div>
          <button type="submit" disabled={rotatePending} className="btn-primary text-sm">
            {rotatePending ? '…' : 'Rotate'}
          </button>
          <button type="button" onClick={() => setShowRotate(null)} className="btn-ghost text-sm">
            Cancel
          </button>
        </form>
      )}

      {rotatePinResult?.success && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-bold text-amber-800 mb-1">New PIN (save this — not shown again)</p>
          <p className="font-mono text-lg font-bold tracking-widest">{rotatePinResult.newPin}</p>
          <p className="text-xs text-gray-500">{rotatePinResult.role === 'GRADER' ? 'Grader' : 'Panel Chair'} PIN updated</p>
        </div>
      )}
      {rotatePinResult && !rotatePinResult.success && (
        <p className="mt-2 text-sm text-red-600">{rotatePinResult.error}</p>
      )}
    </div>
  )
}
