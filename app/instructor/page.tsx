import { redirect } from 'next/navigation'
import { getInstructorSession } from '@/lib/gradebook-auth'

export default async function InstructorRootPage() {
  const session = await getInstructorSession()
  if (session) redirect('/instructor/gradebook')
  redirect('/instructor/auth')
}
