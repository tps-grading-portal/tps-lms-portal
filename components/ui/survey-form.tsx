'use client'

import { useActionState } from 'react'
import { cn } from '@/lib/utils'

export type SurveyQuestion = {
  id: string
  questionKey: string
  questionText: string
  questionType: string
  options: unknown
  isRequired: boolean
  sortOrder: number
}

type ClassOption = { id: string; name: string }

// Section breaks: [firstSortOrder, sectionTitle]
type SectionBreak = [number, string]

interface SurveyFormProps {
  action: (prev: string | null, formData: FormData) => Promise<string | null>
  questions: SurveyQuestion[]
  classes: ClassOption[]
  sectionBreaks: SectionBreak[]
  submitLabel: string
  intro?: string
}

export function SurveyForm({
  action,
  questions,
  classes,
  sectionBreaks,
  submitLabel,
  intro,
}: SurveyFormProps) {
  const [error, formAction, pending] = useActionState(action, null)

  const getSectionTitle = (sortOrder: number): string | null => {
    // Find the most recent section break at or before this sortOrder
    const applicable = sectionBreaks.filter(([start]) => start <= sortOrder)
    if (applicable.length === 0) return null
    const [, title] = applicable[applicable.length - 1]
    // Only show the title once — at the first question of the section
    const firstInSection = questions.find((q) => {
      const breaks = sectionBreaks.filter(([s]) => s <= q.sortOrder)
      if (breaks.length === 0) return false
      return breaks[breaks.length - 1][1] === title && q.sortOrder === breaks[breaks.length - 1][0]
    })
    return firstInSection?.sortOrder === sortOrder ? title : null
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Class selector */}
      <div className="card">
        <label className="field-label">
          Select Your Class <span className="text-red-500">*</span>
        </label>
        {classes.length === 1 ? (
          <>
            <input type="hidden" name="classId" value={classes[0].id} />
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
              Class <strong>{classes[0].name}</strong>
            </div>
          </>
        ) : (
          <select name="classId" required className="field-select">
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>Class {c.name}</option>
            ))}
          </select>
        )}
      </div>

      {intro && (
        <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
          {intro}
        </div>
      )}

      {/* Questions */}
      {questions.map((q) => {
        const sectionTitle = getSectionTitle(q.sortOrder)
        const options = Array.isArray(q.options) ? (q.options as string[]) : []

        return (
          <div key={q.id}>
            {sectionTitle && (
              <div className="pt-6 mb-4 pl-4 border-l-4 border-tps-orange">
                <h2 className="text-base font-bold text-tps-navy">{sectionTitle}</h2>
              </div>
            )}

            <div className="card space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 leading-snug">
                  {q.questionText}
                  {q.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {!q.isRequired && (
                  <p className="text-xs text-gray-400 mt-0.5">Optional</p>
                )}
              </div>

              <QuestionInput question={q} options={options} />
            </div>
          </div>
        )
      })}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="sticky bottom-4 pt-2">
        <button type="submit" disabled={pending} className="btn-primary w-full text-base py-4 shadow-lg">
          {pending ? 'Submitting…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function QuestionInput({
  question,
  options,
}: {
  question: SurveyQuestion
  options: string[]
}) {
  const name = question.questionKey
  const req  = question.isRequired

  switch (question.questionType) {
    case 'MULTIPLE_CHOICE':
      return (
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-tps-blue transition-colors"
            >
              <input
                type="radio"
                name={name}
                value={opt}
                required={req}
                className="mt-0.5 h-4 w-4 text-tps-blue border-gray-300 flex-shrink-0"
              />
              <span className="text-sm text-gray-800">{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'LIKERT': {
      // Horizontal 1-5 scale
      const scaleSize = options.length || 5
      return (
        <div>
          <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${scaleSize}, 1fr)` }}>
            {options.map((label, idx) => {
              const val = String(idx + 1)
              return (
                <label
                  key={val}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name={name}
                    value={val}
                    required={req}
                    className="sr-only peer"
                  />
                  <span className={cn(
                    'w-full min-h-[52px] flex flex-col items-center justify-center rounded-lg border-2 text-sm font-bold transition-all',
                    'border-gray-200 text-gray-600 hover:border-tps-blue hover:text-tps-blue',
                    'peer-checked:border-tps-blue peer-checked:bg-tps-blue peer-checked:text-white',
                  )}>
                    {val}
                  </span>
                  <span className="text-[9px] text-gray-500 text-center leading-tight px-0.5">
                    {label.replace(/^\d+\s*[–-]\s*/, '')}
                  </span>
                </label>
              )
            })}
          </div>
          {/* Endpoint labels */}
          {options.length > 0 && (
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
              <span>{options[0]}</span>
              <span className="text-right">{options[options.length - 1]}</span>
            </div>
          )}
        </div>
      )
    }

    case 'DATE':
      return (
        <input
          type="date"
          name={name}
          required={req}
          className="field-input"
          max={new Date().toISOString().split('T')[0]}
        />
      )

    case 'NUMBER':
      return <input type="number" name={name} required={req} className="field-input w-32" />

    case 'MULTI_SELECT':
      return (
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name={name}
                value={opt}
                className="mt-0.5 h-4 w-4 text-tps-blue border-gray-300 rounded flex-shrink-0"
              />
              <span className="text-sm text-gray-800">{opt}</span>
            </label>
          ))}
        </div>
      )

    // TEXT and default
    default:
      return (
        <textarea
          name={name}
          required={req}
          rows={3}
          className="field-input resize-y text-sm"
          placeholder="Your response…"
        />
      )
  }
}
