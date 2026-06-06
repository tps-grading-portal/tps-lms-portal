'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { portalSaveEntryAction } from '../actions'
import { TaskRow, type TaskScore } from '@/lib/gradesheet-form-components'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { cn } from '@/lib/utils'
import type { GradesheetTemplate, GradesheetTask, GradebookEntry, GradebookTaskScore } from '@prisma/client'

type FullEntry = GradebookEntry & {
  student:  { id: string; number: number; firstName: string; lastName: string; track: string; class: { name: string } }
  template: GradesheetTemplate & { tasks: GradesheetTask[] }
  scores:   GradebookTaskScore[]
}

export function MobileGradeForm({ entry }: { entry: FullEntry }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error,   setError]        = useState<string | null>(null)
  const [saved,   setSaved]        = useState(false)

  const studentLabel = `${entry.student.firstName} ${entry.student.lastName}`.trim()
    || `Student ${entry.student.number}`

  // Build initial score state from existing GradebookTaskScore records
  const initialScores: Record<string, TaskScore> = {}
  for (const s of entry.scores) {
    initialScores[s.taskId] = {
      scoreEntered:       s.scoreEntered ?? undefined,
      numberAccomplished: s.numberAccomplished ?? 1,
      isNA:               s.isNA,
      comments:           s.comments ?? undefined,
    }
  }

  const [scores,     setScores]     = useState<Record<string, TaskScore>>(initialScores)
  const [instructor, setInstructor] = useState<string>(entry.instructorName ?? '')

  const updateScore = (taskId: string, patch: Partial<TaskScore>) =>
    setScores((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } }))

  function getScore(taskId: string, numReq: number): TaskScore {
    const s = scores[taskId]
    return { numberAccomplished: numReq >= 1 ? 1 : numReq, ...s }
  }

  // Live scoring preview
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

  // Group tasks by section label
  const sections = useMemo(() => {
    const map = new Map<string, GradesheetTask[]>()
    for (const task of entry.template.tasks) {
      const key = task.sectionLabel ?? 'Tasks'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [entry.template.tasks])

  function buildPayload() {
    const payload: Record<string, { scoreEntered?: number; numberAccomplished?: number; isNA?: boolean; comments?: string }> = {}
    for (const t of entry.template.tasks) {
      if (t.isDemo) continue
      const s = getScore(t.id, t.numberRequired)
      payload[t.id] = {
        scoreEntered:       s.scoreEntered,
        numberAccomplished: s.numberAccomplished,
        isNA:               s.isNA,
        comments:           s.comments,
      }
    }
    return payload
  }

  function handleSave(submit: boolean) {
    if (!instructor.trim()) { setError('Your name is required.'); return }
    setError(null)
    startTransition(async () => {
      const result = await portalSaveEntryAction(entry.id, instructor, buildPayload(), submit)
      if (result.error) { setError(result.error); return }
      if (submit) {
        setSaved(true)
        setTimeout(() => router.push('/portal/grade'), 1500)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  if (entry.isLocked) {
    return (
      <div className="card text-center py-10">
        <p className="text-gray-500">This gradesheet is locked and cannot be edited.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">

      {/* Student + event header */}
      <div className="card bg-tps-navy text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-white/60">Grading</p>
        <p className="text-lg font-bold">{studentLabel}</p>
        <p className="text-sm text-white/80">
          {entry.template.courseCode} — {entry.template.title}
        </p>
        <p className="text-xs text-white/50 mt-1">
          Class {entry.student.class.name} · {entry.student.track}
        </p>
      </div>

      {/* Instructor name */}
      <div className="card">
        <label className="field-label">Your Name (Instructor) *</label>
        <input
          type="text"
          value={instructor}
          onChange={e => setInstructor(e.target.value)}
          className="field-input"
          placeholder="e.g. Maj Smith"
          disabled={pending}
        />
      </div>

      {/* Live score preview */}
      {liveResult && (
        <div className={cn(
          'card flex items-center justify-between flex-wrap gap-3',
          liveResult.overallPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        )}>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Score Preview</p>
            <p className={cn('text-2xl font-bold tabular-nums', liveResult.overallPass ? 'text-green-700' : 'text-red-600')}>
              {liveResult.overallScore?.toFixed(1) ?? '—'}%
            </p>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            {!liveResult.airmanshipPass && (
              <p className="text-red-500">Airmanship fail</p>
            )}
            {liveResult.taskResults.filter(t => t.isAutoFail).length > 0 && (
              <p className="text-red-600 font-semibold">
                {liveResult.taskResults.filter(t => t.isAutoFail).length} auto-fail(s)
              </p>
            )}
            <p className={liveResult.overallPass ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
              {liveResult.overallPass ? 'PASS' : 'FAIL'}
            </p>
          </div>
        </div>
      )}

      {/* Task sections */}
      {Array.from(sections.entries()).map(([sectionLabel, tasks]) => (
        <section key={sectionLabel}>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
            {sectionLabel}
          </h3>
          <div className="space-y-2">
            {tasks.map((task) => {
              const s          = getScore(task.id, task.numberRequired)
              const taskResult = liveResult?.taskResults.find((r) => r.taskId === task.id) ?? null
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  score={s}
                  taskResult={taskResult}
                  onChange={(patch) => updateScore(task.id, patch)}
                  locked={pending}
                />
              )
            })}
          </div>
        </section>
      ))}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && !error && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">
          Saved successfully.
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-10">
        <button
          onClick={() => handleSave(false)}
          disabled={pending}
          className="flex-1 btn-secondary text-sm py-3"
        >
          {pending ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={pending || !instructor.trim()}
          className="flex-1 btn-primary text-sm py-3"
        >
          {pending ? 'Submitting…' : 'Submit & Recalculate Standings'}
        </button>
      </div>
    </div>
  )
}
