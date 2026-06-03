'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Question = {
  id:           string
  questionKey:  string
  questionText: string
  questionType: string
  options:      unknown
  sortOrder:    number
  isRequired:   boolean
}

type ResponseRecord = {
  id:          string
  classId:     string
  className:   string
  submittedAt: string
  responses:   Record<string, unknown>
}

interface Props {
  classes:              { id: string; name: string; isActive: boolean }[]
  studentQuestions:     Question[]
  instructorQuestions:  Question[]
  studentResponses:     ResponseRecord[]
  instructorResponses:  ResponseRecord[]
}

// ── Section grouping ──────────────────────────────────────────────────────────

function getSectionTitle(sortOrder: number, surveyType: 'STUDENT' | 'INSTRUCTOR'): string {
  if (surveyType === 'STUDENT') {
    if (sortOrder <= 2)  return 'Section 1: About You & Your Comp Oral Exam'
    if (sortOrder <= 13) return 'Section 2: Your Comp Oral Exam Scenario'
    if (sortOrder <= 24) return 'Section 3: Exam Process & Preparation'
    return 'Section 4: Self-Assessment of Preparation'
  }
  if (sortOrder <= 3) return 'Section 1: Examination Details'
  return 'Section 2: Scenario Evaluation'
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

function getAnswers(responses: ResponseRecord[], key: string): string[] {
  return responses
    .map((r) => {
      const val = r.responses[key]
      if (val === null || val === undefined || val === '') return null
      return String(val).trim()
    })
    .filter((v): v is string => v !== null && v.length > 0)
}

function mean(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// ── Bar component ─────────────────────────────────────────────────────────────

function ResponseBar({
  label, count, total, color = 'bg-tps-orange',
}: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
        <div
          className={`h-full ${color} rounded-sm transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-20 text-right flex-shrink-0">
        {count} ({pct}%)
      </span>
    </div>
  )
}

// ── Question result card ──────────────────────────────────────────────────────

function QuestionResult({
  question,
  responses,
}: {
  question:  Question
  responses: ResponseRecord[]
}) {
  const [expanded, setExpanded] = useState(false)
  const answers   = getAnswers(responses, question.questionKey)
  const options   = Array.isArray(question.options) ? (question.options as string[]) : []
  const answered  = answers.length
  const total     = responses.length
  const skipRate  = total > 0 ? Math.round(((total - answered) / total) * 100) : 0

  if (answered === 0) {
    return (
      <div className="card border border-gray-100 py-3">
        <p className="text-sm font-medium text-gray-700 mb-1">{question.questionText}</p>
        <p className="text-xs text-gray-400 italic">No responses yet</p>
      </div>
    )
  }

  // ── LIKERT ───────────────────────────────────────────────────────────────
  if (question.questionType === 'LIKERT') {
    const nums    = answers.map((a) => parseInt(a, 10)).filter((n) => !isNaN(n))
    const avg     = mean(nums)
    const scale   = options.length > 0 ? options.length : 5
    const counts  = Array.from({ length: scale }, (_, i) => ({
      label: options[i] ?? String(i + 1),
      count: nums.filter((n) => n === i + 1).length,
    }))
    const barColor = (i: number) => {
      if (i < 1) return 'bg-red-400'
      if (i < 2) return 'bg-orange-400'
      if (i < 3) return 'bg-amber-400'
      if (i < 4) return 'bg-green-400'
      return 'bg-emerald-500'
    }

    return (
      <div className="card border border-gray-100 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-gray-700 flex-1">{question.questionText}</p>
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-bold text-tps-navy">{avg.toFixed(1)}</span>
            <span className="text-xs text-gray-400">/{scale}</span>
            <p className="text-[10px] text-gray-400">{answered} response{answered !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="space-y-1">
          {counts.map(({ label, count }, i) => (
            <ResponseBar key={i} label={label} count={count} total={answered} color={barColor(i)} />
          ))}
        </div>
        {skipRate > 0 && (
          <p className="text-[10px] text-gray-400">{skipRate}% did not answer (optional)</p>
        )}
      </div>
    )
  }

  // ── MULTIPLE_CHOICE / MULTI_SELECT ───────────────────────────────────────
  if (question.questionType === 'MULTIPLE_CHOICE' || question.questionType === 'MULTI_SELECT') {
    const allAnswers = answers.flatMap((a) => a.split(',').map((s) => s.trim()))
    const displayOptions = options.length > 0 ? options : [...new Set(allAnswers)].sort()
    const counts = displayOptions.map((opt) => ({
      label: opt,
      count: allAnswers.filter((a) => a === opt).length,
    })).sort((a, b) => b.count - a.count)

    return (
      <div className="card border border-gray-100 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-gray-700 flex-1">{question.questionText}</p>
          <p className="text-[10px] text-gray-400 flex-shrink-0">{answered} response{answered !== 1 ? 's' : ''}</p>
        </div>
        <div className="space-y-1">
          {counts.map(({ label, count }, i) => (
            <ResponseBar key={i} label={label} count={count} total={answered} />
          ))}
        </div>
      </div>
    )
  }

  // ── TEXT / free text ─────────────────────────────────────────────────────
  if (question.questionType === 'TEXT') {
    const textResponses = responses
      .map((r) => ({
        text:        String(r.responses[question.questionKey] ?? '').trim(),
        className:   r.className,
        submittedAt: r.submittedAt,
      }))
      .filter((r) => r.text.length > 0)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    const visible = expanded ? textResponses : textResponses.slice(0, 5)

    return (
      <div className="card border border-gray-100 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-gray-700 flex-1">{question.questionText}</p>
          <p className="text-[10px] text-gray-400 flex-shrink-0">{textResponses.length} response{textResponses.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="space-y-2">
          {visible.map((r, i) => (
            <TextResponse key={i} text={r.text} className={r.className} date={r.submittedAt} />
          ))}
        </div>
        {textResponses.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-tps-orange hover:underline"
          >
            {expanded ? '▲ Show fewer' : `▼ Show all ${textResponses.length} responses`}
          </button>
        )}
      </div>
    )
  }

  // ── DATE / NUMBER ────────────────────────────────────────────────────────
  if (question.questionType === 'DATE') {
    const dates = answers.filter((a) => a.match(/\d{4}-\d{2}-\d{2}/)).sort()
    return (
      <div className="card border border-gray-100 space-y-1">
        <p className="text-sm font-medium text-gray-700">{question.questionText}</p>
        <p className="text-xs text-gray-500">
          {dates.length} response{dates.length !== 1 ? 's' : ''} ·
          Range: {dates[0] ?? '—'} to {dates[dates.length - 1] ?? '—'}
        </p>
      </div>
    )
  }

  if (question.questionType === 'NUMBER') {
    const nums = answers.map(Number).filter((n) => !isNaN(n))
    const avg  = nums.length ? mean(nums) : 0
    const min  = nums.length ? Math.min(...nums) : 0
    const max  = nums.length ? Math.max(...nums) : 0
    return (
      <div className="card border border-gray-100 space-y-1">
        <p className="text-sm font-medium text-gray-700">{question.questionText}</p>
        <p className="text-xs text-gray-500">
          {nums.length} response{nums.length !== 1 ? 's' : ''} · Avg: {avg.toFixed(1)} · Range: {min}–{max}
        </p>
      </div>
    )
  }

  return null
}

// ── Text response entry ────────────────────────────────────────────────────────

function TextResponse({ text, className, date }: { text: string; className: string; date: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 200

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 border-l-2 border-tps-orange">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold text-tps-orange">Class {className}</span>
        <span className="text-[10px] text-gray-400">
          {new Date(date).toLocaleDateString()}
        </span>
      </div>
      <p className={cn('text-xs text-gray-700 leading-relaxed', !expanded && isLong && 'line-clamp-3')}>
        {text}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-tps-orange hover:underline mt-1">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCsv(
  responses: ResponseRecord[],
  questions: Question[],
  filename:  string,
) {
  if (responses.length === 0) return

  const keys    = questions.map((q) => q.questionKey)
  const headers = ['Class', 'Submitted At', ...questions.map((q) => `"${q.questionText.replace(/"/g, '""')}"`)].join(',')

  const rows = responses.map((r) => {
    const cells = [
      r.className,
      new Date(r.submittedAt).toLocaleString(),
      ...keys.map((k) => {
        const val = r.responses[k]
        if (val === null || val === undefined) return ''
        return `"${String(val).replace(/"/g, '""')}"`
      }),
    ]
    return cells.join(',')
  })

  const csv  = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main viewer ───────────────────────────────────────────────────────────────

export function SurveyViewer({
  classes,
  studentQuestions,
  instructorQuestions,
  studentResponses,
  instructorResponses,
}: Props) {
  const [activeTab,       setActiveTab]       = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT')
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())

  const toggleClass = (id: string) =>
    setSelectedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const responses  = activeTab === 'STUDENT' ? studentResponses  : instructorResponses
  const questions  = activeTab === 'STUDENT' ? studentQuestions  : instructorQuestions
  const surveyType = activeTab

  const filtered = useMemo(
    () =>
      selectedClasses.size === 0
        ? responses
        : responses.filter((r) => selectedClasses.has(r.classId)),
    [responses, selectedClasses],
  )

  // Group questions by section
  const sections = useMemo(() => {
    const map = new Map<string, Question[]>()
    for (const q of questions) {
      const title = getSectionTitle(q.sortOrder, surveyType)
      if (!map.has(title)) map.set(title, [])
      map.get(title)!.push(q)
    }
    return Array.from(map.entries())
  }, [questions, surveyType])

  const csvFilename =
    `TPS-${surveyType.toLowerCase()}-survey` +
    (selectedClasses.size === 1
      ? `-${classes.find((c) => selectedClasses.has(c.id))?.name ?? 'class'}`
      : selectedClasses.size > 1
      ? `-${selectedClasses.size}-classes`
      : '-all-classes') +
    '.csv'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Survey Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} response{filtered.length !== 1 ? 's' : ''}
            {selectedClasses.size > 0
              ? ` from ${selectedClasses.size} selected class${selectedClasses.size !== 1 ? 'es' : ''}`
              : ' across all classes'}
          </p>
        </div>
        <button
          onClick={() => downloadCsv(filtered, questions, csvFilename)}
          disabled={filtered.length === 0}
          className="btn-secondary text-sm"
        >
          ↓ Download CSV
        </button>
      </div>

      {/* Survey type tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {(['STUDENT', 'INSTRUCTOR'] as const).map((tab) => {
            const count = tab === 'STUDENT'
              ? (selectedClasses.size === 0 ? studentResponses : studentResponses.filter(r => selectedClasses.has(r.classId))).length
              : (selectedClasses.size === 0 ? instructorResponses : instructorResponses.filter(r => selectedClasses.has(r.classId))).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab
                    ? 'border-tps-orange text-tps-orange font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )}
              >
                {tab === 'STUDENT' ? 'Student Survey' : 'Instructor Survey'}
                <span className={cn(
                  'ml-2 text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab ? 'bg-tps-orange text-white' : 'bg-gray-100 text-gray-500',
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Class filter pills */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Filter by class</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedClasses(new Set())}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              selectedClasses.size === 0
                ? 'bg-tps-navy text-white border-tps-navy'
                : 'bg-white text-gray-600 border-gray-300 hover:border-tps-navy',
            )}
          >
            All Classes
          </button>
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => toggleClass(cls.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                selectedClasses.has(cls.id)
                  ? 'bg-tps-navy text-white border-tps-navy'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-tps-navy',
              )}
            >
              {cls.name}
              {cls.isActive && <span className="ml-1 text-[9px] opacity-60">●</span>}
            </button>
          ))}
        </div>
      </div>

      {/* No responses */}
      {filtered.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No survey responses yet</p>
          <p className="text-sm mt-1">
            Responses will appear here after students and instructors complete the surveys.
          </p>
        </div>
      )}

      {/* Questions by section */}
      {filtered.length > 0 && (
        <div className="space-y-8">
          {sections.map(([sectionTitle, sectionQuestions]) => (
            <section key={sectionTitle} className="space-y-4">
              <div className="pl-4 border-l-4 border-tps-orange">
                <h2 className="text-base font-bold text-tps-navy">{sectionTitle}</h2>
                <p className="text-xs text-gray-400">
                  {sectionQuestions.length} question{sectionQuestions.length !== 1 ? 's' : ''}
                </p>
              </div>
              {sectionQuestions.map((q) => (
                <QuestionResult key={q.id} question={q} responses={filtered} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
