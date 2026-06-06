'use server'

import { db } from '@/lib/db'
import { requirePermission, requireAnyPermission, getCurrentUser } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Track, SurveyType } from '@prisma/client'

// ── Deploy a survey ──────────────────────────────────────────────────────────

const DeploySchema = z.object({
  classId:         z.string(),
  syllabusEventId: z.string().optional(),
  surveyType:      z.enum(['STUDENT', 'INSTRUCTOR']),
  closesAt:        z.string().optional(),
  instructorName:  z.string().optional(),
  scenarioLabel:   z.string().optional(),
  trackFilter:     z.string().optional(),
})

export async function deploySurveyAction(
  data: z.infer<typeof DeploySchema>,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const user = await requirePermission('manage:surveys')

    const parsed = DeploySchema.parse(data)

    // Metadata is hardcoded at deploy time — snapshot of current values
    const deployment = await db.surveyDeployment.create({
      data: {
        classId:         parsed.classId,
        syllabusEventId: parsed.syllabusEventId ?? null,
        surveyType:      parsed.surveyType as SurveyType,
        deployedById:    user.id,
        closesAt:        parsed.closesAt ? new Date(parsed.closesAt) : null,
        isActive:        true,
        instructorName:  parsed.instructorName ?? null,
        scenarioLabel:   parsed.scenarioLabel ?? null,
        trackFilter:     (parsed.trackFilter as Track) ?? null,
      },
    })

    revalidatePath('/portal/surveys')
    return { ok: true, id: deployment.id }
  } catch (err) {
    console.error('deploySurveyAction:', err)
    return { ok: false, error: 'Failed to deploy survey.' }
  }
}

export async function closeSurveyAction(
  deploymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission('manage:surveys')
    await db.surveyDeployment.update({
      where: { id: deploymentId },
      data:  { isActive: false },
    })
    revalidatePath('/portal/surveys')
    return { ok: true }
  } catch (err) {
    console.error('closeSurveyAction:', err)
    return { ok: false, error: 'Failed to close survey.' }
  }
}

// ── Anonymity shield — strip names, store sanitized ──────────────────────────

/**
 * A9 anonymity shield:
 * - Raw responses are stored WITHOUT any student identifiers
 * - Instructor-facing reports are further sanitized by A9 (remove identifiable comments)
 * - A9 creates a sanitizedText draft, then publishes to instructor dashboard
 */
export async function saveSanitizedReportAction(
  deploymentId: string,
  sanitizedText: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requirePermission('manage:surveys')

    await db.surveySanitizedReport.upsert({
      where:  { deploymentId },
      update: { sanitizedText, updatedAt: new Date() },
      create: { deploymentId, sanitizedText },
    })

    revalidatePath('/portal/surveys')
    return { ok: true }
  } catch (err) {
    console.error('saveSanitizedReportAction:', err)
    return { ok: false, error: 'Failed to save report draft.' }
  }
}

export async function publishReportAction(
  deploymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requirePermission('manage:surveys')

    const report = await db.surveySanitizedReport.findUnique({ where: { deploymentId } })
    if (!report?.sanitizedText) {
      return { ok: false, error: 'Cannot publish — no sanitized report text exists.' }
    }

    await db.surveySanitizedReport.update({
      where: { deploymentId },
      data:  { publishedAt: new Date(), publishedById: user.id },
    })

    revalidatePath('/portal/surveys')
    return { ok: true }
  } catch (err) {
    console.error('publishReportAction:', err)
    return { ok: false, error: 'Failed to publish report.' }
  }
}

// ── Anonymous response submission ────────────────────────────────────────────

const SubmitResponseSchema = z.object({
  deploymentId: z.string(),
  trackLabel:   z.string().optional(),
  cohortLabel:  z.string().optional(),
  responses:    z.record(z.unknown()),
})

export async function submitSurveyResponseAction(
  data: z.infer<typeof SubmitResponseSchema>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = SubmitResponseSchema.parse(data)

    const deployment = await db.surveyDeployment.findUnique({ where: { id: parsed.deploymentId } })
    if (!deployment?.isActive) return { ok: false, error: 'This survey is no longer active.' }
    if (deployment.closesAt && deployment.closesAt < new Date()) {
      await db.surveyDeployment.update({ where: { id: parsed.deploymentId }, data: { isActive: false } })
      return { ok: false, error: 'This survey has closed.' }
    }

    // Store with ZERO student identifiers — only track/cohort labels retained
    await db.surveyResponseV2.create({
      data: {
        deploymentId: parsed.deploymentId,
        trackLabel:   parsed.trackLabel ?? null,
        cohortLabel:  parsed.cohortLabel ?? null,
        responses:    parsed.responses as object,
      },
    })

    return { ok: true }
  } catch (err) {
    console.error('submitSurveyResponseAction:', err)
    return { ok: false, error: 'Failed to submit response.' }
  }
}

// ── Data queries ──────────────────────────────────────────────────────────────

export async function getSurveysData(classId?: string) {
  await requireAnyPermission(['manage:surveys', 'view:sanitized_surveys'])

  return db.surveyDeployment.findMany({
    where:   classId ? { classId } : {},
    orderBy: { deployedAt: 'desc' },
    include: {
      class:        { select: { name: true } },
      syllabusEvent: { select: { courseCode: true, title: true } },
      deployedBy:   { select: { firstName: true, lastName: true } },
      _count:       { select: { responses: true } },
      sanitizedReport: { select: { publishedAt: true, sanitizedText: true } },
    },
  })
}

export async function getSurveyRawResponses(deploymentId: string) {
  await requirePermission('view:raw_surveys')
  return db.surveyResponseV2.findMany({
    where:   { deploymentId },
    orderBy: { submittedAt: 'asc' },
  })
}
