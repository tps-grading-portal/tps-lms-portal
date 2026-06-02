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
    maxAge: 8 * 60 * 60, // 8 hours
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
  // Providers are added in lib/auth.ts — not here (bcrypt is Node.js-only)
  providers: [],
} satisfies NextAuthConfig
