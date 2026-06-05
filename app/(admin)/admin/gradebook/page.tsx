import { db } from '@/lib/db'
import Link from 'next/link'
import type { Metadata } from 'next'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Gradebook' }

export default async function GradebookPage() {
  const [classes, templateCount] = await Promise.all([
    db.gradebookClass.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        students: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { entries: true } },
            entries: {
              select: { status: true, overallPass: true },
            },
          },
        },
      },
    }),
    db.gradesheetTemplate.count({ where: { isActive: true } }),
  ])

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Gradebook</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Flight gradesheet management — {templateCount} active gradesheet templates
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/gradebook/instructors" className="btn-secondary text-sm">
            Instructors
          </Link>
          <Link href="/admin/gradebook/templates" className="btn-secondary text-sm">
            Gradesheet Library
          </Link>
          <Link href="/admin/gradebook/classes/new" className="btn-primary text-sm">
            + New Class
          </Link>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="card border border-dashed border-gray-300 text-center py-12 space-y-3">
          <p className="text-gray-400 font-medium">No classes yet.</p>
          <Link href="/admin/gradebook/classes/new" className="btn-primary text-sm inline-flex">
            Create First Class →
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {classes.map((cls) => {
          const totalStudents  = cls.students.length
          const totalEntries   = cls.students.reduce((s, st) => s + st.entries.length, 0)
          const submitted      = cls.students.reduce((s, st) => s + st.entries.filter((e) => e.status === 'SUBMITTED').length, 0)
          const fails          = cls.students.reduce((s, st) => s + st.entries.filter((e) => e.overallPass === false).length, 0)

          return (
            <div key={cls.id} className="card border border-gray-200 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-tps-navy">{cls.name}</h2>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span>{totalStudents} student{totalStudents !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{submitted}/{totalEntries} gradesheets submitted</span>
                    {fails > 0 && <><span>·</span><span className="text-red-600 font-medium">{fails} fail{fails !== 1 ? 's' : ''}</span></>}
                  </div>
                </div>
                <div className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                  cls.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {cls.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {cls.students.map((student) => {
                  const done   = student.entries.filter((e) => e.status === 'SUBMITTED').length
                  const total  = student.entries.length
                  const hasFail = student.entries.some((e) => e.overallPass === false)
                  return (
                    <Link
                      key={student.id}
                      href={`/admin/gradebook/classes/${cls.id}/${student.id}`}
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
          )
        })}
      </div>
    </div>
  )
}
