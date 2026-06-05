import { db } from '@/lib/db'
import Link from 'next/link'
import { setActiveClassAction, deactivateClassAction } from '../actions'
import { DeleteClassButton } from './delete-class-button'
import { PASSING_SCORE } from '@/lib/constants'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Classes' }

export default async function ClassesPage() {
  const classes = await db.class.findMany({
    orderBy: [{ isCompOralCurrent: 'desc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { students: true, sessions: true, studentSurveys: true } },
      sessions: {
        select: { finalScore: true, hasFail: true, status: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-tps-navy">Classes</h1>
        <Link href="/admin/classes/new" className="btn-primary text-sm">
          + Create New Class
        </Link>
      </div>

      {classes.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No classes yet</p>
          <p className="text-sm mt-1">
            <Link href="/admin" className="text-tps-blue hover:underline">Create the first class</Link>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {classes.map((cls) => {
          const finalized = cls.sessions.filter((s) => s.status === 'FINALIZED')
          const pending   = cls.sessions.filter((s) => s.status === 'PENDING_RESOLUTION')
          const scores    = finalized.map((s) => s.finalScore ?? 0).filter(Boolean)
          const passRate  = scores.length
            ? Math.round((scores.filter((s) => s >= PASSING_SCORE).length / scores.length) * 100)
            : null
          const avgScore  = scores.length
            ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
            : null

          return (
            <div
              key={cls.id}
              className={`card border ${cls.isActive ? 'border-tps-blue bg-blue-50' : 'border-gray-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Class info */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-tps-navy">Class {cls.name}</h2>
                    {cls.isActive && (
                      <span className="text-xs bg-tps-blue text-white px-2 py-0.5 rounded-full">ACTIVE</span>
                    )}
                    {cls.archivedAt && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">ARCHIVED</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Created {new Date(cls.createdAt).toLocaleDateString()}
                  </p>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <Stat label="Students"   value={cls._count.students} />
                    <Stat label="Sessions"   value={cls._count.sessions} />
                    <Stat label="Finalized"  value={finalized.length} />
                    <Stat label="Avg Score"  value={avgScore ?? '—'} />
                    <Stat label="Pass Rate"  value={passRate !== null ? `${passRate}%` : '—'} />
                    <Stat label="Surveys"    value={cls._count.studentSurveys} />
                    {pending.length > 0 && (
                      <Stat label="⚠ Pending" value={pending.length} highlight />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/classes/${cls.id}`} className="btn-primary text-sm">
                    View Detail
                  </Link>
                  {!cls.isActive && !cls.archivedAt && (
                    <form action={async () => { 'use server'; await setActiveClassAction(cls.id) }}>
                      <button type="submit" className="btn-secondary text-sm">Set Active</button>
                    </form>
                  )}
                  {cls.isActive && (
                    <form action={async () => { 'use server'; await deactivateClassAction(cls.id) }}>
                      <button type="submit" className="btn-ghost text-sm border border-gray-300">
                        Deactivate
                      </button>
                    </form>
                  )}
                  <a
                    href={`/api/export/${cls.id}`}
                    className="btn-secondary text-sm"
                    download
                  >
                    Export Excel
                  </a>
                </div>
              </div>

              {/* Delete — 3-step confirmation, bottom left */}
              <DeleteClassButton
                classId={cls.id}
                className={cls.name}
                sessionCount={cls._count.sessions}
                studentCount={cls._count.students}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({
  label, value, highlight = false,
}: {
  label: string; value: string | number; highlight?: boolean
}) {
  return (
    <div className={highlight ? 'text-amber-700' : 'text-gray-600'}>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
