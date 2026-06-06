import { requireAuth } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { can } from '@/lib/permissions'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Grades' }

export default async function GradesPage() {
  const user = await requireAuth()

  // Instructors → redirect to the grading queue
  if (can(user.role, 'grade:enter')) {
    const { redirect } = await import('next/navigation')
    redirect('/portal/grade')
  }

  // Students — load their own gradebook entries
  const student = await db.student.findFirst({
    where: { userId: user.id },
    include: {
      class:   { select: { name: true } },
      entries: {
        include: { template: { select: { courseCode: true, title: true, type: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!student) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-tps-navy mb-1">My Grades</h1>
        <div className="card text-center py-16 text-gray-400">
          No student profile linked to your account. Contact your instructor or system admin.
        </div>
      </div>
    )
  }

  const submitted  = student.entries.filter(e => e.status === 'SUBMITTED')
  const inProgress = student.entries.filter(e => e.status === 'IN_PROGRESS')
  const pending    = student.entries.filter(e => e.status === 'NOT_STARTED')

  const avgScore = submitted.length > 0
    ? submitted.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / submitted.length
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">My Grades</h1>
        <p className="text-gray-500 text-sm">
          Class {student.class.name} · {student.track} track ·{' '}
          {submitted.length}/{student.entries.length} events graded
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-tps-navy tabular-nums">
            {avgScore !== null ? avgScore.toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Average Score</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-600 tabular-nums">{submitted.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Completed</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-gray-400 tabular-nums">{pending.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pending</p>
        </div>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">In Progress</h2>
          <div className="space-y-2">
            {inProgress.map(entry => (
              <div key={entry.id} className="card border-l-4 border-l-amber-400 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold font-mono bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded">
                      {entry.template.courseCode}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{entry.template.title}</p>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">In Progress</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Submitted */}
      {submitted.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Graded Events</h2>
          <div className="space-y-2">
            {submitted.map(entry => (
              <div key={entry.id} className="card border-l-4 border-l-green-400 py-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded">
                        {entry.template.courseCode}
                      </span>
                      <span className="text-xs text-gray-400">{entry.template.type}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{entry.template.title}</p>
                    {entry.submittedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Graded {new Date(entry.submittedAt).toLocaleDateString()}
                        {entry.instructorName && ` by ${entry.instructorName}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {entry.overallScore !== null && (
                      <p className={`text-lg font-bold tabular-nums ${
                        entry.overallScore >= 90 ? 'text-green-700' :
                        entry.overallScore >= 80 ? 'text-tps-navy' :
                        entry.overallScore >= 70 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {entry.overallScore.toFixed(1)}%
                      </p>
                    )}
                    {entry.overallPass !== null && (
                      <span className={`text-xs font-bold ${entry.overallPass ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.overallPass ? 'PASS' : 'FAIL'}
                      </span>
                    )}
                  </div>
                </div>
                {entry.comments && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">
                    {entry.comments}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming Events</h2>
          <div className="space-y-2">
            {pending.map(entry => (
              <div key={entry.id} className="card border-l-4 border-l-gray-200 py-3 opacity-75">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {entry.template.courseCode}
                    </span>
                    <p className="text-sm font-semibold text-gray-600 mt-1">{entry.template.title}</p>
                  </div>
                  <span className="text-xs text-gray-400">Not graded</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {student.entries.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          No gradesheet entries found. Contact your instructor if you believe this is an error.
        </div>
      )}

      <div className="pt-2">
        <Link href="/portal/syllabus" className="text-sm text-tps-blue hover:underline">
          View full syllabus roadmap →
        </Link>
      </div>
    </div>
  )
}
