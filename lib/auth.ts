/**
 * Full Auth.js config — Node.js runtime only.
 * NOT imported by middleware.ts.
 */
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authConfig } from '@/auth.config'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const admin = await db.adminUser.findUnique({
          where: { username: parsed.data.username },
        })
        if (!admin) return null

        const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash)
        if (!valid) return null

        await db.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        })

        return { id: admin.id, name: admin.username, email: null }
      },
    }),
  ],
})
