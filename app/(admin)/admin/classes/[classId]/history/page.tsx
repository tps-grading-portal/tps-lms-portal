import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminSessionData } from './actions'
import { AdminSessionGrid } from './admin-session-grid'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grade History' }

interface PageProps {
  params: Promise<{ classId: string }>
}

export default async function GradeHistoryPage({ params }: PageProps) {
  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    select: { name: true },
  })
  if (!cls) notFound()

  const data = await getAdminSessionData(classId)

  const finalized = data.sessions.filter((s) => s.status === 'FINALIZED').length
  const active    = data.sessions.filter((s) => s.status !== 'FINALIZED').length

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/classes" className="hover:text-tps-blue">Classes</Link>
        <span>›</span>
        <Link href={`/admin/classes/${classId}`} className="hover:text-tps-blue">
          Class {cls.name}
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Grade History</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">
            Grade History — Class {cls.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {finalized} finalized · {active} active
          </p>
        </div>
        <Link href={`/admin/classes/${classId}`} className="btn-secondary text-sm">
          ← Class Detail
        </Link>
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-blue-100 border border-blue-200 inline-block" />
          Finalized — click <strong>Adjust</strong> to unlock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-green-100 border border-green-300 inline-block" />
          Unlocked — editing enabled, click <strong>Re-finalize</strong> when done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-grade-discontinuity border border-amber-400 inline-block" />
          Discontinuity — resolve before re-finalizing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
          Manually adjusted grade
        </span>
      </div>

      <AdminSessionGrid initialData={data} classId={classId} />
    </div>
  )
}
