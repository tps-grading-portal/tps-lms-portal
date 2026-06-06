import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { EditUserForm } from './edit-user-form'
import { PrivilegesPanel } from './privileges-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Edit User' }

const INSTRUCTOR_ROLES = ['LINE_INSTRUCTOR', 'GUEST_INSTRUCTOR', 'DEPT_CHAIR', 'ADO', 'DO']

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:users')) return null

  const { id } = await params

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
      studentProfile: { select: { id: true, classId: true, number: true, track: true, class: { select: { name: true } } } },
      departments: { select: { deptCode: true } },
      courseAssignments: {
        include: {
          syllabusEvent: { select: { courseCode: true, title: true } },
          assignedBy:    { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) notFound()

  // Catalog for the Add Course dropdown (instructor-level roles only)
  const catalog = INSTRUCTOR_ROLES.includes(user.role)
    ? await db.syllabusEvent.findMany({
        where:   { isActive: true },
        orderBy: { courseCode: 'asc' },
        select:  { id: true, courseCode: true, title: true, deptCode: true },
      })
    : []

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-tps-navy mb-1">Edit User</h1>
      <p className="text-gray-500 text-sm mb-6">{user.email}</p>
      <EditUserForm
        user={{
          id:          user.id,
          email:       user.email,
          firstName:   user.firstName,
          lastName:    user.lastName,
          role:        user.role,
          isActive:    user.isActive,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt:   user.createdAt.toISOString(),
          isSelf:      user.id === session.user.id,
          studentProfile: user.studentProfile
            ? {
                id:        user.studentProfile.id,
                classId:   user.studentProfile.classId,
                className: user.studentProfile.class.name,
                number:    user.studentProfile.number,
                track:     user.studentProfile.track,
              }
            : null,
        }}
      />

      <div className="mt-5">
        <PrivilegesPanel
          userId={user.id}
          role={user.role}
          departments={user.departments.map(d => d.deptCode)}
          assignments={user.courseAssignments.map(a => ({
            id:          a.id,
            courseCode:  a.syllabusEvent?.courseCode ?? null,
            courseTitle: a.syllabusEvent?.title ?? null,
            deptCode:    a.deptCode,
            assignedBy:  `${a.assignedBy.firstName} ${a.assignedBy.lastName}`.trim(),
            assignedAt:  a.createdAt.toISOString(),
          }))}
          catalog={catalog}
        />
      </div>
    </div>
  )
}
