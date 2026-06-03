'use client'

/**
 * Admin form builder — wraps the same FormBuilder UI used by creators,
 * but saves via an admin-auth server action instead of creator-PIN auth.
 */

import { useState } from 'react'
import { adminSaveFormAction } from './actions'
import { autoLinearPointMap } from '@/lib/sandbox-scoring'
import { ImportWizard } from './import-wizard'
import type { ExtractedQuestion } from '@/lib/sandbox-question-extractor'
import { cn } from '@/lib/utils'

type QType = 'GRADE_1_8' | 'NUMERIC' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'REPEATING_SECTION'

interface SubQuestionDraft {
  id:        string
  label:     string
  type:      string
  subWeight: string  // percentage within section
}

interface QuestionDraft {
  id?:           string
  questionType:  QType
  label:         string
  description:   string
  sectionLabel:  string
  options:       string
  scaleMin:      string
  scaleMax:      string
  pointMap:      Record<string, number>
  weight:        string
  isRequired:    boolean
  // Repeating section only:
  subQuestions:  SubQuestionDraft[]
  subjectSource: 'freetext' | 'predefined'
}

interface ExistingForm {
  id:                 string
  title:              string
  description:        string | null
  mode:               string
  subjectEntry:       string
  graderEntry:        string
  predefinedSubjects: unknown
  scoringEnabled:     boolean
  questions: {
    id: string; label: string; description: string | null; questionType: string;
    sectionLabel: string | null; options: unknown; scaleMin: number | null;
    scaleMax: number | null; pointMap: unknown; weight: number | null; isRequired: boolean; sortOrder: number
  }[]
}

const Q_TYPE_LABELS: Record<QType, string> = {
  GRADE_1_8:         '1-8 Grade Scale (TPS standard)',
  NUMERIC:           'Numeric Scale (custom range)',
  MULTIPLE_CHOICE:   'Multiple Choice (single answer)',
  CHECKBOX:          'Checkboxes (multiple answers)',
  TEXT:              'Free Text',
  NUMBER:            'Number Entry',
  REPEATING_SECTION: '🔄 Repeating Section (group + individual)',
}

const emptyQuestion = (): QuestionDraft => ({
  questionType: 'GRADE_1_8', label: '', description: '', sectionLabel: '',
  options: '', scaleMin: '1', scaleMax: '5',
  pointMap: autoLinearPointMap(1, 5), weight: '', isRequired: true,
  subQuestions: [], subjectSource: 'freetext',
})

const emptyRepeatSection = (): QuestionDraft => ({
  questionType: 'REPEATING_SECTION',
  label: 'Individual Scores',
  description: 'Grade each person individually.',
  sectionLabel: '', options: '', scaleMin: '1', scaleMax: '8',
  pointMap: {}, weight: '20', isRequired: true,
  subjectSource: 'freetext',
  subQuestions: [{ id: `sq_${Date.now()}`, label: 'Individual Score', type: 'GRADE_1_8', subWeight: '100' }],
})

function toQuestionDrafts(form: ExistingForm): QuestionDraft[] {
  return form.questions.map((q) => {
    const opts = q.options as { subQuestions?: SubQuestionDraft[]; subjectSource?: string } | null
    return {
    id:           q.id,
    questionType: q.questionType as QType,
    label:        q.label,
    description:  q.description ?? '',
    sectionLabel: q.sectionLabel ?? '',
    options:      q.questionType === 'REPEATING_SECTION' ? '' : (Array.isArray(q.options) ? (q.options as string[]).join(', ') : ''),
    scaleMin:     String(q.scaleMin ?? 1),
    scaleMax:     String(q.scaleMax ?? 5),
    pointMap:     (q.pointMap as Record<string, number>) ?? autoLinearPointMap(q.scaleMin ?? 1, q.scaleMax ?? 5),
    weight:       q.weight !== null ? String(Math.round(q.weight * 100)) : '',
    isRequired:   q.isRequired,
    subQuestions: opts?.subQuestions ?? [],
    subjectSource: (opts?.subjectSource as 'freetext' | 'predefined') ?? 'freetext',
  }
  })
}

interface Props {
  form:         ExistingForm
  staffMembers: { id: string; name: string }[]
}

export function AdminFormBuilder({ form, staffMembers }: Props) {
  const [title,        setTitle]        = useState(form.title)
  const [description,  setDescription]  = useState(form.description ?? '')
  const [mode,         setMode]         = useState(form.mode)
  const [subjectEntry, setSubjectEntry] = useState(form.subjectEntry)
  const [graderEntry,  setGraderEntry]  = useState(form.graderEntry)
  const [predefined,   setPredefined]   = useState(
    Array.isArray(form.predefinedSubjects) ? (form.predefinedSubjects as string[]).join('\n') : ''
  )
  const [scoring,      setScoring]      = useState(form.scoringEnabled)
  const [submitPin,    setSubmitPin]    = useState('')
  const [resultsPin,   setResultsPin]   = useState('')
  const [questions,    setQuestions]    = useState<QuestionDraft[]>(toQuestionDrafts(form))
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(form.questions.length > 0)
  const [error,        setError]        = useState('')
  const [pinResult,    setPinResult]    = useState<string | null>(null)
  const [showWizard,   setShowWizard]   = useState(false)

  const totalWeight = questions.reduce((s, q) => s + (parseFloat(q.weight) || 0), 0)
  const weightsOk   = !scoring || Math.abs(totalWeight - 100) < 0.5

  const addQ           = () => setQuestions((qs) => [...qs, emptyQuestion()])
  const addRepeatBlock = () => setQuestions((qs) => [...qs, emptyRepeatSection()])

  const handleWizardImport = (extracted: ExtractedQuestion[]) => {
    const newQs: QuestionDraft[] = extracted.map((eq) => ({
      questionType:  eq.questionType as QType,
      label:         eq.label,
      description:   '',
      sectionLabel:  eq.sectionLabel ?? '',
      options:       Array.isArray(eq.options) ? eq.options.join(', ') : '',
      scaleMin:      String(eq.scaleMin ?? 1),
      scaleMax:      String(eq.scaleMax ?? 5),
      pointMap:      (eq.scaleMin !== null && eq.scaleMax !== null)
        ? autoLinearPointMap(eq.scaleMin, eq.scaleMax)
        : {},
      weight:        '',
      isRequired:    true,
      subQuestions:  [],
      subjectSource: 'freetext' as const,
    }))
    setQuestions((qs) => [...qs, ...newQs])
    setSaved(false)
  }
  const removeQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i))
  const moveQ   = (i: number, dir: -1 | 1) => setQuestions((qs) => {
    const next = [...qs]; const j = i + dir
    if (j < 0 || j >= next.length) return qs
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const updateQ = (i: number, patch: Partial<QuestionDraft>) =>
    setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q))

  const handleSave = async () => {
    if (!title.trim())   { setError('Form title is required.'); return }
    if (!weightsOk)      { setError('Scoring weights must sum to 100%.'); return }
    setSaving(true); setError('')

    const result = await adminSaveFormAction({
      formId:             form.id,
      title, description, mode, subjectEntry, graderEntry, scoringEnabled: scoring,
      predefinedSubjects: predefined.split('\n').map((s) => s.trim()).filter(Boolean),
      submitPin:  submitPin  || undefined,
      resultsPin: resultsPin || undefined,
      questions: questions.map((q, i) => ({
        id:           q.id,
        questionType: q.questionType,
        label:        q.label,
        description:  q.description || null,
        sectionLabel: q.sectionLabel || null,
        // REPEATING_SECTION: store config in options JSON
        options: q.questionType === 'REPEATING_SECTION'
          ? {
              subQuestions: q.subQuestions.map((sq) => ({
                id: sq.id, label: sq.label, type: sq.type,
                subWeight: parseFloat(sq.subWeight) / 100 || 1,
              })),
              subjectSource: q.subjectSource,
            }
          : ['MULTIPLE_CHOICE', 'CHECKBOX'].includes(q.questionType)
            ? q.options.split(',').map((s) => s.trim()).filter(Boolean)
            : null,
        scaleMin:     ['NUMERIC', 'NUMBER'].includes(q.questionType) ? parseInt(q.scaleMin) : null,
        scaleMax:     ['NUMERIC', 'NUMBER'].includes(q.questionType) ? parseInt(q.scaleMax) : null,
        pointMap:     q.questionType === 'NUMERIC' ? q.pointMap : null,
        weight:       scoring && q.weight ? parseFloat(q.weight) / 100 : null,
        isRequired:   q.isRequired,
        sortOrder:    i,
      })),
    })

    setSaving(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(true)
    if (submitPin || resultsPin) {
      setPinResult(`PINs updated${submitPin && resultsPin ? '' : submitPin ? ' (submit PIN)' : ' (results PIN)'}.`)
      setSubmitPin(''); setResultsPin('')
    }
  }

  return (
    <div className="space-y-8">
      {saved && (
        <div className="card border border-green-200 bg-green-50 text-sm text-green-800 flex items-center justify-between gap-3">
          <span>✓ Form saved — {questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          {pinResult && <span className="text-xs text-amber-700">{pinResult}</span>}
        </div>
      )}

      {/* Settings */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-gray-800">Form Settings</h2>
        <div>
          <label className="field-label">Form Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
        </div>
        <div>
          <label className="field-label">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="field-input resize-y" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="field-select">
              <option value="SURVEY">Survey — respondents answer for themselves</option>
              <option value="GRADER">Grader — evaluators rate a named subject</option>
            </select>
          </div>
          {mode === 'GRADER' && (
            <div>
              <label className="field-label">Subject Name Entry</label>
              <select value={subjectEntry} onChange={(e) => setSubjectEntry(e.target.value)} className="field-select">
                <option value="FREE_TEXT">Free text</option>
                <option value="PREDEFINED_LIST">Pre-defined list</option>
              </select>
            </div>
          )}
          <div>
            <label className="field-label">Grader Name Entry</label>
            <select value={graderEntry} onChange={(e) => setGraderEntry(e.target.value)} className="field-select">
              <option value="FREE_TEXT">Free text</option>
              <option value="STAFF_LIST">Staff member list ({staffMembers.length} members)</option>
            </select>
          </div>
        </div>
        {mode === 'GRADER' && subjectEntry === 'PREDEFINED_LIST' && (
          <div>
            <label className="field-label">Subject Names (one per line)</label>
            <textarea value={predefined} onChange={(e) => setPredefined(e.target.value)} rows={4}
              placeholder="Group Alpha&#10;Group Bravo&#10;Group Charlie" className="field-input resize-y font-mono text-sm" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input id="scoring" type="checkbox" checked={scoring} onChange={(e) => setScoring(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-tps-orange" />
          <label htmlFor="scoring" className="text-sm text-gray-700">Enable weighted scoring</label>
        </div>
      </section>

      {/* PIN rotation */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-gray-800">Access PINs</h2>
        <p className="text-sm text-gray-500">Leave blank to keep current PINs. Enter a new value to update.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Submission PIN (new)</label>
            <input value={submitPin} onChange={(e) => setSubmitPin(e.target.value)}
              type="text" inputMode="numeric" placeholder="Leave blank to keep current"
              className="field-input font-mono tracking-widest" />
          </div>
          <div>
            <label className="field-label">Results PIN (new)</label>
            <input value={resultsPin} onChange={(e) => setResultsPin(e.target.value)}
              type="text" inputMode="numeric" placeholder="Leave blank to keep current"
              className="field-input font-mono tracking-widest" />
          </div>
        </div>
        {submitPin && resultsPin && submitPin === resultsPin && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ Same PIN for both — anyone with the submission PIN can also access results.
          </p>
        )}
      </section>

      {/* Questions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between sticky top-14 z-10 bg-gray-50 py-2 -mx-4 px-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            Questions ({questions.length})
            {scoring && (
              <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full',
                weightsOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                Weights: {totalWeight.toFixed(0)}% {weightsOk ? '✓' : '⚠ must equal 100%'}
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowWizard(true)} className="btn-secondary text-xs">📄 Import from File</button>
            <button onClick={addQ} className="btn-primary text-sm">+ Add Question</button>
          </div>
        </div>

        {questions.length === 0 && (
          <div className="card border border-dashed border-gray-300 text-center py-8 text-gray-400 space-y-2">
            <p>No questions yet.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowWizard(true)} className="btn-secondary text-sm">📄 Import from File</button>
              <button onClick={addQ} className="btn-primary text-sm">+ Add Question</button>
            </div>
          </div>
        )}

        {questions.map((q, i) => (
          <div key={i} className={cn('card border space-y-3',
            q.questionType === 'REPEATING_SECTION' ? 'border-tps-orange bg-orange-50' : 'border-gray-200'
          )}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono">
                {q.questionType === 'REPEATING_SECTION'
                  ? <span className="text-tps-orange font-semibold">🔄 Repeating Section</span>
                  : <span className="text-gray-400">Q{i + 1}</span>
                }
              </span>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => moveQ(i, -1)} disabled={i === 0}          className="btn-ghost text-xs px-2 py-1 min-h-0">↑</button>
                <button onClick={() => moveQ(i, 1)}  disabled={i === questions.length - 1} className="btn-ghost text-xs px-2 py-1 min-h-0">↓</button>
                <button onClick={() => removeQ(i)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 min-h-0">Remove</button>
              </div>
            </div>

            {/* ── Repeating Section editor ──────────────────────────────────── */}
            {q.questionType === 'REPEATING_SECTION' ? (
              <RepeatingSectionEditor
                q={q}
                scoring={scoring}
                onChange={(patch) => updateQ(i, patch)}
              />
            ) : (
              <>
            <input value={q.sectionLabel} onChange={(e) => updateQ(i, { sectionLabel: e.target.value })}
              placeholder="Section header (optional)" className="field-input text-xs text-gray-500" />

            <select value={q.questionType} onChange={(e) => updateQ(i, { questionType: e.target.value as QType })} className="field-select text-sm">
              {Object.entries(Q_TYPE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>

            <input value={q.label} onChange={(e) => updateQ(i, { label: e.target.value })}
              placeholder="Question text *" className="field-input" />

            <input value={q.description} onChange={(e) => updateQ(i, { description: e.target.value })}
              placeholder="Helper text (optional)" className="field-input text-sm text-gray-500" />

            {(q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'CHECKBOX') && (
              <div>
                <label className="field-label text-xs">Options (comma-separated)</label>
                <input value={q.options} onChange={(e) => updateQ(i, { options: e.target.value })}
                  placeholder="Option A, Option B, Option C" className="field-input text-sm" />
              </div>
            )}

            {(q.questionType === 'NUMERIC' || q.questionType === 'NUMBER') && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label text-xs">Min value</label>
                    <input type="number" value={q.scaleMin} onChange={(e) => updateQ(i, { scaleMin: e.target.value })} className="field-input" />
                  </div>
                  <div>
                    <label className="field-label text-xs">Max value</label>
                    <input type="number" value={q.scaleMax} onChange={(e) => updateQ(i, { scaleMax: e.target.value })} className="field-input" />
                  </div>
                </div>
                <button onClick={() => updateQ(i, { pointMap: autoLinearPointMap(parseInt(q.scaleMin)||1, parseInt(q.scaleMax)||5) })}
                  className="btn-secondary text-xs">
                  Auto-generate point map ({q.scaleMin}→0 to {q.scaleMax}→100)
                </button>
                {q.questionType === 'NUMERIC' && Object.keys(q.pointMap).length > 0 && (
                  <div>
                    <label className="field-label text-xs">Point Map (override if needed)</label>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {Object.entries(q.pointMap).sort(([a],[b])=>Number(a)-Number(b)).map(([val, pts]) => (
                        <div key={val} className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-5">{val}→</span>
                          <input type="number" value={pts}
                            onChange={(e) => updateQ(i, { pointMap: { ...q.pointMap, [val]: parseFloat(e.target.value)||0 } })}
                            className="field-input text-xs text-center p-1 font-mono" min={0} max={100} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-gray-100">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={q.isRequired} onChange={(e) => updateQ(i, { isRequired: e.target.checked })} className="h-3 w-3" />
                Required
              </label>
              {scoring && ['GRADE_1_8','NUMERIC','NUMBER'].includes(q.questionType) && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <label className="text-xs text-gray-500">Weight:</label>
                  <input type="number" value={q.weight} onChange={(e) => updateQ(i, { weight: e.target.value })}
                    placeholder="0" min={0} max={100} step={1} className="field-input w-16 text-center text-sm font-mono" />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              )}
            </div>
            </>
            )}
          </div>
        ))}

        {/* Bottom add buttons */}
        <div className="flex gap-2">
          <button onClick={addQ} className="flex-1 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-400 hover:border-tps-orange hover:text-tps-orange transition-colors">
            + Add question
          </button>
          <button onClick={addRepeatBlock} className="border-2 border-dashed border-orange-200 rounded-xl py-3 px-4 text-sm text-orange-300 hover:border-tps-orange hover:text-tps-orange transition-colors whitespace-nowrap"
            title="Add a repeating section for per-person grading">
            🔄 Add individual scores block
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">{error}</div>}

      <div className="sticky bottom-4">
        <button onClick={handleSave} disabled={saving || !weightsOk}
          className="btn-primary w-full text-base py-4 shadow-lg">
          {saving ? 'Saving…' : 'Save Form'}
        </button>
      </div>

      {/* Import wizard modal */}
      {showWizard && (
        <ImportWizard
          onImport={handleWizardImport}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}

// ── Repeating Section Editor ──────────────────────────────────────────────────

function RepeatingSectionEditor({
  q, scoring, onChange,
}: {
  q:        QuestionDraft
  scoring:  boolean
  onChange: (p: Partial<QuestionDraft>) => void
}) {
  const addSQ = () => onChange({
    subQuestions: [...q.subQuestions, { id: `sq_${Date.now()}`, label: '', type: 'GRADE_1_8', subWeight: '100' }],
  })
  const removeSQ = (idx: number) => onChange({ subQuestions: q.subQuestions.filter((_, i) => i !== idx) })
  const updateSQ = (idx: number, patch: Partial<SubQuestionDraft>) =>
    onChange({ subQuestions: q.subQuestions.map((sq, i) => i === idx ? { ...sq, ...patch } : sq) })

  return (
    <div className="space-y-3">
      <div className="bg-orange-100 rounded-lg px-3 py-2 text-xs text-tps-orange font-semibold">
        🔄 Repeating Section — grades one set of questions per person
      </div>
      <div>
        <label className="field-label text-xs">Section Label</label>
        <input value={q.label} onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Individual Briefing Skills" className="field-input" />
      </div>
      <div>
        <label className="field-label text-xs">Helper text (shown to grader)</label>
        <input value={q.description} onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Grade each person individually." className="field-input text-sm text-gray-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {scoring && (
          <div>
            <label className="field-label text-xs">Section Weight (% of total score)</label>
            <input type="number" value={q.weight} onChange={(e) => onChange({ weight: e.target.value })}
              min={0} max={100} className="field-input font-mono" placeholder="20" />
          </div>
        )}
        <div>
          <label className="field-label text-xs">Subject name entry</label>
          <select value={q.subjectSource} onChange={(e) => onChange({ subjectSource: e.target.value as 'freetext' | 'predefined' })}
            className="field-select text-sm">
            <option value="freetext">Grader types each person&apos;s name</option>
            <option value="predefined">From form&apos;s pre-defined subject list</option>
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="field-label text-xs mb-0">Questions repeated per person</label>
          <button onClick={addSQ} className="text-xs text-tps-orange hover:underline">+ Add sub-question</button>
        </div>
        <div className="space-y-2 border border-orange-200 rounded-lg p-3">
          {q.subQuestions.map((sq, idx) => (
            <div key={sq.id} className="flex gap-2 items-center">
              <input value={sq.label} onChange={(e) => updateSQ(idx, { label: e.target.value })}
                placeholder="e.g. Overall Briefing Skills" className="field-input text-sm flex-1" />
              <select value={sq.type} onChange={(e) => updateSQ(idx, { type: e.target.value })}
                className="field-select text-xs w-32 flex-shrink-0">
                <option value="GRADE_1_8">1-8 Scale</option>
                <option value="NUMERIC">Numeric</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="TEXT">Text</option>
              </select>
              {q.subQuestions.length > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="number" value={sq.subWeight} onChange={(e) => updateSQ(idx, { subWeight: e.target.value })}
                    min={0} max={100} className="field-input w-14 text-center text-xs font-mono" title="Weight within section (%)" />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
              )}
              <button onClick={() => removeSQ(idx)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">×</button>
            </div>
          ))}
          {q.subQuestions.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No sub-questions yet. Click &quot;Add sub-question&quot; above.</p>
          )}
        </div>
      </div>
    </div>
  )
}
