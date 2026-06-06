'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'

export async function loginAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email    = formData.get('email')?.toString()    ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) return 'Email and password are required.'

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/portal/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) return 'Invalid email or password.'
    throw error // Re-throw NEXT_REDIRECT
  }

  return null
}
