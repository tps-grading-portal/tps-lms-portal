import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getInstructorSession } from '@/lib/gradebook-auth'
import { GradesheetEntryForm } from '@/app/(admin)/admin/gradebook/classes/[classId]/[studentId]/[entryId]/gradesheet-entry-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradesheet' }

interface PageProps { params: Promise<{ classId: string; studentId: string; entryId: string }> }

export default async function InstructorEntryPage({ params }: PageProps) {
  const session = await getInstructorSession()
  if (!session) redirect('/instructor/auth')

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

  // Pre-fill instructor name from session
  const entryWithInstructor = {
    ...entry,
    instructorName: entry.instructorName ?? session.name,
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-10">
        <Link href={`/instructor/gradebook/${classId}/${studentId}`} className="text-sm text-gray-300 hover:text-white">
          ← {entry.student.class.name}-{entry.student.number}
        </Link>
        <span className="text-xs text-gray-300">{session.name}</span>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/instructor/gradebook" className="hover:text-tps-orange">Gradebook</Link>
          <span>›</span>
          <Link href={`/instructor/gradebook/${classId}/${studentId}`} className="hover:text-tps-orange">{entry.student.class.name}-{entry.student.number}</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{entry.template.courseCode}</span>
        </div>

        <GradesheetEntryForm entry={entryWithInstructor} isInstructor={true} />
      </div>
    </main>
  )
}
