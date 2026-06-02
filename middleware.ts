/**
 * Edge middleware — enforces auth on every protected route.
 * Imports ONLY edge-compatible modules (authConfig, jose).
 * No Prisma, no bcryptjs.
 *
 * /admin/*   → Auth.js JWT session required
 * /grade/*   → Grader PIN JWT required
 * /chair/*   → Panel Chair PIN JWT required
 * /survey/*  → Open access
 */
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export default auth(async function middleware(req) {
  const { pathname } = req.nextUrl

  // ── Admin ────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!req.auth) {
      const url = new URL('/admin/login', req.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── Grader ────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/grade') && pathname !== '/grade/auth') {
    const token = req.cookies.get('tps_grader_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/grade/auth', req.url))
    }
    try {
      await jwtVerify(token, secret)
    } catch {
      const res = NextResponse.redirect(new URL('/grade/auth', req.url))
      res.cookies.delete('tps_grader_token')
      return res
    }
    return NextResponse.next()
  }

  // ── Panel Chair ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/chair') && pathname !== '/chair/auth') {
    const token = req.cookies.get('tps_chair_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/chair/auth', req.url))
    }
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
  matcher: ['/admin/:path*', '/grade/:path*', '/chair/:path*'],
}
