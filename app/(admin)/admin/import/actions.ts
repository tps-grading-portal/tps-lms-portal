'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getCriteriaForClass } from '@/lib/criteria-utils'
import { processSession } from '@/lib/session-processor'

interface ImportPayload {
  classId:      string
  headers:      string[]
  rows:         string[][]
  mapping:      Record<string, string>          // fieldKey → colIndex string
  criteriaIds:  { id: string; code: string }[]
  scenarioMap:  Record<string, string>           // scenario number string → scenario id
  staffMap:     Record<string, string>           // lowercased name → staffMember id
}

export async function importGradesAction(
  payload: ImportPayload,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  const { classId, rows, mapping, criteriaIds, scenarioMap, staffMap } = payload

  const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
  if (!cls) throw new Error('Class not found')

  const classCriteria = await getCriteriaForClass(classId)

  // Build criterionId lookup by code
  const criterionByCode = new Map(classCriteria.map((c) => [c.code, c.id]))

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    try {
      const get = (key: string) => {
        const idx = mapping[key]
        if (idx === undefined || idx === '') return ''
        return String(row[parseInt(idx)] ?? '').trim()
      }

      const studentRaw    = get('studentNumber')
      const trackRaw      = get('track').toUpperCase()
      const scenarioRaw   = get('scenarioNumber')
      const graderRaw     = get('graderName').toLowerCase()

      if (!studentRaw || !scenarioRaw || !graderRaw) {
        errors.push(`Row ${rowNum}: missing required field (student, scenario, or grader)`)
        skipped++
        continue
      }

      // Extract integer from student identifier (e.g. "26A-7" → 7, or "7" → 7)
      const numberMatch = studentRaw.match(/(\d+)$/)
      if (!numberMatch) { errors.push(`Row ${rowNum}: invalid student number "${studentRaw}"`); skipped++; continue }
      const studentNumber = parseInt(numberMatch[1], 10)

      // Validate track
      const validTracks = ['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM']
      const track = validTracks.includes(trackRaw) ? trackRaw : 'PILOT'

      // Resolve scenario
      const scenarioId = scenarioMap[scenarioRaw] ?? scenarioMap[scenarioRaw.replace(/[^0-9]/g, '')]
      if (!scenarioId) { errors.push(`Row ${rowNum}: unknown scenario "${scenarioRaw}"`); skipped++; continue }

      // Resolve staff member (fuzzy: try exact then partial)
      let staffId: string | undefined = staffMap[graderRaw]
      if (!staffId) {
        const partial = Object.entries(staffMap).find(([name]) => name.includes(graderRaw) || graderRaw.includes(name))
        staffId = partial?.[1]
      }
      if (!staffId) {
        // Create staff member on the fly if not found
        const newStaff = await db.staffMember.create({ data: { name: get('graderName') } })
        staffId = newStaff.id
        staffMap[graderRaw] = staffId
      }

      // Find or create student
      let student = await db.student.findFirst({ where: { classId, number: studentNumber } })
      if (!student) {
        student = await db.student.create({
          data: { classId, number: studentNumber, track: track as never },
        })
      }

      // Find or create session
      let session = await db.gradingSession.findFirst({
        where: { classId, studentId: student.id, scenarioId, status: { not: 'FINALIZED' } },
      })
      if (!session) {
        session = await db.gradingSession.create({
          data: { classId, studentId: student.id, scenarioId, status: 'OPEN' },
        })
      }

      // Check for duplicate assessment
      const existing = await db.graderAssessment.findUnique({
        where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId: staffId } },
      })
      if (existing) { skipped++; continue }

      // Create assessment
      const assessment = await db.graderAssessment.create({
        data: { sessionId: session.id, staffMemberId: staffId, submittedAt: new Date() },
      })

      // Create criterion grades
      let allGradesValid = true
      for (const { id: criterionIdFromPayload, code } of criteriaIds) {
        const rawVal = get(`crit_${criterionIdFromPayload}`)
        const gradeValue = parseInt(rawVal, 10)
        if (isNaN(gradeValue) || gradeValue < 1 || gradeValue > 8) {
          errors.push(`Row ${rowNum}: invalid grade "${rawVal}" for criterion ${code}`)
          allGradesValid = false
          continue
        }
        // Use the class-specific criterion id if available, otherwise the passed id
        const criterionId = criterionByCode.get(code) ?? criterionIdFromPayload
        await db.criterionGrade.create({
          data: { assessmentId: assessment.id, criterionId, gradeValue },
        })
      }

      if (allGradesValid) {
        await processSession(session.id)
        // Auto-finalize imported sessions
        const updatedSession = await db.gradingSession.findUnique({ where: { id: session.id } })
        if (updatedSession?.status === 'READY_TO_FINALIZE') {
          await db.gradingSession.update({
            where: { id: session.id },
            data:  { status: 'FINALIZED', finalizedAt: new Date() },
          })
        }
        imported++
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${String(err)}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}
