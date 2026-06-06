import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { NewUserForm } from './new-user-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'New User' }

export default async function NewUserPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:users')) return null

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-tps-navy mb-1">New User</h1>
      <p className="text-gray-500 text-sm mb-6">Create a portal account.</p>
      <NewUserForm />
    </div>
  )
}
