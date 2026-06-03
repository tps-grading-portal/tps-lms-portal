'use client'

import { useState } from 'react'
import { saveFormAction, resetCreatorPinAction } from './actions'
import { autoLinearPointMap } from '@/lib/sandbox-scoring'
import { cn } from '@/lib/utils'

type QType = 'GRADE_1_8' | 'NUMERIC' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'TEXT' | 'NUMBER'

interface QuestionDraft {
  id?:          string   // undefined = new question
  questionType: QType
  label:        string
  description:  string
  sectionLabel: string
  options:      string   // comma-separated for MC/checkbox
  scaleMin:     string
  scaleMax:     string
  pointMap:     Record<string, number>
  usePointMap:  boolean  // show point map editor
  weight:       string   // percentage string e.g. "20"
  isRequired:   boolean
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
  submitSlug:         string
  resultsSlug:        string
  samePinWarning:     boolean
  questions: {
    id: string; label: string; description: string | null; questionType: string;
    sectionLabel: string | null; options: unknown; scaleMin: number | null;
    scaleMax: number | null; pointMap: unknown; weight: number | null; isRequired: boolean; sortOrder: number
  }[]
}

interface Props {
  token:        string
  existingForm: ExistingForm | null
  staffMembers: { id: string; name: string }[]
  baseUrl:      string
}

const Q_TYPE_LABELS: Record<QType, string> = {
  GRADE_1_8:       '1-8 Grade Scale (TPS standard)',
  NUMERIC:         'Numeric Scale (custom range)',
  MULTIPLE_CHOICE: 'Multiple Choice (single answer)',
  CHECKBOX:        'Checkboxes (multiple answers)',
  TEXT:            'Free Text',
  NUMBER:          'Number Entry',
}

const emptyQuestion = (): QuestionDraft => ({
  questionType: 'GRADE_1_8',
  label:        '',
  description:  '',
  sectionLabel: '',
  options:      '',
  scaleMin:     '1',
  scaleMax:     '5',
  pointMap:     autoLinearPointMap(1, 5),
  usePointMap:  false,
  weight:       '',
  isRequired:   true,
})

function formToQuestions(form: ExistingForm): QuestionDraft[] {
  return form.questions.map((q) => ({
    id:           q.id,
    questionType: q.questionType as QType,
    label:        q.label,
    description:  q.description ?? '',
    sectionLabel: q.sectionLabel ?? '',
    options:      Array.isArray(q.options) ? (q.options as string[]).join(', ') : '',
    scaleMin:     String(q.scaleMin ?? 1),
    scaleMax:     String(q.scaleMax ?? 5),
    pointMap:     (q.pointMap as Record<string, number>) ?? autoLinearPointMap(q.scaleMin ?? 1, q.scaleMax ?? 5),
    usePointMap:  q.questionType === 'NUMERIC' || q.questionType === 'NUMBER',
    weight:       q.weight !== null ? String(Math.round(q.weight * 100)) : '',
    isRequired:   q.isRequired,
  }))
}

export function FormBuilder({ token, existingForm, staffMembers, baseUrl }: Props) {
  const [title,        setTitle]        = useState(existingForm?.title ?? '')
  const [description,  setDescription]  = useState(existingForm?.description ?? '')
  const [mode,         setMode]         = useState(existingForm?.mode ?? 'SURVEY')
  const [subjectEntry, setSubjectEntry] = useState(existingForm?.subjectEntry ?? 'FREE_TEXT')
  const [graderEntry,  setGraderEntry]  = useState(existingForm?.graderEntry ?? 'FREE_TEXT')
  const [predefined,   setPredefined]   = useState(
    Array.isArray(existingForm?.predefinedSubjects) ? (existingForm.predefinedSubjects as string[]).join('\n') : ''
  )
  const [scoring,      setScoring]      = useState(existingForm?.scoringEnabled ?? false)
  const [submitPin,    setSubmitPin]    = useState('')
  const [resultsPin,   setResultsPin]   = useState('')
  const [questions,    setQuestions]    = useState<QuestionDraft[]>(
    existingForm ? formToQuestions(existingForm) : []
  )
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState<{ submitSlug: string; resultsSlug: string } | null>(
    existingForm ? { submitSlug: existingForm.submitSlug, resultsSlug: existingForm.resultsSlug } : null
  )
  const [error,        setError]        = useState('')
  const [pinResult,    setPinResult]    = useState<{ type: string; pin: string } | null>(null)

  const totalWeight = questions.reduce((s, q) => s + (parseFloat(q.weight) || 0), 0)
  const weightsOk   = !scoring || Math.abs(totalWeight - 100) < 0.5

  const addQuestion = () => setQuestions((qs) => [...qs, emptyQuestion()])
  const removeQ     = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i))
  const moveQ       = (i: number, dir: -1 | 1) => {
    setQuestions((qs) => {
      const next = [...qs]
      const j = i + dir
      if (j < 0 || j >= next.length) return qs
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  const updateQ = (i: number, patch: Partial<QuestionDraft>) =>
    setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q))

  const handleSave = async () => {
    if (!title.trim()) { setError('Form title is required.'); return }
    if (!existingForm && (!submitPin || !resultsPin)) { setError('Set PINs for both submission and results.'); return }
    if (!weightsOk) { setError('Scoring weights must sum to 100%.'); return }

    setSaving(true)
    setError('')

    const payload = {
      token,
      title,
      description,
      mode,
      subjectEntry,
      graderEntry,
      predefinedSubjects: predefined.split('\n').map((s) => s.trim()).filter(Boolean),
      scoringEnabled: scoring,
      submitPin:  submitPin  || undefined,
      resultsPin: resultsPin || undefined,
      questions: questions.map((q, i) => ({
        id:           q.id,
        questionType: q.questionType,
        label:        q.label,
        description:  q.description || null,
        sectionLabel: q.sectionLabel || null,
        options:      ['MULTIPLE_CHOICE', 'CHECKBOX'].includes(q.questionType)
          ? q.options.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        scaleMin:     ['NUMERIC', 'NUMBER'].includes(q.questionType) ? parseInt(q.scaleMin) : null,
        scaleMax:     ['NUMERIC', 'NUMBER'].includes(q.questionType) ? parseInt(q.scaleMax) : null,
        pointMap:     q.usePointMap ? q.pointMap : null,
        weight:       scoring && q.weight ? parseFloat(q.weight) / 100 : null,
        isRequired:   q.isRequired,
        sortOrder:    i,
      })),
    }

    const result = await saveFormAction(payload)
    setSaving(false)

    if ('error' in result) {
      setError(result.error)
    } else {
      setSaved({ submitSlug: result.submitSlug, resultsSlug: result.resultsSlug })
    }
  }

  const handlePinReset = async (type: 'submit' | 'results', pin: string) => {
    const result = await resetCreatorPinAction(token, type, pin)
    if ('success' in result) setPinResult({ type, pin: result.newPin })
  }

  return (
    <div className="space-y-8">
      {/* Published status */}
      {saved && (
        <div className="card border border-green-300 bg-green-50 space-y-3">
          <p className="font-semibold text-green-800">✓ Form is live</p>
          {[
            { label: 'Submission URL', url: `${baseUrl}/sandbox/${saved.submitSlug}/submit` },
            { label: 'Results URL',    url: `${baseUrl}/sandbox/${saved.resultsSlug}/results` },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}:</span>
              <code className="text-xs text-gray-700 break-all flex-1">{url}</code>
              <button onClick={() => navigator.clipboard.writeText(url)} className="text-xs text-tps-orange hover:underline flex-shrink-0">Copy</button>
            </div>
          ))}
          {pinResult && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              New {pinResult.type} PIN: <strong className="font-mono">{pinResult.pin}</strong> — share this with your {pinResult.type === 'submit' ? 'graders' : 'results viewers'}
            </p>
          )}
        </div>
      )}

      {/* Form settings */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-gray-800">Form Settings</h2>
        <div>
          <label className="field-label">Form Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mission Systems Evaluation" className="field-input" />
        </div>
        <div>
          <label className="field-label">Description (shown on submission form)</label>
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
                <option value="FREE_TEXT">Free text (grader types subject name)</option>
                <option value="PREDEFINED_LIST">Pre-defined list (admin sets names)</option>
              </select>
            </div>
          )}
          <div>
            <label className="field-label">Grader Name Entry</label>
            <select value={graderEntry} onChange={(e) => setGraderEntry(e.target.value)} className="field-select">
              <option value="FREE_TEXT">Free text</option>
              <option value="STAFF_LIST">Staff member list</option>
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
          <label htmlFor="scoring" className="text-sm text-gray-700">Enable weighted scoring (calculates a total score per submission)</label>
        </div>
      </section>

      {/* Access PINs (only shown for new forms) */}
      {!existingForm && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-800">Access PINs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Submission PIN *</label>
              <input value={submitPin} onChange={(e) => setSubmitPin(e.target.value)}
                type="text" inputMode="numeric" placeholder="4-20 chars" className="field-input font-mono tracking-widest" />
              <p className="text-xs text-gray-400 mt-1">Share with graders/respondents</p>
            </div>
            <div>
              <label className="field-label">Results PIN *</label>
              <input value={resultsPin} onChange={(e) => setResultsPin(e.target.value)}
                type="text" inputMode="numeric" placeholder="4-20 chars" className="field-input font-mono tracking-widest" />
              <p className="text-xs text-gray-400 mt-1">Share with results viewers</p>
            </div>
          </div>
          {submitPin && resultsPin && submitPin === resultsPin && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ Same PIN for both — anyone with the submission PIN can also access results.
            </p>
          )}
        </section>
      )}

      {/* PIN reset for existing forms */}
      {existingForm && saved && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-gray-800">Rotate PINs</h2>
          {(['submit', 'results'] as const).map((type) => (
            <PinRotator key={type} label={type === 'submit' ? 'Submission PIN' : 'Results PIN'} onSave={(pin) => handlePinReset(type, pin)} />
          ))}
        </section>
      )}

      {/* Questions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Questions ({questions.length})
            {scoring && (
              <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full',
                weightsOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                Weight total: {totalWeight.toFixed(0)}% {weightsOk ? '✓' : '⚠ must equal 100%'}
              </span>
            )}
          </h2>
          <button onClick={addQuestion} className="btn-primary text-sm">+ Add Question</button>
        </div>

        {questions.length === 0 && (
          <div className="card border border-dashed border-gray-300 text-center py-8 text-gray-400">
            No questions yet. Click &quot;Add Question&quot; to start.
          </div>
        )}

        {questions.map((q, i) => (
          <QuestionEditor
            key={i}
            q={q}
            index={i}
            total={questions.length}
            scoring={scoring}
            onChange={(patch) => updateQ(i, patch)}
            onRemove={() => removeQ(i)}
            onMove={(dir) => moveQ(i, dir)}
          />
        ))}
      </section>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="sticky bottom-4">
        <button onClick={handleSave} disabled={saving || !weightsOk} className="btn-primary w-full text-base py-4 shadow-lg">
          {saving ? 'Saving…' : existingForm ? 'Save Changes' : 'Publish Form'}
        </button>
      </div>
    </div>
  )
}

// ── Question editor card ──────────────────────────────────────────────────────

function QuestionEditor({
  q, index, total, scoring, onChange, onRemove, onMove,
}: {
  q:        QuestionDraft
  index:    number
  total:    number
  scoring:  boolean
  onChange: (p: Partial<QuestionDraft>) => void
  onRemove: () => void
  onMove:   (d: -1 | 1) => void
}) {
  const showOptions   = q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'CHECKBOX'
  const showScale     = q.questionType === 'NUMERIC' || q.questionType === 'NUMBER'
  const showPointMap  = showScale

  const regenerateMap = () => {
    const min = parseInt(q.scaleMin) || 1
    const max = parseInt(q.scaleMax) || 5
    onChange({ pointMap: autoLinearPointMap(min, max) })
  }

  return (
    <div className="card border border-gray-200 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 font-mono">Q{index + 1}</span>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => onMove(-1)} disabled={index === 0}       className="btn-ghost text-xs px-2 py-1 min-h-0">↑</button>
          <button onClick={() => onMove(1)}  disabled={index === total - 1} className="btn-ghost text-xs px-2 py-1 min-h-0">↓</button>
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 min-h-0">Remove</button>
        </div>
      </div>

      {/* Optional section label */}
      <input
        value={q.sectionLabel}
        onChange={(e) => onChange({ sectionLabel: e.target.value })}
        placeholder="Section header (optional, e.g. 'Risk Factors')"
        className="field-input text-xs text-gray-500"
      />

      {/* Question type */}
      <select value={q.questionType} onChange={(e) => onChange({ questionType: e.target.value as QType })} className="field-select text-sm">
        {Object.entries(Q_TYPE_LABELS).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>

      {/* Label */}
      <div>
        <label className="field-label text-xs">Question Text *</label>
        <input value={q.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Rate the scope risk" className="field-input" />
      </div>

      {/* Description */}
      <input value={q.description} onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Helper text shown below the question (optional)" className="field-input text-sm text-gray-500" />

      {/* Options for MC/Checkbox */}
      {showOptions && (
        <div>
          <label className="field-label text-xs">Options (comma-separated)</label>
          <input value={q.options} onChange={(e) => onChange({ options: e.target.value })}
            placeholder="Option A, Option B, Option C" className="field-input text-sm" />
        </div>
      )}

      {/* Scale for NUMERIC */}
      {showScale && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label text-xs">Min value</label>
            <input type="number" value={q.scaleMin} onChange={(e) => { onChange({ scaleMin: e.target.value }); }}
              className="field-input" />
          </div>
          <div>
            <label className="field-label text-xs">Max value</label>
            <input type="number" value={q.scaleMax} onChange={(e) => { onChange({ scaleMax: e.target.value }); }}
              className="field-input" />
          </div>
          <div className="col-span-2">
            <button onClick={regenerateMap} className="btn-secondary text-xs">
              Auto-generate point map ({q.scaleMin}→0 to {q.scaleMax}→100, linear)
            </button>
          </div>
        </div>
      )}

      {/* Point map override */}
      {showPointMap && Object.keys(q.pointMap).length > 0 && (
        <div>
          <label className="field-label text-xs">Point Map (value → points, override if needed)</label>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(q.pointMap).sort(([a], [b]) => Number(a) - Number(b)).map(([val, pts]) => (
              <div key={val} className="flex items-center gap-1">
                <span className="text-xs text-gray-500 w-5">{val}→</span>
                <input
                  type="number"
                  value={pts}
                  onChange={(e) => onChange({ pointMap: { ...q.pointMap, [val]: parseFloat(e.target.value) || 0 } })}
                  className="field-input text-xs text-center p-1 font-mono"
                  min={0} max={100}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Required + Weight */}
      <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-gray-100">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={q.isRequired} onChange={(e) => onChange({ isRequired: e.target.checked })} className="h-3 w-3" />
          Required
        </label>
        {scoring && ['GRADE_1_8', 'NUMERIC', 'NUMBER'].includes(q.questionType) && (
          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-xs text-gray-500">Weight:</label>
            <input
              type="number" value={q.weight} onChange={(e) => onChange({ weight: e.target.value })}
              placeholder="0" min={0} max={100} step={1}
              className="field-input w-16 text-center text-sm font-mono"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PinRotator({ label, onSave }: { label: string; onSave: (pin: string) => void }) {
  const [pin,      setPin]      = useState('')
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-32">{label}</span>
      {expanded ? (
        <>
          <input value={pin} onChange={(e) => setPin(e.target.value)}
            type="text" inputMode="numeric" placeholder="New PIN"
            className="field-input font-mono tracking-widest w-32 text-sm" maxLength={20} />
          <button onClick={() => { onSave(pin); setExpanded(false); setPin('') }} className="btn-primary text-xs">Set</button>
          <button onClick={() => setExpanded(false)} className="btn-ghost text-xs">Cancel</button>
        </>
      ) : (
        <button onClick={() => setExpanded(true)} className="btn-secondary text-xs">Rotate</button>
      )}
    </div>
  )
}
