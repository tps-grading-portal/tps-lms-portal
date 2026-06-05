/**
 * Generates an Excel workbook (.xlsx) for a single student's gradebook.
 * One sheet per gradesheet entry, named by course code.
 */
import ExcelJS from 'exceljs'
import { studentLabel } from './student-display'

interface TaskScore {
  taskId:            string
  scoreEntered:      number | null
  numberAccomplished: number | null
  isNA:              boolean
  scoreAwarded:      number | null
  isAutoFail:        boolean
  comments:          string | null
}

interface Task {
  id:            string
  sortOrder:     number
  sectionLabel:  string | null
  isAirmanship:  boolean
  isBonus:       boolean
  isDemo:        boolean
  label:         string
  minScore:      number | null
  minScoreHard:  boolean
  desiredScore:  number | null
  weight:        number
  numberRequired: number
}

interface Entry {
  id:             string
  status:         string
  isLocked:       boolean
  instructorName: string | null
  submittedAt:    Date | null
  overallScore:   number | null
  academicPass:   boolean | null
  airmanshipPass: boolean | null
  overallPass:    boolean | null
  template: {
    courseCode:  string
    title:       string
    type:        string
    tasks:       Task[]
  }
  scores: TaskScore[]
}

interface Student {
  id:     string
  number: number
  track:  string
  class:  { name: string }
  entries: Entry[]
}

const NAVY   = '1B2A4A'
const ORANGE = 'F26522'
const LIGHT  = 'F9FAFB'

export async function buildStudentWorkbook(student: Student): Promise<Buffer> {
  const wb   = new ExcelJS.Workbook()
  const label = studentLabel(student.class.name, student.number)

  wb.creator  = 'TPS Grading Portal'
  wb.created  = new Date()

  // Sort entries by course code
  const sorted = [...student.entries].sort((a, b) =>
    a.template.courseCode.localeCompare(b.template.courseCode)
  )

  for (const entry of sorted) {
    const ws = wb.addWorksheet(entry.template.courseCode, {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    })

    // ── Sheet header ──────────────────────────────────────────────────────────
    ws.getRow(1).height = 20
    ws.mergeCells('A1:J1')
    const titleCell = ws.getCell('A1')
    titleCell.value         = `${entry.template.courseCode} — ${entry.template.title}`
    titleCell.font          = { bold: true, size: 13, color: { argb: `FF${NAVY}` } }
    titleCell.alignment     = { vertical: 'middle' }

    ws.getRow(2).height = 16
    ws.getCell('A2').value = 'Student'
    ws.getCell('B2').value = label
    ws.getCell('D2').value = 'Class'
    ws.getCell('E2').value = student.class.name
    ws.getCell('G2').value = 'Track'
    ws.getCell('H2').value = student.track.replace('_', '/')
    ;['A2','D2','G2'].forEach((addr) => {
      ws.getCell(addr).font = { bold: true, size: 10, color: { argb: 'FF6B7280' } }
    })
    ;['B2','E2','H2'].forEach((addr) => {
      ws.getCell(addr).font = { bold: true, size: 10, color: { argb: `FF${NAVY}` } }
    })

    ws.getRow(3).height = 16
    ws.getCell('A3').value = 'Instructor'
    ws.getCell('B3').value = entry.instructorName ?? '—'
    ws.getCell('D3').value = 'Submitted'
    ws.getCell('E3').value = entry.submittedAt
      ? new Date(entry.submittedAt).toLocaleDateString('en-US')
      : '—'
    ws.getCell('G3').value = 'Status'
    ws.getCell('H3').value = entry.status.replace('_', ' ')
    ;['A3','D3','G3'].forEach((addr) => {
      ws.getCell(addr).font = { bold: true, size: 10, color: { argb: 'FF6B7280' } }
    })

    // ── Result summary ────────────────────────────────────────────────────────
    if (entry.status === 'SUBMITTED') {
      ws.getRow(4).height = 18
      ws.getCell('A4').value = 'Overall Score'
      ws.getCell('B4').value = entry.overallScore != null ? `${entry.overallScore.toFixed(1)}%` : '—'
      ws.getCell('D4').value = 'Academic'
      ws.getCell('E4').value = entry.academicPass == null ? '—' : entry.academicPass ? 'PASS' : 'FAIL'
      ws.getCell('G4').value = 'Airmanship'
      ws.getCell('H4').value = entry.airmanshipPass == null ? '—' : entry.airmanshipPass ? 'PASS' : 'FAIL'
      ws.getCell('J4').value = entry.overallPass ? 'PASS' : 'FAIL'

      ws.getCell('B4').font = { bold: true, size: 11,
        color: { argb: entry.overallPass ? 'FF16A34A' : 'FFDC2626' } }
      ;['E4','H4'].forEach((addr, i) => {
        const pass = i === 0 ? entry.academicPass : entry.airmanshipPass
        ws.getCell(addr).font = { bold: true, size: 10,
          color: { argb: pass ? 'FF16A34A' : 'FFDC2626' } }
      })
      ws.getCell('J4').font = { bold: true, size: 12,
        color: { argb: entry.overallPass ? 'FF16A34A' : 'FFDC2626' } }
    }

    // ── Column headers ────────────────────────────────────────────────────────
    const headerRow = ws.getRow(6)
    const headers = ['Section','Task','Min','*','Desired','Weight %','Acc','Score (0-4)','Awarded %','Comments']
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value  = h
      cell.font   = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    headerRow.height = 18

    // ── Set column widths ─────────────────────────────────────────────────────
    ws.columns = [
      { width: 18 }, // Section
      { width: 40 }, // Task
      { width: 6  }, // Min
      { width: 4  }, // *
      { width: 8  }, // Desired
      { width: 9  }, // Weight %
      { width: 6  }, // Acc
      { width: 12 }, // Score
      { width: 10 }, // Awarded %
      { width: 30 }, // Comments
    ]

    // ── Task rows ─────────────────────────────────────────────────────────────
    let rowIdx = 7
    const scoreMap = new Map(entry.scores.map((s) => [s.taskId, s]))
    let currentSection = ''

    for (const task of entry.template.tasks) {
      const row   = ws.getRow(rowIdx)
      const score = scoreMap.get(task.id)

      const isNewSection = task.sectionLabel && task.sectionLabel !== currentSection
      if (isNewSection) {
        currentSection = task.sectionLabel!
      }

      // Section label (only on first task of section)
      row.getCell(1).value = isNewSection ? task.sectionLabel : ''

      // Task label
      row.getCell(2).value = task.isDemo ? `[Demo] ${task.label}` : task.label

      if (!task.isDemo) {
        row.getCell(3).value = task.minScore ?? ''
        row.getCell(4).value = task.minScoreHard ? '*' : ''
        row.getCell(5).value = task.desiredScore ?? ''
        row.getCell(6).value = task.weight > 0 ? `${(task.weight * 100).toFixed(1)}%` : ''
      }

      if (score) {
        if (score.isNA) {
          row.getCell(7).value = 'N/A'
          row.getCell(8).value = 'N/A'
        } else if (!task.isDemo) {
          row.getCell(7).value = score.numberAccomplished ?? 1
          row.getCell(8).value = score.scoreEntered ?? ''
          row.getCell(9).value = score.scoreAwarded != null ? `${score.scoreAwarded.toFixed(0)}%` : ''
          row.getCell(10).value = score.comments ?? ''

          // Colour auto-fail rows
          if (score.isAutoFail) {
            for (let c = 1; c <= 10; c++) {
              row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
            }
          }
        }
      }

      // Airmanship row tint
      if (task.isAirmanship) {
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }
      }

      // Alternating rows
      if (rowIdx % 2 === 0 && !score?.isAutoFail) {
        for (let c = 1; c <= 10; c++) {
          if (!row.getCell(c).fill || (row.getCell(c).fill as ExcelJS.FillPattern).fgColor?.argb === 'FFFFFFFF') {
            row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT}` } }
          }
        }
      }

      row.height = 15
      rowIdx++
    }

    // Thin borders on data area
    for (let r = 6; r < rowIdx; r++) {
      for (let c = 1; c <= 10; c++) {
        ws.getRow(r).getCell(c).border = {
          top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      }
    }
  }

  // If no entries, add a placeholder sheet
  if (sorted.length === 0) {
    const ws = wb.addWorksheet('No Entries')
    ws.getCell('A1').value = `${label} — no gradesheet entries found.`
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
