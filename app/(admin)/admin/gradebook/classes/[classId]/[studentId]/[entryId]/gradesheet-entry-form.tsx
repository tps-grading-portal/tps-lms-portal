'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveGradebookEntryAction, unlockGradebookEntryAction } from '../../../../actions'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { cn } from '@/lib/utils'
import { TaskRow, type TaskScore } from '@/lib/gradesheet-form-components'
import type { GradesheetTemplate, GradesheetTask, GradebookEntry, GradebookTaskScore } from '@prisma/client'

type FullEntry = GradebookEntry & {
  student:  { id: string; name: string; track: string; class: { name: string } }
  template: GradesheetTemplate & { tasks: GradesheetTask[] }
  scores:   GradebookTaskScore[]
}

export type { TaskScore }

export function GradesheetEntryForm({ entry, isInstructor }: { entry: FullEntry; isInstructor?: boolean }) {
  const router = useRouter()

  const initialScores: Record<string, TaskScore> = {}
  for (const s of entry.scores) {
    initialScores[s.taskId] = {
      scoreEntered:       s.scoreEntered ?? undefined,
      numberAccomplished: s.numberAccomplished ?? 1,
      isNA:               s.isNA,
      comments:           s.comments ?? undefined,
    }
  }

  const [scores,        setScores]        = useState<Record<string, TaskScore>>(initialScores)
  const [instructor,    setInstructor]     = useState<string>(entry.instructorName ?? '')
  const [saving,        setSaving]         = useState(false)
  const [confirmSubmit, setConfirmSubmit]  = useState(false)
  const [unlocking,     setUnlocking]      = useState(false)
  const [error,         setError]          = useState('')

  const updateScore = (taskId: string, patch: Partial<TaskScore>) =>
    setScores((s) => ({ ...s, [taskId]: { ...s[taskId], ...patch } }))

  // Ensure every non-demo task has at least numberAccomplished=1 set
  const getScore = (taskId: string, numReq: number): TaskScore => {
    const s = scores[taskId]
    return { numberAccomplished: numReq >= 1 ? 1 : numReq, ...s }
  }

  const liveResult = useMemo(() => {
    const inputs = entry.template.tasks.map((t) => {
      const s = getScore(t.id, t.numberRequired)
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
  }, [scores, entry.template.tasks])

  const handleSave = async (submit: boolean) => {
    if (!instructor.trim()) { setError('Instructor name required.'); return }
    setSaving(true); setError('')
    const payload: Record<string, { scoreEntered?: number; numberAccomplished?: number; isNA?: boolean; comments?: string }> = {}
    for (const t of entry.template.tasks) {
      if (t.isDemo) continue
      const s = getScore(t.id, t.numberRequired)
      payload[t.id] = {
        scoreEntered:       s.scoreEntered,
        numberAccomplished: s.numberAccomplished ?? 1,
        isNA:               s.isNA ?? false,
        comments:           s.comments,
      }
    }
    const res = await saveGradebookEntryAction(entry.id, instructor, payload, submit, isInstructor)
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
      {/* Header */}
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
          {isLocked && !isInstructor && (
            <div className="flex items-center gap-3">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                Locked — {entry.instructorName}
              </span>
              <button onClick={handleUnlock} disabled={unlocking} className="btn-secondary text-xs">
                {unlocking ? '…' : '🔓 Admin Unlock'}
              </button>
            </div>
          )}
          {isLocked && isInstructor && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              Submitted by {entry.instructorName}
            </span>
          )}
        </div>

        {/* Live score */}
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
              {(['academicPass', 'airmanshipPass'] as const).map((key) => (
                <div key={key} className={cn('px-3 py-2 rounded-lg text-center min-w-[64px]',
                  (liveResult?.[key] ?? entry[key]) ? 'bg-green-100' : 'bg-red-100'
                )}>
                  <p className={cn('font-bold text-sm', (liveResult?.[key] ?? entry[key]) ? 'text-green-700' : 'text-red-700')}>
                    {(liveResult?.[key] ?? entry[key]) ? '✓' : '✗'}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                    {key === 'academicPass' ? 'Academic' : 'Airmanship'}
                  </p>
                </div>
              ))}
            </div>
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
            {section}
          </h3>
          <div className="space-y-3">
            {tasks.map((task) => {
              const s = getScore(task.id, task.numberRequired)
              const taskResult = liveResult?.taskResults.find((r) => r.taskId === task.id)
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  score={s}
                  taskResult={taskResult}
                  onChange={(patch) => updateScore(task.id, patch)}
                  locked={isLocked}
                />
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
                    Final: {liveResult.overallScore.toFixed(1)}% — {liveResult.overallPass ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-700">Once submitted, only an admin can unlock this gradesheet.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSubmit(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Submitting…' : 'Confirm Submit & Lock'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex-1">
                {saving ? 'Saving…' : 'Save Progress'}
              </button>
              <button
                onClick={() => { if (!instructor.trim()) { setError('Instructor name required.'); return } setConfirmSubmit(true) }}
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
