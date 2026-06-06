/**
 * Edge-compatible Auth.js config — NO Prisma, NO bcryptjs.
 * Used exclusively by middleware.ts (Edge Runtime).
 * lib/auth.ts extends this with the Credentials provider (Node.js only).
 */
import type { NextAuthConfig } from 'next-auth'

// Local type mirror — avoids importing @prisma/client in the edge bundle.
// Kept in sync with the UserRole enum in schema.prisma.
type UserRole =
  | 'SYSTEM_ADMIN'
  | 'DEAN_COMMANDER'
  | 'A9_STANDARDS'
  | 'DEPT_CHAIR'
  | 'LINE_INSTRUCTOR'
  | 'STUDENT'

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8-hour JWT validity
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // No maxAge → browser session cookie (cleared on browser close)
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // user is narrowed to our augmented User type at runtime; cast for TS
        const u = user as { id?: string; role: UserRole; firstName: string; lastName: string }
        token.userId    = u.id ?? ''
        token.role      = u.role as unknown as string  // stored as string in JWT
        token.firstName = u.firstName
        token.lastName  = u.lastName
      }
      return token
    },
    session({ session, token }) {
      session.user.id        = token.userId as string
      session.user.role      = token.role as UserRole
      session.user.firstName = token.firstName as string
      session.user.lastName  = token.lastName as string
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
