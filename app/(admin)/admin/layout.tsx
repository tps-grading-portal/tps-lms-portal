import { auth } from '@/lib/auth'
import Link from 'next/link'
import { signOut } from '@/lib/auth'
import { TPSPatchBadge } from '@/components/ui/tps-branding'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { template: '%s | Admin', default: 'Admin' } }

const NAV_ITEMS = [
  { href: '/admin',             label: 'Dashboard'  },
  { href: '/admin/classes',     label: 'Classes'    },
  { href: '/admin/classes/new', label: 'New Class'  },
  { href: '/admin/rubric',      label: 'Rubric'     },
  { href: '/admin/stats',       label: 'Statistics' },
  { href: '/admin/import',      label: 'Import'     },
  { href: '/admin/settings',    label: 'Settings'   },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await auth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-tps-navy text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
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
              await signOut({ redirectTo: '/admin/login' })
            }}
          >
            <button type="submit" className="text-tps-silver text-xs hover:text-white min-h-[44px] px-2">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Section nav */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-tps-navy hover:bg-gray-50
                           border-b-2 border-transparent hover:border-tps-orange transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
