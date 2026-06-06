import type { UserRole } from '@prisma/client'

export type Permission =
  | 'manage:users'            // SYSTEM_ADMIN only
  | 'manage:curriculum'       // SYSTEM_ADMIN, DEAN
  | 'view:all_analytics'      // SYSTEM_ADMIN, DEAN, A9
  | 'view:dept_analytics'     // DEPT_CHAIR + all above
  | 'view:instructor_analytics' // LINE_INSTRUCTOR (limited)
  | 'manage:content_vault'    // A9 final approve/archive
  | 'review:content'          // DEPT_CHAIR review step
  | 'submit:content'          // LINE_INSTRUCTOR submit
  | 'grade:enter'             // LINE_INSTRUCTOR, DEPT_CHAIR
  | 'view:all_standings'      // SYSTEM_ADMIN, DEAN, A9, DEPT_CHAIR
  | 'view:dept_standings'     // LINE_INSTRUCTOR (own dept only)
  | 'view:own_grades'         // STUDENT
  | 'manage:surveys'          // A9 owns survey deploy/sanitize
  | 'view:raw_surveys'        // A9 only (names visible)
  | 'view:sanitized_surveys'  // LINE_INSTRUCTOR (no names)
  | 'manage:chat'             // SYSTEM_ADMIN can create/delete channels
  | 'use:chat'                // all authenticated roles
  | 'manage:weighting_matrix' // DEAN, SYSTEM_ADMIN
  | 'view:flight_schedule'    // everyone except STUDENT
  | 'manage:classes'          // SYSTEM_ADMIN, DEAN
  | 'impersonate:user'        // SYSTEM_ADMIN only
  | 'view:lessons'            // all authenticated roles
  | 'author:lessons'          // LINE_INSTRUCTOR, DEPT_CHAIR, SYSTEM_ADMIN
  | 'schedule:academic'       // DEAN, SYSTEM_ADMIN
  | 'view:academic_schedule'  // all authenticated roles
  | 'grade:queue'             // LINE_INSTRUCTOR, DEPT_CHAIR, SYSTEM_ADMIN

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SYSTEM_ADMIN: [
    'manage:users',
    'manage:curriculum',
    'view:all_analytics',
    'view:dept_analytics',
    'view:instructor_analytics',
    'manage:content_vault',
    'review:content',
    'submit:content',
    'grade:enter',
    'grade:queue',
    'view:all_standings',
    'view:dept_standings',
    'view:own_grades',
    'manage:surveys',
    'view:raw_surveys',
    'view:sanitized_surveys',
    'manage:chat',
    'use:chat',
    'manage:weighting_matrix',
    'view:flight_schedule',
    'manage:classes',
    'impersonate:user',
    'view:lessons',
    'author:lessons',
    'schedule:academic',
    'view:academic_schedule',
  ],
  DEAN_COMMANDER: [
    'manage:curriculum',
    'view:all_analytics',
    'view:dept_analytics',
    'view:instructor_analytics',
    'view:all_standings',
    'manage:weighting_matrix',
    'view:flight_schedule',
    'manage:classes',
    'use:chat',
    'view:sanitized_surveys',
    'view:lessons',
    'schedule:academic',
    'view:academic_schedule',
  ],
  A9_STANDARDS: [
    'view:all_analytics',
    'view:dept_analytics',
    'view:instructor_analytics',
    'manage:content_vault',
    'review:content',
    'submit:content',
    'view:all_standings',
    'manage:surveys',
    'view:raw_surveys',
    'view:sanitized_surveys',
    'view:flight_schedule',
    'use:chat',
    'view:lessons',
    'view:academic_schedule',
  ],
  DEPT_CHAIR: [
    'view:dept_analytics',
    'view:instructor_analytics',
    'review:content',
    'submit:content',
    'grade:enter',
    'grade:queue',
    'view:all_standings',
    'view:dept_standings',
    'view:sanitized_surveys',
    'view:flight_schedule',
    'use:chat',
    'view:lessons',
    'author:lessons',
    'schedule:academic',
    'view:academic_schedule',
  ],
  ADO: [
    // Assistant Director of Operations — chair-equivalent over AN/CF
    'view:dept_analytics',
    'view:instructor_analytics',
    'review:content',
    'submit:content',
    'grade:enter',
    'grade:queue',
    'view:all_standings',
    'view:dept_standings',
    'view:sanitized_surveys',
    'view:flight_schedule',
    'use:chat',
    'view:lessons',
    'author:lessons',
    'view:academic_schedule',
  ],
  DO: [
    // Director of Operations — ADO powers + schedule authority
    'view:dept_analytics',
    'view:instructor_analytics',
    'review:content',
    'submit:content',
    'grade:enter',
    'grade:queue',
    'view:all_standings',
    'view:dept_standings',
    'view:sanitized_surveys',
    'view:flight_schedule',
    'use:chat',
    'view:lessons',
    'author:lessons',
    'schedule:academic',
    'view:academic_schedule',
  ],
  LINE_INSTRUCTOR: [
    'submit:content',
    'grade:enter',
    'grade:queue',
    'view:dept_standings',
    'view:instructor_analytics',
    'view:sanitized_surveys',
    'view:flight_schedule',
    'use:chat',
    'view:lessons',
    'author:lessons',
    'view:academic_schedule',
  ],
  GUEST_INSTRUCTOR: [
    // Scoped to assigned courses only — enforced at the query level
    'submit:content',
    'grade:enter',
    'grade:queue',
    'use:chat',
    'view:lessons',
    'author:lessons',
    'view:academic_schedule',
  ],
  STUDENT: [
    'view:own_grades',
    'use:chat',
    'view:lessons',
    'view:academic_schedule',
  ],
}

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => can(role, p))
}

export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => can(role, p))
}

// Portal nav items — rendered only when user has at least one required permission
export type NavItem = {
  label: string
  href: string
  requiredPermission: Permission
  icon: string
}

export const PORTAL_NAV: NavItem[] = [
  { label: 'Dashboard',          href: '/portal/dashboard',          requiredPermission: 'use:chat',                  icon: 'home' },
  { label: 'Academic Schedule',  href: '/portal/academic-schedule',  requiredPermission: 'view:academic_schedule',    icon: 'calendar' },
  { label: 'Standings',          href: '/portal/standings',          requiredPermission: 'view:dept_standings',       icon: 'trophy' },
  { label: 'Grade Queue',        href: '/portal/grade',              requiredPermission: 'grade:queue',               icon: 'clipboard' },
  { label: 'Syllabus',           href: '/portal/syllabus',           requiredPermission: 'view:own_grades',           icon: 'map' },
  { label: 'My Grades',          href: '/portal/grades',             requiredPermission: 'view:own_grades',           icon: 'chart-bar' },
  { label: 'Content Vault',      href: '/portal/vault',              requiredPermission: 'submit:content',            icon: 'folder-lock' },
  { label: 'Analytics',          href: '/portal/analytics',          requiredPermission: 'view:instructor_analytics', icon: 'chart-line' },
  { label: 'Surveys',            href: '/portal/surveys',            requiredPermission: 'manage:surveys',            icon: 'clipboard' },
  { label: 'Flight Schedule',    href: '/portal/schedule',           requiredPermission: 'view:flight_schedule',      icon: 'calendar' },
  { label: 'Weighting Matrix',   href: '/portal/weighting',          requiredPermission: 'manage:weighting_matrix',   icon: 'scale' },
  { label: 'User Management',    href: '/portal/users',              requiredPermission: 'manage:users',              icon: 'users' },
  { label: 'Course Owners',      href: '/portal/course-owners',      requiredPermission: 'manage:users',              icon: 'academic-cap' },
  { label: 'Classes',            href: '/portal/classes',            requiredPermission: 'manage:classes',            icon: 'academic-cap' },
  { label: 'Chat',               href: '/portal/chat',               requiredPermission: 'use:chat',                  icon: 'chat' },
]
