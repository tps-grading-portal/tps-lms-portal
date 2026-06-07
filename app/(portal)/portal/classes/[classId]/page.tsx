import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { ClassDetailView } from './class-detail-view'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ classId: string }> }): Promise<Metadata> {
  const { classId } = await params
  const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
  return { title: cls ? `Class ${cls.name}` : 'Class' }
}

export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:classes')) return null

  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        orderBy: { number: 'asc' },
        include: {
          entries: {
            where:  { status: 'SUBMITTED' },
            select: { overallScore: true, overallPass: true },
          },
          _count: { select: { entries: true } },
        },
      },
      _count: { select: { scheduledEvents: true } },
    },
  })
  if (!cls) notFound()

  const students = cls.students.map(s => {
    const submitted = s.entries
    const avg = submitted.length > 0
      ? submitted.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / submitted.length
      : null
    return {
      id:           s.id,
      number:       s.number,
      firstName:    s.firstName,
      lastName:     s.lastName,
      email:        s.email,
      track:        s.track,
      hasLogin:     !!s.userId,
      gradedCount:  submitted.length,
      totalEntries: s._count.entries,
      avgScore:     avg,
      hasFail:      submitted.some(e => e.overallPass === false),
    }
  })

  return (
    <div className="max-w-5xl mx-auto">
      <ClassDetailView
        cls={{
          id:            cls.id,
          name:          cls.name,
          concentration: cls.concentration,
          startDate:     cls.startDate?.toISOString() ?? null,
          endDate:       cls.endDate?.toISOString() ?? null,
          isActive:      cls.isActive,
          isPlanning:    cls.isPlanning,
          isAdmin:       session.user.role === 'SYSTEM_ADMIN',
          archivedAt:    cls.archivedAt?.toISOString() ?? null,
          scheduledEventCount: cls._count.scheduledEvents,
        }}
        students={students}
      />
    </div>
  )
}
