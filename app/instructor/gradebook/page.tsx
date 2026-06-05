import { db } from '@/lib/db'
import { getInstructorSession } from '@/lib/gradebook-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Instructor Gradebook' }

export default async function InstructorGradebookPage() {
  const session = await getInstructorSession()
  if (!session) redirect('/instructor/auth')

  const classes = await db.gradebookClass.findMany({
    where:   { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      students: {
        orderBy: { sortOrder: 'asc' },
        include: {
          entries: { select: { status: true, overallPass: true } },
        },
      },
    },
  })

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/grad-patch.png" alt="TPS" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">TPS — Instructor</p>
            <p className="text-white font-semibold text-sm leading-none mt-0.5">{session.name}</p>
          </div>
        </div>
        <form action="/api/instructor/logout" method="POST">
          <button type="submit" className="text-xs text-gray-300 hover:text-white">Sign out</button>
        </form>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-tps-navy">Gradebook</h1>

        {classes.map((cls) => (
          <div key={cls.id} className="card border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-tps-navy">{cls.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {cls.students.map((student) => {
                const done    = student.entries.filter((e) => e.status === 'SUBMITTED').length
                const total   = student.entries.length
                const hasFail = student.entries.some((e) => e.overallPass === false)
                return (
                  <Link
                    key={student.id}
                    href={`/instructor/gradebook/${cls.id}/${student.id}`}
                    className={cn(
                      'rounded-lg border px-3 py-2 hover:border-tps-orange transition-colors',
                      hasFail ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                    )}
                  >
                    <p className="font-semibold text-sm text-tps-navy truncate">{student.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{student.track.replace('_', '/')}</p>
                    <p className={cn('text-xs mt-1 font-medium', done === total ? 'text-green-600' : 'text-gray-500')}>
                      {done}/{total} done {hasFail && '⚠'}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {classes.length === 0 && (
          <p className="text-gray-400 text-center py-12">No active classes found.</p>
        )}
      </div>
    </main>
  )
}
