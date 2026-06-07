import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { NewClassForm } from './new-class-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'New Class' }

export default async function NewClassPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:classes')) return null

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-tps-navy mb-1">New Class</h1>
      <p className="text-gray-500 text-sm mb-6">Create a new class cohort.</p>
      <NewClassForm />
    </div>
  )
}
