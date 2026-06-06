'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import type { RoadmapEvent } from './actions'
import type { SyllabusEventStatus, DepartmentCode } from '@prisma/client'

type Props = { events: RoadmapEvent[]; studentName: string | null }

const DEPT_LABELS: Record<DepartmentCode, string> = {
  AN: 'Ancillary',
  CF: 'Check Flights',
  SO: 'Space Ops',
  AS: 'Astro Sciences',
  PF: 'Performance',
  FQ: 'Flying Qualities',
  SY: 'Mission Systems',
  TF: 'Test Foundations',
  TL: 'Test Leadership',
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

function EventNode({ event, expanded, onToggle }: {
  event: RoadmapEvent
  expanded: boolean
  onToggle: () => void
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

        {/* Dept + credit hours */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400">{DEPT_LABELS[event.deptCode]}</span>
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
            {event.prerequisiteIds.length > 0 && (
              <span>{event.prerequisiteIds.length} prerequisite(s)</span>
            )}
          </div>
          <Link
            href={`/portal/lessons/${encodeURIComponent(event.courseCode)}`}
            className="inline-block text-xs font-semibold text-tps-orange hover:underline"
          >
            Open lesson page →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Progress summary bar ──────────────────────────────────────────────────────

function ProgressBar({ events }: { events: RoadmapEvent[] }) {
  const counts = {
    LOCKED:      0,
    UPCOMING:    0,
    IN_PROGRESS: 0,
    COMPLETED:   0,
    REVIEW:      0,
    null:        0,
  } as Record<string, number>

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
        {done     > 0 && <div className="bg-green-500 h-full" style={{ width: `${(done/total)*100}%` }} />}
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

// ── Main component ────────────────────────────────────────────────────────────

const ALL_STATUSES: (SyllabusEventStatus | 'all')[] = ['all', 'LOCKED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'REVIEW']

export function RoadmapView({ events, studentName }: Props) {
  const [filterStatus, setFilterStatus] = useState<SyllabusEventStatus | 'all'>('all')
  const [filterDept,   setFilterDept]   = useState<DepartmentCode | 'all'>('all')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [search,       setSearch]       = useState('')

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

  // Group filtered events by MCG department (course), in MCG order
  const byDept = useMemo(() => {
    const map = new Map<DepartmentCode, RoadmapEvent[]>()
    for (const e of filtered) {
      if (!map.has(e.deptCode)) map.set(e.deptCode, [])
      map.get(e.deptCode)!.push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }))
    }
    return new Map([...map.entries()].sort((a, b) => deptSortIndex(a[0]) - deptSortIndex(b[0])))
  }, [filtered])

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field-input flex-1"
        />

        <div className="flex gap-1 flex-wrap">
          {(['all', ...depts] as (DepartmentCode | 'all')[]).map(d => (
            <button
              key={d}
              onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterDept === d
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {d === 'all' ? 'All Courses' : d}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s as SyllabusEventStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">{filtered.length} event{filtered.length !== 1 ? 's' : ''} shown</p>

      {/* Course (department) sections — MCG order */}
      {byDept.size === 0 ? (
        <div className="card text-center py-10 text-gray-400">No events match your filters.</div>
      ) : (
        Array.from(byDept.entries()).map(([dept, deptEvents]) => (
          <section key={dept}>
            {/* Course header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold text-tps-navy uppercase tracking-wider px-2">
                {dept} — {deptLabel(dept)}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">{deptEvents.length} events</span>
            </div>

            {/* Event grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deptEvents.map(event => (
                <EventNode
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
