'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateStudentAction, removeStudentAction } from '../../../actions'
import type { Track } from '@prisma/client'

const TRACK_LABELS: Record<Track, string> = {
  PILOT: 'Pilot', RPA: 'RPA', FTE: 'FTE', OPERATOR: 'STC', CSO_WSO: 'CSO/WSO', ABM: 'ABM',
}

type StudentInfo = {
  id:        string
  number:    number
  firstName: string
  lastName:  string
  email:     string | null
  track:     Track
  className: string
  classId:   string
}

type EntryRow = {
  id:             string
  courseCode:     string
  title:          string
  type:           string
  status:         string
  overallScore:   number | null
  overallPass:    boolean | null
  submittedAt:    string | null
  instructorName: string | null
  isLocked:       boolean
}

type CompOralRow = {
  id:          string
  scenario:    string
  finalScore:  number | null
  hasFail:     boolean
  isRetake:    boolean
  finalizedAt: string | null
}

type AlertRow = { id: string; type: string; severity: string; message: string }

// ── Edit student modal ────────────────────────────────────────────────────────

function EditStudentModal({ student, onClose }: { student: StudentInfo; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState(student.firstName)
  const [lastName,  setLastName]  = useState(student.lastName)
  const [email,     setEmail]     = useState(student.email ?? '')

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await updateStudentAction(student.id, {
        firstName, lastName, email: email || null,
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.refresh()
      onClose()
    })
  }

  function handleRemove() {
    if (!confirm(`Remove ${student.firstName} ${student.lastName} from class ${student.className}? Only possible if they have no submitted grades.`)) return
    startTx(async () => {
      const result = await removeStudentAction(student.id)
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.push(`/portal/classes/${student.classId}`)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">Edit Student</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-input" disabled={pending} />
          </div>

          <p className="text-xs text-gray-400">
            Track ({TRACK_LABELS[student.track]}) is permanent and cannot be changed.
          </p>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={pending} className="btn-primary flex-1 text-sm py-2.5">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleRemove} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-700',
  WARNING:  'bg-amber-50 border-amber-200 text-amber-700',
  INFO:     'bg-blue-50 border-blue-200 text-blue-700',
}

export function StudentProfileView({
  student, entries, compOrals, alerts, canManage, canGrade,
}: {
  student:   StudentInfo
  entries:   EntryRow[]
  compOrals: CompOralRow[]
  alerts:    AlertRow[]
  canManage: boolean
  canGrade:  boolean
}) {
  const [editOpen, setEditOpen] = useState(false)

  const submitted  = entries.filter(e => e.status === 'SUBMITTED')
  const inProgress = entries.filter(e => e.status === 'IN_PROGRESS')
  const pending    = entries.filter(e => e.status === 'NOT_STARTED')

  const avgScore = submitted.length > 0
    ? submitted.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / submitted.length
    : null

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400">
        <Link href="/portal/classes" className="hover:text-tps-navy">Classes</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/portal/classes/${student.classId}`} className="hover:text-tps-navy">{student.className}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700 font-medium">{student.lastName}, {student.firstName}</span>
      </div>

      {/* Header */}
      <div className="card bg-tps-navy text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">
              {student.className}-{student.number} · {TRACK_LABELS[student.track]} Track
            </p>
            <h1 className="text-2xl font-bold mt-0.5">{student.firstName} {student.lastName}</h1>
            {student.email && <p className="text-white/70 text-sm mt-0.5">{student.email}</p>}
          </div>
          {canManage && (
            <button onClick={() => setEditOpen(true)} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={`rounded-xl border px-4 py-3 text-sm ${SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.INFO}`}>
              <span className="font-bold text-xs uppercase tracking-wide mr-2">{a.severity}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-tps-navy tabular-nums">
            {avgScore !== null ? avgScore.toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Average Score</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-600 tabular-nums">{submitted.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Graded Events</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-gray-400 tabular-nums">{pending.length + inProgress.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Remaining</p>
        </div>
      </div>

      {/* Comp Oral results */}
      {compOrals.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-tps-navy uppercase tracking-wider mb-2">Comprehensive Oral</h2>
          <div className="space-y-2">
            {compOrals.map(s => (
              <div key={s.id} className={`card py-3 border-l-4 ${s.hasFail ? 'border-l-red-400' : 'border-l-green-400'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {s.scenario}
                      {s.isRetake && <span className="ml-2 text-xs text-amber-600 font-medium">Retake</span>}
                    </p>
                    {s.finalizedAt && (
                      <p className="text-xs text-gray-400">Finalized {new Date(s.finalizedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {s.finalScore !== null && (
                      <p className={`text-lg font-bold tabular-nums ${s.hasFail ? 'text-red-600' : 'text-tps-navy'}`}>
                        {s.finalScore.toFixed(2)}
                      </p>
                    )}
                    <span className={`text-xs font-bold ${s.hasFail ? 'text-red-600' : 'text-green-600'}`}>
                      {s.hasFail ? 'FAIL' : 'PASS'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gradebook */}
      <section>
        <h2 className="text-xs font-bold text-tps-navy uppercase tracking-wider mb-2">
          Gradebook · {submitted.length}/{entries.length} complete
        </h2>

        {entries.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 text-sm">No gradesheet entries.</div>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <div
                key={e.id}
                className={`card py-3 flex items-center gap-3 border-l-4 ${
                  e.status === 'SUBMITTED'   ? (e.overallPass === false ? 'border-l-red-400' : 'border-l-green-400') :
                  e.status === 'IN_PROGRESS' ? 'border-l-amber-400' : 'border-l-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold font-mono bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded">
                      {e.courseCode}
                    </span>
                    <span className="text-[10px] text-gray-400">{e.type}</span>
                    {e.status === 'IN_PROGRESS' && <span className="text-[10px] text-amber-600 font-semibold">In Progress</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{e.title}</p>
                  {e.submittedAt && (
                    <p className="text-xs text-gray-400">
                      {new Date(e.submittedAt).toLocaleDateString()}
                      {e.instructorName && ` · ${e.instructorName}`}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  {e.overallScore !== null ? (
                    <>
                      <p className={`font-bold tabular-nums ${
                        e.overallPass === false ? 'text-red-600' :
                        e.overallScore >= 90 ? 'text-green-700' :
                        e.overallScore >= 80 ? 'text-tps-navy' :
                        e.overallScore >= 70 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {e.overallScore.toFixed(1)}%
                      </p>
                      {e.overallPass !== null && (
                        <span className={`text-xs font-bold ${e.overallPass ? 'text-green-600' : 'text-red-600'}`}>
                          {e.overallPass ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
                  )}
                </div>

                {canGrade && !e.isLocked && (
                  <Link href={`/portal/grade/${e.id}`} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                    {e.status === 'NOT_STARTED' ? 'Grade' : 'Continue'}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {editOpen && <EditStudentModal student={student} onClose={() => setEditOpen(false)} />}
    </div>
  )
}
