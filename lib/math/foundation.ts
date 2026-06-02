/**
 * Foundation Report generator.
 * Produces a structured LLM context block — copy-paste into Claude/ChatGPT.
 * Mirrors the legacy generateFoundationReport() output exactly.
 *
 * Sections:
 *  1. Operator instructions
 *  2. LLM analysis instructions (9 objectives)
 *  3. TPS educational context
 *  4. Data summary
 *  5. Statistical findings
 *  6. Grader analysis
 *  7. Scenario & track analysis
 *  8. Survey data (student comments organized by theme)
 *  9. Statistical appendix (raw matrices)
 */
import type { FullAnalysisResult, SessionStats } from './types'
import { TRACK_LABELS } from '@/lib/utils'
import { FTC_TRACKS, STC_TRACKS, PASSING_SCORE, AUTO_FAIL_SCORE } from '@/lib/constants'

const hr = '─'.repeat(80)

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return 'N/A'
  return n.toFixed(decimals)
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'N/A'
  return `${(n * 100).toFixed(1)}%`
}

export function generateFoundationReport(
  analysis: FullAnalysisResult,
  data: SessionStats[],
  criteriaList: { id: string; code: string; name: string; weight: number }[],
  studentSurveys: { responses: unknown; submittedAt: Date }[],
  instructorSurveys: { responses: unknown; submittedAt: Date }[],
  classNames: string[],
): string {
  const lines: string[] = []

  const push = (...strs: string[]) => lines.push(...strs)
  const section = (title: string) => {
    push('', hr, `  ${title}`, hr, '')
  }

  // ── 1. OPERATOR INSTRUCTIONS ────────────────────────────────────────────────
  section('🚀 OPERATOR INSTRUCTIONS — READ FIRST')
  push(
    'STEP 1: Verify all grading data is finalized in the TPS Grading Portal.',
    'STEP 2: Copy ALL content below this box into a new LLM conversation.',
    'STEP 3: The LLM will auto-process all instructions and data.',
    'STEP 4: Provide supporting documents if requested (Andragogy doc, Rubric, School Outcomes).',
    'STEP 5: Wait for the 12-15 page Comprehensive Analysis Report.',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Class(es): ${classNames.join(', ')}`,
    `Total sessions analysed: ${data.length}`,
  )

  // ── 2. LLM ANALYSIS INSTRUCTIONS ───────────────────────────────────────────
  section('📋 TPS COMPREHENSIVE ORAL EXAMINATION — LLM ANALYSIS INSTRUCTIONS')
  push(
    'MISSION: You are analysing USAF Test Pilot School Comprehensive Oral Examination data.',
    'Your analysis will directly impact TPS curriculum development, student preparation,',
    'and faculty development.',
    '',
    '⚠️ CRITICAL STATISTICAL REQUIREMENT:',
    'When calculating standard deviation for scenario/performance analysis, EXCLUDE',
    'automatic failure scores (69). RETAIN pass/fail rates and failure counts for reporting.',
    'Report both "Performance StdDev (excluding failures)" and "Pass Rate including failures".',
    '',
    'FTC/STC SEPARATION MANDATE:',
    `  FTC (Flight Test Course): ${FTC_TRACKS.map((t) => TRACK_LABELS[t]).join(', ')}`,
    `  STC (Space Test Course):  ${STC_TRACKS.map((t) => TRACK_LABELS[t]).join(', ')}`,
    'Every performance metric, recommendation, and finding MUST be reported separately.',
    '',
    'PRIVACY PROTOCOL:',
    '  • Anonymise students as Student_001, Student_002, etc.',
    '  • Anonymise instructors as Instructor_A, Instructor_B, etc.',
    '',
    '9 ANALYSIS OBJECTIVES:',
    '  1. EXAM EFFECTIVENESS vs TPS SCHOOL OUTCOMES — Evaluate TLTI pillar coverage.',
    '  2. CURRICULUM EFFECTIVENESS — Correlate preparation ratings with performance.',
    '  3. SCENARIO EFFECTIVENESS — Fairness, difficulty, elicitation of TLTI skills.',
    '  4. STUDENT PERFORMANCE INSIGHTS — Statistical trends across pillars and criteria.',
    '  5. EMERGENT INSIGHTS — Non-obvious cross-source patterns.',
    '  6. SYNTHETIC TRAINING AIDS — WAA/Average/Fail transcript examples.',
    '  7. ACTIONABLE RECOMMENDATIONS — Faculty and Leadership, FTC and STC specific.',
    '  8. FTC/STC COMPARATIVE ANALYSIS — Differentiated performance and preparation.',
    '  9. STAFF RECOGNITION — Named staff from student/instructor comments (quotes only).',
    '',
    'REQUIRED OUTPUT: 12-15 page Comprehensive Analysis Report with:',
    '  • Executive Summary (2-3 pages)',
    '  • Detailed Analysis by Objective',
    '  • Integrated Recommendations Matrix (Faculty + Leadership, 0-3 mo and 3-12 mo)',
    '  • Staff Recognition List',
  )

  // ── 3. TPS EDUCATIONAL CONTEXT ──────────────────────────────────────────────
  section('📚 TPS EDUCATIONAL CONTEXT')
  push(
    'TLTI GRADUATE OUTCOMES: Tester (75%), Leader (15%), Thinker (5%), Innovator (5%)',
    'NOTE: Innovator pillar NOT graded in current Comp Oral (3 pillars, 7 criteria).',
    '',
    'EXAM STRUCTURE:',
    '  • 35 min scenario preparation',
    '  • 25±5 min presentation + Q&A',
    '  • 4-5 graders per student, 4 minimum required',
    '  • Discontinuity: any two graders differ >2 on 1-8 scale → Panel Chair resolves',
    '',
    'GRADE SCALE: 1=Well Above Average (100pts) → 4=Average (85pts) → 8=Fail (69pts)',
    'AUTO-FAIL POLICY: Any grade of 8 from any grader → entire score = 69 (Fail)',
    '',
    'RUBRIC CRITERIA (weights sum to 100%):',
  )
  for (const c of criteriaList) {
    push(`  ${c.code}  ${c.name.padEnd(40)} [${(c.weight * 100).toFixed(1)}%]`)
  }

  // ── 4. DATA SUMMARY ─────────────────────────────────────────────────────────
  section('📊 DATA SUMMARY')
  const { summary } = analysis
  push(
    `Total sessions (complete):  ${data.length}`,
    `Total unique graders:        ${summary.totalGraders.size}`,
    `Finalized sessions:          ${summary.completeSessions}`,
    `Average final score:         ${fmt(summary.avgScore)}`,
    `Score std dev (excl. fails): ${fmt(summary.scoreStdDev)}`,
    `Passing rate (≥${PASSING_SCORE}):      ${fmtPct(summary.passingRate)}`,
    `Fail rate (auto-fail):       ${fmtPct(summary.failRate)}`,
    `Student surveys received:    ${studentSurveys.length}`,
    `Instructor surveys received: ${instructorSurveys.length}`,
  )

  // ── 5. STATISTICAL FINDINGS — RELIABILITY ──────────────────────────────────
  section('📐 STATISTICAL FINDINGS — INTER-RATER RELIABILITY')
  const { reliability } = analysis
  const iccInterp = (v: number | null) =>
    v === null ? 'N/A' : v < 0.7 ? '⚠ Concern (<0.70)' : v < 0.8 ? '✓ Acceptable' : '✓✓ Good'

  push(
    `ICC(2,k) Overall:     ${fmt(reliability.icc)}   ${iccInterp(reliability.icc)}`,
    `Kendall's W:          ${fmt(reliability.kendallW)}`,
    `Fleiss' Kappa (P/F):  ${fmt(reliability.fleissKappa)}`,
    `Cronbach's Alpha:     ${fmt(reliability.cronbachAlpha)}`,
    '',
    'ICC by Criterion:',
  )
  for (const c of criteriaList) {
    const icc = reliability.iccByCriterion.get(c.id) ?? null
    push(`  ${c.code}  ${fmt(icc)}  ${iccInterp(icc)}`)
  }
  push('', 'Item-Total Correlations:')
  for (const c of criteriaList) {
    const corr = reliability.itemTotalCorrelations.get(c.code) ?? null
    push(`  ${c.code}  r = ${fmt(corr)}`)
  }

  // ── 6. GRADER BIAS ANALYSIS ──────────────────────────────────────────────────
  section('⚖️ GRADER BIAS ANALYSIS')
  push(
    'Bias classification: Lenient = Z > +0.5 SD, Strict = Z < -0.5 SD',
    '',
    `${'Grader'.padEnd(20)} ${'Avg Score'.padEnd(12)} ${'Z-Score'.padEnd(10)} ${'Bias'.padEnd(10)} ${'Correction'.padEnd(12)} ${'n'.padEnd(6)} Reliability`,
  )
  for (const g of analysis.graderBias) {
    push(
      `${g.graderName.padEnd(20)} ${fmt(g.avgScore).padEnd(12)} ${fmt(g.zScore).padEnd(10)} ${g.bias.padEnd(10)} ${fmt(g.correction).padEnd(12)} ${String(g.totalGrades).padEnd(6)} ${g.reliability}`,
    )
  }

  // ── 7. CRITERION PERFORMANCE ────────────────────────────────────────────────
  section('🎯 CRITERION PERFORMANCE MATRIX')
  push(
    `${'Code'.padEnd(6)} ${'Name'.padEnd(38)} ${'Difficulty'.padEnd(12)} ${'Discrimination'.padEnd(16)} ${'Fail Rate'.padEnd(11)} ${'Avg Score'}`,
  )
  for (const c of analysis.criterionStats) {
    const diffLabel =
      c.avgDifficulty === null
        ? 'N/A'
        : c.avgDifficulty < 2.5
        ? `${fmt(c.avgDifficulty)} (Easy)`
        : c.avgDifficulty > 5.5
        ? `${fmt(c.avgDifficulty)} (Hard)`
        : `${fmt(c.avgDifficulty)} (Mod)`

    push(
      `${c.code.padEnd(6)} ${c.name.substring(0, 37).padEnd(38)} ${diffLabel.padEnd(12)} ${fmt(c.discrimination).padEnd(16)} ${fmtPct(c.failRate).padEnd(11)} ${fmt(c.avgNumericScore)}`,
    )
  }

  // ── 8. G-THEORY VARIANCE COMPONENTS ────────────────────────────────────────
  if (analysis.gTheory) {
    const g = analysis.gTheory
    section('🔬 GENERALIZABILITY THEORY — VARIANCE COMPONENTS')
    push(
      `Student variance:   ${fmt(g.studentVariance)}   (${fmtPct(g.studentPercent)} of total)`,
      `Grader variance:    ${fmt(g.graderVariance)}   (${fmtPct(g.graderPercent)} of total)`,
      `Criterion variance: ${fmt(g.criterionVariance)}   (${fmtPct(g.criterionPercent)} of total)`,
      `Residual variance:  ${fmt(g.residualVariance)}   (${fmtPct(g.residualPercent)} of total)`,
      '',
      'Predicted Reliability by Grader Count (Spearman-Brown):',
      ...g.predictedByGraders.map(({ n, reliability }) => `  ${n} graders → ${fmt(reliability)}`),
    )
  }

  // ── 9. SCENARIO PERFORMANCE ──────────────────────────────────────────────────
  section('📋 SCENARIO PERFORMANCE')
  push(
    `${'Scenario'.padEnd(25)} ${'n'.padEnd(5)} ${'Avg Score'.padEnd(12)} ${'StdDev (no-fail)'.padEnd(18)} ${'Pass Rate'}`,
  )
  for (const s of analysis.scenarios) {
    push(
      `${s.scenario.substring(0, 24).padEnd(25)} ${String(s.studentCount).padEnd(5)} ${fmt(s.avgScore).padEnd(12)} ${fmt(s.stdDev).padEnd(18)} ${fmtPct(s.passRate)}`,
    )
  }

  // ── 10. TRACK PERFORMANCE ────────────────────────────────────────────────────
  section('✈️ TRACK PERFORMANCE (FTC vs STC)')
  const ftcTracks = analysis.tracks.filter((t) => (FTC_TRACKS as readonly string[]).includes(t.track))
  const stcTracks = analysis.tracks.filter((t) => (STC_TRACKS as readonly string[]).includes(t.track))

  for (const [label, tracks] of [['FTC', ftcTracks], ['STC', stcTracks]] as const) {
    push(`${label}:`)
    for (const t of tracks) {
      push(
        `  ${(TRACK_LABELS[t.track] ?? t.track).padEnd(20)} n=${t.studentCount}  avg=${fmt(t.avgScore)}  pass=${fmtPct(t.passRate)}`,
      )
    }
  }

  // ── 11. STUDENT SURVEY COMMENTS (organised by question) ─────────────────────
  if (studentSurveys.length > 0) {
    section('💬 STUDENT SURVEY DATA')
    push(`Total responses: ${studentSurveys.length}`, '')

    // Collect all free-text responses grouped by question key
    const textResponses = new Map<string, string[]>()
    const likertByKey   = new Map<string, number[]>()

    for (const survey of studentSurveys) {
      const r = survey.responses as Record<string, unknown>
      for (const [key, value] of Object.entries(r)) {
        if (key.startsWith('_')) continue
        if (typeof value === 'string' && value.length > 10 && isNaN(Number(value))) {
          // Likely a text response
          if (!textResponses.has(key)) textResponses.set(key, [])
          textResponses.get(key)!.push(value)
        } else if (typeof value === 'string' && !isNaN(Number(value))) {
          // Likert / numeric
          const n = Number(value)
          if (!likertByKey.has(key)) likertByKey.set(key, [])
          likertByKey.get(key)!.push(n)
        }
      }
    }

    // Likert averages
    if (likertByKey.size > 0) {
      push('LIKERT SCALE AVERAGES (1=worst, 5=best):')
      for (const [key, vals] of likertByKey) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        push(`  ${key}: ${avg.toFixed(2)} (n=${vals.length})`)
      }
      push('')
    }

    // Free-text comments
    push('FREE-TEXT RESPONSES:')
    for (const [key, comments] of textResponses) {
      if (comments.length === 0) continue
      push(``, `[${key}] (${comments.length} responses):`)
      for (const c of comments) {
        push(`  • ${c.replace(/\n/g, ' ').substring(0, 300)}`)
      }
    }
  }

  // ── 12. INSTRUCTOR SURVEY COMMENTS ──────────────────────────────────────────
  if (instructorSurveys.length > 0) {
    section('📝 INSTRUCTOR SURVEY DATA')
    push(`Total responses: ${instructorSurveys.length}`, '')

    const textResponses = new Map<string, string[]>()
    for (const survey of instructorSurveys) {
      const r = survey.responses as Record<string, unknown>
      for (const [key, value] of Object.entries(r)) {
        if (key.startsWith('_')) continue
        if (typeof value === 'string' && value.length > 10 && isNaN(Number(value))) {
          if (!textResponses.has(key)) textResponses.set(key, [])
          textResponses.get(key)!.push(value)
        }
      }
    }

    for (const [key, comments] of textResponses) {
      if (comments.length === 0) continue
      push(``, `[${key}]:`)
      for (const c of comments) {
        push(`  • ${c.replace(/\n/g, ' ').substring(0, 300)}`)
      }
    }
  }

  // ── 13. RAW GRADE DATA (anonymised) ─────────────────────────────────────────
  section('📊 RAW GRADES DATA (anonymised)')
  push(
    `${'Student'.padEnd(14)} ${'Track'.padEnd(10)} ${'Scenario'.padEnd(18)} ${'Grader'.padEnd(12)} ${criteriaList.map((c) => c.code.padEnd(6)).join('')} ${'WtdSum'.padEnd(8)} Score`,
  )

  const studentMap = new Map<string, string>()
  let studentCounter = 1
  for (const session of data) {
    if (!studentMap.has(session.studentId)) {
      studentMap.set(session.studentId, `Student_${String(studentCounter).padStart(3, '0')}`)
      studentCounter++
    }
    const anonName = studentMap.get(session.studentId)!

    for (const assessment of session.assessments) {
      const grades = criteriaList.map((c) => {
        const g = assessment.grades.find((g) => g.code === c.code)
        return String(g?.gradeValue ?? '—').padEnd(6)
      }).join('')

      push(
        `${anonName.padEnd(14)} ${(TRACK_LABELS[session.track] ?? session.track).substring(0, 9).padEnd(10)} ${session.scenario.substring(0, 17).padEnd(18)} ${assessment.graderName.substring(0, 11).padEnd(12)} ${grades}${fmt(assessment.weightedSum, 1).padEnd(8)} ${fmt(session.finalScore, 1)}`,
      )
    }
  }

  // ── 14. ANALYSIS FRAMEWORK ──────────────────────────────────────────────────
  section('🔬 ANALYSIS FRAMEWORK')
  push(
    'PHASE 1: Foundational Analysis',
    '  1. Statistical Assessment — quantitative grading patterns and reliability',
    '  2. Correlation Mapping — link performance data with student/instructor feedback',
    '  3. Thematic Organization — categorise qualitative feedback',
    '  4. Educational Alignment — evaluate against TPS andragogical principles',
    '',
    'PHASE 2: Advanced Correlation — scenario-performance triangulation',
    'PHASE 3: Emergent Pattern Identification — cross-source validation',
    'PHASE 4: FTC/STC Differentiated Analysis',
    'PHASE 5: Comprehensive Comment Mining — 100% utilisation, no filtering',
    '',
    'BEGIN ANALYSIS NOW following this framework.',
  )

  return lines.join('\n')
}
