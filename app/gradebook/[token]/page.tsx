import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/gradebook-auth'
import { StudentGradebookView } from './student-gradebook-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Gradebook' }

interface PageProps { params: Promise<{ token: string }> }

export default async function StudentGradebookPage({ params }: PageProps) {
  const { token } = await params

  const student = await db.gradebookStudent.findUnique({
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

  // Must have a PIN set before we check session
  if (!student.viewPinHash) {
    redirect(`/gradebook/${token}/set-pin`)
  }

  // Check session
  const session = await getStudentSession(token)
  if (!session || session.studentId !== student.id) {
    redirect(`/gradebook/${token}/auth`)
  }

  // If temp PIN, must change it
  if (student.isTempPin) {
    redirect(`/gradebook/${token}/set-pin?change=1`)
  }

  return <StudentGradebookView student={student} />
}
