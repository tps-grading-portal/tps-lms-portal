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
  taskId:            string
  isAirmanship:      boolean
  isBonus:           boolean
  isDemo:            boolean
  minScore:          number | null
  minScoreHard:      boolean
  desiredScore:      number | null
  weight:            number           // fraction 0-1
  scoreEntered:      number | null
  numberAccomplished?: number | null
}

export interface TaskScoreResult {
  taskId:      string
  scoreAwarded: number   // percentage 0-100
  isAutoFail:  boolean
}

export interface EntryScoreResult {
  overallScore:   number   // weighted total, floored at 69 if any fail
  academicPass:   boolean  // no hard-min academic failure
  airmanshipPass: boolean  // no hard-min airmanship failure
  overallPass:    boolean
  taskResults:    TaskScoreResult[]
}

export function scoreEntry(tasks: TaskScoreInput[]): EntryScoreResult {
  let totalWeighted   = 0
  let academicAutoFail   = false
  let airmanshipAutoFail = false
  const taskResults: TaskScoreResult[] = []

  for (const t of tasks) {
    if (t.isDemo || t.minScore === null || t.desiredScore === null) continue
    if (t.scoreEntered === null || t.scoreEntered === undefined) continue

    const pct       = lookupScore(t.minScore, t.desiredScore, t.scoreEntered)
    const isBelowMin = t.scoreEntered < t.minScore
    const isAutoFail = t.minScoreHard && isBelowMin

    totalWeighted += pct * t.weight

    if (isAutoFail) {
      if (t.isAirmanship) airmanshipAutoFail = true
      else academicAutoFail = true
    }

    taskResults.push({ taskId: t.taskId, scoreAwarded: pct, isAutoFail })
  }

  const academicPass   = !academicAutoFail
  const airmanshipPass = !airmanshipAutoFail
  const anyFail        = !academicPass || !airmanshipPass
  const belowThreshold = totalWeighted < 69

  const overallPass  = !anyFail && !belowThreshold
  const overallScore = overallPass ? totalWeighted : 69

  return { overallScore, academicPass, airmanshipPass, overallPass, taskResults }
}
