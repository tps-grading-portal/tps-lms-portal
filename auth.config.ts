/**
 * Edge-compatible Auth.js configuration — NO Prisma, NO bcryptjs.
 * Used exclusively by middleware.ts (Edge Runtime).
 * lib/auth.ts extends this with the Credentials provider (Node.js only).
 */
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // JWT token validity — 8 hours
  },
  // Override the session cookie to be a session cookie (no maxAge).
  // This means the browser discards it when the browser session ends
  // (browser fully closed), requiring re-login on next visit.
  // The JWT inside still carries the 8h expiry for security.
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // No maxAge → browser session cookie
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.adminId = user.id
      return token
    },
    session({ session, token }) {
      if (token.adminId) session.user.id = token.adminId as string
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
