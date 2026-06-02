/**
 * PIN-based authentication for Grader and Panel Chair routes.
 * Uses short-lived JWTs stored in HttpOnly cookies.
 * No user accounts — shared room PIN per class per role.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import type { AccessRole } from '@prisma/client'

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-change-in-production'
)

const COOKIE_NAMES: Record<AccessRole, string> = {
  GRADER: 'tps_grader_token',
  PANEL_CHAIR: 'tps_chair_token',
}

// Token payload shape
interface PinTokenPayload {
  classId: string
  role: AccessRole
  iat: number
  exp: number
}

// Issue a JWT after successful PIN verification
export async function issuePinToken(classId: string, role: AccessRole): Promise<string> {
  const token = await new SignJWT({ classId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAMES[role], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60, // 12 hours
    path: '/',
  })

  return token
}

// Verify PIN against DB hash for the active class
export async function verifyPin(
  classId: string,
  role: AccessRole,
  pin: string
): Promise<boolean> {
  const access = await db.classAccess.findUnique({
    where: { classId_role: { classId, role } },
  })
  if (!access) return false
  return bcrypt.compare(pin, access.passwordHash)
}

// Validate an incoming request's PIN token — returns payload or null
export async function validatePinToken(role: AccessRole): Promise<PinTokenPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAMES[role])?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as PinTokenPayload
  } catch {
    return null
  }
}

// Clear PIN token (logout)
export async function clearPinToken(role: AccessRole): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAMES[role])
}
