import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { GradesTabs } from '@/components/portal/grades-tabs'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradebook Exports' }

export default async function GradebookExportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  if (!can(role, 'grade:queue') && !can(role, 'view:all_standings')) return null

  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    include: { _count: { select: { students: true } } },
  })

  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-tps-navy">Grades</h1>
        <p className="text-gray-500 text-sm">Download full gradebooks as Excel</p>
      </div>

      <GradesTabs role={role} />

      <div className="space-y-3">
        {classes.length === 0 ? (
          <div className="card text-center py-12 text-gray-400 text-sm">No classes found.</div>
        ) : classes.map(c => (
          <div key={c.id} className="card flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-tps-navy">
                Class {c.name}
                {c.isActive && <span className="ml-2 text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">ACTIVE</span>}
              </p>
              <p className="text-xs text-gray-400">{c._count.students} students</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <a href={`/api/export/class-gradebooks/${c.id}`} className="btn-primary text-sm px-4 py-2">
                ⬇ All Gradebooks (.zip)
              </a>
              <Link href={`/portal/classes/${c.id}`} className="btn-secondary text-sm px-4 py-2">
                Open Roster
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Single-student exports are on each student&apos;s profile (Classes → roster → student → “⬇ Gradebook”).
      </p>
    </div>
  )
}
