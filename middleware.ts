/**
 * Edge middleware — enforces auth on every protected route.
 * Imports ONLY edge-compatible modules (authConfig, jose).
 * No Prisma, no bcryptjs.
 *
 * Route protection matrix:
 *   /portal/*    → NextAuth JWT required (all LMS roles)
 *   /admin/*     → NextAuth JWT required (backward compat — existing grading portal)
 *   /grade/*     → Grader PIN JWT required (mobile grading, unchanged)
 *   /chair/*     → Panel Chair PIN JWT required (unchanged)
 *   /login       → Public; redirects authenticated users → /portal/dashboard
 *
 * Invisible Access Control: middleware only blocks unauthenticated access.
 * Role capability checks happen in server components / server actions — no
 * "Access Denied" pages are shown; forbidden content simply doesn't render.
 */
import NextAuth from 'next-auth'
import type { NextAuthRequest } from 'next-auth'
import { authConfig } from './auth.config'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export default auth(async function middleware(req: NextAuthRequest) {
  const { pathname } = req.nextUrl
  const isAuthed = !!req.auth

  // ── Authenticated users hitting /login → send home ───────────────────────
  if (pathname === '/login' || pathname === '/admin/login') {
    if (isAuthed) return NextResponse.redirect(new URL('/portal/dashboard', req.url))
    return NextResponse.next()
  }

  // ── Portal (new LMS routes) ───────────────────────────────────────────────
  if (pathname.startsWith('/portal')) {
    if (!isAuthed) {
      const url = new URL('/login', req.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── Admin (existing grading portal — backward compat) ────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isAuthed) {
      const url = new URL('/login', req.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── Grader (PIN-based, unchanged) ─────────────────────────────────────────
  if (pathname.startsWith('/grade') && pathname !== '/grade/auth') {
    const token = req.cookies.get('tps_grader_token')?.value
    if (!token) return NextResponse.redirect(new URL('/grade/auth', req.url))
    try {
      await jwtVerify(token, secret)
    } catch {
      const res = NextResponse.redirect(new URL('/grade/auth', req.url))
      res.cookies.delete('tps_grader_token')
      return res
    }
    return NextResponse.next()
  }

  // ── Panel Chair (PIN-based, unchanged) ───────────────────────────────────
  if (pathname.startsWith('/chair') && pathname !== '/chair/auth') {
    const token = req.cookies.get('tps_chair_token')?.value
    if (!token) return NextResponse.redirect(new URL('/chair/auth', req.url))
    try {
      await jwtVerify(token, secret)
    } catch {
      const res = NextResponse.redirect(new URL('/chair/auth', req.url))
      res.cookies.delete('tps_chair_token')
      return res
    }
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/portal/:path*',
    '/admin/:path*',
    '/grade/:path*',
    '/chair/:path*',
    '/login',
  ],
}
