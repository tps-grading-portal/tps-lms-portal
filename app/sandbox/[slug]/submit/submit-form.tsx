'use client'

import { useActionState, useState } from 'react'
import { submitSandboxAction } from './actions'
import { cn } from '@/lib/utils'
import { GRADE_LABELS } from '@/lib/constants'

const GRADE_BG: Record<number, string> = {
  1: 'bg-emerald-600 text-white', 2: 'bg-emerald-500 text-white',
  3: 'bg-green-400 text-gray-900', 4: 'bg-gray-200 text-gray-800',
  5: 'bg-amber-200 text-gray-800', 6: 'bg-orange-300 text-gray-900',
  7: 'bg-orange-400 text-white',   8: 'bg-red-500 text-white',
}
const GRADE_ANCHORS: Record<number, string> = { 1: 'WAA', 4: 'Avg', 8: 'Fail' }

interface Question {
  id:           string
  questionType: string
  label:        string
  description:  string | null
  sectionLabel: string | null
  options:      unknown
  scaleMin:     number | null
  scaleMax:     number | null
  isRequired:   boolean
}

interface Props {
  form:         { id: string; mode: string; subjectEntry: string; graderEntry: string; predefinedSubjects: unknown; scoringEnabled: boolean }
  questions:    Question[]
  staffMembers: { id: string; name: string }[]
  slug:         string
}

export function SandboxSubmitForm({ form, questions, staffMembers, slug }: Props) {
  const [error, formAction, pending] = useActionState(submitSandboxAction, null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  const predefined = Array.isArray(form.predefinedSubjects) ? (form.predefinedSubjects as string[]) : []
  const options = (q: Question) => Array.isArray(q.options) ? (q.options as string[]) : []

  const setAnswer = (qId: string, val: string) => setAnswers((a) => ({ ...a, [qId]: val }))
  const toggleCheck = (qId: string, val: string) => {
    setAnswers((a) => {
      const current = (a[qId] as string[] | undefined) ?? []
      const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
      return { ...a, [qId]: next }
    })
  }

  const allRequired = questions
    .filter((q) => q.isRequired)
    .every((q) => {
      const a = answers[q.id]
      return a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
    })

  // Group by section
  const sections: { label: string | null; questions: Question[] }[] = []
  for (const q of questions) {
    const last = sections[sections.length - 1]
    if (!last || last.label !== q.sectionLabel) {
      sections.push({ label: q.sectionLabel, questions: [q] })
    } else {
      last.questions.push(q)
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="formId"  value={form.id} />
      <input type="hidden" name="slug"    value={slug} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      {/* Identity fields */}
      <div className="card space-y-3">
        {form.mode === 'GRADER' && (
          <div>
            <label className="field-label">Subject Being Evaluated *</label>
            {form.subjectEntry === 'PREDEFINED_LIST' && predefined.length > 0 ? (
              <select name="subjectName" required className="field-select">
                <option value="">Select subject…</option>
                {predefined.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input name="subjectName" required placeholder="Enter subject name" className="field-input" />
            )}
          </div>
        )}
        <div>
          <label className="field-label">{form.mode === 'GRADER' ? 'Your Name (Grader) *' : 'Your Name'}</label>
          {form.graderEntry === 'STAFF_LIST' && staffMembers.length > 0 ? (
            <select name="graderName" className="field-select">
              <option value="">Select your name…</option>
              {staffMembers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          ) : (
            <input name="graderName" placeholder="Your name (optional)" className="field-input" />
          )}
        </div>
      </div>

      {/* Questions by section */}
      {sections.map((section, si) => (
        <div key={si} className="space-y-4">
          {section.label && (
            <div className="pl-4 border-l-4 border-tps-orange">
              <h2 className="text-sm font-bold text-tps-navy">{section.label}</h2>
            </div>
          )}
          {section.questions.map((q) => (
            <div key={q.id} className="card border border-gray-200 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {q.label}{q.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  {q.description && <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>}
                </div>
                {answers[q.id] !== undefined && answers[q.id] !== '' && (
                  <span className="text-xs text-green-600 flex-shrink-0">✓</span>
                )}
              </div>

              {/* GRADE_1_8 */}
              {q.questionType === 'GRADE_1_8' && (
                <div className="grid grid-cols-8 gap-1">
                  {[1,2,3,4,5,6,7,8].map((val) => {
                    const selected = answers[q.id] === String(val)
                    return (
                      <button key={val} type="button"
                        onClick={() => setAnswer(q.id, String(val))}
                        className={cn(
                          'flex flex-col items-center justify-center rounded border min-h-[52px] transition-all active:scale-95',
                          selected
                            ? GRADE_BG[val] + ' ring-2 ring-offset-1 ring-tps-orange'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                        )}>
                        <span className="font-bold text-base leading-none">{val}</span>
                        {GRADE_ANCHORS[val] && <span className="text-[9px] leading-none mt-0.5 opacity-70">{GRADE_ANCHORS[val]}</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* NUMERIC */}
              {q.questionType === 'NUMERIC' && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{q.scaleMin ?? 1}</span>
                  <input type="range"
                    min={q.scaleMin ?? 1} max={q.scaleMax ?? 5} step={1}
                    value={answers[q.id] as string || String(q.scaleMin ?? 1)}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="flex-1 accent-tps-orange"
                  />
                  <span className="text-xs text-gray-400">{q.scaleMax ?? 5}</span>
                  <span className="text-sm font-bold text-tps-navy w-8 text-center">
                    {answers[q.id] ?? q.scaleMin ?? 1}
                  </span>
                </div>
              )}

              {/* MULTIPLE_CHOICE */}
              {q.questionType === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2">
                  {options(q).map((opt) => (
                    <label key={opt} className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      answers[q.id] === opt ? 'bg-blue-50 border-tps-orange' : 'border-gray-200 hover:bg-gray-50',
                    )}>
                      <input type="radio" name={`q_${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                        className="h-4 w-4 text-tps-orange border-gray-300" />
                      <span className="text-sm text-gray-800">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* CHECKBOX */}
              {q.questionType === 'CHECKBOX' && (
                <div className="space-y-2">
                  {options(q).map((opt) => {
                    const checked = ((answers[q.id] as string[] | undefined) ?? []).includes(opt)
                    return (
                      <label key={opt} className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        checked ? 'bg-blue-50 border-tps-orange' : 'border-gray-200 hover:bg-gray-50',
                      )}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(q.id, opt)}
                          className="h-4 w-4 text-tps-orange border-gray-300 rounded" />
                        <span className="text-sm text-gray-800">{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* TEXT */}
              {q.questionType === 'TEXT' && (
                <textarea rows={3}
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Your response…"
                  className="field-input resize-y text-sm"
                />
              )}

              {/* NUMBER */}
              {q.questionType === 'NUMBER' && (
                <input type="number"
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Enter a number"
                  className="field-input w-40"
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {typeof error === 'string' && error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="sticky bottom-4 pt-2">
        <button type="submit" disabled={pending || !allRequired}
          className={cn('btn w-full text-base py-4 shadow-lg',
            allRequired ? 'btn-primary' : 'bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed min-h-[44px]'
          )}>
          {pending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
