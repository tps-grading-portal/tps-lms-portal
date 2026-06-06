'use client'

import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { signOutAction } from '@/app/portal-signout-action'
import { TPSPatchBadge } from '@/components/ui/tps-branding'
import { NotificationBell } from './notification-bell'
import type { UserRole } from '@prisma/client'

const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN:     'System Admin',
  DEAN_COMMANDER:   'Dean / Commander',
  A9_STANDARDS:     'A9 Standards',
  DEPT_CHAIR:       'Dept Chair',
  ADO:              'ADO',
  DO:               'DO',
  LINE_INSTRUCTOR:  'Instructor',
  GUEST_INSTRUCTOR: 'Guest Instructor',
  STUDENT:          'Student',
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
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-tps-navy border-b border-white/10 flex items-center px-4 z-50">
      <Link href="/portal/dashboard" className="flex items-center gap-2 mr-6">
        <TPSPatchBadge size={28} />
        <span className="text-white font-bold text-sm tracking-wide hidden sm:block">
          TPS LMS
        </span>
      </Link>

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
