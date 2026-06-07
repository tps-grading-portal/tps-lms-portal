import { requirePermission } from '@/lib/server-auth'
import { getGradeQueueAction } from './actions'
import { GradeQueue } from './grade-queue'
import { GradesTabs } from '@/components/portal/grades-tabs'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grading Queue' }

export default async function GradePage() {
  const user = await requirePermission('grade:enter')

  const { entries, classNames } = await getGradeQueueAction()

  if (classNames.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-tps-navy mb-1">Grading Queue</h1>
        <p className="text-gray-500 text-sm mb-6">Mobile-optimized gradebook entry with instant standings recalculation</p>
        <div className="card text-center py-16 text-gray-400">
          No active class found. Ask a System Admin to activate a class.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-tps-navy">Grades</h1>
        <p className="text-gray-500 text-sm">
          {classNames.length === 1 ? `Class ${classNames[0]}` : `Classes ${classNames.join(', ')}`}
          {' '}· {entries.length} grade sheet{entries.length !== 1 ? 's' : ''}
          {' '}· Tap &quot;Grade&quot; or scan QR code to open on any device
        </p>
      </div>

      <GradesTabs role={user.role} />

      <GradeQueue entries={entries} />
    </div>
  )
}
