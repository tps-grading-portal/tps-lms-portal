'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deptSortIndex, deptLabel, MCG_DEPT_ORDER } from '@/lib/mcg-departments'
import { PrereqGraph } from './prereq-graph'
import { createSyllabusEventAction, removeSyllabusEventAction } from './actions'
import type { RoadmapEvent, RoadmapData } from './actions'
import type { SyllabusEventStatus, DepartmentCode, Track, EventSuffix } from '@prisma/client'

type Props = {
  events:      RoadmapEvent[]
  studentName: string | null
  editScope:   RoadmapData['editScope']
}

// ── Concentration grouping (per MCG) ─────────────────────────────────────────
// FTC: Pilot, CSO, RPA, FTE, ABM · STC: Operators · Common: both

const FTC_TRACKS: Track[] = ['PILOT', 'RPA', 'FTE', 'CSO_WSO', 'ABM']

type Concentration = 'FTC' | 'STC' | 'COMMON'

const CONC_META: Record<Concentration, { label: string; sub: string }> = {
  FTC:    { label: 'Flight Test Course (FTC)', sub: 'Pilot · CSO/WSO · RPA · FTE · ABM' },
  STC:    { label: 'Space Test Course (STC)',  sub: 'Operators' },
  COMMON: { label: 'Common Core',              sub: 'Shared FTC & STC curriculum' },
}
const CONC_ORDER: Concentration[] = ['COMMON', 'FTC', 'STC']

function concentrationOf(tracks: Track[]): Concentration {
  const hasFTC = tracks.some(t => FTC_TRACKS.includes(t))
  const hasSTC = tracks.includes('OPERATOR')
  if (hasFTC && hasSTC) return 'COMMON'
  if (hasSTC) return 'STC'
  return 'FTC'
}

const STATUS_META: Record<SyllabusEventStatus, { label: string; border: string; bg: string; dot: string }> = {
  LOCKED:      { label: 'Locked',      border: 'border-l-gray-300',   bg: 'bg-gray-50',   dot: 'bg-gray-400'   },
  UPCOMING:    { label: 'Upcoming',    border: 'border-l-blue-400',   bg: 'bg-blue-50',   dot: 'bg-blue-500'   },
  IN_PROGRESS: { label: 'In Progress', border: 'border-l-amber-400',  bg: 'bg-amber-50',  dot: 'bg-amber-500'  },
  COMPLETED:   { label: 'Completed',   border: 'border-l-green-500',  bg: 'bg-green-50',  dot: 'bg-green-600'  },
  REVIEW:      { label: 'Review',      border: 'border-l-red-400',    bg: 'bg-red-50',    dot: 'bg-red-500'    },
}

const NO_STATUS_META = { label: 'N/A', border: 'border-l-gray-200', bg: 'bg-white', dot: 'bg-gray-300' }

function getStatusMeta(status: SyllabusEventStatus | null) {
  return status ? STATUS_META[status] : NO_STATUS_META
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-700'
  if (score >= 80) return 'text-tps-navy'
  if (score >= 70) return 'text-amber-600'
  return 'text-red-600 font-bold'
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventNode({ event, expanded, onToggle, eventById, canEdit, onRemove }: {
  event:     RoadmapEvent
  expanded:  boolean
  onToggle:  () => void
  eventById: Map<string, RoadmapEvent>
  canEdit:   boolean
  onRemove:  () => void
}) {
  const meta = getStatusMeta(event.status)

  return (
    <div
      className={`rounded-lg border border-l-4 ${meta.border} ${meta.bg} transition-shadow hover:shadow-md cursor-pointer`}
      onClick={onToggle}
    >
      <div className="p-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold bg-tps-navy text-white px-1.5 py-0.5 rounded font-mono leading-none">
                {event.courseCode}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                event.status ? `${meta.bg} text-gray-600` : 'bg-gray-100 text-gray-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {event.isGraded && (
                <span className="text-[10px] text-gray-400">Graded</span>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-800 mt-1 leading-snug">{event.title}</p>
          </div>

          {event.score !== null && (
            <span className={`text-sm font-bold tabular-nums ${scoreColor(event.score)}`}>
              {event.score.toFixed(1)}
            </span>
          )}
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {event.creditHours > 0 && (
            <span className="text-[10px] text-gray-400">{event.creditHours} cr</span>
          )}
          {event.completedAt && (
            <span className="text-[10px] text-gray-400">
              Completed {new Date(event.completedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
          {event.description && (
            <p className="text-xs text-gray-600 leading-relaxed">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
            <span>Event type: <strong>{event.eventSuffix}</strong></span>
            <span>Tracks: <strong>{event.tracks.join(', ')}</strong></span>
          </div>
          {event.prerequisiteIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
              <span className="font-semibold">Prereqs:</span>
              {event.prerequisiteIds.map(pid => {
                const prereq = eventById.get(pid)
                if (!prereq) return null
                return (
                  <Link
                    key={pid}
                    href={`/portal/lessons/${encodeURIComponent(prereq.courseCode)}`}
                    className="font-mono font-bold bg-gray-100 hover:bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded"
                  >
                    {prereq.courseCode}
                  </Link>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/portal/lessons/${encodeURIComponent(event.courseCode)}`}
              className="inline-block text-xs font-semibold text-tps-orange hover:underline"
            >
              Open lesson page →
            </Link>
            {canEdit && (
              <button
                onClick={onRemove}
                className="text-[10px] text-gray-300 hover:text-red-500 transition-colors"
                title="Remove from syllabus"
              >
                Remove from syllabus
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Progress summary bar ──────────────────────────────────────────────────────

function ProgressBar({ events }: { events: RoadmapEvent[] }) {
  const counts = {} as Record<string, number>
  for (const e of events) {
    const key = e.status ?? 'null'
    counts[key] = (counts[key] ?? 0) + 1
  }

  const total = events.length
  const done  = counts['COMPLETED'] ?? 0
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-tps-navy">Overall Progress</span>
        <span className="text-gray-500">{done}/{total} completed ({pct}%)</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {done > 0 && <div className="bg-green-500 h-full" style={{ width: `${(done/total)*100}%` }} />}
        {(counts['IN_PROGRESS'] ?? 0) > 0 && <div className="bg-amber-400 h-full" style={{ width: `${((counts['IN_PROGRESS']??0)/total)*100}%` }} />}
        {(counts['UPCOMING']    ?? 0) > 0 && <div className="bg-blue-400 h-full"  style={{ width: `${((counts['UPCOMING']   ??0)/total)*100}%` }} />}
        {(counts['REVIEW']      ?? 0) > 0 && <div className="bg-red-400 h-full"   style={{ width: `${((counts['REVIEW']     ??0)/total)*100}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {(Object.entries(STATUS_META) as [SyllabusEventStatus, typeof STATUS_META[SyllabusEventStatus]][]).map(([status, m]) =>
          (counts[status] ?? 0) > 0 ? (
            <span key={status} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${m.dot}`} />
              {m.label}: {counts[status]}
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}

// ── Add course modal ──────────────────────────────────────────────────────────

const SUFFIX_OPTIONS: { value: EventSuffix; label: string }[] = [
  { value: 'A', label: 'A — Academic Lecture' }, { value: 'B', label: 'B — Async Content' },
  { value: 'C', label: 'C — Control Room' },     { value: 'E', label: 'E — Exam' },
  { value: 'F', label: 'F — Flight' },           { value: 'G', label: 'G — Ground School' },
  { value: 'H', label: 'H — Ground Training' },  { value: 'I', label: 'I — Ground Test' },
  { value: 'L', label: 'L — Lab' },              { value: 'M', label: 'M — MIB' },
  { value: 'O', label: 'O — Space Operation' },  { value: 'R', label: 'R — Written Report' },
  { value: 'S', label: 'S — Simulator' },        { value: 'W', label: 'W — Working Group' },
  { value: 'Y', label: 'Y — Oral Report' },      { value: 'Z', label: 'Z — Debrief' },
]

const TRACK_OPTIONS: { value: Track; label: string }[] = [
  { value: 'PILOT', label: 'Pilot' }, { value: 'CSO_WSO', label: 'CSO/WSO' }, { value: 'RPA', label: 'RPA' },
  { value: 'FTE', label: 'FTE' }, { value: 'ABM', label: 'ABM' }, { value: 'OPERATOR', label: 'STC/Operator' },
]

function AddCourseModal({ editScope, onClose }: { editScope: Props['editScope']; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const allowedDepts = editScope.all ? [...MCG_DEPT_ORDER] : editScope.depts

  const [courseCode, setCourseCode] = useState('')
  const [title,      setTitle]      = useState('')
  const [dept,       setDept]       = useState<string>(allowedDepts[0] ?? 'TF')
  const [suffix,     setSuffix]     = useState<EventSuffix>('A')
  const [tracks,     setTracks]     = useState<Track[]>([...FTC_TRACKS, 'OPERATOR'])
  const [description, setDescription] = useState('')

  function toggleTrack(t: Track) {
    setTracks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const code = courseCode.trim().toUpperCase()
    const numMatch = code.match(/(\d{4})/)
    startTx(async () => {
      const result = await createSyllabusEventAction({
        courseCode:  code,
        title,
        deptCode:    dept as DepartmentCode,
        eventSuffix: suffix,
        phase:       numMatch ? parseInt(numMatch[1][0]) : 6,
        tracks,
        description: description || null,
      })
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-tps-navy">Add Course to Syllabus</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Course Code *</label>
            <input
              value={courseCode}
              onChange={e => setCourseCode(e.target.value)}
              className="field-input font-mono"
              placeholder={`${dept} 6101${suffix}`}
              disabled={pending}
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Phase (Course) *</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className="field-input" disabled={pending}>
              {allowedDepts.map(d => <option key={d} value={d}>{d} — {deptLabel(d)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="field-input" disabled={pending} />
        </div>

        <div>
          <label className="field-label">Event Type *</label>
          <select value={suffix} onChange={e => setSuffix(e.target.value as EventSuffix)} className="field-input" disabled={pending}>
            {SUFFIX_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Tracks *</label>
          <div className="grid grid-cols-3 gap-1.5">
            {TRACK_OPTIONS.map(t => (
              <label
                key={t.value}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                  tracks.includes(t.value) ? 'border-tps-orange bg-tps-orange/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={tracks.includes(t.value)}
                  onChange={() => toggleTrack(t.value)}
                  className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
                  disabled={pending}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="field-input" disabled={pending} />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={pending || !courseCode.trim() || !title.trim()} className="btn-primary w-full text-sm py-2.5">
          {pending ? 'Adding…' : 'Add Course'}
        </button>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_STATUSES: (SyllabusEventStatus | 'all')[] = ['all', 'LOCKED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'REVIEW']

export function RoadmapView({ events, studentName, editScope }: Props) {
  const router = useRouter()
  const [filterStatus, setFilterStatus] = useState<SyllabusEventStatus | 'all'>('all')
  const [filterDept,   setFilterDept]   = useState<DepartmentCode | 'all'>('all')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [flowMode,     setFlowMode]     = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [addOpen,      setAddOpen]      = useState(false)
  const [, startTx] = useTransition()

  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events])

  const canEditAny = editScope.all || editScope.depts.length > 0
  const canEditDept = (dept: DepartmentCode) => editScope.all || editScope.depts.includes(dept)

  // Departments present, in MCG curriculum order
  const depts = useMemo(
    () => [...new Set(events.map(e => e.deptCode))].sort((a, b) => deptSortIndex(a) - deptSortIndex(b)),
    [events],
  )

  const filtered = useMemo(() => {
    let list = events
    if (filterStatus !== 'all') list = list.filter(e => e.status === filterStatus)
    if (filterDept   !== 'all') list = list.filter(e => e.deptCode === filterDept)
    if (search.trim())          list = list.filter(e =>
      e.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      e.title.toLowerCase().includes(search.toLowerCase())
    )
    return list
  }, [events, filterStatus, filterDept, search])

  // Concentration → dept → events
  const grouped = useMemo(() => {
    const result = new Map<Concentration, Map<DepartmentCode, RoadmapEvent[]>>()
    for (const e of filtered) {
      const conc = concentrationOf(e.tracks)
      if (!result.has(conc)) result.set(conc, new Map())
      const deptMap = result.get(conc)!
      if (!deptMap.has(e.deptCode)) deptMap.set(e.deptCode, [])
      deptMap.get(e.deptCode)!.push(e)
    }
    for (const deptMap of result.values()) {
      for (const list of deptMap.values()) {
        list.sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }))
      }
    }
    return result
  }, [filtered])

  // Auto-expand sections when filtering/searching
  const forceOpen = search.trim().length > 0 || filterStatus !== 'all' || filterDept !== 'all'

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function handleRemove(event: RoadmapEvent) {
    if (!confirm(`Remove ${event.courseCode} — ${event.title} from the syllabus? It can be re-added later.`)) return
    startTx(async () => {
      const result = await removeSyllabusEventAction(event.id)
      if ('error' in result && result.error) { alert(result.error); return }
      router.refresh()
    })
  }

  const hasStudentData = events.some(e => e.status !== null)

  return (
    <div className="space-y-6">
      {/* Student context banner */}
      {studentName && (
        <div className="card bg-tps-navy text-white py-3">
          <p className="text-sm font-semibold">Viewing roadmap for: {studentName}</p>
        </div>
      )}
      {!hasStudentData && (
        <div className="card bg-amber-50 border border-amber-200 py-3">
          <p className="text-sm text-amber-700">
            Showing master catalog. No student progress data loaded — event statuses reflect the full MCG syllabus.
          </p>
        </div>
      )}

      {/* Progress summary */}
      {hasStudentData && (
        <div className="card">
          <ProgressBar events={events} />
        </div>
      )}

      {/* Search — full-width row */}
      <input
        type="search"
        placeholder="Search by course code or title…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="field-input w-full"
      />

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View mode */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setFlowMode(false)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !flowMode ? 'bg-tps-navy text-white' : 'bg-white text-gray-600 hover:text-tps-navy'
            }`}
          >
            By Course
          </button>
          <button
            onClick={() => setFlowMode(true)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              flowMode ? 'bg-tps-navy text-white' : 'bg-white text-gray-600 hover:text-tps-navy'
            }`}
          >
            Prerequisite Web
          </button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Dept filter */}
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value as DepartmentCode | 'all')}
          className="field-input w-auto text-xs py-1.5"
        >
          <option value="all">All Courses</option>
          {depts.map(d => <option key={d} value={d}>{d} — {deptLabel(d)}</option>)}
        </select>

        {/* Status chips */}
        <div className="flex gap-1 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s as SyllabusEventStatus].label}
            </button>
          ))}
        </div>

        {/* Add course — scoped */}
        {canEditAny && (
          <button onClick={() => setAddOpen(true)} className="btn-primary text-xs px-3 py-1.5 ml-auto">
            + Add Course
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">{filtered.length} event{filtered.length !== 1 ? 's' : ''} shown</p>

      {/* ── Prerequisite web (spiderweb graph) ── */}
      {flowMode && <PrereqGraph events={filtered} />}

      {/* ── By-course view: FTC / STC / Common, collapsible courses ── */}
      {!flowMode && (filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No events match your filters.</div>
      ) : (
        CONC_ORDER.map(conc => {
          const deptMap = grouped.get(conc)
          if (!deptMap || deptMap.size === 0) return null
          const concTotal = [...deptMap.values()].reduce((n, l) => n + l.length, 0)
          const sortedDepts = [...deptMap.entries()].sort((a, b) => deptSortIndex(a[0]) - deptSortIndex(b[0]))

          return (
            <section key={conc} className="space-y-3">
              {/* Concentration banner */}
              <div className="rounded-xl bg-tps-navy text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-sm">{CONC_META[conc].label}</p>
                  <p className="text-xs text-white/60">{CONC_META[conc].sub}</p>
                </div>
                <span className="text-xs text-white/70">{concTotal} events</span>
              </div>

              {/* Collapsible course (dept) sections */}
              {sortedDepts.map(([dept, deptEvents]) => {
                const key = `${conc}:${dept}`
                const open = forceOpen || openSections.has(key)
                const completed = deptEvents.filter(e => e.status === 'COMPLETED').length
                return (
                  <div key={key} className="card p-0 overflow-hidden">
                    <button
                      onClick={() => toggleSection(key)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70 transition-colors"
                    >
                      <span className={`text-gray-400 text-sm transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                      <span className="text-xs font-bold font-mono text-tps-navy w-8">{dept}</span>
                      <span className="text-sm font-semibold text-gray-700 flex-1">{deptLabel(dept)}</span>
                      {hasStudentData && (
                        <span className={`text-xs tabular-nums ${completed === deptEvents.length ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                          {completed}/{deptEvents.length} complete
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{deptEvents.length} events</span>
                    </button>

                    {open && (
                      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deptEvents.map(event => (
                          <EventNode
                            key={event.id}
                            event={event}
                            expanded={expandedId === event.id}
                            onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                            eventById={eventById}
                            canEdit={canEditDept(event.deptCode)}
                            onRemove={() => handleRemove(event)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })
      ))}

      {addOpen && <AddCourseModal editScope={editScope} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
