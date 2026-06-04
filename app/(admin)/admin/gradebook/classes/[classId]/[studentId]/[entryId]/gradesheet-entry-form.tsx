'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveGradebookEntryAction, unlockGradebookEntryAction } from '../../../../actions'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { cn } from '@/lib/utils'
import type { GradesheetTemplate, GradesheetTask, GradebookEntry, GradebookTaskScore } from '@prisma/client'

type FullEntry = GradebookEntry & {
  student:  { id: string; name: string; track: string; class: { name: string } }
  template: GradesheetTemplate & { tasks: GradesheetTask[] }
  scores:   GradebookTaskScore[]
}

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

interface TaskScore {
  scoreEntered?:       number
  numberAccomplished?: number
  comments?:           string
}

export function GradesheetEntryForm({ entry }: { entry: FullEntry }) {
  const router = useRouter()

  const initialScores: Record<string, TaskScore> = {}
  for (const s of entry.scores) {
    initialScores[s.taskId] = {
      scoreEntered:       s.scoreEntered ?? undefined,
      numberAccomplished: s.numberAccomplished ?? undefined,
      comments:           s.comments ?? undefined,
    }
  }

  const [scores,         setScores]         = useState<Record<string, TaskScore>>(initialScores)
  const [instructor,     setInstructor]      = useState<string>(entry.instructorName ?? '')
  const [saving,         setSaving]          = useState(false)
  const [confirmSubmit,  setConfirmSubmit]   = useState(false)
  const [unlocking,      setUnlocking]       = useState(false)
  const [expandedTask,   setExpandedTask]    = useState<string | null>(null)
  const [error,          setError]           = useState('')

  const updateScore = (taskId: string, patch: Partial<TaskScore>) =>
    setScores((s) => ({ ...s, [taskId]: { ...s[taskId], ...patch } }))

  // Live scoring
  const liveResult = useMemo(() => {
    const inputs = entry.template.tasks.map((t) => ({
      taskId:            t.id,
      isAirmanship:      t.isAirmanship,
      isBonus:           t.isBonus,
      isDemo:            t.isDemo,
      minScore:          t.minScore,
      minScoreHard:      t.minScoreHard,
      desiredScore:      t.desiredScore,
      weight:            t.weight,
      scoreEntered:      scores[t.id]?.scoreEntered ?? null,
      numberAccomplished: scores[t.id]?.numberAccomplished ?? null,
    }))
    const gradedCount = inputs.filter((i) => !i.isDemo && i.scoreEntered !== null && i.scoreEntered !== undefined).length
    if (gradedCount === 0) return null
    return scoreEntry(inputs)
  }, [scores, entry.template.tasks])

  const handleSave = async (submit: boolean) => {
    if (!instructor.trim()) { setError('Instructor name required.'); return }
    setSaving(true); setError('')
    const payload: Record<string, { scoreEntered: number; numberAccomplished?: number; comments?: string }> = {}
    for (const [taskId, s] of Object.entries(scores)) {
      if (s.scoreEntered !== undefined) {
        payload[taskId] = { scoreEntered: s.scoreEntered, numberAccomplished: s.numberAccomplished, comments: s.comments }
      }
    }
    const res = await saveGradebookEntryAction(entry.id, instructor, payload, submit)
    setSaving(false)
    if ('error' in res) { setError(res.error ?? 'Unknown error'); return }
    if (submit) router.back()
  }

  const handleUnlock = async () => {
    setUnlocking(true)
    await unlockGradebookEntryAction(entry.id)
    setUnlocking(false)
    router.refresh()
  }

  // Group tasks by section
  const sections = useMemo(() => {
    const map = new Map<string, GradesheetTask[]>()
    for (const t of entry.template.tasks) {
      const key = t.sectionLabel ?? 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [entry.template.tasks])

  const isLocked = entry.isLocked

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card border border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-tps-navy">
              {entry.template.courseCode} — {entry.template.title}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {entry.student.name} · {entry.student.track.replace('_', '/')} · {entry.student.class.name}
            </p>
          </div>
          {isLocked && (
            <div className="flex items-center gap-3">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">
                Locked — {entry.instructorName}
              </span>
              <button onClick={handleUnlock} disabled={unlocking} className="btn-secondary text-xs">
                {unlocking ? '…' : '🔓 Admin Unlock'}
              </button>
            </div>
          )}
        </div>

        {/* Live score display */}
        {(liveResult || entry.status === 'SUBMITTED') && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 items-center">
            <div className="text-center">
              <p className={cn('text-3xl font-bold font-mono',
                (liveResult?.overallPass ?? entry.overallPass) ? 'text-green-600' : 'text-red-600'
              )}>
                {((liveResult?.overallScore ?? entry.overallScore) ?? 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400">Overall</p>
            </div>
            <div className="flex gap-2">
              <div className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
                (liveResult?.academicPass ?? entry.academicPass) ? 'bg-green-100' : 'bg-red-100'
              )}>
                <p className={cn('font-bold text-sm', (liveResult?.academicPass ?? entry.academicPass) ? 'text-green-700' : 'text-red-700')}>
                  {(liveResult?.academicPass ?? entry.academicPass) ? '✓' : '✗'}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Academic</p>
              </div>
              <div className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
                (liveResult?.airmanshipPass ?? entry.airmanshipPass) ? 'bg-green-100' : 'bg-red-100'
              )}>
                <p className={cn('font-bold text-sm', (liveResult?.airmanshipPass ?? entry.airmanshipPass) ? 'text-green-700' : 'text-red-700')}>
                  {(liveResult?.airmanshipPass ?? entry.airmanshipPass) ? '✓' : '✗'}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Airmanship</p>
              </div>
            </div>
            {!isLocked && liveResult && (
              <p className="text-xs text-gray-400 ml-auto">Score updates as you grade</p>
            )}
          </div>
        )}
      </div>

      {/* Instructor name */}
      {!isLocked && (
        <div className="card border border-gray-200">
          <label className="field-label">Instructor Name *</label>
          <input value={instructor} onChange={(e) => setInstructor(e.target.value)}
            placeholder="Maj. Smith" className="field-input max-w-sm" />
        </div>
      )}

      {/* Task sections */}
      {Array.from(sections.entries()).map(([section, tasks]) => (
        <div key={section} className="card border border-gray-200 space-y-3">
          <h3 className={cn('font-semibold text-sm uppercase tracking-wide',
            tasks[0]?.isAirmanship ? 'text-tps-orange' : 'text-gray-600'
          )}>
            {tasks[0]?.isAirmanship ? '✈ ' : ''}{section}
          </h3>

          <div className="space-y-3">
            {tasks.map((task) => {
              const s         = scores[task.id]
              const taskResult = liveResult?.taskResults.find((r) => r.taskId === task.id)
              const isExpanded = expandedTask === task.id
              const pctAwarded = taskResult?.scoreAwarded

              return (
                <div key={task.id} className={cn('rounded-xl border p-3 space-y-2',
                  taskResult?.isAutoFail ? 'border-red-300 bg-red-50' :
                  task.isDemo ? 'border-gray-100 bg-gray-50' :
                  task.isBonus ? 'border-amber-100 bg-amber-50' :
                  'border-gray-100',
                )}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800">{task.label}</p>
                        {task.isBonus && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 rounded font-medium">BONUS</span>}
                        {task.isDemo  && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded font-medium">DEMO</span>}
                        {taskResult?.isAutoFail && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 rounded font-bold">AUTO-FAIL</span>}
                      </div>
                      <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                        {task.minScore !== null && (
                          <span>Min: {task.minScore}{task.minScoreHard ? '*' : ''}</span>
                        )}
                        {task.desiredScore !== null && <span>Desired: {task.desiredScore}</span>}
                        {task.weight > 0 && <span>Weight: {(task.weight * 100).toFixed(1)}%</span>}
                        {task.numberRequired > 1 && <span># Req: {task.numberRequired}</span>}
                      </div>
                    </div>

                    {pctAwarded !== undefined && (
                      <span className={cn('text-xs font-mono font-bold flex-shrink-0 px-2 py-1 rounded',
                        taskResult?.isAutoFail ? 'bg-red-200 text-red-800' :
                        pctAwarded >= 90 ? 'bg-green-100 text-green-700' :
                        pctAwarded >= 70 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      )}>
                        {pctAwarded.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {!task.isDemo && !isLocked && (
                    <>
                      {/* 0-4 score buttons */}
                      <div className="flex gap-1.5 flex-wrap">
                        {[0, 1, 2, 3, 4].map((v) => (
                          <button key={v} type="button"
                            onClick={() => updateScore(task.id, { scoreEntered: v === s?.scoreEntered ? undefined : v })}
                            className={cn('flex-1 min-w-[40px] py-2 rounded-lg text-sm font-bold border transition-colors',
                              s?.scoreEntered === v
                                ? SCORE_COLORS[v] + ' border-transparent shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                            )}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      {s?.scoreEntered !== undefined && (
                        <p className="text-[10px] text-gray-500 pl-1">{SCORE_LABELS[s.scoreEntered]}</p>
                      )}

                      {/* Comments toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? '▲ Hide' : '▼ Add comment / # accomplished'}
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 pt-1">
                          {task.numberRequired > 1 && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-32">Accomplished:</label>
                              <input type="number" min={0} max={task.numberRequired}
                                value={s?.numberAccomplished ?? ''}
                                onChange={(e) => updateScore(task.id, { numberAccomplished: parseInt(e.target.value) || undefined })}
                                className="field-input w-20 text-center text-sm font-mono"
                                placeholder={`/${task.numberRequired}`}
                              />
                            </div>
                          )}
                          <textarea
                            value={s?.comments ?? ''}
                            onChange={(e) => updateScore(task.id, { comments: e.target.value || undefined })}
                            placeholder="Comments (optional)"
                            rows={2}
                            className="field-input text-sm resize-y w-full"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Locked view */}
                  {!task.isDemo && isLocked && (
                    <div className="flex items-center gap-3">
                      {s?.scoreEntered !== undefined && (
                        <span className={cn('text-sm font-bold px-3 py-1 rounded-lg', SCORE_COLORS[s.scoreEntered])}>
                          {s.scoreEntered} — {SCORE_LABELS[s.scoreEntered]}
                        </span>
                      )}
                      {s?.comments && (
                        <p className="text-xs text-gray-500 italic">&ldquo;{s.comments}&rdquo;</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Footer actions */}
      {!isLocked && (
        <div className="sticky bottom-4 space-y-2">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {confirmSubmit ? (
            <div className="card border border-amber-300 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                Submit and lock this gradesheet?
                {liveResult && (
                  <span className={cn('ml-2', liveResult.overallPass ? 'text-green-700' : 'text-red-700')}>
                    Final score: {liveResult.overallScore.toFixed(1)}% — {liveResult.overallPass ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-700">Once submitted, this gradesheet is locked and can only be edited by an admin.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSubmit(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Submitting…' : 'Confirm Submit & Lock'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => handleSave(false)} disabled={saving}
                className="btn-secondary flex-1">
                {saving ? 'Saving…' : 'Save Progress'}
              </button>
              <button onClick={() => { if (!instructor.trim()) { setError('Instructor name required.'); return } setConfirmSubmit(true) }}
                disabled={saving} className="btn-primary flex-1">
                Submit & Lock →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
