'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { signOutAction } from '@/app/portal-signout-action'
import { TPSPatchBadge } from '@/components/ui/tps-branding'
import { NotificationBell } from './notification-bell'
import { PORTAL_NAV } from '@/lib/permissions'
import type { UserRole } from '@prisma/client'

const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN:     'System Admin',
  DEAN_COMMANDER:   'Dean / Commander',
  A9_STANDARDS:     'A9 Standards',
  DEPT_CHAIR:       'Dept Chair',
  ADO:              'ADO',
  DO:               'DO',
  SCHEDULER:        'Scheduler',
  LINE_INSTRUCTOR:  'Instructor',
  GUEST_INSTRUCTOR: 'Guest Instructor',
  STUDENT:          'Student',
}

// Routes that aren't (or differ from) sidebar nav items
const EXTRA_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/portal/lessons',        title: 'Course Page' },
  { prefix: '/portal/account',        title: 'My Account' },
  { prefix: '/portal/grades/exports', title: 'Gradebook Exports' },
  { prefix: '/portal/analytics',      title: 'Analytics' },
  { prefix: '/portal/grade',          title: 'Grades' },
  { prefix: '/portal/users/new',      title: 'New User' },
  { prefix: '/portal/classes/new',    title: 'New Class' },
]

/** Title of the currently selected menu item, shown in the blue header. */
function usePageTitle(): string | null {
  const pathname = usePathname()
  const extra = EXTRA_TITLES
    .filter(t => pathname.startsWith(t.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (extra) return extra.title
  const nav = PORTAL_NAV
    .filter(item => item.href === '/portal/dashboard' ? pathname === item.href : pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return nav?.label ?? null
}

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign Out'}
    </button>
  )
}

export function PortalTopNav({
  firstName,
  lastName,
  role,
}: {
  firstName: string
  lastName:  string
  role:      UserRole
}) {
  const pageTitle = usePageTitle()

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-tps-navy border-b border-white/10 flex items-center px-4 z-50">
      <Link href="/portal/dashboard" className="flex items-center gap-2 mr-4">
        <TPSPatchBadge size={28} />
        <span className="text-white font-bold text-sm tracking-wide hidden sm:block">
          TPS LMS
        </span>
      </Link>

      {/* Current page title */}
      {pageTitle && (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white/30 hidden sm:block">/</span>
          <h1 className="text-white font-semibold text-base truncate">{pageTitle}</h1>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="text-right hidden sm:block">
          <p className="text-white text-sm font-semibold leading-tight">
            {firstName} {lastName}
          </p>
          <p className="text-tps-gold text-xs leading-tight">{ROLE_LABELS[role]}</p>
        </div>

        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </div>
    </header>
  )
}
