import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { AccountView } from './account-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userId = session.user.id
  const isReviewer = can(session.user.role, 'manage:users')

  const [user, myRequests, events, pendingForReview] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        lastLoginAt: true, createdAt: true,
        departments:       { select: { deptCode: true } },
        courseAssignments: {
          include: { syllabusEvent: { select: { courseCode: true, title: true } } },
        },
        studentProfile: { select: { class: { select: { name: true } }, track: true } },
      },
    }),
    db.accessRequest.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      include: { reviewedBy: { select: { firstName: true, lastName: true } } },
    }),
    db.syllabusEvent.findMany({
      where:   { isActive: true },
      orderBy: { courseCode: 'asc' },
      select:  { id: true, courseCode: true, title: true },
    }),
    isReviewer
      ? db.accessRequest.findMany({
          where:   { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { firstName: true, lastName: true, role: true, email: true } } },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="w-full max-w-5xl">
      <AccountView
        profile={{
          email:       user.email,
          firstName:   user.firstName,
          lastName:    user.lastName,
          role:        user.role,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt:   user.createdAt.toISOString(),
          className:   user.studentProfile?.class.name ?? null,
          track:       user.studentProfile?.track ?? null,
          departments: user.departments.map(d => d.deptCode),
          courseOwnerships: user.courseAssignments.map(a => ({
            id:    a.id,
            label: a.syllabusEvent
              ? `${a.syllabusEvent.courseCode} — ${a.syllabusEvent.title}`
              : `${a.deptCode} (whole phase)`,
          })),
        }}
        myRequests={myRequests.map(r => ({
          id:            r.id,
          type:          r.type,
          targetLabel:   r.targetLabel,
          justification: r.justification,
          status:        r.status,
          createdAt:     r.createdAt.toISOString(),
          reviewedBy:    r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}`.trim() : null,
          reviewNote:    r.reviewNote,
        }))}
        courseOptions={events.map(e => ({ id: e.id, label: `${e.courseCode} — ${e.title}` }))}
        pendingForReview={pendingForReview.map(r => ({
          id:            r.id,
          type:          r.type,
          targetLabel:   r.targetLabel,
          justification: r.justification,
          createdAt:     r.createdAt.toISOString(),
          requester:     `${r.user.firstName} ${r.user.lastName}`.trim(),
          requesterRole: r.user.role,
        }))}
        isReviewer={isReviewer}
      />
    </div>
  )
}
