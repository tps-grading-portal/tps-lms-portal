import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { TPSAuthPage } from '@/components/ui/tps-auth-page'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Login' }

export default async function AdminLoginPage() {
  const session = await auth()
  if (session) redirect('/admin')

  return (
    <TPSAuthPage roleLabel="Administrator Access">
      <div className="card">
        <LoginForm />
      </div>
    </TPSAuthPage>
  )
}
