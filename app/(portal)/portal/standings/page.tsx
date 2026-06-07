import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import { StandingsBoard } from './standings-board'
import { ClassSelector } from '@/components/portal/class-selector'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Class Standings' }

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  const canView = can(role, 'view:dept_standings') || can(role, 'view:all_standings')
  if (!canView) return null

  const params = await searchParams

  // Load active classes for the selector
  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    select:  { id: true, name: true },
  })

  const selectedClassId = params.classId ?? classes[0]?.id
  if (!selectedClassId) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-bold text-tps-navy mb-2">Class Standings</h1>
        <div className="card text-center py-16 text-gray-400 text-sm">
          No active classes found. Create a class first.
        </div>
      </div>
    )
  }

  const standings = await computeStandings(selectedClassId)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Class Standings</h1>
          <p className="text-gray-500 text-sm">
            Weighted performance rankings · Class {standings.className}
          </p>
        </div>

        {/* Class selector */}
        <ClassSelector classes={classes} selectedClassId={selectedClassId} />
      </div>

      {/* Weighting notice if no weights configured */}
      {can(role, 'manage:weighting_matrix') &&
        standings.allStudents.every(s => s.weightedAvg === null) && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            No curriculum weights configured yet.{' '}
            <a href="/portal/weighting" className="underline font-semibold">
              Set up the weighting matrix →
            </a>
          </div>
        )}

      <StandingsBoard data={standings} />
    </div>
  )
}
