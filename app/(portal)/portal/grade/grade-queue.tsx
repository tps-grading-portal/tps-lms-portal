'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { deptFromCourseCode, deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import type { GradeQueueEntry } from './actions'
import type { Track } from '@prisma/client'

const TRACK_LABELS: Record<Track, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'STC',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Not Started', color: 'bg-gray-100 text-gray-500' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  SUBMITTED:   { label: 'Submitted',   color: 'bg-green-100 text-green-700' },
}

type Filter = 'all' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED'

// ── QR modal ──────────────────────────────────────────────────────────────────

function QrModal({ entryId, label, onClose }: { entryId: string; label: string; onClose: () => void }) {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/grade/${entryId}`
    : `/portal/grade/${entryId}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy text-sm">QR Code — {label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?url=${encodeURIComponent(url)}`}
            alt="QR code for grading entry"
            className="w-48 h-48 rounded-lg border border-gray-100"
          />
        </div>

        <p className="text-xs text-gray-500 text-center break-all">{url}</p>

        <button
          onClick={() => navigator.clipboard?.writeText(url)}
          className="w-full mt-3 btn-secondary text-xs py-2"
        >
          Copy Link
        </button>
      </div>
    </div>
  )
}

// ── Gradesheet row (leaf) ─────────────────────────────────────────────────────

function SheetRow({ entry, onQr }: { entry: GradeQueueEntry; onQr: () => void }) {
  const meta = STATUS_META[entry.status] ?? STATUS_META.NOT_STARTED
  return (
    <div className="flex items-center gap-3 py-2 pl-4 pr-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded font-mono">
            {entry.courseCode}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{entry.templateTitle}</p>
        {entry.overallScore !== null && (
          <p className="text-xs font-semibold mt-0.5 text-tps-navy tabular-nums">
            {entry.overallScore.toFixed(1)}%
            {entry.overallPass !== null && (
              <span className={entry.overallPass ? ' text-green-600' : ' text-red-600'}>
                {' '}({entry.overallPass ? 'Pass' : 'Fail'})
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex gap-1.5 shrink-0">
        <Link
          href={`/portal/grade/${entry.entryId}`}
          className="btn-primary text-xs px-3 py-1.5 text-center"
        >
          {entry.status === 'NOT_STARTED' ? 'Grade' : 'Edit'}
        </Link>
        <button onClick={onQr} className="btn-secondary text-xs px-2.5 py-1.5" title="Show QR code">
          QR
        </button>
      </div>
    </div>
  )
}

// ── Department group within a student ─────────────────────────────────────────

function DeptGroup({
  dept, entries, expanded, onToggle, onQr,
}: {
  dept:     string
  entries:  GradeQueueEntry[]
  expanded: boolean
  onToggle: () => void
  onQr:     (id: string) => void
}) {
  const graded = entries.filter(e => e.status === 'SUBMITTED').length

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-50/80 hover:bg-gray-100 transition-colors text-left"
      >
        <span className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="text-xs font-bold text-tps-navy font-mono w-7">{dept}</span>
        <span className="text-xs text-gray-600 flex-1">{deptLabel(dept)}</span>
        <span className={`text-xs tabular-nums font-medium ${graded === entries.length ? 'text-green-600' : 'text-gray-400'}`}>
          {graded}/{entries.length} graded
        </span>
      </button>

      {expanded && (
        <div className="bg-white">
          {entries.map(e => (
            <SheetRow key={e.entryId} entry={e} onQr={() => onQr(e.entryId)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Student section ───────────────────────────────────────────────────────────

function StudentSection({
  entries, className, expanded, onToggle, expandedDepts, onToggleDept, onQr, forceOpen,
}: {
  entries:       GradeQueueEntry[]
  className:     string
  expanded:      boolean
  onToggle:      () => void
  expandedDepts: Set<string>
  onToggleDept:  (key: string) => void
  onQr:          (id: string) => void
  forceOpen:     boolean
}) {
  const first  = entries[0]
  const graded = entries.filter(e => e.status === 'SUBMITTED').length
  const inProg = entries.filter(e => e.status === 'IN_PROGRESS').length

  // Group this student's sheets by MCG department, in MCG order
  const deptGroups = useMemo(() => {
    const map = new Map<string, GradeQueueEntry[]>()
    for (const e of entries) {
      const dept = deptFromCourseCode(e.courseCode)
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }))
    }
    return [...map.entries()].sort((a, b) => deptSortIndex(a[0]) - deptSortIndex(b[0]))
  }, [entries])

  const isOpen = expanded || forceOpen

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left"
      >
        <span className={`text-gray-400 text-sm transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{first.studentName}</p>
          <p className="text-xs text-gray-400">
            {className}-{first.studentNumber} · {TRACK_LABELS[first.track]}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold tabular-nums ${graded === entries.length ? 'text-green-600' : 'text-tps-navy'}`}>
            {graded}/{entries.length}
          </p>
          <p className="text-[10px] text-gray-400">
            graded{inProg > 0 && ` · ${inProg} in progress`}
          </p>
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {deptGroups.map(([dept, deptEntries]) => {
            const key = `${first.studentId}:${dept}`
            return (
              <DeptGroup
                key={dept}
                dept={dept}
                entries={deptEntries}
                expanded={expandedDepts.has(key) || forceOpen}
                onToggle={() => onToggleDept(key)}
                onQr={onQr}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main queue ────────────────────────────────────────────────────────────────

// Track display order within a class
const TRACK_ORDER: Track[] = ['PILOT', 'CSO_WSO', 'RPA', 'FTE', 'ABM', 'OPERATOR']

export function GradeQueue({ entries }: { entries: GradeQueueEntry[] }) {
  const [filter,           setFilter]           = useState<Filter>('all')
  const [search,           setSearch]           = useState('')
  const [qrEntryId,        setQrEntryId]        = useState<string | null>(null)
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())
  const [expandedDepts,    setExpandedDepts]    = useState<Set<string>>(new Set())
  const [collapsedTracks,  setCollapsedTracks]  = useState<Set<string>>(new Set())
  const [classTab,         setClassTab]         = useState<string | null>(null)

  // One class at a time — tabs switch between them
  const classNames = useMemo(
    () => [...new Set(entries.map(e => e.className))].sort(),
    [entries],
  )
  const currentClass = classTab && classNames.includes(classTab) ? classTab : classNames[0]
  const classEntries = useMemo(
    () => entries.filter(e => e.className === currentClass),
    [entries, currentClass],
  )

  const counts = {
    NOT_STARTED: classEntries.filter(e => e.status === 'NOT_STARTED').length,
    IN_PROGRESS: classEntries.filter(e => e.status === 'IN_PROGRESS').length,
    SUBMITTED:   classEntries.filter(e => e.status === 'SUBMITTED').length,
  }

  // Apply status + search filters at the sheet level
  const searching = search.trim().length > 0
  const filtered = useMemo(() => classEntries.filter(e => {
    if (filter !== 'all' && e.status !== filter) return false
    if (searching) {
      const q = search.toLowerCase()
      if (!e.studentName.toLowerCase().includes(q) &&
          !e.courseCode.toLowerCase().includes(q) &&
          !e.templateTitle.toLowerCase().includes(q)) return false
    }
    return true
  }), [classEntries, filter, search, searching])

  // Track → student grouping within the selected class
  const trackSections = useMemo(() => {
    const byTrack = new Map<Track, GradeQueueEntry[]>()
    for (const e of filtered) {
      if (!byTrack.has(e.track)) byTrack.set(e.track, [])
      byTrack.get(e.track)!.push(e)
    }

    return [...byTrack.entries()]
      .sort((a, b) => TRACK_ORDER.indexOf(a[0]) - TRACK_ORDER.indexOf(b[0]))
      .map(([track, trackEntries]) => {
        const byStudent = new Map<string, GradeQueueEntry[]>()
        for (const e of trackEntries) {
          if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, [])
          byStudent.get(e.studentId)!.push(e)
        }
        const students = [...byStudent.values()]
          .sort((a, b) => a[0].studentSortKey.localeCompare(b[0].studentSortKey))
        return { track, students }
      })
  }, [filtered])

  // When filtering or searching, auto-expand so results are visible
  const forceOpen = searching || filter !== 'all'

  function toggleStudent(id: string) {
    setExpandedStudents(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleDept(key: string) {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function toggleTrack(key: string) {
    setCollapsedTracks(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  const qrEntry = qrEntryId ? entries.find(e => e.entryId === qrEntryId) : null

  return (
    <div className="space-y-4">
      {/* Class selector tabs */}
      {classNames.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200">
          {classNames.map(name => (
            <button
              key={name}
              onClick={() => setClassTab(name)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 -mb-px transition-colors ${
                name === currentClass
                  ? 'border-tps-orange text-tps-orange'
                  : 'border-transparent text-gray-500 hover:text-tps-navy hover:border-gray-300'
              }`}
            >
              Class {name}
            </button>
          ))}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-gray-400">{counts.NOT_STARTED}</p>
          <p className="text-xs text-gray-400">Not Started</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-amber-600">{counts.IN_PROGRESS}</p>
          <p className="text-xs text-gray-400">In Progress</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-green-600">{counts.SUBMITTED}</p>
          <p className="text-xs text-gray-400">Submitted</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search student, course, or title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field-input flex-1"
        />
        <div className="flex gap-1 flex-wrap">
          {(['all', 'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {f === 'all' ? `All (${classEntries.length})` : `${STATUS_META[f].label} (${counts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Track → Student → Dept → Sheets */}
      {trackSections.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No entries match your filters.</div>
      ) : (
        trackSections.map(section => {
          const isCollapsed = collapsedTracks.has(section.track) && !forceOpen
          return (
            <section key={section.track}>
              <button
                onClick={() => toggleTrack(section.track)}
                className="w-full flex items-center gap-3 mb-2 group/track"
              >
                <span className={`text-gray-400 text-xs transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                <span className="text-xs font-bold text-tps-navy uppercase tracking-wider">
                  {TRACK_LABELS[section.track]}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">{section.students.length} student{section.students.length === 1 ? '' : 's'}</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {section.students.map(studentEntries => (
                    <StudentSection
                      key={studentEntries[0].studentId}
                      entries={studentEntries}
                      className={currentClass}
                      expanded={expandedStudents.has(studentEntries[0].studentId)}
                      onToggle={() => toggleStudent(studentEntries[0].studentId)}
                      expandedDepts={expandedDepts}
                      onToggleDept={toggleDept}
                      onQr={setQrEntryId}
                      forceOpen={forceOpen}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      {/* QR modal */}
      {qrEntry && (
        <QrModal
          entryId={qrEntry.entryId}
          label={`${qrEntry.courseCode} — ${qrEntry.studentName}`}
          onClose={() => setQrEntryId(null)}
        />
      )}
    </div>
  )
}
