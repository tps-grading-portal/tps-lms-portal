// TPS Gradesheet scoring engine
// Fixed lookup table: rows = min/desired, columns = score entered (0-4)

const LOOKUP: Record<string, [number, number, number, number, number]> = {
  '0/1': [70, 90, 93, 97, 100],
  '0/2': [70, 80, 90, 95, 100],
  '0/3': [70, 77, 83, 90, 100],
  '1/1': [60, 90, 93, 97, 100],
  '1/2': [60, 70, 90, 95, 100],
  '1/3': [60, 70, 80, 90, 100],
  '2/2': [30, 60, 90, 95, 100],
  '2/3': [30, 60, 70, 90, 100],
  '3/3': [0,  30, 60, 90, 100],
}

export function lookupScore(minScore: number, desiredScore: number, scoreEntered: number): number {
  const key = `${minScore}/${desiredScore}`
  const row = LOOKUP[key]
  if (!row) return 0
  const idx = Math.max(0, Math.min(4, scoreEntered))
  return row[idx]
}

export interface TaskScoreInput {
  taskId:             string
  isAirmanship:       boolean
  isBonus:            boolean
  isDemo:             boolean
  isNA:               boolean          // excluded from scoring entirely
  minScore:           number | null
  minScoreHard:       boolean
  desiredScore:       number | null
  weight:             number           // fraction 0-1
  scoreEntered:       number | null
  numberAccomplished: number | null    // null = treat as 1
  numberRequired:     number           // from task definition
}

export interface TaskScoreResult {
  taskId:       string
  scoreAwarded: number   // percentage 0-100 (post-proration)
  isAutoFail:   boolean
  isNA:         boolean
}

export interface EntryScoreResult {
  overallScore:   number   // weighted total, floored at 69 if any fail
  academicPass:   boolean
  airmanshipPass: boolean
  overallPass:    boolean
  taskResults:    TaskScoreResult[]
}

export function scoreEntry(tasks: TaskScoreInput[]): EntryScoreResult {
  let weightedSum        = 0
  let activeWeightSum    = 0   // sum of weights for non-demo, non-NA tasks that have a score
  let academicAutoFail   = false
  let airmanshipAutoFail = false
  const taskResults: TaskScoreResult[] = []

  for (const t of tasks) {
    // Skip demos entirely
    if (t.isDemo) continue

    // N/A tasks are excluded from scoring — don't add to weight sum
    if (t.isNA) {
      taskResults.push({ taskId: t.taskId, scoreAwarded: 0, isAutoFail: false, isNA: true })
      continue
    }

    // Skip tasks with no score entered yet
    if (t.scoreEntered === null || t.scoreEntered === undefined) continue
    if (t.minScore === null || t.desiredScore === null) continue

    // Base lookup score
    const basePct = lookupScore(t.minScore, t.desiredScore, t.scoreEntered)

    // # Accomplished proration
    const accomplished = t.numberAccomplished ?? 1
    const required     = Math.max(1, t.numberRequired)
    const fraction     = Math.min(accomplished, required) / required

    // 0 accomplished = 0 score (task was not attempted)
    const scoreAwarded = accomplished === 0 ? 0 : basePct * fraction

    // Auto-fail check:
    // - Hard min AND score below min
    // - OR hard min AND 0 accomplished (required task not attempted)
    const belowMin   = t.scoreEntered < t.minScore
    const notAttempted = accomplished === 0
    const isAutoFail = t.minScoreHard && (belowMin || notAttempted)

    weightedSum     += scoreAwarded * t.weight
    activeWeightSum += t.weight

    if (isAutoFail) {
      if (t.isAirmanship) airmanshipAutoFail = true
      else academicAutoFail = true
    }

    taskResults.push({ taskId: t.taskId, scoreAwarded, isAutoFail, isNA: false })
  }

  // Renormalize if N/A tasks removed weight from the denominator
  // scoreAwarded is 0-100 and weight is 0-1, so weightedSum is already in percentage points
  const rawScore = activeWeightSum > 0 ? weightedSum / activeWeightSum : 0

  const academicPass   = !academicAutoFail
  const airmanshipPass = !airmanshipAutoFail
  const anyFail        = !academicPass || !airmanshipPass
  const belowThreshold = rawScore < 69

  const overallPass  = !anyFail && !belowThreshold
  const overallScore = overallPass ? rawScore : 69

  return { overallScore, academicPass, airmanshipPass, overallPass, taskResults }
}
