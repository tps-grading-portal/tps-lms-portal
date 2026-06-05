'use client'

import { cn } from '@/lib/utils'

interface Entry {
  id:          string
  status:      string
  overallScore: number | null
  overallPass: boolean | null
  academicPass: boolean | null
  airmanshipPass: boolean | null
  template:    { courseCode: string; title: string; type: string }
}

interface Props {
  student: {
    name:    string
    track:   string
    entries: Entry[]
    class:   { name: string }
  }
}

const TYPE_ICON: Record<string, string> = {
  FLIGHT: '✈', REPORT: '📄', ORAL: '🎤', SIM: '🖥', CONTROL_ROOM: '🎛',
}
const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  SUBMITTED:   'bg-green-100 text-green-700',
}

export function StudentGradebookView({ student }: Props) {
  const submitted = student.entries.filter((e) => e.status === 'SUBMITTED').length
  const total     = student.entries.length
  const fails     = student.entries.filter((e) => e.overallPass === false).length
  const pct       = total > 0 ? Math.round((submitted / total) * 100) : 0

  const grouped = student.entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const prefix = e.template.courseCode.split(' ')[0]
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(e)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center border-b-2 border-tps-orange sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/grad-patch.png" alt="TPS" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">TPS — My Gradebook</p>
            <p className="text-white font-semibold text-sm leading-none mt-0.5">{student.class.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Student card */}
        <div className="card border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-tps-navy">{student.name}</h1>
              <p className="text-sm text-gray-500">{student.track.replace('_', '/')} · {student.class.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-tps-navy">{pct}%</p>
              <p className="text-xs text-gray-500">{submitted}/{total} complete</p>
              {fails > 0 && <p className="text-xs text-red-600 font-medium">{fails} fail{fails !== 1 ? 's' : ''}</p>}
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-tps-orange rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Event list — read-only */}
        {Object.entries(grouped).map(([prefix, entries]) => (
          <div key={prefix} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{prefix}</h2>
            <div className="space-y-1">
              {entries.map((entry) => (
                <div key={entry.id} className={cn(
                  'flex items-center gap-4 rounded-xl border px-4 py-3',
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
