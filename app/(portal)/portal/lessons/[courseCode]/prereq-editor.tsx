'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addPrerequisiteAction, removePrerequisiteAction, getCatalogForPrereqsAction } from './actions'

type PrereqRow = { prerequisiteId: string; courseCode: string; title: string; isHard: boolean }
type CatalogRow = { id: string; courseCode: string; title: string }

export function PrereqEditor({
  syllabusEventId, prereqs, canEdit,
}: {
  syllabusEventId: string
  prereqs:         PrereqRow[]
  canEdit:         boolean
}) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [adding,  setAdding] = useState(false)
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null)
  const [pickId,  setPickId]  = useState('')
  const [isHard,  setIsHard]  = useState(true)

  useEffect(() => {
    if (adding && !catalog) {
      getCatalogForPrereqsAction().then(setCatalog)
    }
  }, [adding, catalog])

  const existingIds = new Set(prereqs.map(p => p.prerequisiteId))

  function handleAdd() {
    if (!pickId) return
    setError(null)
    startTx(async () => {
      const result = await addPrerequisiteAction(syllabusEventId, pickId, isHard)
      if ('error' in result && result.error) { setError(result.error); return }
      setPickId('')
      setAdding(false)
      router.refresh()
    })
  }

  function handleRemove(prerequisiteId: string) {
    startTx(async () => {
      const result = await removePrerequisiteAction(syllabusEventId, prerequisiteId)
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  if (prereqs.length === 0 && !canEdit) return null

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Prerequisites</h2>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="btn-secondary text-xs px-3 py-1.5" disabled={pending}>
            + Add Prerequisite
          </button>
        )}
      </div>

      {prereqs.length === 0 ? (
        <p className="text-sm text-gray-400">No prerequisites.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {prereqs.map(p => (
            <span
              key={p.prerequisiteId}
              className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 pl-3 pr-1.5 py-1.5 rounded-lg"
            >
              <Link
                href={`/portal/lessons/${encodeURIComponent(p.courseCode)}`}
                className="font-mono font-bold text-tps-navy hover:text-tps-orange"
              >
                {p.courseCode}
              </Link>
              <span className="text-gray-500">{p.title}</span>
              {p.isHard
                ? <span className="text-red-500 font-medium">required</span>
                : <span className="text-amber-500 font-medium">soft</span>}
              {canEdit && (
                <button
                  onClick={() => handleRemove(p.prerequisiteId)}
                  disabled={pending}
                  className="text-gray-300 hover:text-red-500 text-base leading-none px-0.5"
                  title="Remove prerequisite"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={pickId}
              onChange={e => setPickId(e.target.value)}
              className="field-input flex-1 min-w-[220px] text-sm"
              disabled={pending || !catalog}
            >
              <option value="">{catalog ? 'Select prerequisite course…' : 'Loading catalog…'}</option>
              {catalog?.filter(c => c.id !== syllabusEventId && !existingIds.has(c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isHard}
                onChange={e => setIsHard(e.target.checked)}
                className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
              />
              Hard requirement (blocks)
            </label>
            <button onClick={handleAdd} disabled={pending || !pickId} className="btn-primary text-xs px-3 py-2">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="text-gray-400 text-sm px-1">Cancel</button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mt-2">{error}</div>}
    </section>
  )
}
