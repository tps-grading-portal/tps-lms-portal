'use client'

import { useEffect, useRef, useState, useMemo, useTransition } from 'react'
import { aggregateBySubject, generateLLMPrompt, assignRankStatus, aggregateRepeatingSection, parseRepeatEntries } from '@/lib/sandbox-scoring'
import { editSandboxSubmissionAction, deleteSandboxSubmissionAction } from './actions'
import { cn } from '@/lib/utils'

type Question = {
  id: string; label: string; description: string | null; questionType: string;
  sectionLabel: string | null; options: unknown; scaleMin: number | null;
  scaleMax: number | null; pointMap: unknown; weight: number | null;
}

type Submission = {
  id: string; subjectName: string | null; graderName: string | null;
  answers: Record<string, unknown>; totalScore: number | null; submittedAt: string
}

interface Props {
  form:               { id: string; mode: string; scoringEnabled: boolean; title: string; description: string | null }
  questions:          Question[]
  initialSubmissions: Submission[]
  slug:               string
}

type Tab = 'summary' | 'subjects' | 'questions' | 'raw' | 'llm'

export function SandboxResultsViewer({ form, questions, initialSubmissions, slug }: Props) {
  const [submissions,   setSubmissions]   = useState<Submission[]>(initialSubmissions)
  const [activeTab,     setActiveTab]     = useState<Tab>('summary')
  const [topN,          setTopN]          = useState(5)
  const [llmCopied,     setLlmCopied]     = useState(false)
  const [gradecard,     setGradecard]     = useState<Submission | null>(null)
  const [editMode,      setEditMode]      = useState(false)
  const [editAnswers,   setEditAnswers]   = useState<Record<string, unknown>>({})
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [,              startT]           = useTransition()
  const esRef = useRef<EventSource | null>(null)

  // SSE — live updates
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`/api/sandbox/events/${slug}`)
      esRef.current = es
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (Array.isArray(data)) setSubmissions(data)
        } catch { /* skip */ }
      }
      es.onerror = () => { es.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => { esRef.current?.close() }
  }, [slug])

  const scorableQs = questions.map((q) => ({
    id: q.id, questionType: q.questionType,
    weight:   q.weight,
    pointMap: (q.pointMap as Record<string, number> | null) ?? null,
    scaleMin: q.scaleMin,
    scaleMax: q.scaleMax,
    label:    q.label,
  }))

  const aggregates = useMemo(
    () => aggregateBySubject(submissions.map((s) => ({
      subjectName: s.subjectName,
      answers:     s.answers,
      totalScore:  s.totalScore,
    })), scorableQs),
    [submissions, questions]
  )

  const rankStatuses = useMemo(
    () => assignRankStatus(aggregates, topN),
    [aggregates, topN]
  )

  // ── Gradecard handlers ──────────────────────────────────────────────────────
  const openGradecard = (s: Submission) => {
    setGradecard(s)
    setEditMode(false)
    setEditAnswers({ ...s.answers })
  }

  const handleEditSave = async () => {
    if (!gradecard) return
    setActionPending(true)
    await editSandboxSubmissionAction(gradecard.id, slug, editAnswers)
    setActionPending(false)
    setEditMode(false)
    setGradecard(null)
  }

  const handleDelete = async (submissionId: string) => {
    setActionPending(true)
    await deleteSandboxSubmissionAction(submissionId, slug)
    setActionPending(false)
    setDeleteTarget(null)
    setGradecard(null)
    startT(() => setSubmissions((prev) => prev.filter((s) => s.id !== submissionId)))
  }

  // Format an answer value for display
  const formatAnswer = (val: unknown, q: Question): string => {
    if (val === undefined || val === null || val === '') return '—'
    // REPEATING_SECTION: show compact summary in table cells
    if (q.questionType === 'REPEATING_SECTION') {
      try {
        const entries = parseRepeatEntries(val)
        if (entries.length === 0) return '—'
        return `${entries.length} person${entries.length !== 1 ? 's' : ''} graded`
      } catch { return '(repeating section)' }
    }
    if (Array.isArray(val)) return val.join(', ')
    if (q.questionType === 'GRADE_1_8') {
      const n = parseInt(String(val))
      const labels = ['','Well Above Avg','Above Avg','Slightly Above Avg','Average','Slightly Below Avg','Below Avg','Well Below Avg','Fail']
      return `${n} — ${labels[n] ?? ''}`
    }
    return String(val)
  }

  // Column headers: Q1, Q2, Q3 — full text available on hover
  const qLabel = (index: number): string => `Q${index + 1}`

  const llmPrompt = useMemo(
    () => generateLLMPrompt(
      { title: form.title, description: form.description, mode: form.mode },
      questions.map((q) => ({ id: q.id, label: q.label, questionType: q.questionType, weight: q.weight })),
      submissions.map((s) => ({ ...s })),
      aggregates,
    ),
    [submissions, questions, aggregates]
  )

  const copyLLM = () => {
    navigator.clipboard.writeText(llmPrompt).then(() => { setLlmCopied(true); setTimeout(() => setLlmCopied(false), 3000) })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'summary',   label: 'Summary'   },
    { id: 'subjects',  label: 'Subjects'  },
    { id: 'questions', label: 'Questions' },
    { id: 'raw',       label: 'All Responses' },
    { id: 'llm',       label: 'LLM Prompt' },
  ]

  return (
    <>
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Submissions',  value: submissions.length },
          { label: 'Subjects',     value: form.mode === 'GRADER' ? aggregates.length : '—' },
          { label: 'Avg Score',    value: form.scoringEnabled ? (aggregates.length > 0 ? (aggregates.reduce((s, a) => s + (a.avgScore ?? 0), 0) / aggregates.length).toFixed(1) : '—') : 'N/A' },
          { label: 'Live updates', value: '●' },
        ].map(({ label, value }) => (
          <div key={label} className="card border border-gray-200 py-3 text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-xl font-bold text-tps-navy">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.filter((t) => t.id !== 'subjects' || form.mode === 'GRADER').map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn('px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors',
                activeTab === t.id
                  ? 'border-tps-orange text-tps-orange font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              )}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {form.scoringEnabled && aggregates.length > 0 && (
            <div className="card border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">Score Distribution</h3>
              {aggregates.map((agg, i) => (
                <div key={agg.subject} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                  <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{agg.subject}</span>
                  <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-tps-orange rounded-full"
                      style={{ width: `${((agg.avgScore ?? 0) / 100) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono font-bold text-tps-navy w-14 text-right">
                    {agg.avgScore?.toFixed(1) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="card border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">Recent Submissions</h3>
            {submissions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
                {s.subjectName && <span className="font-medium text-tps-navy">{s.subjectName}</span>}
                {s.graderName  && <span className="text-gray-500">by {s.graderName}</span>}
                <span className="text-gray-400 ml-auto">{new Date(s.submittedAt).toLocaleString()}</span>
                {s.totalScore !== null && <span className="font-bold text-tps-navy">{s.totalScore.toFixed(1)}</span>}
              </div>
            ))}
            {submissions.length === 0 && <p className="text-gray-400 text-sm">No submissions yet.</p>}
          </div>
        </div>
      )}

      {/* Tab: Subjects (Grader mode) */}
      {activeTab === 'subjects' && form.mode === 'GRADER' && (
        <div className="space-y-6">
          {/* Group-level table */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Highlight top</label>
              <input type="number" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 5)}
                min={1} max={aggregates.length} className="field-input w-16 text-center" />
              <span className="text-sm text-gray-600">groups</span>
            </div>
            {aggregates.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Group / Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Evaluations</th>
                      {form.scoringEnabled && <>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Avg Score</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Min</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Max</th>
                      </>}
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aggregates.map((agg, i) => {
                      const status = rankStatuses[i]
                      const rowBg  = status === 'top' ? 'bg-green-50' : status === 'low' ? 'bg-red-50' : 'bg-amber-50'
                      const badge  = status === 'top' ? '★ TOP' : status === 'low' ? '✗ LOW' : '◐ MID'
                      const badgeCls = status === 'top' ? 'bg-green-100 text-green-800' : status === 'low' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      return (
                        <tr key={agg.subject} className={rowBg}>
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{agg.subject}</td>
                          <td className="px-3 py-2 text-gray-500">{agg.count}</td>
                          {form.scoringEnabled && <>
                            <td className="px-3 py-2 font-bold font-mono">{agg.avgScore?.toFixed(2) ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500 font-mono">{agg.minScore?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500 font-mono">{agg.maxScore?.toFixed(1) ?? '—'}</td>
                          </>}
                          <td className="px-3 py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', badgeCls)}>{badge}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Individual scores from repeating sections */}
          {(() => {
            const repeatQ = questions.find((q) => q.questionType === 'REPEATING_SECTION')
            if (!repeatQ || !form.scoringEnabled) return null
            const personScoreMap = aggregateRepeatingSection(
              submissions.map((s) => ({ subjectName: s.subjectName, answers: s.answers, graderName: s.graderName })),
              questions.map((q) => ({ id: q.id, questionType: q.questionType, weight: q.weight, pointMap: (q.pointMap as Record<string,number>|null)??null, scaleMin: q.scaleMin, scaleMax: q.scaleMax, label: q.label, options: q.options })),
            )
            if (personScoreMap.size === 0) return null
            return (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  🔄 Individual Scores
                  <span className="text-xs font-normal text-gray-400">Group score averaged across all graders, individual score averaged per person</span>
                </h3>
                {Array.from(personScoreMap.entries()).map(([group, persons]) => (
                  <div key={group} className="card border border-orange-200 bg-orange-50 space-y-3">
                    <p className="font-semibold text-sm text-tps-navy">{group}</p>
                    <div className="overflow-x-auto rounded-lg border border-orange-100">
                      <table className="w-full text-sm">
                        <thead className="bg-orange-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Person</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Group Score</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Individual Score</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 font-bold">Total</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Graders</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100 bg-white">
                          {persons.map((p) => (
                            <tr key={p.person}>
                              <td className="px-3 py-2 font-medium">{p.person}</td>
                              <td className="px-3 py-2 font-mono text-gray-600">{p.groupScore.toFixed(2)}</td>
                              <td className="px-3 py-2 font-mono text-gray-600">{p.individualScore.toFixed(2)}</td>
                              <td className={cn('px-3 py-2 font-bold font-mono', p.totalScore >= 70 ? 'text-green-700' : 'text-red-600')}>
                                {p.totalScore.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs">{p.gradersCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Tab: Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {questions.map((q) => {
            const answers = submissions
              .map((s) => s.answers[q.id])
              .filter((v) => v !== undefined && v !== null && v !== '')

            if (answers.length === 0) return (
              <div key={q.id} className="card border border-gray-100 py-3">
                <p className="text-sm font-medium text-gray-700">{q.label}</p>
                <p className="text-xs text-gray-400 italic mt-1">No responses yet</p>
              </div>
            )

            const isNumeric  = ['GRADE_1_8', 'NUMERIC', 'NUMBER'].includes(q.questionType)
            const isText     = q.questionType === 'TEXT'
            const isChoice   = ['MULTIPLE_CHOICE', 'CHECKBOX'].includes(q.questionType)
            const numVals    = answers.map((v) => parseFloat(String(v))).filter((n) => !isNaN(n))
            const avg        = numVals.length ? numVals.reduce((a, b) => a + b, 0) / numVals.length : null
            const options    = Array.isArray(q.options) ? (q.options as string[]) : []
            const max        = q.questionType === 'GRADE_1_8' ? 8 : (q.scaleMax ?? 5)

            return (
              <div key={q.id} className="card border border-gray-100 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-gray-700 flex-1">{q.label}</p>
                  <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{answers.length} response{answers.length !== 1 ? 's' : ''}</p>
                </div>

                {isNumeric && avg !== null && (
                  <div>
                    <p className="text-2xl font-bold text-tps-navy">{avg.toFixed(2)} <span className="text-sm text-gray-400">/ {max}</span></p>
                    {/* Distribution bars */}
                    {q.questionType === 'GRADE_1_8' && (
                      <div className="mt-2 space-y-1">
                        {[1,2,3,4,5,6,7,8].map((v) => {
                          const count = numVals.filter((n) => Math.round(n) === v).length
                          const pct   = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0
                          return (
                            <div key={v} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 w-4">{v}</span>
                              <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                                <div className="h-full bg-tps-orange rounded-sm" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-gray-600 w-16 text-right">{count} ({pct}%)</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {isChoice && (
                  <div className="space-y-1">
                    {options.map((opt) => {
                      const count = answers.filter((a) => {
                        if (Array.isArray(a)) return a.includes(opt)
                        return a === opt
                      }).length
                      const pct = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0
                      return (
                        <div key={opt} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-600 w-32 truncate">{opt}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                            <div className="h-full bg-tps-orange rounded-sm" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-gray-600 w-16 text-right">{count} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isText && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {answers.map((a, i) => (
                      <div key={i} className="bg-gray-50 border-l-2 border-tps-orange px-3 py-2 text-xs text-gray-700 rounded-r-lg">
                        {String(a)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Raw responses */}
      {activeTab === 'raw' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Submitted</th>
                {form.mode === 'GRADER' && <th className="px-3 py-2 text-left font-semibold text-gray-600">Subject</th>}
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Grader / Respondent</th>
                {questions.map((q, qi) => (
                  <th key={q.id} className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[60px]">
                    <span title={q.label} className="cursor-help font-mono">{qLabel(qi)}</span>
                  </th>
                ))}
                {form.scoringEnabled && <th className="px-3 py-2 text-left font-semibold text-gray-600">Score</th>}
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <tr key={s.id} className="bg-white hover:bg-gray-50 cursor-pointer group" onClick={() => openGradecard(s)}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(s.submittedAt).toLocaleDateString()}</td>
                  {form.mode === 'GRADER' && <td className="px-3 py-2 font-medium">{s.subjectName ?? '—'}</td>}
                  <td className="px-3 py-2 text-gray-500">{s.graderName ?? '—'}</td>
                  {questions.map((q) => {
                    const val = s.answers[q.id]
                    const display = val === undefined || val === null || val === ''
                      ? <span className="text-gray-300">—</span>
                      : q.questionType === 'GRADE_1_8'
                        ? <span className={cn('font-bold', parseInt(String(val)) === 8 ? 'text-red-600' : parseInt(String(val)) <= 2 ? 'text-green-600' : 'text-gray-700')}>{String(val)}</span>
                        : q.questionType === 'TEXT'
                          ? <span className="text-gray-600 truncate max-w-[120px] block" title={String(val)}>{String(val).slice(0, 40)}{String(val).length > 40 ? '…' : ''}</span>
                          : Array.isArray(val) ? <span>{val.join(', ')}</span> : <span>{String(val)}</span>
                    return <td key={q.id} className="px-3 py-2 text-gray-700">{display}</td>
                  })}
                  {form.scoringEnabled && (
                    <td className="px-3 py-2 font-bold font-mono">
                      <span className={cn(s.totalScore !== null && s.totalScore >= 70 ? 'text-green-700' : s.totalScore !== null ? 'text-red-600' : 'text-gray-400')}>
                        {s.totalScore?.toFixed(1) ?? '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openGradecard(s)} className="text-tps-orange hover:text-orange-700 text-xs px-1.5 py-1 rounded hover:bg-orange-50" title="View gradecard">
                        ↗
                      </button>
                      <button onClick={() => setDeleteTarget(s.id)} className="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 rounded hover:bg-red-50" title="Delete submission">
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr><td colSpan={99} className="px-3 py-8 text-center text-gray-400">No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-3 py-2 border-t">Click any row to view full gradecard. Hover a row to see action buttons.</p>
        </div>
      )}

      {/* Tab: LLM Prompt */}
      {activeTab === 'llm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">LLM Analysis Prompt</h3>
              <p className="text-sm text-gray-500 mt-0.5">Copy and paste into Claude or ChatGPT for AI analysis.</p>
            </div>
            <button onClick={copyLLM} className="btn-primary text-sm">
              {llmCopied ? '✓ Copied!' : 'Copy All'}
            </button>
          </div>
          <textarea
            readOnly
            value={llmPrompt}
            className="w-full h-[500px] font-mono text-xs p-4 border border-gray-200 rounded-xl bg-gray-50 resize-y focus:outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>
      )}
    </div>
    {/* ── Gradecard modal ──────────────────────────────────────────────────── */}
    {gradecard && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setGradecard(null); setEditMode(false) }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-tps-navy text-white px-5 py-4 rounded-t-2xl flex items-start justify-between">
            <div>
              <p className="text-tps-gold text-[9px] font-bold tracking-widest uppercase">Submission Gradecard</p>
              <p className="font-semibold text-sm mt-0.5">
                {gradecard.subjectName || gradecard.graderName || 'Anonymous'}
              </p>
              <p className="text-tps-silver text-xs mt-0.5">{new Date(gradecard.submittedAt).toLocaleString()}</p>
            </div>
            <button onClick={() => { setGradecard(null); setEditMode(false) }} className="text-tps-silver hover:text-white text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
          </div>

          <div className="p-5 space-y-4">
            {/* Meta */}
            <div className="flex gap-4 text-sm text-gray-600">
              {gradecard.subjectName && <span><strong>Subject:</strong> {gradecard.subjectName}</span>}
              {gradecard.graderName  && <span><strong>By:</strong> {gradecard.graderName}</span>}
              {gradecard.totalScore !== null && (
                <span className={cn('font-bold ml-auto', gradecard.totalScore >= 70 ? 'text-green-700' : 'text-red-600')}>
                  Score: {gradecard.totalScore.toFixed(1)}
                </span>
              )}
            </div>

            {/* Questions */}
            {questions.map((q, qi) => {
              const rawVal  = editMode ? editAnswers[q.id] : gradecard.answers[q.id]
              const opts    = Array.isArray(q.options) ? (q.options as string[]) : []
              const config  = q.questionType === 'REPEATING_SECTION'
                ? (q.options as { subQuestions?: { id: string; label: string; type: string }[] } | null)
                : null

              return (
                <div key={q.id} className={cn('border-b border-gray-100 pb-3 last:border-0',
                  q.questionType === 'REPEATING_SECTION' && 'bg-orange-50 rounded-lg px-3 py-2 border-orange-200'
                )}>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    <span className="text-tps-orange font-mono mr-1">{qLabel(qi)}</span>
                    {q.label}
                  </p>

                  {/* REPEATING SECTION — special rendering */}
                  {q.questionType === 'REPEATING_SECTION' ? (() => {
                    const entries = parseRepeatEntries(rawVal)
                    const subQs   = config?.subQuestions ?? []

                    if (!editMode) {
                      // Read-only: table of subject → scores
                      return entries.length === 0 ? (
                        <p className="text-gray-400 italic text-sm">No individual scores recorded</p>
                      ) : (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-orange-100">
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Person</th>
                              {subQs.map((sq) => (
                                <th key={sq.id} className="px-2 py-1 text-left font-semibold text-gray-600">{sq.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-orange-100">
                            {entries.map((entry, ei) => (
                              <tr key={ei} className="bg-white">
                                <td className="px-2 py-1.5 font-medium">{entry.subject || '—'}</td>
                                {subQs.map((sq) => (
                                  <td key={sq.id} className={cn('px-2 py-1.5 font-mono font-bold',
                                    entry[sq.id] === '8' ? 'text-red-600' :
                                    parseInt(entry[sq.id] || '0') <= 2 ? 'text-green-600' : 'text-gray-700'
                                  )}>
                                    {entry[sq.id] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    } else {
                      // Edit mode: per-person grade inputs
                      const currentEntries = editMode
                        ? parseRepeatEntries(editAnswers[q.id])
                        : entries
                      const setEntry = (ei: number, sqId: string, val: string) => {
                        const next = [...currentEntries]
                        next[ei] = { ...next[ei], [sqId]: val }
                        setEditAnswers((a) => ({ ...a, [q.id]: JSON.stringify(next) }))
                      }
                      return (
                        <div className="space-y-3">
                          {currentEntries.map((entry, ei) => (
                            <div key={ei} className="card border border-orange-200 space-y-2 py-2">
                              <p className="text-xs font-semibold text-tps-navy">{entry.subject || `Person ${ei + 1}`}</p>
                              {subQs.map((sq) => (
                                <div key={sq.id}>
                                  <label className="text-[10px] text-gray-500 block mb-1">{sq.label}</label>
                                  {sq.type === 'GRADE_1_8' ? (
                                    <div className="grid grid-cols-8 gap-1">
                                      {[1,2,3,4,5,6,7,8].map((v) => (
                                        <button key={v} type="button"
                                          onClick={() => setEntry(ei, sq.id, String(v))}
                                          className={cn('rounded border min-h-[32px] text-xs font-bold transition-all',
                                            entry[sq.id] === String(v)
                                              ? 'bg-tps-orange text-white border-tps-orange'
                                              : 'border-gray-200 text-gray-600 hover:border-gray-400'
                                          )}>
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <input type="text" value={entry[sq.id] ?? ''}
                                      onChange={(e) => setEntry(ei, sq.id, e.target.value)}
                                      className="field-input text-sm" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )
                    }
                  })() : (
                    /* Regular question rendering */
                    !editMode ? (
                      <p className={cn('text-sm', formatAnswer(rawVal, q) === '—' ? 'text-gray-400 italic' : 'text-gray-900')}>
                        {formatAnswer(rawVal, q)}
                      </p>
                    ) : (
                      <>
                        {q.questionType === 'GRADE_1_8' && (
                          <div className="grid grid-cols-8 gap-1">
                            {[1,2,3,4,5,6,7,8].map((v) => (
                              <button key={v} type="button"
                                onClick={() => setEditAnswers((a) => ({ ...a, [q.id]: String(v) }))}
                                className={cn('rounded border min-h-[36px] text-sm font-bold transition-all',
                                  String(editAnswers[q.id]) === String(v) ? 'bg-tps-orange text-white border-tps-orange' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                                )}>
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                        {(q.questionType === 'NUMERIC' || q.questionType === 'NUMBER') && (
                          <input type="number" value={String(editAnswers[q.id] ?? '')}
                            onChange={(e) => setEditAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            min={q.scaleMin ?? undefined} max={q.scaleMax ?? undefined}
                            className="field-input w-32" />
                        )}
                        {q.questionType === 'MULTIPLE_CHOICE' && (
                          <select value={String(editAnswers[q.id] ?? '')}
                            onChange={(e) => setEditAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            className="field-select text-sm">
                            <option value="">—</option>
                            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                        {q.questionType === 'TEXT' && (
                          <textarea value={String(editAnswers[q.id] ?? '')}
                            onChange={(e) => setEditAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            rows={3} className="field-input resize-y text-sm" />
                        )}
                      </>
                    )
                  )}
                </div>
              )
            })}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {!editMode ? (
                <>
                  <button onClick={() => setEditMode(true)} className="btn-secondary text-sm flex-1">✎ Edit</button>
                  <button onClick={() => setDeleteTarget(gradecard.id)} className="btn-danger text-sm">Delete</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(false)} className="btn-secondary text-sm">Cancel</button>
                  <button onClick={handleEditSave} disabled={actionPending} className="btn-primary text-sm flex-1">
                    {actionPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Delete confirmation ──────────────────────────────────────────────── */}
    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
        <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
          <p className="font-semibold text-gray-800">Delete this submission?</p>
          <p className="text-sm text-gray-500">This cannot be undone. The submission will be permanently removed.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={() => handleDelete(deleteTarget)} disabled={actionPending} className="btn-danger flex-1 text-sm">
              {actionPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
