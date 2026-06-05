'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { GradesheetTask } from '@prisma/client'

export const SCORE_LABELS: Record<number, string> = {
  0: 'Unsafe / Omitted',
  1: 'Safe but Unable',
  2: 'Unable',
  3: 'Minimally Proficient',
  4: 'Proficient / Desired',
}

export const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-600 text-white',
  1: 'bg-orange-500 text-white',
  2: 'bg-amber-400 text-gray-900',
  3: 'bg-yellow-300 text-gray-900',
  4: 'bg-green-500 text-white',
}

export interface TaskScore {
  scoreEntered?:       number
  numberAccomplished?: number
  isNA?:               boolean
  comments?:           string
}

export function TaskRow({
  task, score, taskResult, onChange, locked,
}: {
  task:       GradesheetTask
  score:      TaskScore
  taskResult?: { scoreAwarded: number; isAutoFail: boolean; isNA: boolean } | null
  onChange:   (patch: Partial<TaskScore>) => void
  locked:     boolean
}) {
  const [showComment, setShowComment] = useState(false)
  const isNA         = score.isNA ?? false
  const accomplished = score.numberAccomplished ?? 1

  return (
    <div className={cn('rounded-xl border p-3 space-y-2',
      isNA                   ? 'border-gray-200 bg-gray-100 opacity-70' :
      taskResult?.isAutoFail ? 'border-red-300 bg-red-50' :
      task.isDemo            ? 'border-gray-100 bg-gray-50' :
      task.isBonus           ? 'border-amber-100 bg-amber-50' :
      'border-gray-100',
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-sm font-medium', isNA ? 'text-gray-400 line-through' : 'text-gray-800')}>{task.label}</p>
            {task.isBonus && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 rounded font-medium">BONUS</span>}
            {task.isDemo  && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded font-medium">DEMO</span>}
            {taskResult?.isAutoFail && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 rounded font-bold">AUTO-FAIL</span>}
          </div>
          <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
            {task.minScore !== null && <span>Min: {task.minScore}{task.minScoreHard ? <span className="text-red-400">*</span> : ''}</span>}
            {task.desiredScore !== null && <span>Desired: {task.desiredScore}</span>}
            {task.weight > 0 && <span>Weight: {(task.weight * 100).toFixed(1)}%</span>}
          </div>
        </div>

        {/* Score awarded badge + N/A toggle — always in header row so N/A is always reachable */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isNA && taskResult?.scoreAwarded !== undefined && (
            <span className={cn('text-xs font-mono font-bold px-2 py-1 rounded',
              taskResult.isAutoFail         ? 'bg-red-200 text-red-800' :
              taskResult.scoreAwarded >= 90 ? 'bg-green-100 text-green-700' :
              taskResult.scoreAwarded >= 70 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-600'
            )}>
              {taskResult.scoreAwarded.toFixed(0)}%
            </span>
          )}
          {!task.isDemo && !locked && (
            <button type="button"
              onClick={() => onChange({ isNA: !isNA, scoreEntered: undefined })}
              className={cn('text-xs px-2 py-1 rounded border font-medium transition-colors',
                isNA
                  ? 'border-tps-orange text-tps-orange bg-orange-50'
                  : 'border-gray-200 text-gray-400 hover:border-gray-400'
              )}>
              N/A
            </button>
          )}
          {isNA && locked && <span className="text-xs text-gray-400 font-medium">N/A</span>}
        </div>
      </div>

      {!task.isDemo && !isNA && (
        <>
          {/* Column labels — abbreviated rubric names (item D) */}
          <div className="flex gap-2 items-end mt-1">
            <div className="w-14 flex-shrink-0">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide text-center">
                {task.numberRequired > 1 ? `Acc/${task.numberRequired}` : 'Acc'}
              </p>
            </div>
            <div className="flex-1 flex gap-1">
              {(['Unsafe','S/Unable','Unable','Min Prof','Proficient'] as const).map((lbl) => (
                <span key={lbl} className="flex-1 text-[8px] text-gray-400 text-center leading-tight">{lbl}</span>
              ))}
            </div>
          </div>

          {/* Controls row */}
          <div className="flex gap-2 items-center">
            <input type="number" min={0} max={task.numberRequired * 2}
              value={accomplished}
              disabled={locked}
              onChange={(e) => onChange({ numberAccomplished: parseInt(e.target.value) || 0 })}
              className={cn('w-14 flex-shrink-0 field-input text-center text-sm font-mono py-1',
                accomplished === 0 ? 'border-red-300 bg-red-50' : ''
              )}
            />
            <div className="flex gap-1 flex-1">
              {[0, 1, 2, 3, 4].map((v) => (
                <button key={v} type="button"
                  disabled={locked}
                  onClick={() => onChange({ scoreEntered: v === score.scoreEntered ? undefined : v })}
                  className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                    score.scoreEntered === v
                      ? SCORE_COLORS[v] + ' border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50'
                  )}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Score label + warnings */}
          {score.scoreEntered !== undefined && !isNA && (
            <p className="text-[10px] text-gray-500">{SCORE_LABELS[score.scoreEntered]}</p>
          )}
          {accomplished === 0 && task.minScoreHard && (
            <p className="text-[10px] text-red-500 font-medium">⚠ 0 accomplished on a required task — auto-fail</p>
          )}

          {!locked && (
            <button type="button" onClick={() => setShowComment(!showComment)}
              className="text-[10px] text-gray-400 hover:text-gray-600">
              {showComment ? '▲ Hide comment' : '▼ Add comment'}
            </button>
          )}
          {showComment && !locked && (
            <textarea value={score.comments ?? ''}
              onChange={(e) => onChange({ comments: e.target.value || undefined })}
              placeholder="Comments (optional)" rows={2}
              className="field-input text-sm resize-y w-full" />
          )}
        </>
      )}

      {!task.isDemo && locked && !isNA && (
        <div className="flex items-center gap-3 pl-1">
          {score.scoreEntered !== undefined && (
            <span className={cn('text-sm font-bold px-3 py-1 rounded-lg', SCORE_COLORS[score.scoreEntered])}>
              {accomplished}/{task.numberRequired} · {score.scoreEntered} — {SCORE_LABELS[score.scoreEntered]}
            </span>
          )}
          {score.comments && <p className="text-xs text-gray-500 italic">&ldquo;{score.comments}&rdquo;</p>}
        </div>
      )}
    </div>
  )
}
