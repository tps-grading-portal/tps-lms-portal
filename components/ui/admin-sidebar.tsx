'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface NavItem {
  href:  string
  label: string
}

interface NavSection {
  title?: string        // undefined = standalone (no section header)
  items:  NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin', label: 'Dashboard' }],
  },
  {
    title: 'Classes',
    items: [
      { href: '/admin/classes',     label: 'All Classes' },
      { href: '/admin/classes/new', label: 'New Class'   },
    ],
  },
  {
    title: 'Comp Oral',
    items: [
      { href: '/admin/rubric',   label: 'Rubric'     },
      { href: '/admin/stats',    label: 'Statistics' },
      { href: '/admin/surveys',  label: 'Surveys'    },
      { href: '/admin/import',   label: 'Import'     },
    ],
  },
  {
    title: 'Gradebook',
    items: [
      { href: '/admin/gradebook',             label: 'Overview'   },
      { href: '/admin/gradebook/templates',   label: 'Templates'  },
      { href: '/admin/gradebook/instructors', label: 'Instructors'},
    ],
  },
  {
    items: [{ href: '/admin/sandbox', label: 'Sandbox' }],
  },
  {
    items: [{ href: '/admin/settings', label: 'Settings' }],
  },
]

function SidebarLink({ href, label }: NavItem) {
  const pathname = usePathname()
  const isActive =
    href === '/admin'
      ? pathname === '/admin'
      : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        'block px-3 py-1.5 rounded-lg text-sm transition-colors',
        isActive
          ? 'bg-tps-orange/10 text-tps-orange font-semibold'
          : 'text-gray-600 hover:text-tps-navy hover:bg-gray-100',
      )}
    >
      {label}
    </Link>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="space-y-5 p-4">
      {SECTIONS.map((section, si) => (
        <div key={si}>
          {section.title && (
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <SidebarLink key={item.href} {...item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed bottom-4 right-4 z-50 bg-tps-navy text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Close' : 'Menu'}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <aside
        className={cn(
          'fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-52 bg-white border-r border-gray-200 overflow-y-auto z-40 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        onClick={() => setOpen(false)}
      >
        {nav}
      </aside>
    </>
  )
}
