'use client'

import { useState } from 'react'
import { deploySurveyAction } from './actions'

type Props = {
  classId: string
  classes: { id: string; name: string }[]
  events:  { id: string; courseCode: string; title: string }[]
}

export function SurveyDeployForm({ classId, classes, events }: Props) {
  const [open,    setOpen]    = useState(false)
  const [pending, setPending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    setPending(true)
    setError(null)
    setSuccess(false)

    const result = await deploySurveyAction({
      classId:         fd.get('classId')?.toString() ?? classId,
      syllabusEventId: fd.get('syllabusEventId')?.toString() || undefined,
      surveyType:      fd.get('surveyType')?.toString() as 'STUDENT' | 'INSTRUCTOR',
      closesAt:        fd.get('closesAt')?.toString() || undefined,
      instructorName:  fd.get('instructorName')?.toString() || undefined,
      scenarioLabel:   fd.get('scenarioLabel')?.toString() || undefined,
    })

    setPending(false)
    if (result.ok) {
      setSuccess(true)
      setTimeout(() => { setOpen(false); setSuccess(false) }, 1500)
    } else {
      setError(result.error ?? 'Failed to deploy.')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Deploy Survey
      </button>
    )
  }

  return (
    <div className="w-full card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-tps-navy">Deploy Survey</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="classId" value={classId} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Survey Type *</label>
            <select name="surveyType" required className="field-select">
              <option value="STUDENT">Student Survey</option>
              <option value="INSTRUCTOR">Instructor Survey</option>
            </select>
          </div>

          <div>
            <label className="field-label">Linked Event (optional)</label>
            <select name="syllabusEventId" className="field-select">
              <option value="">— None —</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.courseCode} — {e.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Instructor Name (metadata)</label>
            <input name="instructorName" className="field-input" placeholder="Hardcoded at deploy time" />
          </div>

          <div>
            <label className="field-label">Scenario Label (optional)</label>
            <input name="scenarioLabel" className="field-input" placeholder="e.g. TF 9111E Oral #1" />
          </div>

          <div>
            <label className="field-label">Closes At (optional)</label>
            <input type="datetime-local" name="closesAt" className="field-input" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Survey deployed.</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Deploying…' : 'Deploy'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}
