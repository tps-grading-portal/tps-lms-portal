import { db } from '@/lib/db'
import Link from 'next/link'
import { TemplateLibraryPanel } from './template-library-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradesheet Library' }

export default async function TemplateLibraryPage() {
  const templates = await db.gradesheetTemplate.findMany({
    orderBy: [{ isActive: 'desc' }, { courseCode: 'asc' }],
    include: { _count: { select: { tasks: true, entries: true } } },
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Gradesheet Library</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Gradesheet Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {templates.filter((t) => t.isActive).length} active · {templates.filter((t) => !t.isActive).length} archived
          </p>
        </div>
      </div>

      <TemplateLibraryPanel templates={templates} />
    </div>
  )
}
