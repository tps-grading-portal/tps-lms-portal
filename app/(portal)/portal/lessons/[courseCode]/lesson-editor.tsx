'use client'

import { useState, useTransition } from 'react'
import { saveLessonPageAction } from './actions'

type Props = {
  syllabusEventId: string
  classId:         string
  initial: {
    overview:           string
    learningObjectives: string[]
    outline:            string
    estimatedMinutes:   number | null
    isPublished:        boolean
  }
}

export function LessonEditor({ syllabusEventId, classId, initial }: Props) {
  const [open,    setOpen]    = useState(false)
  const [pending, startTx]   = useTransition()
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [overview,     setOverview]     = useState(initial.overview)
  const [outline,      setOutline]      = useState(initial.outline)
  const [estimatedMin, setEstimatedMin] = useState<string>(initial.estimatedMinutes?.toString() ?? '')
  const [isPublished,  setIsPublished]  = useState(initial.isPublished)
  const [objectives,   setObjectives]   = useState<string[]>(
    initial.learningObjectives.length > 0 ? initial.learningObjectives : [''],
  )

  function updateObjective(i: number, val: string) {
    setObjectives(prev => prev.map((o, idx) => idx === i ? val : o))
  }
  function addObjective()    { setObjectives(prev => [...prev, '']) }
  function removeObjective(i: number) { setObjectives(prev => prev.filter((_, idx) => idx !== i)) }

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await saveLessonPageAction(syllabusEventId, classId, {
        overview,
        learningObjectives: objectives.filter(o => o.trim()),
        outline,
        estimatedMinutes: estimatedMin ? parseInt(estimatedMin) : null,
        isPublished,
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm px-4 py-2">
        Edit Lesson Content
      </button>
    )
  }

  return (
    <div className="card space-y-5 border-tps-navy/20">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-tps-navy">Edit Lesson Content</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
      </div>

      {/* Overview */}
      <div>
        <label className="field-label">Overview</label>
        <textarea
          value={overview}
          onChange={e => setOverview(e.target.value)}
          rows={4}
          className="field-input"
          placeholder="Brief summary of what this event covers…"
          disabled={pending}
        />
      </div>

      {/* Learning Objectives */}
      <div>
        <label className="field-label">Learning Objectives</label>
        <div className="space-y-2">
          {objectives.map((obj, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={obj}
                onChange={e => updateObjective(i, e.target.value)}
                className="field-input flex-1"
                placeholder={`Objective ${i + 1}…`}
                disabled={pending}
              />
              {objectives.length > 1 && (
                <button
                  onClick={() => removeObjective(i)}
                  className="text-red-400 hover:text-red-600 text-lg px-2"
                  disabled={pending}
                >×</button>
              )}
            </div>
          ))}
          <button onClick={addObjective} className="text-sm text-tps-blue hover:underline" disabled={pending}>
            + Add objective
          </button>
        </div>
      </div>

      {/* Outline */}
      <div>
        <label className="field-label">Lesson Outline / Notes</label>
        <textarea
          value={outline}
          onChange={e => setOutline(e.target.value)}
          rows={6}
          className="field-input font-mono text-sm"
          placeholder="Detailed outline, talking points, reference material…"
          disabled={pending}
        />
      </div>

      {/* Duration */}
      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <label className="field-label">Est. Duration (minutes)</label>
          <input
            type="number"
            value={estimatedMin}
            onChange={e => setEstimatedMin(e.target.value)}
            className="field-input"
            min={0}
            disabled={pending}
          />
        </div>

        {/* Publish toggle */}
        <label className="flex items-center gap-2 cursor-pointer pb-1">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={e => setIsPublished(e.target.checked)}
            className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
            disabled={pending}
          />
          <span className="text-sm text-gray-700">Published (visible to students)</span>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Saved.</div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={pending} className="btn-primary text-sm px-5 py-2">
          {pending ? 'Saving…' : 'Save Lesson'}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
      </div>
    </div>
  )
}
