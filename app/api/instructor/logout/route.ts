import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const jar = await cookies()
  jar.delete('gb_instructor')
  return NextResponse.redirect(new URL('/instructor/auth', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'))
}
