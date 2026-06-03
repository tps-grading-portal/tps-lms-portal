'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavLinkProps {
  href:  string
  label: string
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()

  // Exact match for dashboard root; prefix match for all other sections
  const isActive =
    href === '/admin'
      ? pathname === '/admin'
      : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
        isActive
          ? 'border-tps-orange text-tps-orange font-semibold'
          : 'border-transparent font-medium text-gray-600 hover:text-tps-navy hover:border-tps-orange',
      )}
    >
      {label}
    </Link>
  )
}
