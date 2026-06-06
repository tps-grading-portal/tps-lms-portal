import type { UserRole } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      firstName: string
      lastName: string
    } & DefaultSession['user']
  }
  interface User {
    role: UserRole
    firstName: string
    lastName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role: UserRole
    firstName: string
    lastName: string
  }
}
