import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { GradesheetEntryForm } from './gradesheet-entry-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradesheet' }

interface PageProps { params: Promise<{ classId: string; studentId: string; entryId: string }> }

export default async function GradesheetEntryPage({ params }: PageProps) {
  const { classId, studentId, entryId } = await params

  const entry = await db.gradebookEntry.findUnique({
    where:   { id: entryId },
    include: {
      student:  { include: { class: true } },
      template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
      scores:   true,
    },
  })
  if (!entry || entry.studentId !== studentId) notFound()

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <Link href={`/admin/gradebook/classes/${classId}`} className="hover:text-tps-orange">{entry.student.class.name}</Link>
        <span>›</span>
        <Link href={`/admin/gradebook/classes/${classId}/${studentId}`} className="hover:text-tps-orange">{entry.student.class.name}-{entry.student.number}</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{entry.template.courseCode}</span>
      </div>

      <GradesheetEntryForm entry={entry} />
    </div>
  )
}
