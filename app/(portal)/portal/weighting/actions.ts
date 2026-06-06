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

  const [events, weights] = await Promise.all([
    db.syllabusEvent.findMany({
      where:   { isActive: true, isGraded: true },
      orderBy: [{ deptCode: 'asc' }, { phase: 'asc' }, { courseCode: 'asc' }],
      select:  { id: true, courseCode: true, title: true, deptCode: true, phase: true, tracks: true },
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

  return { events, weightMap }
}
