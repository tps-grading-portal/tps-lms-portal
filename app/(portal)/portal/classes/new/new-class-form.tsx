'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClassAction } from '../actions'
import type { Concentration } from '@prisma/client'

export function NewClassForm() {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [name,          setName]          = useState('')
  const [concentration, setConcentration] = useState<Concentration | ''>('')
  const [startDate,     setStartDate]     = useState('')
  const [endDate,       setEndDate]       = useState('')
  const [isActive,      setIsActive]      = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Class name is required.'); return }

    startTx(async () => {
      const result = await createClassAction({
        name,
        concentration: concentration || null,
        startDate:     startDate || null,
        endDate:       endDate || null,
        isActive,
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.push(`/portal/classes/${result.classId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div>
        <label className="field-label">Class Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="field-input"
          placeholder="e.g. 26B"
          maxLength={10}
          disabled={pending}
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-1">Cohort designator — year + letter (e.g. 26B).</p>
      </div>

      <div>
        <label className="field-label">Concentration</label>
        <select
          value={concentration}
          onChange={e => setConcentration(e.target.value as Concentration | '')}
          className="field-input"
          disabled={pending}
        >
          <option value="">Mixed (FTC + STC)</option>
          <option value="FTC">FTC — Flight Test</option>
          <option value="STC">STC — Space Test</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="field-input" disabled={pending} />
        </div>
        <div>
          <label className="field-label">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="field-input" disabled={pending} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
          disabled={pending}
        />
        <span className="text-sm text-gray-700">Set as the active class</span>
      </label>
      {isActive && (
        <p className="text-xs text-amber-600 -mt-3">
          This will deactivate any currently active class.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={pending} className="btn-primary text-sm px-5 py-2.5">
          {pending ? 'Creating…' : 'Create Class'}
        </button>
        <button type="button" onClick={() => router.push('/portal/classes')} className="btn-secondary text-sm px-4 py-2.5" disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
