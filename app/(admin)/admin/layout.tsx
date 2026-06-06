import { auth } from '@/lib/auth'
import { signOut } from '@/lib/auth'
import { TPSPatchBadge } from '@/components/ui/tps-branding'
import { AdminSidebar } from '@/components/ui/admin-sidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { template: '%s | Admin', default: 'Admin' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await auth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-tps-navy text-white shadow-md border-b-2 border-tps-orange sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TPSPatchBadge size={32} />
            <div>
              <p className="text-tps-gold font-bold text-[10px] tracking-widest uppercase leading-none">
                USAF Test Pilot School
              </p>
              <p className="text-white font-semibold text-sm leading-none mt-0.5">
                Grading Portal
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button type="submit" className="text-tps-silver text-xs hover:text-white min-h-[44px] px-2">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar */}
        <AdminSidebar />

        {/* Main content — offset by sidebar width on md+ */}
        <main className="flex-1 md:ml-52 min-w-0 px-6 py-6 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  )
}
