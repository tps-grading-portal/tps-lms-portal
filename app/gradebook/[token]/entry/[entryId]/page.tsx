import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getStudentSession } from '@/lib/gradebook-auth'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradesheet' }

interface PageProps { params: Promise<{ token: string; entryId: string }> }

const SCORE_LABELS: Record<number, string> = {
  0: 'Unsafe / Omitted',
  1: 'Safe but Unable',
  2: 'Unable',
  3: 'Minimally Proficient',
  4: 'Proficient / Desired',
}

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-600 text-white',
  1: 'bg-orange-500 text-white',
  2: 'bg-amber-400 text-gray-900',
  3: 'bg-yellow-300 text-gray-900',
  4: 'bg-green-500 text-white',
}

export default async function StudentEntryPage({ params }: PageProps) {
  const { token, entryId } = await params

  // Verify session
  const session = await getStudentSession(token)
  if (!session) redirect(`/gradebook/${token}/auth`)

  const student = await db.student.findUnique({
    where:  { viewToken: token },
    select: { id: true, isTempPin: true },
  })
  if (!student || student.isTempPin) redirect(`/gradebook/${token}`)

  // Load the entry — verify it belongs to this student
  const entry = await db.gradebookEntry.findUnique({
    where:   { id: entryId },
    include: {
      template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
      scores:   true,
    },
  })
  if (!entry || entry.studentId !== session.studentId) notFound()

  const scoreMap = new Map(entry.scores.map((s) => [s.taskId, s]))

  // Group tasks by section
  const sections = new Map<string, typeof entry.template.tasks>()
  for (const t of entry.template.tasks) {
    const key = t.sectionLabel ?? 'General'
    if (!sections.has(key)) sections.set(key, [])
    sections.get(key)!.push(t)
  }

  const isSubmitted = entry.status === 'SUBMITTED'

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-10">
        <Link href={`/gradebook/${token}`} className="text-sm text-gray-300 hover:text-white">
          ← Gradebook
        </Link>
        <p className="text-sm font-medium">{entry.template.courseCode}</p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header card */}
        <div className="card border border-gray-200 space-y-3">
          <div>
            <h1 className="text-xl font-bold text-tps-navy">{entry.template.courseCode}</h1>
            <p className="text-sm text-gray-500">{entry.template.title}</p>
          </div>

          {isSubmitted ? (
            <>
              <div className="flex flex-wrap gap-3 items-center pt-1 border-t border-gray-100">
                <div className="text-center">
                  <p className={cn('text-3xl font-bold font-mono',
                    entry.overallPass ? 'text-green-600' : 'text-red-600'
                  )}>
                    {entry.overallScore?.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">Overall</p>
                </div>
                <div className="flex gap-2">
                  {[
                    { label: 'Academic',   pass: entry.academicPass },
                    { label: 'Airmanship', pass: entry.airmanshipPass },
                  ].map(({ label, pass }) => (
                    <div key={label} className={cn('px-3 py-2 rounded-lg text-center min-w-[72px]',
                      pass ? 'bg-green-100' : 'bg-red-100'
                    )}>
                      <p className={cn('font-bold text-sm', pass ? 'text-green-700' : 'text-red-700')}>
                        {pass ? 'Pass' : 'Fail'}
                      </p>
                      <p className="text-[10px] text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="ml-auto text-right">
                  {entry.instructorName && (
                    <p className="text-xs text-gray-500">Graded by {entry.instructorName}</p>
                  )}
                  {entry.submittedAt && (
                    <p className="text-xs text-gray-400">
                      {new Date(entry.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={cn('rounded-lg px-3 py-2 text-sm font-medium',
              entry.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                             : 'bg-gray-50 text-gray-500 border border-gray-200'
            )}>
              {entry.status === 'IN_PROGRESS' ? 'Grading in progress — not yet submitted' : 'Not yet graded'}
            </div>
          )}
        </div>

        {/* Task sections */}
        {Array.from(sections.entries()).map(([section, tasks]) => (
          <div key={section} className="card border border-gray-200 space-y-2">
            <h3 className={cn('text-xs font-bold uppercase tracking-wide',
              tasks[0]?.isAirmanship ? 'text-tps-orange' : 'text-gray-500'
            )}>
              {section}
            </h3>

            <div className="space-y-2">
              {tasks.map((task) => {
                const score = scoreMap.get(task.id)
                const hasScore = isSubmitted && score && !task.isDemo

                return (
                  <div key={task.id} className={cn(
                    'rounded-xl border px-3 py-2.5',
                    score?.isAutoFail  ? 'border-red-200 bg-red-50' :
                    task.isDemo        ? 'border-gray-100 bg-gray-50' :
                    task.isBonus       ? 'border-amber-100 bg-amber-50' :
                    'border-gray-100 bg-white',
                  )}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-800">{task.label}</p>
                          {task.isDemo  && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded">Demo</span>}
                          {task.isBonus && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 rounded">Bonus</span>}
                          {score?.isAutoFail && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 rounded font-bold">Auto-fail</span>}
                        </div>
                        <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                          {task.minScore !== null && (
                            <span>Min: {task.minScore}{task.minScoreHard ? '*' : ''}</span>
                          )}
                          {task.desiredScore !== null && <span>Desired: {task.desiredScore}</span>}
                          {task.weight > 0 && <span>Weight: {(task.weight * 100).toFixed(1)}%</span>}
                        </div>
                      </div>

                      {/* Score display */}
                      {hasScore && !score.isNA && score.scoreEntered !== null && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-lg', SCORE_COLORS[score.scoreEntered])}>
                            {score.scoreEntered} — {SCORE_LABELS[score.scoreEntered]}
                          </span>
                          {score.scoreAwarded !== null && (
                            <span className={cn('text-xs font-mono font-bold px-2 py-1 rounded',
                              score.isAutoFail         ? 'bg-red-200 text-red-800' :
                              score.scoreAwarded >= 90 ? 'bg-green-100 text-green-700' :
                              score.scoreAwarded >= 70 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-600'
                            )}>
                              {score.scoreAwarded.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                      {hasScore && score.isNA && (
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">N/A</span>
                      )}
                      {!hasScore && !task.isDemo && isSubmitted && (
                        <span className="text-xs text-gray-300 flex-shrink-0">—</span>
                      )}
                    </div>

                    {/* Accomplished count and comments */}
                    {hasScore && !score.isNA && (
                      <div className="mt-2 pl-0 space-y-1">
                        {task.numberRequired > 1 && score.numberAccomplished !== null && (
                          <p className="text-[10px] text-gray-500">
                            Accomplished: {score.numberAccomplished}/{task.numberRequired}
                          </p>
                        )}
                        {score.comments && (
                          <p className="text-xs text-gray-600 italic bg-gray-50 rounded px-2 py-1 border border-gray-100">
                            &ldquo;{score.comments}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {!isSubmitted && entry.status === 'NOT_STARTED' && (
          <p className="text-sm text-gray-400 text-center py-4">
            This gradesheet has not been graded yet. The task list above shows what will be evaluated.
          </p>
        )}
      </div>
    </main>
  )
}
