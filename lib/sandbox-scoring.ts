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

// ── Repeating Section types and scoring ──────────────────────────────────────

export interface RepeatSubQuestion {
  id:        string
  label:     string
  type:      string   // GRADE_1_8 | NUMERIC | etc.
  subWeight: number   // weight within the section (0–1, must sum to 1)
}

export interface RepeatingSectionConfig {
  subQuestions:   RepeatSubQuestion[]
  subjectSource:  'freetext' | 'predefined'
  predefinedList?: string[]  // section-level override of form predefinedSubjects
}

export interface RepeatEntry {
  subject: string
  [sqId: string]: string  // sub-question answers
}

/** Parse a repeating section's answers from the submission JSON */
export function parseRepeatEntries(raw: unknown): RepeatEntry[] {
  if (!raw) return []
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as RepeatEntry[]
    if (Array.isArray(raw)) return raw as RepeatEntry[]
  } catch { /* fall through */ }
  return []
}

/**
 * Compute group score (non-repeating questions only) for a single submission.
 * Returns 0–100 representing the group component.
 */
export function scoreGroupComponent(
  answers:   Record<string, unknown>,
  questions: SandboxQuestion[],
): number {
  const groupQs = questions.filter((q) => q.questionType !== 'REPEATING_SECTION' && q.weight !== null && q.weight > 0)
  let score = 0
  for (const q of groupQs) {
    const pts = getPoints(answers[q.id], q)
    if (pts !== null) score += pts * (q.weight ?? 0)
  }
  return Math.round(score * 100) / 100
}

/**
 * Compute per-person individual score for one entry in a repeating section.
 * Returns the person's section contribution (already multiplied by sectionWeight).
 */
export function scoreIndividualEntry(
  entry:         RepeatEntry,
  config:        RepeatingSectionConfig,
  sectionWeight: number,
): number {
  let sectionScore = 0
  for (const sq of config.subQuestions) {
    const raw = entry[sq.id]
    if (!raw) continue
    const pts = getPoints(raw, { id: sq.id, questionType: sq.type, weight: null, pointMap: null, scaleMin: null, scaleMax: null, label: sq.label })
    if (pts !== null) sectionScore += pts * sq.subWeight
  }
  return Math.round(sectionScore * sectionWeight * 100) / 100
}

/**
 * Aggregate group + individual scores across multiple grader submissions for the same group.
 *
 * Formula (matches sandbox-example1.js updateMasterSummary):
 *   groupScore  = avg(groupComponent) across all submissions for this group
 *   individualScore_p = avg(sectionScore_p) across submissions where person p was graded
 *   totalScore_p = groupScore + individualScore_p
 */
export interface GroupPersonScore {
  person:           string
  groupScore:       number
  individualScore:  number
  totalScore:       number
  gradersCount:     number
}

export function aggregateRepeatingSection(
  submissions: {
    subjectName:   string | null
    answers:       Record<string, unknown>
    graderName:    string | null
  }[],
  questions:    SandboxQuestion[],
): Map<string, GroupPersonScore[]> {
  // Map: groupName → Map<personName, { groupScores[], individualScores[] }>
  const byGroup = new Map<string, Map<string, { groupScores: number[]; indivScores: number[] }>>()

  const repeatQ = questions.find((q) => q.questionType === 'REPEATING_SECTION')
  if (!repeatQ) return new Map()

  const config = (repeatQ as SandboxQuestion & { options?: unknown }).options as RepeatingSectionConfig | null
  if (!config) return new Map()

  const sectionWeight = repeatQ.weight ?? 0

  for (const sub of submissions) {
    const group = sub.subjectName ?? '(ungrouped)'
    if (!byGroup.has(group)) byGroup.set(group, new Map())
    const personMap = byGroup.get(group)!

    const groupScore = scoreGroupComponent(sub.answers, questions)
    const entries    = parseRepeatEntries(sub.answers[repeatQ.id])

    for (const entry of entries) {
      const person = entry.subject?.trim()
      if (!person) continue
      if (!personMap.has(person)) personMap.set(person, { groupScores: [], indivScores: [] })
      const pm = personMap.get(person)!
      pm.groupScores.push(groupScore)
      pm.indivScores.push(scoreIndividualEntry(entry, config, sectionWeight))
    }
  }

  const result = new Map<string, GroupPersonScore[]>()
  for (const [group, personMap] of byGroup) {
    const personScores: GroupPersonScore[] = []
    for (const [person, data] of personMap) {
      const avgGroup  = data.groupScores.reduce((a, b) => a + b, 0) / data.groupScores.length
      const avgIndiv  = data.indivScores.reduce((a, b) => a + b, 0) / data.indivScores.length
      personScores.push({
        person,
        groupScore:      Math.round(avgGroup * 100) / 100,
        individualScore: Math.round(avgIndiv * 100) / 100,
        totalScore:      Math.round((avgGroup + avgIndiv) * 100) / 100,
        gradersCount:    data.groupScores.length,
      })
    }
    result.set(group, personScores.sort((a, b) => b.totalScore - a.totalScore))
  }
  return result
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
