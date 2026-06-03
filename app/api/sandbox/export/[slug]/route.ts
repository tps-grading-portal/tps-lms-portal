import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { aggregateBySubject } from '@/lib/sandbox-scoring'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Accept: results PIN cookie, admin session, or access-granted form results cookie
  const cookieName = `sbx_results_${slug.slice(0, 16)}`
  const pinToken   = req.cookies.get(cookieName)?.value
  const adminSession = await auth()

  if (!pinToken && !adminSession) return new NextResponse('Unauthorized', { status: 401 })
  if (pinToken) {
    try { await jwtVerify(pinToken, secret) } catch { if (!adminSession) return new NextResponse('Unauthorized', { status: 401 }) }
  }

  const form = await db.sandboxForm.findUnique({
    where:   { resultsSlug: slug },
    include: {
      questions:   { orderBy: { sortOrder: 'asc' } },
      submissions: { orderBy: { submittedAt: 'asc' } },
    },
  })
  if (!form) return new NextResponse('Not found', { status: 404 })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TPS Grading Portal — The Sandbox'
  wb.created = new Date()

  // ── Sheet 1: Raw Responses ────────────────────────────────────────────────
  const raw = wb.addWorksheet('Raw Responses')

  const cols: Partial<ExcelJS.Column>[] = [
    { header: 'Submitted At', key: 'submittedAt', width: 20 },
    ...(form.mode === 'GRADER' ? [{ header: 'Subject', key: 'subject', width: 20 } as ExcelJS.Column] : []),
    { header: 'Grader / Respondent', key: 'grader', width: 20 },
    ...form.questions.map((q) => ({
      header: q.label,
      key:    q.id,
      width:  24,
    } as ExcelJS.Column)),
    ...(form.scoringEnabled ? [{ header: 'Total Score', key: 'score', width: 12 } as ExcelJS.Column] : []),
  ]
  raw.columns = cols

  const hRow = raw.getRow(1)
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } }

  for (const s of form.submissions) {
    const answers = s.answers as Record<string, unknown>
    const row: Record<string, unknown> = {
      submittedAt: new Date(s.submittedAt).toLocaleString(),
      subject:     s.subjectName ?? '',
      grader:      s.graderName  ?? '',
      score:       s.totalScore  ?? '',
    }
    for (const q of form.questions) {
      const val = answers[q.id]
      row[q.id] = Array.isArray(val) ? val.join(', ') : (val ?? '')
    }
    raw.addRow(row)
  }
  raw.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sheet 2: Subject Summary (Grader mode) ────────────────────────────────
  if (form.mode === 'GRADER') {
    const scorableQs = form.questions.map((q) => ({
      id: q.id, questionType: q.questionType,
      weight:   q.weight,
      pointMap: (q.pointMap as Record<string, number> | null) ?? null,
      scaleMin: q.scaleMin, scaleMax: q.scaleMax, label: q.label,
    }))
    const aggregates = aggregateBySubject(
      form.submissions.map((s) => ({
        subjectName: s.subjectName,
        answers:     s.answers as Record<string, unknown>,
        totalScore:  s.totalScore,
      })),
      scorableQs,
    )

    if (aggregates.length > 0) {
      const summary = wb.addWorksheet('Subject Summary')
      summary.columns = [
        { header: 'Subject',    key: 'subject',   width: 24 },
        { header: 'Responses',  key: 'count',     width: 12 },
        { header: 'Avg Score',  key: 'avgScore',  width: 12 },
        { header: 'Min Score',  key: 'minScore',  width: 12 },
        { header: 'Max Score',  key: 'maxScore',  width: 12 },
        ...form.questions.filter((q) => q.weight !== null).map((q) => ({
          header: `Avg: ${q.label}`, key: `q_${q.id}`, width: 20,
        } as ExcelJS.Column)),
      ]
      const sh = summary.getRow(1)
      sh.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF26522' } }

      for (const agg of aggregates) {
        const row: Record<string, unknown> = {
          subject:  agg.subject,
          count:    agg.count,
          avgScore: agg.avgScore ?? '',
          minScore: agg.minScore ?? '',
          maxScore: agg.maxScore ?? '',
        }
        for (const q of form.questions.filter((q) => q.weight !== null)) {
          row[`q_${q.id}`] = agg.byQuestion[q.id]?.avg ?? ''
        }
        summary.addRow(row)
      }
      summary.views = [{ state: 'frozen', ySplit: 1 }]
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `Sandbox-${form.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
