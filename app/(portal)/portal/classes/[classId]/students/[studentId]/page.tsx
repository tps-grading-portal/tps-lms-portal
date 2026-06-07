import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { StudentProfileView } from './student-profile-view'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ studentId: string }> }): Promise<Metadata> {
  const { studentId } = await params
  const s = await db.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } })
  return { title: s ? `${s.lastName}, ${s.firstName}` : 'Student' }
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  const canView = can(role, 'manage:classes') || can(role, 'grade:enter')
  if (!canView) return null

  const { classId, studentId } = await params

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { id: true, name: true } },
      entries: {
        include: { template: { select: { courseCode: true, title: true, type: true } } },
        orderBy: [{ status: 'desc' }, { template: { courseCode: 'asc' } }],
      },
      sessions: {
        where:   { status: 'FINALIZED' },
        include: { scenario: { select: { label: true } } },
        orderBy: { finalizedAt: 'desc' },
      },
      alerts: {
        where:   { isResolved: false },
        orderBy: { createdAt: 'desc' },
      },
      syllabusEvents: {
        include: { syllabusEvent: { select: { courseCode: true, title: true, phase: true } } },
      },
    },
  })

  if (!student || student.classId !== classId) notFound()

  const canManage = can(role, 'manage:classes')
  const canGrade  = can(role, 'grade:enter')

  return (
    <div className="w-full">
      <StudentProfileView
        student={{
          id:        student.id,
          number:    student.number,
          firstName: student.firstName,
          lastName:  student.lastName,
          email:     student.email,
          track:     student.track,
          className: student.class.name,
          classId:   student.class.id,
        }}
        entries={student.entries.map(e => ({
          id:           e.id,
          courseCode:   e.template.courseCode,
          title:        e.template.title,
          type:         e.template.type,
          status:       e.status,
          overallScore: e.overallScore,
          overallPass:  e.overallPass,
          submittedAt:  e.submittedAt?.toISOString() ?? null,
          instructorName: e.instructorName,
          isLocked:     e.isLocked,
        }))}
        compOrals={student.sessions.map(s => ({
          id:         s.id,
          scenario:   s.scenario.label,
          finalScore: s.outputScore ?? s.finalScore,
          hasFail:    s.hasFail,
          isRetake:   s.isRetake,
          finalizedAt: s.finalizedAt?.toISOString() ?? null,
        }))}
        alerts={student.alerts.map(a => ({
          id:       a.id,
          type:     a.type,
          severity: a.severity,
          message:  a.message,
        }))}
        canManage={canManage}
        canGrade={canGrade}
      />
    </div>
  )
}
