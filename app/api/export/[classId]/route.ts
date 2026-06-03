/**
 * Excel export for a single class.
 * GET /api/export/[classId]  →  .xlsx download
 *
 * Sheet 1 "Grade Data"    — one row per grader assessment (mirrors legacy History sheet)
 * Sheet 2 "Session Summary" — one row per student session
 * Sheet 3 "Survey Responses" — student survey responses (one row per submission)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { TRACK_LABELS } from '@/lib/utils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    select: { name: true },
  })
  if (!cls) return new NextResponse('Class not found', { status: 404 })

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const [criteria, sessions, studentSurveys] = await Promise.all([
    db.criterion.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.gradingSession.findMany({
      where: { classId },
      orderBy: { createdAt: 'asc' },
      include: {
        student:  true,
        scenario: true,
        assessments: {
          orderBy: { createdAt: 'asc' },
          include: {
            staffMember: true,
            grades: {
              include: { criterion: true },
              orderBy: { criterion: { sortOrder: 'asc' } },
            },
          },
        },
      },
    }),
    db.studentSurveyResponse.findMany({
      where: { classId },
      orderBy: { submittedAt: 'asc' },
    }),
  ])

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'TPS Grading Portal'
  wb.created  = new Date()
  wb.modified = new Date()

  // ── Sheet 1: Grade Data ─────────────────────────────────────────────────────
  const gradeSheet = wb.addWorksheet('Grade Data')

  const criterionCols = criteria.map((c) => `${c.code} ${c.name}`)
  gradeSheet.columns = [
    { header: 'Student',       key: 'student',      width: 22 },
    { header: 'Track',         key: 'track',        width: 14 },
    { header: 'Scenario',      key: 'scenario',     width: 14 },
    { header: 'Grader',        key: 'grader',       width: 18 },
    ...criterionCols.map((name) => ({ header: name, key: name, width: 22 })),
    { header: 'Weighted Sum',  key: 'weightedSum',  width: 14 },
    { header: 'Session Score', key: 'finalScore',   width: 14 },
    { header: 'Status',        key: 'status',       width: 20 },
    { header: 'Has Fail',      key: 'hasFail',      width: 10 },
  ]

  // Style header row
  const headerRow1 = gradeSheet.getRow(1)
  headerRow1.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } }
  headerRow1.alignment = { horizontal: 'center' }

  for (const sess of sessions) {
    for (const assessment of sess.assessments) {
      const gradeMap = new Map(
        assessment.grades.map((g) => [g.criterion.code, g.gradeValue]),
      )

      const row: Record<string, string | number | boolean> = {
        student:     `${cls.name}-${sess.student.number}`,
        track:       TRACK_LABELS[sess.student.track] ?? sess.student.track,
        scenario:    sess.scenario.label,
        grader:      assessment.staffMember.name,
        weightedSum: assessment.weightedSum ?? '',
        finalScore:  sess.finalScore ?? '',
        status:      sess.status,
        hasFail:     sess.hasFail,
      }

      for (const c of criteria) {
        const key = `${c.code} ${c.name}`
        row[key] = gradeMap.get(c.code) ?? ''
      }

      const dataRow = gradeSheet.addRow(row)

      // Color fail cells red
      for (const c of criteria) {
        const colKey = `${c.code} ${c.name}`
        const colIndex = gradeSheet.getColumn(colKey).number
        const cell = dataRow.getCell(colIndex)
        if (cell.value === 8) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
        }
      }

      // Color weighted sum cell
      const wsCell = dataRow.getCell('weightedSum')
      if (typeof wsCell.value === 'number') {
        if (sess.hasFail || wsCell.value <= 69) {
          wsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF28B' } }
        }
      }
    }
  }

  gradeSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: gradeSheet.columnCount },
  }
  gradeSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sheet 2: Session Summary ────────────────────────────────────────────────
  const summarySheet = wb.addWorksheet('Session Summary')
  summarySheet.columns = [
    { header: 'Student',     key: 'student',    width: 22 },
    { header: 'Track',       key: 'track',      width: 14 },
    { header: 'Scenario',    key: 'scenario',   width: 14 },
    { header: '# Graders',   key: 'graders',    width: 10 },
    { header: 'Final Score', key: 'finalScore', width: 12 },
    { header: 'Pass/Fail',   key: 'passFail',   width: 10 },
    { header: 'Status',      key: 'status',     width: 20 },
    { header: 'Finalized',   key: 'finalized',  width: 20 },
  ]

  const sumHeader = summarySheet.getRow(1)
  sumHeader.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
  sumHeader.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } }
  sumHeader.alignment = { horizontal: 'center' }

  for (const sess of sessions) {
    const row = summarySheet.addRow({
      student:    `${cls.name}-${sess.student.number}`,
      track:      TRACK_LABELS[sess.student.track] ?? sess.student.track,
      scenario:   sess.scenario.label,
      graders:    sess.assessments.length,
      finalScore: sess.finalScore ?? '',
      passFail:   sess.finalScore === null
        ? '—'
        : sess.hasFail || sess.finalScore < 70
        ? 'FAIL'
        : 'PASS',
      status:     sess.status,
      finalized:  sess.finalizedAt
        ? new Date(sess.finalizedAt).toLocaleString()
        : '—',
    })

    // Color pass/fail cell
    const pfCell = row.getCell('passFail')
    if (pfCell.value === 'FAIL') {
      pfCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7C7' } }
      pfCell.font = { color: { argb: 'FFCC0000' }, bold: true }
    } else if (pfCell.value === 'PASS') {
      pfCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
      pfCell.font = { color: { argb: 'FF276221' }, bold: true }
    }
  }

  summarySheet.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sheet 3: Student Surveys ────────────────────────────────────────────────
  if (studentSurveys.length > 0) {
    const surveySheet = wb.addWorksheet('Student Surveys')

    // Collect all unique question keys from responses
    const allKeys = new Set<string>()
    for (const s of studentSurveys) {
      const r = s.responses as Record<string, unknown>
      Object.keys(r).filter((k) => !k.startsWith('_')).forEach((k) => allKeys.add(k))
    }
    const keyArray = Array.from(allKeys)

    surveySheet.columns = [
      { header: 'Submitted',   key: '_submitted', width: 20 },
      ...keyArray.map((k) => ({ header: k, key: k, width: 30 })),
    ]

    const svHeader = surveySheet.getRow(1)
    svHeader.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    svHeader.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } }

    for (const s of studentSurveys) {
      const r = s.responses as Record<string, unknown>
      const row: Record<string, string> = { _submitted: new Date(s.submittedAt).toLocaleString() }
      for (const k of keyArray) {
        row[k] = r[k] != null ? String(r[k]) : ''
      }
      surveySheet.addRow(row)
    }

    surveySheet.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // ── Stream response ─────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TPS-Class-${cls.name}-Grades.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
