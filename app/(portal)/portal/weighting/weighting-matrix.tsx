'use client'

import { useState, useTransition, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrackWeightsAction, addEventsToWeightingAction, removeEventFromWeightingAction } from './actions'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import type { Track } from '@prisma/client'

const TRACKS: Track[] = ['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM']
const TRACK_LABELS: Record<Track, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'STC/Operator',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

type EventRow = {
  id:         string
  courseCode: string
  title:      string
  deptCode:   string
  tracks:     string[]
}

type Props = {
  events:    EventRow[]   // currently weighted (isGraded) events
  catalog:   EventRow[]   // not-yet-weighted catalog for the picker
  weightMap: Record<string, number>
}

// ── Add events picker ─────────────────────────────────────────────────────────

function AddEventsModal({ catalog, onClose }: { catalog: EventRow[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [search,  setSearch] = useState('')
  const [dept,    setDept]   = useState<string | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const depts = [...new Set(catalog.map(e => e.deptCode))]
    .sort((a, b) => deptSortIndex(a) - deptSortIndex(b))

  const filtered = catalog.filter(e => {
    if (dept !== 'all' && e.deptCode !== dept) return false
    if (search && !e.courseCode.toLowerCase().includes(search.toLowerCase()) &&
        !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function handleAdd() {
    setError(null)
    startTx(async () => {
      const result = await addEventsToWeightingAction([...selected])
      if ('error' in result) { setError(String(result.error)); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">Add Events to Weighting</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Added events become graded and count toward scores and standings.
          Events without a gradesheet get a minimal auto-generated one.
        </p>

        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            type="search"
            placeholder="Search course code or title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input flex-1 min-w-[160px]"
          />
          <select value={dept} onChange={e => setDept(e.target.value)} className="field-input w-auto">
            <option value="all">All Courses</option>
            {depts.map(d => <option key={d} value={d}>{d} — {deptLabel(d)}</option>)}
          </select>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No unweighted events match.</p>
          ) : filtered.map(e => (
            <label
              key={e.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selected.has(e.id) ? 'border-tps-orange bg-tps-orange/5' : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
              />
              <span className="text-xs font-mono font-bold text-tps-navy w-20 shrink-0">{e.courseCode}</span>
              <span className="text-sm text-gray-700 truncate flex-1">{e.title}</span>
            </label>
          ))}
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mt-3">{error}</div>}

        <button
          onClick={handleAdd}
          disabled={pending || selected.size === 0}
          className="btn-primary w-full text-sm py-2.5 mt-3"
        >
          {pending ? 'Adding…' : `Add ${selected.size} Event${selected.size === 1 ? '' : 's'} to Weighting`}
        </button>
      </div>
    </div>
  )
}

// ── Main matrix ───────────────────────────────────────────────────────────────

export function WeightingMatrix({ events, catalog, weightMap }: Props) {
  const router = useRouter()
  const [activeTrack, setActiveTrack] = useState<Track>('PILOT')
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  // Local weight state: `${track}:${eventId}` → string (user is typing)
  const [localWeights, setLocalWeights] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const [k, v] of Object.entries(weightMap)) {
      init[k] = v.toFixed(2)
    }
    return init
  })

  const trackEvents = useMemo(
    () => events.filter(e => e.tracks.includes(activeTrack)),
    [events, activeTrack],
  )

  function getWeight(eventId: string): string {
    return localWeights[`${activeTrack}:${eventId}`] ?? '0.00'
  }

  function setWeight(eventId: string, val: string) {
    setLocalWeights(prev => ({ ...prev, [`${activeTrack}:${eventId}`]: val }))
    setSuccess(false)
  }

  function currentSum(): number {
    return trackEvents.reduce((s, e) => {
      const v = parseFloat(localWeights[`${activeTrack}:${e.id}`] ?? '0')
      return s + (isNaN(v) ? 0 : v)
    }, 0)
  }

  const sum     = currentSum()
  const sumDiff = Math.abs(sum - 100)
  const sumOk   = sumDiff < 0.01

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const weights = trackEvents.map(e => ({
        syllabusEventId: e.id,
        courseCode:      e.courseCode,
        weightPct:       parseFloat(localWeights[`${activeTrack}:${e.id}`] ?? '0') || 0,
      }))
      const result = await saveTrackWeightsAction(activeTrack, weights)
      if (result.ok) {
        setSuccess(true)
      } else {
        setError(result.error ?? 'Unknown error')
      }
    })
  }

  function handleRemove(event: EventRow) {
    if (!confirm(`Remove ${event.courseCode} from the weighting matrix? Its scores will no longer count toward standings (existing grades are kept).`)) return
    startTransition(async () => {
      await removeEventFromWeightingAction(event.id)
      router.refresh()
    })
  }

  function distributeEvenly() {
    if (trackEvents.length === 0) return
    const each = (100 / trackEvents.length).toFixed(2)
    const updates: Record<string, string> = { ...localWeights }
    for (const e of trackEvents) {
      updates[`${activeTrack}:${e.id}`] = each
    }
    setLocalWeights(updates)
    setSuccess(false)
  }

  // Group events by MCG course, in MCG order
  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>()
    for (const e of trackEvents) {
      if (!map.has(e.deptCode)) map.set(e.deptCode, [])
      map.get(e.deptCode)!.push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }))
    }
    return new Map([...map.entries()].sort((a, b) => deptSortIndex(a[0]) - deptSortIndex(b[0])))
  }, [trackEvents])

  return (
    <div className="space-y-4">
      {/* Track tabs + add button */}
      <div className="flex gap-1 flex-wrap items-center">
        {TRACKS.map(t => (
          <button
            key={t}
            onClick={() => { setActiveTrack(t); setError(null); setSuccess(false) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTrack === t
                ? 'bg-tps-navy text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
            }`}
          >
            {TRACK_LABELS[t]}
          </button>
        ))}
        <button onClick={() => setAddOpen(true)} className="btn-primary text-sm px-4 py-2 ml-auto">
          + Add Events
        </button>
      </div>

      {/* Master-source notice */}
      <p className="text-xs text-gray-400">
        The weighting matrix is the master source for graded events — only events
        listed here count toward scores and standings.
      </p>

      {/* Sum indicator */}
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
        sumOk
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-amber-50 border border-amber-300 text-amber-800'
      }`}>
        <span>
          {TRACK_LABELS[activeTrack]} total: <strong>{sum.toFixed(2)}%</strong>
          {sumOk ? ' ✓' : ` — ${sumDiff.toFixed(2)}% ${sum < 100 ? 'short' : 'over'}`}
        </span>
        <button
          type="button"
          onClick={distributeEvenly}
          className="ml-auto text-xs underline hover:no-underline"
        >
          Distribute evenly
        </button>
      </div>

      {/* Weight table */}
      {trackEvents.length === 0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">
          No weighted events assigned to the {TRACK_LABELS[activeTrack]} track.
          Use “+ Add Events” to bring graded events into the matrix.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-32">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Event Title</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-28">Weight %</th>
                <th className="px-2 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...grouped.entries()].map(([dept, evts]) => (
                <Fragment key={dept}>
                  <tr className="bg-gray-50/80">
                    <td colSpan={4} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {dept} — {deptLabel(dept)}
                    </td>
                  </tr>
                  {evts.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{e.courseCode}</td>
                      <td className="px-4 py-2 text-gray-800">{e.title}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={getWeight(e.id)}
                            onChange={ev => setWeight(e.id, ev.target.value)}
                            className="w-20 text-right rounded border border-gray-300 px-2 py-1 text-sm
                                       focus:border-tps-orange focus:ring-1 focus:ring-tps-orange"
                          />
                          <span className="text-gray-400 text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleRemove(e)}
                          title="Remove from weighting — scores stop counting"
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || !sumOk || trackEvents.length === 0}
          className="btn-primary"
        >
          {pending ? 'Saving…' : `Save ${TRACK_LABELS[activeTrack]} Weights`}
        </button>

        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
        {success && (
          <span className="text-sm text-green-600">Saved successfully.</span>
        )}
      </div>

      {addOpen && <AddEventsModal catalog={catalog} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
