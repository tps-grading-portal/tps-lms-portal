'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { assignCourseAction, removeAssignmentAction } from '../users/actions'

export type OwnerChip = { id: string; name: string; via: string; assignmentId?: string }
export type StaffOption = { id: string; name: string }

/**
 * Owner cell with click-to-assign: clicking "No owner" (or the +) opens an
 * inline picker that assigns a course owner on the spot. Course-level owners
 * can be removed (×) without naming a replacement — the course then shows as
 * unowned with an alert rather than keeping the wrong owner.
 */
export function QuickAssign({
  eventId, owners, staff,
}: {
  eventId: string
  owners:  OwnerChip[]
  staff:   StaffOption[]
}) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [pick,    setPick]    = useState('')
  const [pending, startTx]    = useTransition()
  const [error,   setError]   = useState<string | null>(null)

  function handleAssign() {
    if (!pick) return
    setError(null)
    startTx(async () => {
      const result = await assignCourseAction(pick, eventId)
      if ('error' in result && result.error) { setError(result.error); return }
      setOpen(false)
      setPick('')
      router.refresh()
    })
  }

  function handleRemove(o: OwnerChip) {
    if (!o.assignmentId) return
    if (!confirm(`Remove ${o.name} as course owner? The course will show as unowned until someone else is assigned.`)) return
    setError(null)
    startTx(async () => {
      const result = await removeAssignmentAction(o.assignmentId!)
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  if (open) {
    return (
      <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
        <select
          value={pick}
          onChange={e => setPick(e.target.value)}
          className="field-input text-xs w-44 py-1"
          autoFocus
          disabled={pending}
        >
          <option value="">Assign owner…</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={handleAssign} disabled={pending || !pick} className="btn-primary text-xs px-2 py-1">
          {pending ? '…' : 'Assign'}
        </button>
        <button onClick={() => setOpen(false)} className="text-gray-400 text-xs px-1">×</button>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    )
  }

  if (owners.length === 0) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline"
        title="Click to assign an owner"
      >
        No owner — assign +
      </button>
    )
  }

  return (
    <span className="text-xs text-gray-500">
      {owners.slice(0, 3).map((o, i) => (
        <span key={o.id} className="group/owner">
          {i > 0 && ', '}
          <Link href={`/portal/users/${o.id}`} className="hover:underline text-tps-navy">
            {o.name}
          </Link>
          <span className="text-gray-300"> ({o.via})</span>
          {o.assignmentId && (
            <button
              onClick={() => handleRemove(o)}
              disabled={pending}
              className="ml-0.5 text-gray-300 hover:text-red-500 font-bold disabled:opacity-40"
              title={`Remove ${o.name} as course owner (no replacement needed)`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {owners.length > 3 && ` +${owners.length - 3}`}
      <button
        onClick={() => setOpen(true)}
        className="ml-1.5 text-gray-300 hover:text-tps-orange font-bold"
        title="Add another owner"
      >
        +
      </button>
      {error && <span className="block text-[10px] text-red-600">{error}</span>}
    </span>
  )
}
