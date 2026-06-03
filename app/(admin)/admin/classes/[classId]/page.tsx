import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TRACK_LABELS } from '@/lib/utils'
import { PASSING_SCORE } from '@/lib/constants'
import { finalizeSessionAction } from '@/app/(chair)/chair/actions'
import { PinManager } from '../pin-manager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Class Detail' }

interface PageProps {
  params: Promise<{ classId: string }>
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { classId } = await params

  const [cls, sessions, students, studentSurveys, accessRecords] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { id: true, name: true, isActive: true, archivedAt: true, createdAt: true } }),
    db.gradingSession.findMany({
      where: { classId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        student:  { select: { number: true, track: true } },
        scenario: { select: { number: true, label: true } },
        assessments: {
          include: {
            staffMember: { select: { name: true } },
            grades: { select: { gradeValue: true, isDiscontinuity: true } },
          },
        },
      },
    }),
    db.student.findMany({ where: { classId }, orderBy: { number: 'asc' } }),
    db.studentSurveyResponse.findMany({
      where: { classId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: { id: true, submittedAt: true, responses: true },
    }),
    db.classAccess.findMany({ where: { classId }, select: { role: true } }),
  ])

  if (!cls) notFound()

  const finalized = sessions.filter((s) => s.status === 'FINALIZED')
  const scores    = finalized.map((s) => s.finalScore ?? 0).filter(Boolean)
  const passCount = scores.filter((s) => s >= PASSING_SCORE).length
  const passRate  = scores.length ? Math.round((passCount / scores.length) * 100) : null
  const avgScore  = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
    : null

  const statusOrder = { PENDING_RESOLUTION: 0, READY_TO_FINALIZE: 1, OPEN: 2, FINALIZED: 3 }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/classes" className="hover:text-tps-blue">Classes</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Class {cls.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Class {cls.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {cls.isActive ? '● Active' : cls.archivedAt ? 'Archived' : 'Inactive'} ·
            Created {new Date(cls.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/admin/classes/${classId}/snapshot`} className="btn-secondary">
            Grade Snapshot
          </Link>
          <Link href={`/admin/classes/${classId}/history`} className="btn-secondary">
            Grade History
          </Link>
          <a href={`/api/export/${cls.id}`} download className="btn-primary">
            ↓ Export Excel
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Students',  value: students.length },
          { label: 'Sessions',  value: sessions.length },
          { label: 'Finalized', value: finalized.length },
          { label: 'Avg Score', value: avgScore ?? '—' },
          { label: 'Pass Rate', value: passRate !== null ? `${passRate}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card border border-gray-200 text-center py-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-xl font-bold text-tps-navy">{value}</p>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Sessions ({sessions.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Student', 'Track', 'Scenario', 'Graders', 'Status', 'Score', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions
                .slice()
                .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
                .map((session) => {
                  const graderCount = session.assessments.length
                  const hasDisc     = session.status === 'PENDING_RESOLUTION'

                  return (
                    <tr key={session.id} className={hasDisc ? 'bg-amber-50' : 'bg-white hover:bg-gray-50'}>
                      <td className="px-4 py-3 font-mono font-medium">{cls.name}-{session.student.number}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {TRACK_LABELS[session.student.track] ?? session.student.track}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{session.scenario.label}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {graderCount} / {session.assessments.map((a) => a.staffMember.name).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {session.finalScore !== null ? (
                          <span className={session.hasFail ? 'text-red-600' : 'text-green-700'}>
                            {session.hasFail ? 'FAIL (69)' : session.finalScore.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {session.status === 'READY_TO_FINALIZE' && (
                          <form action={async () => { 'use server'; await finalizeSessionAction(session.id) }}>
                            <button type="submit" className="btn-primary text-xs py-1.5 px-3">
                              Finalize
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No sessions yet — grades will appear here as graders submit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Room PINs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Room PINs</h2>
        <p className="text-sm text-gray-500 mb-3">
          PINs are stored as secure hashes — existing values cannot be retrieved.
          Use Rotate to set a new PIN; it will be displayed once.
        </p>
        <PinManager
          classId={classId}
          graderPinSet={accessRecords.some((a) => a.role === 'GRADER')}
          chairPinSet={accessRecords.some((a) => a.role === 'PANEL_CHAIR')}
        />
      </section>

      {/* Students */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Students ({students.length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {students.map((s) => (
            <div key={s.id} className="card border border-gray-200 py-2 px-3 text-sm">
              <p className="font-medium font-mono">{cls.name}-{s.number}</p>
              <p className="text-xs text-gray-400">{TRACK_LABELS[s.track] ?? s.track}</p>
            </div>
          ))}
          {students.length === 0 && (
            <p className="text-sm text-gray-400 col-span-4">No students added.</p>
          )}
        </div>
      </section>

      {/* Recent surveys */}
      {studentSurveys.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Recent Student Surveys ({studentSurveys.length} shown)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {studentSurveys.map((survey) => {
                  const r = survey.responses as Record<string, string>
                  return (
                    <tr key={survey.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(survey.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.track ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN:               'bg-gray-100 text-gray-600',
    PENDING_RESOLUTION: 'bg-amber-100 text-amber-800 font-semibold',
    READY_TO_FINALIZE:  'bg-green-100 text-green-800 font-semibold',
    FINALIZED:          'bg-blue-100 text-blue-800',
  }
  const labels: Record<string, string> = {
    OPEN:               'Open',
    PENDING_RESOLUTION: '⚠ Discontinuities',
    READY_TO_FINALIZE:  '✓ Ready',
    FINALIZED:          '✓ Finalized',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}
