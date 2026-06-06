import { requirePermission } from '@/lib/server-auth'
import { getEntryForGradingAction } from '../actions'
import { MobileGradeForm } from './mobile-grade-form'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grade Entry' }

export default async function GradeEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  await requirePermission('grade:enter')

  const { entryId } = await params
  const entry = await getEntryForGradingAction(entryId)

  if (!entry) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-10 text-gray-400">
          Grade entry not found.
          <div className="mt-4">
            <Link href="/portal/grade" className="btn-secondary text-sm">← Back to Queue</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/portal/grade" className="text-gray-400 hover:text-tps-navy text-sm">
          ← Queue
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 truncate">
          {entry.template.courseCode} — {entry.student.firstName || `Student ${entry.student.number}`}
        </span>
      </div>

      <MobileGradeForm entry={entry} />
    </div>
  )
}
