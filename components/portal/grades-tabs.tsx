'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { can } from '@/lib/permissions'
import type { UserRole } from '@prisma/client'

/**
 * Consolidated Grades dashboard sub-menu — Queue, Analytics, My Grades, and
 * Exports live under one "Grades" entry with these tabs.
 */
export function GradesTabs({ role }: { role: UserRole }) {
  const pathname = usePathname()

  const tabs: { href: string; label: string }[] = []
  if (can(role, 'grade:queue'))
    tabs.push({ href: '/portal/grade', label: 'Grade Queue' })
  if (role === 'STUDENT')
    tabs.push({ href: '/portal/grades', label: 'My Grades' })
  if (can(role, 'view:instructor_analytics'))
    tabs.push({ href: '/portal/analytics', label: 'Analytics' })
  if (can(role, 'grade:queue') || can(role, 'view:all_standings'))
    tabs.push({ href: '/portal/grades/exports', label: 'Gradebook Exports' })

  if (tabs.length <= 1) return null

  return (
    <div className="flex gap-1 flex-wrap border-b border-gray-200 mb-5">
      {tabs.map(t => {
        const active = pathname === t.href || (t.href !== '/portal/grades' && pathname.startsWith(t.href))
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              active
                ? 'border-tps-orange text-tps-navy font-semibold'
                : 'border-transparent text-gray-500 hover:text-tps-navy'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
