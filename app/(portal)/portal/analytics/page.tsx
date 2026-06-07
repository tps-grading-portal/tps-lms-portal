import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { computeClassAnalytics } from '@/lib/analytics'
import { computeClassComparison } from '@/lib/class-comparison'
import { ClassComparison } from './class-comparison'
import { GradesTabs } from '@/components/portal/grades-tabs'
import type { Metadata } from 'next'
import type { AlertSeverity } from '@prisma/client'

export const metadata: Metadata = { title: 'Analytics' }

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border border-red-200',
  WARNING:  'bg-amber-100 text-amber-700 border border-amber-200',
  INFO:     'bg-blue-100 text-blue-700 border border-blue-200',
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  const canView =
    can(role, 'view:all_analytics') ||
    can(role, 'view:dept_analytics') ||
    can(role, 'view:instructor_analytics')

  if (!canView) return null

  const params = await searchParams

  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    select:  { id: true, name: true },
  })

  const selectedClassId = params.classId ?? classes[0]?.id

  if (!selectedClassId) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-bold text-tps-navy mb-2">Analytics</h1>
        <div className="card text-center py-16 text-gray-400 text-sm">
          No active classes found.
        </div>
      </div>
    )
  }

  const [analytics, comparison] = await Promise.all([
    computeClassAnalytics(selectedClassId),
    computeClassComparison(),
  ])
  const criticalCount = analytics.studentAlerts.filter(a => a.severity === 'CRITICAL').length

  const showGraderAlerts = can(role, 'view:all_analytics') || can(role, 'view:dept_analytics')

  return (
    <div className="w-full space-y-6">
      <GradesTabs role={role} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Analytics</h1>
          <p className="text-gray-500 text-sm">
            Early warning system · Class {analytics.className}
          </p>
        </div>

        {classes.length > 1 && (
          <div className="flex gap-2">
            {classes.map(c => (
              <a
                key={c.id}
                href={`/portal/analytics?classId=${c.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  c.id === selectedClassId
                    ? 'bg-tps-navy text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
                }`}
              >
                {c.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-black text-tps-navy">{analytics.summary.totalStudents}</p>
          <p className="text-xs text-gray-500 mt-0.5">Students</p>
        </div>
        <div className={`card text-center ${criticalCount > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <p className={`text-2xl font-black ${criticalCount > 0 ? 'text-red-600' : 'text-tps-navy'}`}>
            {criticalCount}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Critical Alerts</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-black text-tps-navy">{analytics.summary.gradedEvents}</p>
          <p className="text-xs text-gray-500 mt-0.5">Students w/ Grades</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-black text-tps-navy">
            {analytics.summary.avgClassScore !== null ? `${analytics.summary.avgClassScore}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Class Avg Score</p>
        </div>
      </div>

      {/* Cross-class comparison — every class ever in the LMS, with trends */}
      <section>
        <h2 className="font-bold text-tps-navy text-base mb-1">Class Comparison &amp; Trends</h2>
        <p className="text-xs text-gray-400 mb-3">
          Compare performance across all classes — active and archived — overall,
          by curriculum phase, or event by event. The orange line traces the trend
          from oldest to newest class.
        </p>
        <ClassComparison data={comparison} />
      </section>

      {/* Student alerts */}
      <section>
        <h2 className="font-bold text-tps-navy text-base mb-3 flex items-center gap-2">
          Student Early Warnings
          {analytics.studentAlerts.length > 0 && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
              {analytics.studentAlerts.length}
            </span>
          )}
        </h2>

        {analytics.studentAlerts.length === 0 ? (
          <div className="card text-center py-8 text-gray-400 text-sm">
            No active student alerts — all students are on track.
          </div>
        ) : (
          <div className="space-y-2">
            {analytics.studentAlerts.map((alert, i) => (
              <div key={i} className={`rounded-xl px-4 py-3 text-sm ${SEVERITY_COLORS[alert.severity]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold">{alert.studentName}</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span>{alert.message}</span>
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide">
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Grader bias alerts */}
      {showGraderAlerts && (
        <section>
          <h2 className="font-bold text-tps-navy text-base mb-3 flex items-center gap-2">
            Grader IRR Alerts
            {analytics.graderAlerts.length > 0 && (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-600">
                {analytics.graderAlerts.length}
              </span>
            )}
          </h2>

          {analytics.graderAlerts.length === 0 ? (
            <div className="card text-center py-8 text-gray-400 text-sm">
              No grader bias detected — all instructors within acceptable ranges.
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Instructor</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Grader Avg</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Class Avg</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Δ Delta</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Type</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Samples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.graderAlerts.map(g => (
                    <tr key={g.instructorId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-tps-navy">{g.instructorName}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{g.avgScore.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{g.classAvg.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${Math.abs(g.delta) > 0 ? (g.delta > 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-500'}`}>
                        {g.delta > 0 ? '+' : ''}{g.delta.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          g.severity === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {g.severity === 'hard' ? 'Hard Bias' : 'Soft Bias'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">{g.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            Hard bias: grader avg deviates ≥15 pts from class mean ·
            Soft bias: ≥8 pts · Minimum 3 graded events required
          </p>
        </section>
      )}
    </div>
  )
}
