'use client'

import { useState, useMemo } from 'react'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { cn } from '@/lib/utils'
import type { GradesheetTask } from '@prisma/client'

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

interface TaskScore { scoreEntered?: number; numberAccomplished?: number; comments?: string }

export function GradesheetPreviewForm({ tasks }: { tasks: GradesheetTask[] }) {
  const [scores,       setScores]       = useState<Record<string, TaskScore>>({})
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  const updateScore = (taskId: string, patch: Partial<TaskScore>) =>
    setScores((s) => ({ ...s, [taskId]: { ...s[taskId], ...patch } }))

  const liveResult = useMemo(() => {
    const inputs = tasks.map((t) => ({
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
  }, [scores, tasks])

  // Group by section
  const sections = useMemo(() => {
    const map = new Map<string, GradesheetTask[]>()
    for (const t of tasks) {
      const key = t.sectionLabel ?? 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* Preview banner */}
      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-800">Preview Mode — no grades will be saved</p>
          <p className="text-xs text-amber-600 mt-0.5">Grade as you normally would to test the scoring. Reset clears all scores.</p>
        </div>
        <button onClick={() => { setScores({}); setExpandedTask(null) }}
          className="btn-secondary text-xs flex-shrink-0">
          Reset
        </button>
      </div>

      {/* Live score */}
      {liveResult && (
        <div className="card border border-gray-200 flex flex-wrap gap-4 items-center">
          <div className="text-center">
            <p className={cn('text-3xl font-bold font-mono',
              liveResult.overallPass ? 'text-green-600' : 'text-red-600'
            )}>
              {liveResult.overallScore.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400">Overall</p>
          </div>
          <div className="flex gap-2">
            <div className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
              liveResult.academicPass ? 'bg-green-100' : 'bg-red-100'
            )}>
              <p className={cn('font-bold text-sm', liveResult.academicPass ? 'text-green-700' : 'text-red-700')}>
                {liveResult.academicPass ? '✓' : '✗'}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Academic</p>
            </div>
            <div className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
              liveResult.airmanshipPass ? 'bg-green-100' : 'bg-red-100'
            )}>
              <p className={cn('font-bold text-sm', liveResult.airmanshipPass ? 'text-green-700' : 'text-red-700')}>
                {liveResult.airmanshipPass ? '✓' : '✗'}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Airmanship</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            {liveResult.overallPass ? '✓ PASS' : '✗ FAIL'}
          </p>
        </div>
      )}

      {/* Task sections */}
      {Array.from(sections.entries()).map(([section, sectionTasks]) => (
        <div key={section} className="card border border-gray-200 space-y-3">
          <h3 className={cn('font-semibold text-sm uppercase tracking-wide',
            sectionTasks[0]?.isAirmanship ? 'text-tps-orange' : 'text-gray-600'
          )}>
            {sectionTasks[0]?.isAirmanship ? '✈ ' : ''}{section}
          </h3>

          <div className="space-y-3">
            {sectionTasks.map((task) => {
              const s          = scores[task.id]
              const taskResult = liveResult?.taskResults.find((r) => r.taskId === task.id)
              const isExpanded = expandedTask === task.id

              return (
                <div key={task.id} className={cn('rounded-xl border p-3 space-y-2',
                  taskResult?.isAutoFail ? 'border-red-300 bg-red-50' :
                  task.isDemo   ? 'border-gray-100 bg-gray-50' :
                  task.isBonus  ? 'border-amber-100 bg-amber-50' :
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
                        {task.minScore !== null && <span>Min: {task.minScore}{task.minScoreHard ? '*' : ''}</span>}
                        {task.desiredScore !== null && <span>Desired: {task.desiredScore}</span>}
                        {task.weight > 0 && <span>Weight: {(task.weight * 100).toFixed(1)}%</span>}
                        {task.numberRequired > 1 && <span># Req: {task.numberRequired}</span>}
                      </div>
                    </div>
                    {taskResult?.scoreAwarded !== undefined && (
                      <span className={cn('text-xs font-mono font-bold flex-shrink-0 px-2 py-1 rounded',
                        taskResult.isAutoFail ? 'bg-red-200 text-red-800' :
                        taskResult.scoreAwarded >= 90 ? 'bg-green-100 text-green-700' :
                        taskResult.scoreAwarded >= 70 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      )}>
                        {taskResult.scoreAwarded.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {!task.isDemo && (
                    <>
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
                      <button type="button"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-600">
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
                          <textarea value={s?.comments ?? ''}
                            onChange={(e) => updateScore(task.id, { comments: e.target.value || undefined })}
                            placeholder="Comments (preview only — not saved)"
                            rows={2} className="field-input text-sm resize-y w-full" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
