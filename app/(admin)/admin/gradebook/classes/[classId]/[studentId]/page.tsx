import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { cn } from '@/lib/utils'
import { StudentPinPanel } from './student-pin-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Student Gradebook' }

interface PageProps { params: Promise<{ classId: string; studentId: string }> }

const TYPE_LABEL: Record<string, string> = {
  FLIGHT: 'FLT', REPORT: 'RPT', ORAL: 'ORL', SIM: 'SIM', CONTROL_ROOM: 'CR',
}
const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  SUBMITTED:   'bg-green-100 text-green-700',
}

export default async function StudentGradebookPage({ params }: PageProps) {
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

  const h       = await headers()
  const host    = h.get('host') ?? 'localhost:3000'
  const proto   = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${proto}://${host}`
  const studentUrl = student.viewToken ? `${baseUrl}/gradebook/${student.viewToken}` : null

  const totalEntries = student.entries.length
  const submitted    = student.entries.filter((e) => e.status === 'SUBMITTED').length
  const fails        = student.entries.filter((e) => e.overallPass === false).length
  const pct          = totalEntries > 0 ? Math.round((submitted / totalEntries) * 100) : 0

  const grouped = student.entries.reduce<Record<string, typeof student.entries>>((acc, e) => {
    const prefix = e.template.courseCode.split(' ')[0]
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(e)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <Link href={`/admin/gradebook/classes/${classId}`} className="hover:text-tps-orange">{student.class.name}</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{student.name}</span>
      </div>

      {/* Student header + PIN panel */}
      <div className="card border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tps-navy">{student.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {student.track.replace('_', '/')} · {student.class.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-tps-navy">{pct}%</p>
            <p className="text-xs text-gray-500">{submitted}/{totalEntries} complete</p>
            {fails > 0 && <p className="text-xs text-red-600 font-medium">{fails} fail{fails !== 1 ? 's' : ''}</p>}
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-tps-orange rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* Student gradebook link + PIN management */}
        <StudentPinPanel
          studentId={student.id}
          studentUrl={studentUrl}
          pinIsSet={!!student.viewPinHash}
          isTempPin={student.isTempPin}
        />
      </div>

      {/* Event list */}
      {Object.entries(grouped).map(([prefix, entries]) => (
        <div key={prefix} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{prefix}</h2>
          <div className="space-y-1">
            {entries.map((entry) => (
              <Link key={entry.id}
                href={`/admin/gradebook/classes/${classId}/${studentId}/${entry.id}`}
                className={cn(
                  'flex items-center gap-4 rounded-xl border px-4 py-3 hover:border-tps-orange transition-colors',
                  entry.overallPass === false ? 'border-red-300 bg-red-50' :
                  entry.status === 'SUBMITTED' ? 'border-green-200 bg-green-50' :
                  'border-gray-200 bg-white',
                )}
              >
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{TYPE_LABEL[entry.template.type] ?? entry.template.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-tps-navy">{entry.template.courseCode}</p>
                  <p className="text-xs text-gray-500 truncate">{entry.template.title}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {entry.status === 'SUBMITTED' && (
                    <div className="flex gap-1.5">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        entry.academicPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>A</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        entry.airmanshipPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>AM</span>
                    </div>
                  )}
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
  )
}
