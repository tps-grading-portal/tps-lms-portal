/**
 * Content authority — who may edit lessons, prerequisites, TLO/PLOs, and
 * own content for a given MCG course.
 *
 * - SYSTEM_ADMIN, DEAN_COMMANDER, A9_STANDARDS: everything
 * - DEPT_CHAIR: their assigned departments (UserDepartment)
 * - ADO / DO: AN + CF
 * - LINE_INSTRUCTOR / GUEST_INSTRUCTOR: courses/phases assigned via
 *   CourseAssignment (course owner)
 */
import { db } from '@/lib/db'
import type { UserRole, DepartmentCode } from '@prisma/client'

export type ContentScope = {
  all:      boolean
  depts:    DepartmentCode[]   // whole departments the user controls
  eventIds: string[]           // individual courses the user owns
}

const GLOBAL_ROLES: UserRole[] = ['SYSTEM_ADMIN', 'DEAN_COMMANDER', 'A9_STANDARDS']
const AN_CF: DepartmentCode[] = ['AN', 'CF']

export async function getContentScope(userId: string, role: UserRole): Promise<ContentScope> {
  if (GLOBAL_ROLES.includes(role)) return { all: true, depts: [], eventIds: [] }

  const depts: DepartmentCode[] = []
  if (role === 'ADO' || role === 'DO') depts.push(...AN_CF)

  if (role === 'DEPT_CHAIR') {
    const userDepts = await db.userDepartment.findMany({
      where:  { userId },
      select: { deptCode: true },
    })
    depts.push(...userDepts.map(d => d.deptCode))
  }

  // Course owner / phase assignments apply to any instructor-level role
  const assignments = await db.courseAssignment.findMany({
    where:  { userId },
    select: { syllabusEventId: true, deptCode: true },
  })
  const eventIds: string[] = []
  for (const a of assignments) {
    if (a.syllabusEventId) eventIds.push(a.syllabusEventId)
    if (a.deptCode && !depts.includes(a.deptCode)) depts.push(a.deptCode)
  }

  return { all: false, depts, eventIds }
}

/** May this user edit content/prereqs/TLOs for the given event? */
export function scopeCoversEvent(
  scope: ContentScope,
  event: { id: string; deptCode: DepartmentCode },
): boolean {
  if (scope.all) return true
  if (scope.depts.includes(event.deptCode)) return true
  return scope.eventIds.includes(event.id)
}

/** Convenience: scope check straight from user info + event. */
export async function canEditEventContent(
  userId: string,
  role:   UserRole,
  event:  { id: string; deptCode: DepartmentCode },
): Promise<boolean> {
  const scope = await getContentScope(userId, role)
  return scopeCoversEvent(scope, event)
}

/** Prisma where-clause fragment limiting SyllabusEvents to the user's scope. */
export function scopeToEventWhere(scope: ContentScope) {
  if (scope.all) return {}
  return {
    OR: [
      { deptCode: { in: scope.depts } },
      { id:       { in: scope.eventIds } },
    ],
  }
}
