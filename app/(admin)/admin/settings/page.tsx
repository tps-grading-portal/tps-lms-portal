import { ChangePasswordForm } from './change-password-form'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await auth()

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Logged in as: {session?.user?.name}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Change Admin Password</h2>
        <ChangePasswordForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Room PINs</h2>
        <p className="text-sm text-gray-600 mb-3">
          Grader and Panel Chair PINs are managed per-class from the{' '}
          <Link href="/admin/classes" className="text-tps-blue hover:underline">
            Classes page
          </Link>
          . Click any class and use the &quot;Rotate PIN&quot; button.
        </p>
        <Link href="/admin/classes" className="btn-secondary text-sm inline-flex">
          Go to Classes →
        </Link>
      </section>
    </div>
  )
}
