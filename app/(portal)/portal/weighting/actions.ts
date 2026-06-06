'use server'

import { db } from '@/lib/db'
import { requirePermission } from '@/lib/server-auth'
import { validateTrackWeights } from '@/lib/standings'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Track } from '@prisma/client'

const WeightRowSchema = z.object({
  syllabusEventId: z.string(),
  courseCode:      z.string(),
  weightPct:       z.number().min(0).max(100),
})

const SaveWeightsSchema = z.object({
  track:   z.string(),
  weights: z.array(WeightRowSchema),
})

export async function saveTrackWeightsAction(
  track: Track,
  weights: { syllabusEventId: string; courseCode: string; weightPct: number }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requirePermission('manage:weighting_matrix')

    const parsed = SaveWeightsSchema.parse({ track, weights })

    const validationError = validateTrackWeights(parsed.weights)
    if (validationError) return { ok: false, error: validationError }

    // Upsert each weight row in a transaction
    await db.$transaction(
      parsed.weights.map(w =>
        db.curriculumWeight.upsert({
          where:  { track_syllabusEventId: { track: parsed.track as Track, syllabusEventId: w.syllabusEventId } },
          update: { weightPct: w.weightPct, setByUserId: user.id, updatedAt: new Date() },
          create: { track: parsed.track as Track, syllabusEventId: w.syllabusEventId, weightPct: w.weightPct, setByUserId: user.id },
        }),
      ),
    )

    revalidatePath('/portal/weighting')
    revalidatePath('/portal/standings')
    return { ok: true }
  } catch (err) {
    console.error('saveTrackWeightsAction:', err)
    return { ok: false, error: 'Failed to save weights. Please try again.' }
  }
}

export async function getWeightingMatrixData() {
  await requirePermission('manage:weighting_matrix')

  const [events, catalog, weights] = await Promise.all([
    db.syllabusEvent.findMany({
      where:   { isActive: true, isGraded: true },
      orderBy: { courseCode: 'asc' },
      select:  { id: true, courseCode: true, title: true, deptCode: true, tracks: true },
    }),
    // Full catalog of NOT-yet-weighted events for the "+ Add Events" picker
    db.syllabusEvent.findMany({
      where:   { isActive: true, isGraded: false },
      orderBy: { courseCode: 'asc' },
      select:  { id: true, courseCode: true, title: true, deptCode: true, tracks: true },
    }),
    db.curriculumWeight.findMany({
      include: { syllabusEvent: { select: { courseCode: true } } },
    }),
  ])

  // Weight map: `${track}:${syllabusEventId}` → weightPct
  const weightMap: Record<string, number> = {}
  for (const w of weights) {
    weightMap[`${w.track}:${w.syllabusEventId}`] = w.weightPct
  }

  return { events, catalog, weightMap }
}

// ── Add events to the weighting matrix (master grading source) ───────────────
//
// Adding an event marks it graded and makes it count. If the event has no
// gradesheet template, a minimal one (single "Overall Performance" 0-4 task)
// is auto-created so grading works immediately — replaceable with a full
// template later. Gradebook entries are generated for all students in
// non-archived classes whose track requires the event.

const SUFFIX_TO_TYPE: Record<string, 'FLIGHT' | 'REPORT' | 'ORAL' | 'SIM' | 'CONTROL_ROOM'> = {
  F: 'FLIGHT', S: 'SIM', C: 'CONTROL_ROOM', Y: 'ORAL',
}

export async function addEventsToWeightingAction(eventIds: string[]) {
  const user = await requirePermission('manage:weighting_matrix')

  const events = await db.syllabusEvent.findMany({
    where:   { id: { in: eventIds } },
    include: { gradesheetTemplate: { select: { id: true } } },
  })

  let added = 0
  for (const event of events) {
    let templateId = event.gradesheetTemplateId

    if (!templateId) {
      // Reuse an existing template with the same course code if present
      const existing = await db.gradesheetTemplate.findFirst({
        where:  { courseCode: event.courseCode, isActive: true },
        select: { id: true },
      })
      if (existing) {
        templateId = existing.id
      } else {
        // Auto-create a minimal gradesheet so the event is gradable now
        const tmpl = await db.gradesheetTemplate.create({
          data: {
            courseCode: event.courseCode,
            title:      event.title,
            type:       SUFFIX_TO_TYPE[event.eventSuffix] ?? 'REPORT',
            tracks:     event.tracks,
            notes:      'Auto-generated minimal gradesheet — replace with a full template when available.',
            tasks: {
              create: [{
                sortOrder:    1,
                label:        'Overall Performance',
                minScore:     2,
                desiredScore: 3,
                weight:       100,
                numberRequired: 1,
              }],
            },
          },
        })
        templateId = tmpl.id
      }
    }

    await db.syllabusEvent.update({
      where: { id: event.id },
      data:  { isGraded: true, gradesheetTemplateId: templateId },
    })

    // Generate gradebook entries for matching students in live classes
    const students = await db.student.findMany({
      where:  { track: { in: event.tracks }, class: { archivedAt: null } },
      select: { id: true },
    })
    if (students.length > 0) {
      await db.gradebookEntry.createMany({
        data: students.map(s => ({ studentId: s.id, templateId: templateId! })),
        skipDuplicates: true,
      })
    }
    added++
  }

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'ADD_EVENTS_TO_WEIGHTING',
      targetType: 'SyllabusEvent',
      metadata:   { eventIds, count: added },
    },
  })

  revalidatePath('/portal/weighting')
  revalidatePath('/portal/grade')
  revalidatePath('/portal/standings')
  return { ok: true, added }
}

// ── Remove an event from the weighting matrix ─────────────────────────────────
// The event stops counting toward scores/standings. Existing grades are kept
// but excluded (standings only count weighted events).

export async function removeEventFromWeightingAction(eventId: string) {
  const user = await requirePermission('manage:weighting_matrix')

  await db.$transaction([
    db.curriculumWeight.deleteMany({ where: { syllabusEventId: eventId } }),
    db.syllabusEvent.update({ where: { id: eventId }, data: { isGraded: false } }),
  ])

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'REMOVE_EVENT_FROM_WEIGHTING',
      targetId:   eventId,
      targetType: 'SyllabusEvent',
    },
  })

  revalidatePath('/portal/weighting')
  revalidatePath('/portal/standings')
  return { ok: true }
}
