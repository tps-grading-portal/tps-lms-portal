import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'gradebook-fallback-secret-change-me'
)

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

// ── Student session ───────────────────────────────────────────────────────────

const STUDENT_COOKIE = 'gb_student'

export async function setStudentSession(studentId: string, token: string) {
  const jwt = await new SignJWT({ studentId, token })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)

  const jar = await cookies()
  jar.set(STUDENT_COOKIE, jwt, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
}

export async function getStudentSession(expectedToken: string): Promise<{ studentId: string } | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(STUDENT_COOKIE)?.value
    if (!raw) return null
    const { payload } = await jwtVerify(raw, secret)
    if (payload.token !== expectedToken) return null
    return { studentId: payload.studentId as string }
  } catch { return null }
}

export async function clearStudentSession() {
  const jar = await cookies()
  jar.delete(STUDENT_COOKIE)
}

// ── Instructor session ────────────────────────────────────────────────────────

const INSTRUCTOR_COOKIE = 'gb_instructor'

export async function setInstructorSession(instructorId: string, name: string) {
  const jwt = await new SignJWT({ instructorId, name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret)

  const jar = await cookies()
  jar.set(INSTRUCTOR_COOKIE, jwt, { httpOnly: true, path: '/', maxAge: 60 * 60 * 12, sameSite: 'lax' })
}

export async function getInstructorSession(): Promise<{ instructorId: string; name: string } | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(INSTRUCTOR_COOKIE)?.value
    if (!raw) return null
    const { payload } = await jwtVerify(raw, secret)
    return { instructorId: payload.instructorId as string, name: payload.name as string }
  } catch { return null }
}
