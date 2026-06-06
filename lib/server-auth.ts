/**
 * Server-side auth helpers — Node.js runtime only.
 * Used in server components and server actions (never in middleware).
 */
import { auth } from '@/lib/auth'
import { can, canAny, type Permission } from '@/lib/permissions'
import type { UserRole } from '@prisma/client'

export type AuthUser = {
  id:        string
  email:     string | null | undefined
  role:      UserRole
  firstName: string
  lastName:  string
}

/** Returns the current session user or null if unauthenticated. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return session.user as AuthUser
}

/** Throws if unauthenticated. Use in server actions that require login. */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

/** Throws if user lacks the required permission. */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuth()
  if (!can(user.role, permission)) throw new Error('FORBIDDEN')
  return user
}

/** Throws if user lacks ALL listed permissions (must have every one). */
export async function requireAllPermissions(permissions: Permission[]): Promise<AuthUser> {
  const user = await requireAuth()
  if (!permissions.every(p => can(user.role, p))) throw new Error('FORBIDDEN')
  return user
}

/** Throws if user lacks ANY of the listed permissions (must have at least one). */
export async function requireAnyPermission(permissions: Permission[]): Promise<AuthUser> {
  const user = await requireAuth()
  if (!canAny(user.role, permissions)) throw new Error('FORBIDDEN')
  return user
}

/**
 * Safe capability check for server components.
 * Returns false instead of throwing — use when you want to conditionally render.
 */
export async function userCan(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return can(user.role, permission)
}
