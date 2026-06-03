'use client'

import { useActionState, useState } from 'react'
import { submitSandboxAction } from './actions'
import { cn } from '@/lib/utils'
import { GRADE_LABELS } from '@/lib/constants'
import type { RepeatEntry, RepeatingSectionConfig } from '@/lib/sandbox-scoring'

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
  form:           { id: string; mode: string; subjectEntry: string; graderEntry: string; predefinedSubjects: unknown; scoringEnabled: boolean }
  questions:      Question[]
  staffMembers:   { id: string; name: string }[]
  slug:           string
  initialAnswers: Record<string, unknown>
  editId:         string | null
}

export function SandboxSubmitForm({ form, questions, staffMembers, slug, initialAnswers, editId }: Props) {
  const [error, formAction, pending] = useActionState(submitSandboxAction, null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    // Convert initialAnswers to the right types for pre-population
    Object.fromEntries(
      Object.entries(initialAnswers).map(([k, v]) => [k, Array.isArray(v) ? v as string[] : String(v ?? '')])
    )
  )
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
      {editId && <input type="hidden" name="editId" value={editId} />}

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

              {/* REPEATING_SECTION — renders inline per-person grading */}
              {q.questionType === 'REPEATING_SECTION' && (
                <RepeatingSectionInput
                  q={q}
                  predefinedSubjects={predefined}
                  answers={answers}
                  setAnswer={setAnswer}
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
          {pending ? 'Submitting…' : editId ? 'Save Changes' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

// ── Repeating Section Input ────────────────────────────────────────────────────

function RepeatingSectionInput({
  q, predefinedSubjects, answers, setAnswer,
}: {
  q: Question
  predefinedSubjects: string[]
  answers: Record<string, string | string[]>
  setAnswer: (qId: string, val: string) => void
}) {
  const config = q.options as unknown as RepeatingSectionConfig | null
  const subQs  = config?.subQuestions ?? []
  // Section-level list takes precedence over form-level predefined subjects
  const effectiveSubjects = (config?.predefinedList && config.predefinedList.length > 0)
    ? config.predefinedList
    : predefinedSubjects

  // Parse current entries from answers state
  let entries: RepeatEntry[] = []
  try {
    const raw = answers[q.id]
    if (raw && typeof raw === 'string') entries = JSON.parse(raw)
  } catch { /* start fresh */ }

  const setEntries = (next: RepeatEntry[]) => setAnswer(q.id, JSON.stringify(next))

  const addEntry = (subject = '') => setEntries([...entries, { subject }])
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i))
  const updateEntry = (i: number, field: string, val: string) =>
    setEntries(entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e))

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-tps-orange font-medium">
        Grade each person individually below
      </div>

      {/* Pre-defined subject list: render all at once */}
      {config?.subjectSource === 'predefined' && effectiveSubjects.length > 0 ? (
        effectiveSubjects.map((subject, si) => {
          const entry = entries.find((e) => e.subject === subject) ?? { subject }
          const entryIdx = entries.findIndex((e) => e.subject === subject)
          const handleEntry = (field: string, val: string) => {
            if (entryIdx >= 0) updateEntry(entryIdx, field, val)
            else setEntries([...entries, { subject, [field]: val }])
          }
          return (
            <div key={si} className="card border border-orange-100 space-y-3">
              <p className="font-semibold text-sm text-tps-navy">{subject}</p>
              {subQs.map((sq) => (
                <GradeSubQuestion key={sq.id} sq={sq} value={entry[sq.id] ?? ''}
                  onChange={(v) => handleEntry(sq.id, v)} />
              ))}
            </div>
          )
        })
      ) : (
        /* Free-text: grader adds people */
        <>
          {entries.map((entry, ei) => (
            <div key={ei} className="card border border-orange-100 space-y-3">
              <div className="flex gap-2 items-center">
                <input
                  value={entry.subject}
                  onChange={(e) => updateEntry(ei, 'subject', e.target.value)}
                  placeholder="Person's name"
                  className="field-input flex-1 text-sm font-medium"
                />
                <button onClick={() => removeEntry(ei)} className="text-red-400 hover:text-red-600 min-h-[44px] px-2">×</button>
              </div>
              {subQs.map((sq) => (
                <GradeSubQuestion key={sq.id} sq={sq} value={entry[sq.id] ?? ''}
                  onChange={(v) => updateEntry(ei, sq.id, v)} />
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addEntry()}
            className="w-full border-2 border-dashed border-orange-200 rounded-xl py-3 text-sm text-orange-400 hover:border-tps-orange hover:text-tps-orange transition-colors"
          >
            + Add person to grade
          </button>
        </>
      )}
    </div>
  )
}

function GradeSubQuestion({
  sq, value, onChange,
}: {
  sq: { id: string; label: string; type: string }
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="field-label text-xs">{sq.label}</label>
      {sq.type === 'GRADE_1_8' && (
        <div className="grid grid-cols-8 gap-1">
          {[1,2,3,4,5,6,7,8].map((v) => {
            const selected = value === String(v)
            const colors: Record<number, string> = {
              1:'bg-emerald-600 text-white', 2:'bg-emerald-500 text-white',
              3:'bg-green-400 text-gray-900', 4:'bg-gray-200 text-gray-800',
              5:'bg-amber-200 text-gray-800', 6:'bg-orange-300 text-gray-900',
              7:'bg-orange-400 text-white',   8:'bg-red-500 text-white',
            }
            return (
              <button key={v} type="button" onClick={() => onChange(String(v))}
                className={cn(
                  'rounded border min-h-[44px] text-sm font-bold transition-all active:scale-95',
                  selected ? colors[v] + ' ring-2 ring-offset-1 ring-tps-orange' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                )}>
                {v}
              </button>
            )
          })}
        </div>
      )}
      {sq.type === 'TEXT' && (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)}
          className="field-input resize-y text-sm" placeholder="Response…" />
      )}
      {(sq.type === 'NUMERIC' || sq.type === 'NUMBER') && (
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
          className="field-input w-24" />
      )}
      {sq.type === 'MULTIPLE_CHOICE' && (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field-input text-sm" placeholder="Enter response" />
      )}
    </div>
  )
}
