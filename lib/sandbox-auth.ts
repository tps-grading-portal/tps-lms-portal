/**
 * Sandbox PIN authentication — independent of Comp Oral auth.
 * Three token types: creator, submit, results.
 * Each uses its own HttpOnly cookie keyed by slug/token.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

type TokenType = 'creator' | 'submit' | 'results'

function cookieName(type: TokenType, id: string): string {
  return `sbx_${type}_${id.slice(0, 16)}`
}

// ── Issue a token ─────────────────────────────────────────────────────────────

export async function issueSandboxToken(
  type: TokenType,
  id: string,   // slug or token depending on type
): Promise<void> {
  const jwt = await new SignJWT({ type, id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(cookieName(type, id), jwt, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    // No maxAge → session cookie
  })
}

// ── Validate a token ─────────────────────────────────────────────────────────

export async function validateSandboxToken(
  type: TokenType,
  id:   string,
): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(cookieName(type, id))?.value
    if (!raw) return false
    const { payload } = await jwtVerify(raw, secret)
    return payload.type === type && payload.id === id
  } catch {
    return false
  }
}

// ── Clear a token ─────────────────────────────────────────────────────────────

export async function clearSandboxToken(type: TokenType, id: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(cookieName(type, id))
}

// ── Verify a PIN against a stored hash ───────────────────────────────────────

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12)
}

// ── Generate a random slug ────────────────────────────────────────────────────

export function generateSlug(length = 8): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (n) => chars[n % chars.length]).join('')
}

// ── Generate a unique pair of slugs for a form ────────────────────────────────

export async function generateFormSlugs(): Promise<{ submitSlug: string; resultsSlug: string }> {
  let submitSlug: string, resultsSlug: string

  // Retry until both slugs are globally unique
  do {
    submitSlug  = generateSlug(8)
    resultsSlug = generateSlug(8)
  } while (
    await db.sandboxForm.findFirst({
      where: { OR: [{ submitSlug }, { resultsSlug }, { submitSlug: resultsSlug }, { resultsSlug: submitSlug }] },
    })
  )

  return { submitSlug, resultsSlug }
}

// ── Generate a unique creator link token ─────────────────────────────────────

export async function generateCreatorToken(): Promise<string> {
  let token: string
  do {
    token = generateSlug(16)
  } while (await db.sandboxCreatorInvite.findUnique({ where: { linkToken: token } }))
  return token
}
