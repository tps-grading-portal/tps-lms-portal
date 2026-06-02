import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Login' }

export default async function AdminLoginPage() {
  // Already logged in — send straight to dashboard
  const session = await auth()
  if (session) redirect('/admin')

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tps-gold mb-4">
            <span className="text-tps-navy font-black text-xl">TPS</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Grading Portal</h1>
          <p className="text-tps-silver text-sm mt-1">Administrator Access</p>
        </div>

        {/* Login card */}
        <div className="card">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
