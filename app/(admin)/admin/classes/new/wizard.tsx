'use client'

import { useState } from 'react'
import { createClassWizardAction, getStudentCsvAction } from './actions'
import { updateSurveyQuestionAction, addSurveyQuestionAction, deleteSurveyQuestionAction } from './survey-actions'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Criterion = { id: string; code: string; name: string; weight: number; pillar: string; sortOrder: number }
type Scenario  = { id: string; number: number; label: string }
type Question  = { id: string; surveyType: string; questionText: string; sortOrder: number; isRequired: boolean; questionType: string; isActive: boolean }

interface Props {
  criteria:        Criterion[]
  scenarios:       Scenario[]
  surveyQuestions: Question[]
}

const STEPS = ['Basic Info', 'Criteria', 'Scenarios', 'Access PINs', 'Surveys', 'Confirm']

export function ClassCreationWizard({ criteria, scenarios, surveyQuestions: initialQuestions }: Props) {
  const [step,            setStep]            = useState(0)
  const [submitting,      setSubmitting]       = useState(false)
  const [result,          setResult]           = useState<Awaited<ReturnType<typeof createClassWizardAction>> | null>(null)
  const [csvDownloading,  setCsvDownloading]   = useState(false)
  const [questions,       setQuestions]        = useState(initialQuestions)

  // All form field values tracked in state — avoids DOM-hidden-input submission failures
  const [fields, setFields] = useState({
    name:      '',
    graderPin: '',
    chairPin:  '',
    makeActive: true,
  })

  const [trackCounts, setTrackCounts] = useState({
    PILOT: 0, RPA: 0, FTE: 0, OPERATOR: 0, CSO_WSO: 0, ABM: 0,
  })

  const TRACK_LABELS_DISPLAY: Record<string, string> = {
    PILOT:    'Pilot',
    RPA:      'RPA',
    FTE:      'FTE',
    OPERATOR: 'Operator (STC)',
    CSO_WSO:  'CSO/WSO',
    ABM:      'ABM',
  }

  const totalStudents = Object.values(trackCounts).reduce((a, b) => a + b, 0)

  const set = (key: keyof typeof fields, value: string | boolean) =>
    setFields((f) => ({ ...f, [key]: value }))

  const setTrack = (track: string, value: number) =>
    setTrackCounts((t) => ({ ...t, [track]: Math.max(0, value) }))

  const totalWeight  = criteria.reduce((s, c) => s + c.weight, 0)
  const weightsOk    = Math.abs(totalWeight - 1) < 0.001

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    const fd = new FormData()
    fd.set('name',      fields.name)
    fd.set('graderPin', fields.graderPin)
    fd.set('chairPin',  fields.chairPin)
    if (fields.makeActive) fd.set('makeActive', 'on')
    // Pass per-track counts
    Object.entries(trackCounts).forEach(([track, count]) => {
      fd.set(`track_${track}`, String(count))
    })
    const res = await createClassWizardAction(null, fd)
    setResult(res)
    setSubmitting(false)
  }

  const handleDownloadCsv = async () => {
    if (!result || !('success' in result) || !result.success) return
    setCsvDownloading(true)
    const csv = await getStudentCsvAction(result.classId)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${result.className}-student-numbers.csv`; a.click()
    URL.revokeObjectURL(url)
    setCsvDownloading(false)
  }

  // ── Survey question inline editing ────────────────────────────────────────
  const [editingQId,   setEditingQId]   = useState<string | null>(null)
  const [editingText,  setEditingText]  = useState('')
  const [editingReq,   setEditingReq]   = useState(true)
  const [savingQ,      setSavingQ]      = useState(false)
  const [addingType,   setAddingType]   = useState<'STUDENT' | 'INSTRUCTOR' | null>(null)
  const [newQText,     setNewQText]     = useState('')
  const [newQRequired, setNewQRequired] = useState(true)

  const startEdit = (q: Question) => {
    setEditingQId(q.id)
    setEditingText(q.questionText)
    setEditingReq(q.isRequired)
  }

  const saveEdit = async () => {
    if (!editingQId) return
    setSavingQ(true)
    await updateSurveyQuestionAction(editingQId, { questionText: editingText, isRequired: editingReq })
    setQuestions((qs) => qs.map((q) => q.id === editingQId ? { ...q, questionText: editingText, isRequired: editingReq } : q))
    setEditingQId(null)
    setSavingQ(false)
  }

  const deleteQ = async (id: string) => {
    setSavingQ(true)
    await deleteSurveyQuestionAction(id)
    setQuestions((qs) => qs.filter((q) => q.id !== id))
    setSavingQ(false)
  }

  const addQuestion = async (surveyType: 'STUDENT' | 'INSTRUCTOR') => {
    if (!newQText.trim()) return
    setSavingQ(true)
    const fd = new FormData()
    fd.set('surveyType',   surveyType)
    fd.set('questionText', newQText)
    fd.set('questionType', 'TEXT')
    fd.set('isRequired',   String(newQRequired))
    await addSurveyQuestionAction(fd)
    // Re-fetch isn't easy client-side; add optimistic entry
    setQuestions((qs) => [...qs, {
      id: `temp-${Date.now()}`,
      surveyType,
      questionText: newQText,
      sortOrder:    999,
      isRequired:   newQRequired,
      questionType: 'TEXT',
      isActive:     true,
    }])
    setNewQText('')
    setAddingType(null)
    setSavingQ(false)
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (result && 'success' in result && result.success) {
    return (
      <div className="space-y-6">
        <div className="card border border-green-300 bg-green-50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-2xl">✓</span>
            <h2 className="text-lg font-bold text-green-800">Class {result.className} created</h2>
          </div>
          <p className="text-sm text-green-700">{result.studentCount} student numbers generated. Criteria snapshot frozen.</p>
        </div>
        <div className="card border border-amber-300 bg-amber-50 space-y-3">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
            ⚠️ Save these PINs — they won&apos;t be shown again
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PinBox label="Grader PIN"      pin={result.graderPin} />
            <PinBox label="Panel Chair PIN" pin={result.chairPin}  />
          </div>
        </div>
        <div className="card border border-gray-200 space-y-3">
          <h3 className="font-semibold text-gray-800">Student Number Assignment Sheet</h3>
          <p className="text-sm text-gray-500">
            Download and keep this on a private computer. Assign each number to a real student.
            The portal never stores real names.
          </p>
          <button onClick={handleDownloadCsv} disabled={csvDownloading} className="btn-primary text-sm">
            {csvDownloading ? 'Preparing…' : `↓ Download ${result.className} Student Numbers (.csv)`}
          </button>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/classes" className="btn-secondary text-sm">View All Classes</Link>
          <Link href={`/admin/classes/${result.classId}`} className="btn-primary text-sm">Open Class</Link>
        </div>
      </div>
    )
  }

  const activeStudentQs    = questions.filter((q) => q.surveyType === 'STUDENT'     && q.isActive)
  const activeInstructorQs = questions.filter((q) => q.surveyType === 'INSTRUCTOR'  && q.isActive)

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <div className={cn('h-1 rounded-full mb-1 transition-colors',
              i < step ? 'bg-tps-blue' : i === step ? 'bg-tps-gold' : 'bg-gray-200'
            )} />
            <span className={cn('text-[10px] hidden sm:block',
              i === step ? 'text-tps-blue font-semibold' : 'text-gray-400'
            )}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Step 0: Basic Info ──────────────────────────────────────────────── */}
      <div className={step === 0 ? 'card space-y-5' : 'hidden'}>
        <h2 className="font-semibold text-lg text-gray-800">Basic Information</h2>

        <div>
          <label className="field-label">Class Name <span className="text-gray-400 font-normal">(e.g. 26A, 26B)</span></label>
          <input value={fields.name} onChange={(e) => set('name', e.target.value.toUpperCase())}
            maxLength={20} placeholder="26A" className="field-input w-40 uppercase" />
        </div>

        {/* Per-track student count breakdown */}
        <div>
          <label className="field-label">Students by Track</label>
          <p className="text-xs text-gray-400 mb-3">
            Numbers 1–{totalStudents || 'N'} will be randomly assigned across tracks.
            The CSV you download will show which track each number belongs to.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.keys(trackCounts).map((track) => (
              <div key={track}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {TRACK_LABELS_DISPLAY[track]}
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={trackCounts[track as keyof typeof trackCounts] || ''}
                  onChange={(e) => setTrack(track, parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="field-input text-center font-mono"
                />
              </div>
            ))}
          </div>
          <div className={cn(
            'mt-3 px-3 py-2 rounded-lg text-sm font-medium',
            totalStudents > 0 ? 'bg-blue-50 text-tps-navy border border-blue-200' : 'bg-gray-50 text-gray-400'
          )}>
            Total: <strong>{totalStudents}</strong> student{totalStudents !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input id="makeActive" type="checkbox" checked={fields.makeActive}
            onChange={(e) => set('makeActive', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-tps-orange" />
          <label htmlFor="makeActive" className="text-sm text-gray-700">
            Set as active class (deactivates current active class)
          </label>
        </div>
      </div>

      {/* ── Step 1: Criteria ────────────────────────────────────────────────── */}
      <div className={step === 1 ? 'card space-y-4' : 'hidden'}>
        <div>
          <h2 className="font-semibold text-lg text-gray-800">Grading Criteria Review</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            These criteria and weights will be <strong>frozen</strong> for this class.
            Changes to the template after creation won&apos;t affect this class.
          </p>
        </div>
        <div className={cn('text-xs px-3 py-1.5 rounded-lg inline-block',
          weightsOk ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          Total weight: <strong>{(totalWeight * 100).toFixed(1)}%</strong>
          {!weightsOk && ' ⚠ Must equal 100% before creating class'}
        </div>
        <div className="space-y-2">
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="font-mono text-xs font-bold text-tps-blue w-8">{c.code}</span>
              <span className="flex-1 text-sm text-gray-800">{c.name}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full',
                c.pillar === 'TESTER'  ? 'bg-blue-100 text-blue-700' :
                c.pillar === 'LEADER'  ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              )}>{c.pillar}</span>
              <span className="text-sm font-semibold text-gray-700 w-14 text-right">{(c.weight * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <a href="/admin/rubric" target="_blank" className="text-xs text-tps-blue hover:underline">
          Edit criteria in Rubric settings ↗
        </a>
      </div>

      {/* ── Step 2: Scenarios ──────────────────────────────────────────────── */}
      <div className={step === 2 ? 'card space-y-4' : 'hidden'}>
        <div>
          <h2 className="font-semibold text-lg text-gray-800">Scenarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Scenarios are <strong>global and permanent</strong>. Scenario 1 always means the same scenario across all classes.
          </p>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-1.5">
              <span className="text-xs font-mono font-bold text-gray-600 w-6">#{s.number}</span>
              <span className="text-sm text-gray-800">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 3: Access PINs ────────────────────────────────────────────── */}
      <div className={step === 3 ? 'card space-y-4' : 'hidden'}>
        <h2 className="font-semibold text-lg text-gray-800">Access PINs</h2>
        <p className="text-sm text-gray-500">PINs can be rotated later from the class detail page.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Grader PIN</label>
            <input type="text" value={fields.graderPin} onChange={(e) => set('graderPin', e.target.value)}
              minLength={4} maxLength={20} inputMode="numeric" placeholder="4–8 digits"
              className="field-input font-mono tracking-widest" />
            <p className="text-xs text-gray-400 mt-1">Share with all graders</p>
          </div>
          <div>
            <label className="field-label">Panel Chair PIN</label>
            <input type="text" value={fields.chairPin} onChange={(e) => set('chairPin', e.target.value)}
              minLength={4} maxLength={20} inputMode="numeric" placeholder="4–8 digits"
              className="field-input font-mono tracking-widest" />
            <p className="text-xs text-gray-400 mt-1">Panel Chair only</p>
          </div>
        </div>
      </div>

      {/* ── Step 4: Survey Questions ───────────────────────────────────────── */}
      <div className={step === 4 ? 'space-y-6' : 'hidden'}>
        {(['STUDENT', 'INSTRUCTOR'] as const).map((type) => {
          const qs    = type === 'STUDENT' ? activeStudentQs : activeInstructorQs
          const label = type === 'STUDENT' ? 'Student Survey' : 'Instructor Survey'

          return (
            <div key={type} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{label} <span className="text-gray-400 font-normal text-sm">({qs.length} questions)</span></h3>
                <button type="button" onClick={() => { setAddingType(type); setNewQText(''); setNewQRequired(true) }}
                  className="btn-secondary text-xs">+ Add Question</button>
              </div>

              {/* Add question form */}
              {addingType === type && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <textarea value={newQText} onChange={(e) => setNewQText(e.target.value)}
                    placeholder="Question text…" rows={2}
                    className="field-input text-sm resize-none" />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input type="checkbox" checked={newQRequired} onChange={(e) => setNewQRequired(e.target.checked)} className="h-3 w-3" />
                      Required
                    </label>
                    <div className="flex gap-2 ml-auto">
                      <button type="button" onClick={() => setAddingType(null)} className="btn-ghost text-xs">Cancel</button>
                      <button type="button" onClick={() => addQuestion(type)} disabled={savingQ || !newQText.trim()} className="btn-primary text-xs">
                        {savingQ ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Question list — ALL questions, scrollable */}
              <div className="max-h-96 overflow-y-auto space-y-1 border border-gray-200 rounded-lg divide-y divide-gray-100">
                {qs.map((q, idx) => (
                  <div key={q.id} className="p-2.5 text-xs">
                    {editingQId === q.id ? (
                      <div className="space-y-2">
                        <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)}
                          rows={3} className="field-input text-xs resize-none w-full" />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-gray-600">
                            <input type="checkbox" checked={editingReq} onChange={(e) => setEditingReq(e.target.checked)} className="h-3 w-3" />
                            Required
                          </label>
                          <div className="flex gap-2 ml-auto">
                            <button type="button" onClick={() => setEditingQId(null)} className="btn-ghost text-xs">Cancel</button>
                            <button type="button" onClick={saveEdit} disabled={savingQ} className="btn-primary text-xs">
                              {savingQ ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                        <span className="flex-1 text-gray-700 leading-snug">{q.questionText}</span>
                        <div className="flex gap-1 flex-shrink-0">
                          {q.isRequired && <span className="text-red-400 text-[9px]">*req</span>}
                          <button type="button" onClick={() => startEdit(q)} className="text-gray-300 hover:text-tps-blue px-1" title="Edit">✎</button>
                          <button type="button" onClick={() => deleteQ(q.id)} disabled={savingQ} className="text-gray-300 hover:text-red-500 px-1" title="Remove">×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {qs.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No questions yet.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Step 5: Confirm ────────────────────────────────────────────────── */}
      <div className={step === 5 ? 'card space-y-4' : 'hidden'}>
        <h2 className="font-semibold text-lg text-gray-800">Confirm &amp; Create</h2>
        <div className="space-y-3 text-sm">
          <SummaryRow label="Class Name"     value={fields.name || '(not set)'} warn={!fields.name} />
          <SummaryRow label="Students"       value={totalStudents > 0 ? `${totalStudents} total — randomly assigned across ${Object.values(trackCounts).filter(Boolean).length} track(s)` : '(not set — add students in Step 1)'} warn={totalStudents === 0} />
          <SummaryRow label="Criteria"       value={`${criteria.length} criteria — ${(totalWeight * 100).toFixed(1)}% total — will be frozen`} warn={!weightsOk} />
          <SummaryRow label="Grader PIN"     value={fields.graderPin ? '●●●●●● (set)' : '(not set)'} warn={!fields.graderPin} />
          <SummaryRow label="Chair PIN"      value={fields.chairPin  ? '●●●●●● (set)' : '(not set)'} warn={!fields.chairPin}  />
          <SummaryRow label="Scenarios"      value={`${scenarios.length} global scenarios available`} />
          <SummaryRow label="Surveys"        value={`${activeStudentQs.length} student · ${activeInstructorQs.length} instructor questions`} />
        </div>

        {result && !('success' in result && result.success) && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {'error' in result ? result.error : 'An error occurred.'}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary text-sm">← Back</button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 && !weightsOk}
            className="btn-primary text-sm"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !fields.name || totalStudents === 0 || !fields.graderPin || !fields.chairPin || !weightsOk}
            className="btn-primary text-sm px-6"
          >
            {submitting ? 'Creating class…' : 'Create Class'}
          </button>
        )}
      </div>
    </div>
  )
}

function PinBox({ label, pin }: { label: string; pin: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(pin).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="bg-white rounded-lg border border-amber-200 p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-mono text-xl font-bold text-gray-900 tracking-widest">{pin}</p>
      <button type="button" onClick={copy} className="text-xs text-tps-blue hover:underline mt-1">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function SummaryRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex gap-3 border-b border-gray-100 pb-2 last:border-0">
      <span className="font-medium text-gray-600 w-28 flex-shrink-0">{label}</span>
      <span className={warn ? 'text-red-600 font-medium' : 'text-gray-700'}>{value}</span>
    </div>
  )
}
