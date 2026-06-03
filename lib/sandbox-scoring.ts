/**
 * Sandbox scoring and analysis utilities.
 * These functions are pure — no DB calls.
 */
import { NUMERIC_MAP } from '@/lib/constants'

// ── Score a single submission ─────────────────────────────────────────────────

export interface SandboxQuestion {
  id:           string
  questionType: string
  weight:       number | null
  pointMap:     Record<string, number> | null
  scaleMin:     number | null
  scaleMax:     number | null
  label:        string
}

export function scoreSubmission(
  answers:   Record<string, unknown>,
  questions: SandboxQuestion[],
): number | null {
  const weightedQuestions = questions.filter((q) => q.weight !== null && q.weight > 0)
  if (weightedQuestions.length === 0) return null

  let totalScore = 0

  for (const q of weightedQuestions) {
    const raw = answers[q.id]
    if (raw === undefined || raw === null || raw === '') continue

    const points = getPoints(raw, q)
    if (points === null) continue

    totalScore += points * (q.weight ?? 0)
  }

  return Math.round(totalScore * 100) / 100
}

function getPoints(raw: unknown, q: SandboxQuestion): number | null {
  if (q.questionType === 'GRADE_1_8') {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
    if (isNaN(n) || n < 1 || n > 8) return null
    return NUMERIC_MAP[n] ?? null
  }

  if (q.questionType === 'NUMERIC' || q.questionType === 'NUMBER') {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (isNaN(n)) return null

    if (q.pointMap) {
      // Try exact key match first
      const key = String(Math.round(n))
      if (q.pointMap[key] !== undefined) return q.pointMap[key]
    }

    // Linear interpolation between min→0 and max→100
    const min = q.scaleMin ?? 1
    const max = q.scaleMax ?? 5
    if (max === min) return 50
    return Math.max(0, Math.min(100, ((n - min) / (max - min)) * 100))
  }

  return null
}

// ── Auto-generate a linear point map ─────────────────────────────────────────

export function autoLinearPointMap(min: number, max: number): Record<string, number> {
  const map: Record<string, number> = {}
  const range = max - min
  for (let v = min; v <= max; v++) {
    const pct = range === 0 ? 100 : Math.round(((v - min) / range) * 100)
    map[String(v)] = pct
  }
  return map
}

// ── Per-subject aggregation ───────────────────────────────────────────────────

export interface SubjectAggregate {
  subject:       string
  count:         number
  scores:        number[]
  avgScore:      number | null
  minScore:      number | null
  maxScore:      number | null
  byQuestion:    Record<string, { values: number[]; avg: number | null }>
}

export function aggregateBySubject(
  submissions: { subjectName: string | null; answers: Record<string, unknown>; totalScore: number | null }[],
  questions:   SandboxQuestion[],
): SubjectAggregate[] {
  const map = new Map<string, SubjectAggregate>()

  for (const sub of submissions) {
    const key = sub.subjectName ?? '(anonymous)'
    if (!map.has(key)) {
      map.set(key, {
        subject:    key,
        count:      0,
        scores:     [],
        avgScore:   null,
        minScore:   null,
        maxScore:   null,
        byQuestion: {},
      })
    }
    const agg = map.get(key)!
    agg.count++

    if (sub.totalScore !== null) agg.scores.push(sub.totalScore)

    for (const q of questions) {
      const raw = sub.answers[q.id]
      if (raw === undefined || raw === null || raw === '') continue
      const points = getPoints(raw, q)
      if (points === null) continue
      if (!agg.byQuestion[q.id]) agg.byQuestion[q.id] = { values: [], avg: null }
      agg.byQuestion[q.id].values.push(points)
    }
  }

  const result: SubjectAggregate[] = []
  for (const agg of map.values()) {
    if (agg.scores.length) {
      agg.avgScore = Math.round((agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length) * 100) / 100
      agg.minScore = Math.min(...agg.scores)
      agg.maxScore = Math.max(...agg.scores)
    }
    for (const qId of Object.keys(agg.byQuestion)) {
      const vals = agg.byQuestion[qId].values
      agg.byQuestion[qId].avg = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : null
    }
    result.push(agg)
  }

  return result.sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
}

// ── Multi-dimension desirability score (Value/Risk style) ─────────────────────

export function desirabilityScore(avgValue: number, avgRisk: number): number {
  if (avgRisk === 0) return 0
  return Math.round((avgValue / avgRisk) * 100) / 100
}

// ── Ranking with top-N color coding ──────────────────────────────────────────

export type RankStatus = 'top' | 'middle' | 'low'

export function assignRankStatus(
  items:   { avgScore: number | null }[],
  topN:    number,
): RankStatus[] {
  const sorted = [...items].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
  return items.map((item) => {
    const rank = sorted.findIndex((s) => s === item) + 1
    if (rank <= topN)                                        return 'top'
    if ((item.avgScore ?? 0) >= (sorted[topN]?.avgScore ?? 0)) return 'middle'
    return 'low'
  })
}

// ── LLM prompt generation ─────────────────────────────────────────────────────

export function generateLLMPrompt(
  form:        { title: string; description?: string | null; mode: string },
  questions:   { id: string; label: string; questionType: string; weight: number | null }[],
  submissions: { subjectName: string | null; graderName: string | null; answers: Record<string, unknown>; totalScore: number | null; submittedAt: string }[],
  aggregates:  SubjectAggregate[],
): string {
  const lines: string[] = []
  const hr = '─'.repeat(60)

  lines.push(`ANALYZE RESULTS FOR: ${form.title}`)
  if (form.description) lines.push(`Description: ${form.description}`)
  lines.push(hr)
  lines.push(`Total submissions: ${submissions.length}`)
  lines.push(`Mode: ${form.mode === 'GRADER' ? 'Grader evaluates named subjects' : 'Survey — respondents answer for themselves'}`)
  lines.push('')

  // Questions
  lines.push('FORM QUESTIONS:')
  for (const q of questions) {
    const weight = q.weight !== null ? ` [Weight: ${(q.weight * 100).toFixed(0)}%]` : ''
    lines.push(`  • ${q.label} (${q.questionType})${weight}`)
  }
  lines.push('')

  // Aggregated summary
  if (aggregates.length > 0) {
    lines.push(`SUBJECT SUMMARY (${aggregates.length} subjects, sorted by avg score):`)
    for (let i = 0; i < aggregates.length; i++) {
      const agg = aggregates[i]
      lines.push(`  ${i + 1}. ${agg.subject} — n=${agg.count}, avg=${agg.avgScore?.toFixed(2) ?? 'N/A'}, range=${agg.minScore?.toFixed(1) ?? '?'}–${agg.maxScore?.toFixed(1) ?? '?'}`)
    }
    lines.push('')
  }

  // Raw data
  lines.push('RAW SUBMISSIONS:')
  for (const sub of submissions) {
    lines.push(`Submission — ${sub.subjectName ?? '(survey)'} | Grader: ${sub.graderName ?? 'N/A'} | ${new Date(sub.submittedAt).toLocaleDateString()} | Score: ${sub.totalScore?.toFixed(2) ?? 'N/A'}`)
    for (const q of questions) {
      const val = sub.answers[q.id]
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`  ${q.label}: ${val}`)
      }
    }
    lines.push('')
  }

  lines.push(hr)
  lines.push('ANALYSIS REQUESTED:')
  lines.push('1. Overall performance summary with key findings')
  lines.push('2. Rankings and comparisons where multiple subjects exist')
  lines.push('3. Patterns or themes from free-text responses')
  lines.push('4. Outliers or areas of significant variance')
  lines.push('5. Actionable recommendations based on the data')

  return lines.join('\n')
}
