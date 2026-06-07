/**
 * Student curriculum provisioning — the class/track assignment dictates the
 * curriculum: a StudentSyllabusEvent for every active MCG event matching the
 * student's track, plus gradebook entries for every active gradesheet
 * template matching the track. Idempotent.
 */
import { db } from '@/lib/db'
import type { Track } from '@prisma/client'

export async function provisionStudentCurriculum(studentId: string, track: Track) {
  // Syllabus events (full MCG roadmap for their track)
  const events = await db.syllabusEvent.findMany({
    where:  { isActive: true, tracks: { has: track } },
    select: { id: true },
  })
  if (events.length > 0) {
    await db.studentSyllabusEvent.createMany({
      data: events.map(e => ({ studentId, syllabusEventId: e.id, status: 'LOCKED' as const })),
      skipDuplicates: true,
    })
  }

  // Gradebook entries for matching templates
  const templates = await db.gradesheetTemplate.findMany({
    where:  { isActive: true, tracks: { has: track } },
    select: { id: true },
  })
  for (const tmpl of templates) {
    await db.gradebookEntry.upsert({
      where:  { studentId_templateId: { studentId, templateId: tmpl.id } },
      update: {},
      create: { studentId, templateId: tmpl.id },
    })
  }
}
