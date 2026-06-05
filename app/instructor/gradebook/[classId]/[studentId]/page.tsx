import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getInstructorSession } from '@/lib/gradebook-auth'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Student Gradebook' }

interface PageProps { params: Promise<{ classId: string; studentId: string }> }

const TYPE_ICON: Record<string, string> = { FLIGHT: '✈', REPORT: '📄', ORAL: '🎤', SIM: '🖥', CONTROL_ROOM: '🎛' }
const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  SUBMITTED:   'bg-green-100 text-green-700',
}

export default async function InstructorStudentPage({ params }: PageProps) {
  const session = await getInstructorSession()
  if (!session) redirect('/instructor/auth')

  const { classId, studentId } = await params

  const student = await db.gradebookStudent.findUnique({
    where:   { id: studentId },
    include: {
      class: true,
      entries: {
        include: { template: { select: { courseCode: true, title: true, type: true } } },
        orderBy: { template: { courseCode: 'asc' } },
      },
    },
  })
  if (!student || student.classId !== classId) notFound()

  const submitted = student.entries.filter((e) => e.status === 'SUBMITTED').length
  const total     = student.entries.length
  const pct       = total > 0 ? Math.round((submitted / total) * 100) : 0

  const grouped = student.entries.reduce<Record<string, typeof student.entries>>((acc, e) => {
    const prefix = e.template.courseCode.split(' ')[0]
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(e)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/instructor/gradebook" className="text-gray-300 hover:text-white text-sm">← Classes</Link>
          <span className="text-gray-500">·</span>
          <span className="text-white text-sm font-medium">{student.name}</span>
        </div>
        <span className="text-xs text-gray-300">{session.name}</span>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="card border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-tps-navy">{student.name}</h1>
              <p className="text-sm text-gray-500">{student.track.replace('_', '/')} · {student.class.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-tps-navy">{pct}%</p>
              <p className="text-xs text-gray-500">{submitted}/{total} complete</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-tps-orange rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {Object.entries(grouped).map(([prefix, entries]) => (
          <div key={prefix} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{prefix}</h2>
            <div className="space-y-1">
              {entries.map((entry) => (
                <Link key={entry.id}
                  href={`/instructor/gradebook/${classId}/${studentId}/${entry.id}`}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border px-4 py-3 hover:border-tps-orange transition-colors',
                    entry.overallPass === false ? 'border-red-300 bg-red-50' :
                    entry.status === 'SUBMITTED' ? 'border-green-200 bg-green-50' :
                    'border-gray-200 bg-white',
                  )}>
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[entry.template.type] ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-tps-navy">{entry.template.courseCode}</p>
                    <p className="text-xs text-gray-500 truncate">{entry.template.title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {entry.overallScore !== null && (
                      <span className={cn('font-mono text-sm font-bold',
                        entry.overallPass ? 'text-green-700' : 'text-red-600'
                      )}>
                        {entry.overallScore.toFixed(1)}%
                      </span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[entry.status])}>
                      {entry.status.replace('_', ' ')}
                    </span>
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
