'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addStudentAction, updateClassAction, archiveClassAction } from '../actions'
import type { Track, Concentration } from '@prisma/client'

const TRACK_LABELS: Record<Track, string> = {
  PILOT: 'Pilot', RPA: 'RPA', FTE: 'FTE', OPERATOR: 'STC', CSO_WSO: 'CSO/WSO', ABM: 'ABM',
}

type StudentRow = {
  id:           string
  number:       number
  firstName:    string
  lastName:     string
  email:        string | null
  track:        Track
  gradedCount:  number
  totalEntries: number
  avgScore:     number | null
  hasFail:      boolean
}

type ClassInfo = {
  id:            string
  name:          string
  concentration: Concentration | null
  startDate:     string | null
  endDate:       string | null
  isActive:      boolean
  archivedAt:    string | null
  scheduledEventCount: number
}

// ── Add student modal ────────────────────────────────────────────────────────

function AddStudentModal({ classId, onClose }: { classId: string; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [track,     setTrack]     = useState<Track>('PILOT')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTx(async () => {
      const result = await addStudentAction(classId, {
        firstName, lastName,
        email: email || null,
        track,
        number: null, // auto-assign
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">Add Student</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">First Name *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="field-input" disabled={pending} autoFocus />
            </div>
            <div>
              <label className="field-label">Last Name *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>

          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-input" placeholder="name@us.af.mil" disabled={pending} />
          </div>

          <div>
            <label className="field-label">Track * <span className="font-normal text-gray-400">(permanent — cannot be changed later)</span></label>
            <select value={track} onChange={e => setTrack(e.target.value as Track)} className="field-input" disabled={pending}>
              {Object.entries(TRACK_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <p className="text-xs text-gray-400">
            Gradesheet entries for the student&apos;s track are generated automatically.
          </p>

          <button type="submit" disabled={pending || !firstName.trim() || !lastName.trim()} className="btn-primary w-full text-sm py-2.5">
            {pending ? 'Adding…' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Class settings modal ─────────────────────────────────────────────────────

function ClassSettingsModal({ cls, onClose }: { cls: ClassInfo; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [concentration, setConcentration] = useState<Concentration | ''>(cls.concentration ?? '')
  const [startDate,     setStartDate]     = useState(cls.startDate?.slice(0, 10) ?? '')
  const [endDate,       setEndDate]       = useState(cls.endDate?.slice(0, 10) ?? '')
  const [isActive,      setIsActive]      = useState(cls.isActive)

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await updateClassAction(cls.id, {
        concentration: concentration || null,
        startDate:     startDate || null,
        endDate:       endDate || null,
        isActive,
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.refresh()
      onClose()
    })
  }

  function handleArchive() {
    if (!confirm(`Archive class ${cls.name}? It will be hidden from active views but data is preserved.`)) return
    startTx(async () => {
      await archiveClassAction(cls.id)
      router.push('/portal/classes')
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">Class {cls.name} Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="field-label">Concentration</label>
            <select value={concentration} onChange={e => setConcentration(e.target.value as Concentration | '')} className="field-input" disabled={pending}>
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
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange" disabled={pending} />
            <span className="text-sm text-gray-700">Active class</span>
          </label>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={pending} className="btn-primary flex-1 text-sm py-2.5">
              {pending ? 'Saving…' : 'Save'}
            </button>
            {!cls.archivedAt && (
              <button onClick={handleArchive} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ClassDetailView({ cls, students }: { cls: ClassInfo; students: StudentRow[] }) {
  const [addOpen,      setAddOpen]      = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trackFilter,  setTrackFilter]  = useState<Track | 'all'>('all')
  const [search,       setSearch]       = useState('')

  const filtered = students.filter(s => {
    if (trackFilter !== 'all' && s.track !== trackFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${s.firstName} ${s.lastName}`.toLowerCase().includes(q) &&
          !s.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const tracksPresent = [...new Set(students.map(s => s.track))]

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="text-sm text-gray-400 mb-2">
          <Link href="/portal/classes" className="hover:text-tps-navy">Classes</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-700 font-medium">{cls.name}</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-tps-navy flex items-center gap-3">
              Class {cls.name}
              {cls.isActive && (
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">ACTIVE</span>
              )}
              {cls.archivedAt && (
                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">ARCHIVED</span>
              )}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {students.length} students
              {cls.concentration && ` · ${cls.concentration}`}
              {cls.startDate && ` · ${new Date(cls.startDate).toLocaleDateString()} – ${cls.endDate ? new Date(cls.endDate).toLocaleDateString() : 'TBD'}`}
              {` · ${cls.scheduledEventCount} scheduled events`}
            </p>
          </div>

          <div className="flex gap-2">
            <Link href={`/portal/academic-schedule?classId=${cls.id}`} className="btn-secondary text-sm px-3 py-2">
              Schedule
            </Link>
            <button onClick={() => setSettingsOpen(true)} className="btn-secondary text-sm px-3 py-2">
              Settings
            </button>
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm px-3 py-2">
              + Add Student
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input flex-1"
          />
          {tracksPresent.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setTrackFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  trackFilter === 'all' ? 'bg-tps-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange'
                }`}
              >
                All ({students.length})
              </button>
              {tracksPresent.map(t => (
                <button
                  key={t}
                  onClick={() => setTrackFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    trackFilter === t ? 'bg-tps-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange'
                  }`}
                >
                  {TRACK_LABELS[t]} ({students.filter(s => s.track === t).length})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      {students.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm">
          No students enrolled yet. Add your first student to begin.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-14">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Track</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Progress</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Avg Score</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/portal/classes/${cls.id}/students/${s.id}`}
                >
                  <td className="px-4 py-3 font-mono text-gray-400">{cls.name}-{s.number}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-tps-navy">{s.lastName}, {s.firstName}</span>
                    {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-tps-navy/10 text-tps-navy">
                      {TRACK_LABELS[s.track]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs tabular-nums">
                    {s.gradedCount}/{s.totalEntries} graded
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.avgScore !== null ? (
                      <span className={`font-bold tabular-nums ${
                        s.hasFail ? 'text-red-600' :
                        s.avgScore >= 90 ? 'text-green-700' :
                        s.avgScore >= 80 ? 'text-tps-navy' :
                        s.avgScore >= 70 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {s.avgScore.toFixed(1)}%
                        {s.hasFail && <span className="ml-1 text-xs">⚠</span>}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {addOpen      && <AddStudentModal classId={cls.id} onClose={() => setAddOpen(false)} />}
      {settingsOpen && <ClassSettingsModal cls={cls} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
