'use client'

import { useState, useTransition } from 'react'
import { closeSurveyAction, publishReportAction, saveSanitizedReportAction } from './actions'
import type { SurveyType, UserRole } from '@prisma/client'

type Props = {
  id:             string
  className:      string
  eventCode:      string | null
  surveyType:     SurveyType
  instructorName: string | null
  deployedBy:     string
  deployedAt:     Date
  isActive:       boolean
  responseCount:  number
  publishedAt:    Date | null
  hasDraft:       boolean
  role:           UserRole
}

export function SurveyRow(props: Props) {
  const { id, className, eventCode, surveyType, instructorName, deployedAt,
          isActive, responseCount, publishedAt, hasDraft, role } = props

  const [pending, startTransition] = useTransition()
  const [editMode, setEditMode]     = useState(false)
  const [draftText, setDraftText]   = useState('')
  const [feedback, setFeedback]     = useState<string | null>(null)

  const isA9 = role === 'SYSTEM_ADMIN' || role === 'A9_STANDARDS'

  function close() {
    startTransition(async () => {
      const r = await closeSurveyAction(id)
      if (!r.ok) setFeedback(r.error ?? 'Error')
    })
  }

  function saveDraft() {
    startTransition(async () => {
      const r = await saveSanitizedReportAction(id, draftText)
      if (r.ok) { setEditMode(false); setFeedback(null) }
      else setFeedback(r.error ?? 'Error')
    })
  }

  function publish() {
    if (!confirm('Publish this sanitized report to instructor dashboards?')) return
    startTransition(async () => {
      const r = await publishReportAction(id)
      if (!r.ok) setFeedback(r.error ?? 'Error')
      else setFeedback(null)
    })
  }

  return (
    <div className={`card space-y-3 ${isActive ? '' : 'opacity-75'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
              surveyType === 'STUDENT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {surveyType}
            </span>
            <span className="text-sm font-semibold text-tps-navy">
              Class {className}
              {eventCode && <> · {eventCode}</>}
              {instructorName && <> · {instructorName}</>}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Deployed {new Date(deployedAt).toLocaleDateString()} ·
            {' '}{responseCount} response{responseCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {publishedAt ? (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
              Published {new Date(publishedAt).toLocaleDateString()}
            </span>
          ) : hasDraft ? (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
              Draft saved
            </span>
          ) : null}

          {isActive && isA9 && (
            <button
              onClick={close}
              disabled={pending}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Close Survey
            </button>
          )}

          {isA9 && !publishedAt && (
            <>
              <button
                onClick={() => setEditMode(true)}
                disabled={pending}
                className="text-xs px-2 py-1 rounded bg-tps-navy text-white hover:bg-tps-navy/80 disabled:opacity-50"
              >
                {hasDraft ? 'Edit Draft' : 'Create Report'}
              </button>
              {hasDraft && (
                <button
                  onClick={publish}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Publish
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Report editor (A9 only) */}
      {editMode && isA9 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Sanitized Report Draft
          </p>
          <p className="text-xs text-gray-500">
            Remove any identifiable student names, unit callsigns, or uniquely identifiable phrasing.
            Only sanitized text will be published to instructor dashboards.
          </p>
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            rows={8}
            className="field-input resize-y font-mono text-xs"
            placeholder="Paste or write the sanitized report text here…"
          />
          <div className="flex gap-2">
            <button onClick={saveDraft} disabled={pending} className="btn-primary text-sm">
              {pending ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => setEditMode(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {feedback && (
        <p className="text-xs text-red-500">{feedback}</p>
      )}
    </div>
  )
}
