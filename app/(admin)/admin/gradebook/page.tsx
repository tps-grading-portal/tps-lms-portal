import { db } from '@/lib/db'
import Link from 'next/link'
import { GradebookClassPanel } from './gradebook-class-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradebook' }

export default async function GradebookPage() {
  const [classes, templateCount] = await Promise.all([
    db.class.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        students: {
          orderBy: { number: 'asc' },
          include: {
            entries: { select: { status: true, overallPass: true } },
          },
        },
      },
    }),
    db.gradesheetTemplate.count({ where: { isActive: true } }),
  ])

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Gradebook</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Flight gradesheet management — {templateCount} active templates
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/gradebook/instructors" className="btn-secondary text-sm">Instructors</Link>
          <Link href="/admin/gradebook/templates"   className="btn-secondary text-sm">Templates</Link>
          <Link href="/admin/classes/new"           className="btn-primary text-sm">New Class</Link>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="card border border-dashed border-gray-300 text-center py-12 space-y-3">
          <p className="text-gray-400 font-medium">No classes yet.</p>
          <p className="text-sm text-gray-400">Create a class in the Classes section — it will appear here.</p>
          <Link href="/admin/classes/new" className="btn-primary text-sm inline-flex">Create First Class →</Link>
        </div>
      )}

      <div className="space-y-6">
        {classes.map((cls) => (
          <GradebookClassPanel key={cls.id} cls={cls} />
        ))}
      </div>
    </div>
  )
}
