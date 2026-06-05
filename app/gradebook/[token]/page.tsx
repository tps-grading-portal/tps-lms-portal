import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/gradebook-auth'
import { StudentGradebookView } from './student-gradebook-view'
import { studentLabel } from '@/lib/student-display'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Gradebook' }

interface PageProps { params: Promise<{ token: string }> }

export default async function StudentGradebookPage({ params }: PageProps) {
  const { token } = await params

  const student = await db.student.findUnique({
    where:   { viewToken: token },
    include: {
      class: { select: { name: true } },
      entries: {
        include: { template: { select: { courseCode: true, title: true, type: true } } },
        orderBy: { template: { courseCode: 'asc' } },
      },
    },
  })
  if (!student) notFound()

  if (!student.viewPinHash) redirect(`/gradebook/${token}/set-pin`)

  const session = await getStudentSession(token)
  if (!session || session.studentId !== student.id) redirect(`/gradebook/${token}/auth`)

  if (student.isTempPin) redirect(`/gradebook/${token}/set-pin?change=1`)

  const label = studentLabel(student.class.name, student.number)

  return <StudentGradebookView student={{ ...student, displayName: label }} />
}
