'use client'

import { useState, useMemo } from 'react'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { TaskRow, type TaskScore } from '@/lib/gradesheet-form-components'
import { cn } from '@/lib/utils'
import type { GradesheetTask } from '@prisma/client'

export function GradesheetPreviewForm({ tasks }: { tasks: GradesheetTask[] }) {
  const [scores, setScores] = useState<Record<string, TaskScore>>({})

  const updateScore = (taskId: string, patch: Partial<TaskScore>): void =>
    setScores((s) => ({ ...s, [taskId]: { ...s[taskId], ...patch } }))

  const getScore = (taskId: string): TaskScore => {
    const s = scores[taskId]
    return { numberAccomplished: 1, ...s }
  }

  const liveResult = useMemo(() => {
    const inputs = tasks.map((t) => {
      const s = getScore(t.id)
      return {
        taskId:             t.id,
        isAirmanship:       t.isAirmanship,
        isBonus:            t.isBonus,
        isDemo:             t.isDemo,
        isNA:               s.isNA ?? false,
        minScore:           t.minScore,
        minScoreHard:       t.minScoreHard,
        desiredScore:       t.desiredScore,
        weight:             t.weight,
        scoreEntered:       s.scoreEntered ?? null,
        numberAccomplished: s.numberAccomplished ?? 1,
        numberRequired:     t.numberRequired,
      }
    })
    const gradedCount = inputs.filter((i) => !i.isDemo && !i.isNA && i.scoreEntered !== null).length
    if (gradedCount === 0) return null
    return scoreEntry(inputs)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, tasks])

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
          <p className="text-xs text-amber-600 mt-0.5">Grade as you normally would to test scoring. Reset clears all inputs.</p>
        </div>
        <button onClick={() => setScores({})} className="btn-secondary text-xs flex-shrink-0">Reset</button>
      </div>

      {/* Live score */}
      {liveResult && (
        <div className="card border border-gray-200 flex flex-wrap gap-4 items-center">
          <div className="text-center">
            <p className={cn('text-3xl font-bold font-mono', liveResult.overallPass ? 'text-green-600' : 'text-red-600')}>
              {liveResult.overallScore.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400">Overall</p>
          </div>
          <div className="flex gap-2">
            {(['academicPass', 'airmanshipPass'] as const).map((key) => (
              <div key={key} className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
                liveResult[key] ? 'bg-green-100' : 'bg-red-100'
              )}>
                <p className={cn('font-bold text-sm', liveResult[key] ? 'text-green-700' : 'text-red-700')}>
                  {liveResult[key] ? '✓' : '✗'}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {key === 'academicPass' ? 'Academic' : 'Airmanship'}
                </p>
              </div>
            ))}
          </div>
          <p className={cn('text-sm font-bold ml-auto', liveResult.overallPass ? 'text-green-600' : 'text-red-600')}>
            {liveResult.overallPass ? '✓ PASS' : '✗ FAIL'}
          </p>
        </div>
      )}

      {/* Sections */}
      {Array.from(sections.entries()).map(([section, sectionTasks]) => (
        <div key={section} className="card border border-gray-200 space-y-3">
          <h3 className={cn('font-semibold text-sm uppercase tracking-wide',
            sectionTasks[0]?.isAirmanship ? 'text-tps-orange' : 'text-gray-600'
          )}>
            {section}
          </h3>
          <div className="space-y-3">
            {sectionTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                score={getScore(task.id)}
                taskResult={liveResult?.taskResults.find((r) => r.taskId === task.id)}
                onChange={(patch) => updateScore(task.id, patch)}
                locked={false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
