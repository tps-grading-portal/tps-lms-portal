import Link from 'next/link'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Classes' }

export default async function ClassesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const { role } = session.user

  if (!can(role, 'manage:classes')) return null

  const classes = await db.class.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    include: { _count: { select: { students: true } } },
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Classes</h1>
          <p className="text-gray-500 text-sm">{classes.length} class cohorts</p>
        </div>
        <Link href="/portal/classes/new" className="btn-primary text-sm px-4 py-2">
          + New Class
        </Link>
      </div>

      <div className="grid gap-3">
        {classes.map(c => (
          <Link
            key={c.id}
            href={`/portal/classes/${c.id}`}
            className="card flex items-center justify-between hover:border-tps-orange transition-colors group"
          >
            <div>
              <p className="font-semibold text-tps-navy group-hover:text-tps-orange transition-colors">
                {c.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{c._count.students} students</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-tps-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
