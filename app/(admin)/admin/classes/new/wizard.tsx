'use client'

import { useActionState, useState } from 'react'
import { createClassWizardAction, getStudentCsvAction } from './actions'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Criterion = { id: string; code: string; name: string; weight: number; pillar: string; sortOrder: number }
type Scenario  = { id: string; number: number; label: string }
type Question  = { id: string; surveyType: string; questionText: string; sortOrder: number; isRequired: boolean }

interface Props {
  criteria:       Criterion[]
  scenarios:      Scenario[]
  surveyQuestions: Question[]
}

const STEPS = ['Basic Info', 'Criteria Review', 'Scenarios', 'Access PINs', 'Survey Review', 'Confirm']

export function ClassCreationWizard({ criteria, scenarios, surveyQuestions }: Props) {
  const [step, setStep]             = useState(0)
  const [result, formAction, pending] = useActionState(createClassWizardAction, null)
  const [csvDownloading, setCsvDownloading] = useState(false)

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0)

  const handleDownloadCsv = async () => {
    if (!result || !('success' in result) || !result.success) return
    setCsvDownloading(true)
    const csv = await getStudentCsvAction(result.classId)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${result.className}-student-numbers.csv`
    a.click()
    URL.revokeObjectURL(url)
    setCsvDownloading(false)
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (result && 'success' in result && result.success) {
    return (
      <div className="space-y-6">
        <div className="card border border-green-300 bg-green-50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-2xl">✓</span>
            <h2 className="text-lg font-bold text-green-800">
              Class {result.className} created
            </h2>
          </div>
          <p className="text-sm text-green-700">
            {result.studentCount} student numbers generated. Criteria snapshot frozen.
          </p>
        </div>

        {/* PIN display */}
        <div className="card border border-amber-300 bg-amber-50 space-y-3">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
            ⚠️ Save these PINs — they won&apos;t be shown again
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PinBox label="Grader PIN"       pin={result.graderPin} />
            <PinBox label="Panel Chair PIN"  pin={result.chairPin}  />
          </div>
        </div>

        {/* Student number download */}
        <div className="card border border-gray-200 space-y-3">
          <h3 className="font-semibold text-gray-800">Student Number Assignment Sheet</h3>
          <p className="text-sm text-gray-500">
            Download this CSV. Assign each number to a real student and keep the file
            on a separate, private computer. The portal never stores real names.
          </p>
          <button
            onClick={handleDownloadCsv}
            disabled={csvDownloading}
            className="btn-primary text-sm"
          >
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

  return (
    <form action={formAction} className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <div className={cn(
              'h-1 rounded-full mb-1 transition-colors',
              i < step  ? 'bg-tps-blue' :
              i === step ? 'bg-tps-gold' :
              'bg-gray-200',
            )} />
            <span className={cn(
              'text-[10px] hidden sm:block',
              i === step ? 'text-tps-blue font-semibold' : 'text-gray-400',
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 0: Basic Info ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg text-gray-800">Basic Information</h2>
          <div>
            <label className="field-label">Class Name <span className="text-gray-400 font-normal">(e.g. 26A, 26B)</span></label>
            <input name="name" required maxLength={20} placeholder="26A" className="field-input uppercase" />
          </div>
          <div>
            <label className="field-label">Number of Students</label>
            <input name="studentCount" type="number" required min={1} max={500} placeholder="40" className="field-input w-40" />
            <p className="text-xs text-gray-400 mt-1">
              This generates sequential student numbers (e.g. 26A-1 through 26A-40).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input id="makeActive" name="makeActive" type="checkbox" value="on" defaultChecked className="h-4 w-4 rounded border-gray-300 text-tps-blue" />
            <label htmlFor="makeActive" className="text-sm text-gray-700">
              Set as active class (deactivates current active class)
            </label>
          </div>
        </div>
      )}

      {/* ── Step 1: Criteria Review ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-lg text-gray-800">Grading Criteria Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              These criteria and weights will be <strong>frozen</strong> for this class.
              Changes to the global template after class creation won&apos;t affect this class.
            </p>
          </div>
          <div className={cn(
            'text-xs px-3 py-1.5 rounded-lg inline-block',
            Math.abs(totalWeight - 1) < 0.001
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200',
          )}>
            Total weight: <strong>{(totalWeight * 100).toFixed(1)}%</strong>
            {Math.abs(totalWeight - 1) >= 0.001 && ' ⚠ Must equal 100% before creating class'}
          </div>
          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="font-mono text-xs font-bold text-tps-blue w-8">{c.code}</span>
                <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  c.pillar === 'TESTER'  ? 'bg-blue-100 text-blue-700' :
                  c.pillar === 'LEADER'  ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700',
                )}>{c.pillar}</span>
                <span className="text-sm font-semibold text-gray-700 w-14 text-right">
                  {(c.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <a href="/admin/rubric" target="_blank" className="text-xs text-tps-blue hover:underline">
            Edit criteria in Rubric settings ↗
          </a>
        </div>
      )}

      {/* ── Step 2: Scenarios ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-lg text-gray-800">Scenarios</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Scenarios are <strong>global and permanent</strong>. Scenario 1 always means the same scenario across all classes.
              Graders select from all active scenarios when submitting grades.
            </p>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {scenarios.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-mono font-bold text-gray-600 w-6">#{s.number}</span>
                <span className="text-sm text-gray-800">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            To add new scenarios, go to <a href="/admin/settings" target="_blank" className="text-tps-blue hover:underline">Admin → Settings → Scenarios ↗</a>
          </p>
        </div>
      )}

      {/* ── Step 3: Access PINs ───────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg text-gray-800">Access PINs</h2>
          <p className="text-sm text-gray-500">
            Set the room PINs for this class. Both can be rotated later from the class management page.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Grader PIN</label>
              <input name="graderPin" type="text" required minLength={4} maxLength={20}
                inputMode="numeric" placeholder="4–8 digits"
                className="field-input font-mono tracking-widest" />
              <p className="text-xs text-gray-400 mt-1">Share with all graders</p>
            </div>
            <div>
              <label className="field-label">Panel Chair PIN</label>
              <input name="chairPin" type="text" required minLength={4} maxLength={20}
                inputMode="numeric" placeholder="4–8 digits"
                className="field-input font-mono tracking-widest" />
              <p className="text-xs text-gray-400 mt-1">Panel Chair only</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Survey Review ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-lg text-gray-800">Survey Questions Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              These are the current global survey questions. Both surveys are open-access (no PIN).
              Survey questions can be customized per class from Admin → Settings after class creation.
            </p>
          </div>
          {(['STUDENT', 'INSTRUCTOR'] as const).map((type) => {
            const qs = surveyQuestions.filter((q) => q.surveyType === type)
            return (
              <div key={type}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {type === 'STUDENT' ? 'Student Survey' : 'Instructor Survey'} ({qs.length} questions)
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {qs.slice(0, 10).map((q) => (
                    <div key={q.id} className="flex items-start gap-2 py-1 text-xs">
                      <span className="text-gray-400 font-mono w-4 flex-shrink-0">{q.sortOrder}.</span>
                      <span className="text-gray-700 line-clamp-1">{q.questionText}</span>
                      {q.isRequired && <span className="text-red-400 flex-shrink-0">*</span>}
                    </div>
                  ))}
                  {qs.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-1">
                      + {qs.length - 10} more questions
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Step 5: Confirm ───────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg text-gray-800">Confirm &amp; Create</h2>
          <div className="space-y-3 text-sm">
            <SummaryRow label="Criteria" value={`${criteria.length} criteria, weights sum to ${(totalWeight * 100).toFixed(1)}% — will be frozen`} />
            <SummaryRow label="Scenarios" value={`${scenarios.length} global scenarios available`} />
            <SummaryRow label="Student Numbers" value="Generated on creation, CSV downloadable immediately" />
            <SummaryRow label="Staff" value="Not frozen — graders can be added/removed at any time" />
            <SummaryRow label="Surveys" value={`${surveyQuestions.length} questions (${surveyQuestions.filter(q => q.surveyType === 'STUDENT').length} student, ${surveyQuestions.filter(q => q.surveyType === 'INSTRUCTOR').length} instructor)`} />
          </div>
          {result && !('success' in result && result.success) && 'error' in (result as object) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {(result as { error: string }).error}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 justify-between">
        {step > 0 ? (
          <button type="button" onClick={back} className="btn-secondary text-sm">
            ← Back
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={step === 1 && Math.abs(totalWeight - 1) >= 0.001}
            className="btn-primary text-sm"
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="btn-primary text-sm px-6"
          >
            {pending ? 'Creating class…' : 'Create Class'}
          </button>
        )}
      </div>
    </form>
  )
}

function PinBox({ label, pin }: { label: string; pin: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(pin).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-gray-100 pb-2 last:border-0">
      <span className="font-medium text-gray-600 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}
