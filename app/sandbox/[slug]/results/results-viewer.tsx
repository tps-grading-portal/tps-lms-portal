'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { aggregateBySubject, generateLLMPrompt, assignRankStatus } from '@/lib/sandbox-scoring'
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
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [activeTab,   setActiveTab]   = useState<Tab>('summary')
  const [topN,        setTopN]        = useState(5)
  const [llmCopied,   setLlmCopied]   = useState(false)
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
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Highlight top</label>
            <input type="number" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 5)}
              min={1} max={aggregates.length} className="field-input w-16 text-center" />
            <span className="text-sm text-gray-600">subjects</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Rank</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Subject</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Responses</th>
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
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Grader</th>
                {questions.map((q) => (
                  <th key={q.id} className="px-3 py-2 text-left font-semibold text-gray-600 max-w-[120px]">
                    <span className="block truncate">{q.label}</span>
                  </th>
                ))}
                {form.scoringEnabled && <th className="px-3 py-2 text-left font-semibold text-gray-600">Score</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <tr key={s.id} className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(s.submittedAt).toLocaleString()}</td>
                  {form.mode === 'GRADER' && <td className="px-3 py-2 font-medium">{s.subjectName ?? '—'}</td>}
                  <td className="px-3 py-2 text-gray-500">{s.graderName ?? '—'}</td>
                  {questions.map((q) => (
                    <td key={q.id} className="px-3 py-2 text-gray-700">
                      {(() => {
                        const val = s.answers[q.id]
                        if (val === undefined || val === null || val === '') return <span className="text-gray-300">—</span>
                        if (Array.isArray(val)) return val.join(', ')
                        return String(val)
                      })()}
                    </td>
                  ))}
                  {form.scoringEnabled && (
                    <td className="px-3 py-2 font-bold font-mono">{s.totalScore?.toFixed(2) ?? '—'}</td>
                  )}
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr><td colSpan={99} className="px-3 py-8 text-center text-gray-400">No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
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
  )
}
