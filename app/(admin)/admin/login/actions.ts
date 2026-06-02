'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'

export async function loginAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const username = formData.get('username')?.toString() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!username || !password) return 'Username and password are required.'

  try {
    await signIn('credentials', {
      username,
      password,
      redirectTo: '/admin',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return 'Invalid username or password.'
    }
    // Re-throw so Next.js can handle the NEXT_REDIRECT
    throw error
  }

  return null
}
