import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { TPSBrandHeader } from '@/components/ui/tps-branding'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Login' }

export default async function AdminLoginPage() {
  const session = await auth()
  if (session) redirect('/admin')

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <TPSBrandHeader roleLabel="Administrator Access" />
        <div className="card">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
