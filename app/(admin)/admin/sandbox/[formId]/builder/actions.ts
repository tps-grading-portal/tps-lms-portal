'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { hashPin } from '@/lib/sandbox-auth'
import { revalidatePath } from 'next/cache'

interface SavePayload {
  formId:             string
  title:              string
  description:        string
  mode:               string
  subjectEntry:       string
  graderEntry:        string
  predefinedSubjects: string[]
  scoringEnabled:     boolean
  submitPin?:         string
  resultsPin?:        string
  questions: {
    id?:          string
    questionType: string
    label:        string
    description:  string | null
    sectionLabel: string | null
    options:      string[] | Record<string, unknown> | null
    scaleMin:     number | null
    scaleMax:     number | null
    pointMap:     Record<string, number> | null
    weight:       number | null
    isRequired:   boolean
    sortOrder:    number
  }[]
}

type SaveResult = { success: true } | { error: string }

export async function adminSaveFormAction(payload: SavePayload): Promise<SaveResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const form = await db.sandboxForm.findUnique({
    where: { id: payload.formId },
    select: { id: true },
  })
  if (!form) return { error: 'Form not found.' }

  // Build PIN update data
  const pinUpdates: Record<string, string> = {}
  if (payload.submitPin?.trim()) {
    pinUpdates.submitPinHash  = await hashPin(payload.submitPin.trim())
  }
  if (payload.resultsPin?.trim()) {
    pinUpdates.resultsPinHash = await hashPin(payload.resultsPin.trim())
  }

  await db.sandboxForm.update({
    where: { id: payload.formId },
    data: {
      title:              payload.title,
      description:        payload.description || null,
      mode:               payload.mode as never,
      subjectEntry:       payload.subjectEntry as never,
      graderEntry:        payload.graderEntry as never,
      predefinedSubjects: payload.predefinedSubjects.length > 0 ? payload.predefinedSubjects : undefined,
      scoringEnabled:     payload.scoringEnabled,
      ...pinUpdates,
      samePinWarning: payload.submitPin && payload.resultsPin
        ? payload.submitPin === payload.resultsPin
        : undefined,
    },
  })

  // Replace all questions
  await db.sandboxQuestion.deleteMany({ where: { formId: payload.formId } })

  if (payload.questions.length > 0) {
    await db.sandboxQuestion.createMany({
      data: payload.questions.map((q) => ({
        formId:       payload.formId,
        questionType: q.questionType as never,
        label:        q.label,
        description:  q.description,
        sectionLabel: q.sectionLabel,
        options:      q.options as never ?? undefined,
        scaleMin:     q.scaleMin,
        scaleMax:     q.scaleMax,
        pointMap:     q.pointMap ?? undefined,
        weight:       q.weight,
        isRequired:   q.isRequired,
        sortOrder:    q.sortOrder,
      })),
    })
  }

  revalidatePath(`/admin/sandbox/${payload.formId}`)
  revalidatePath(`/admin/sandbox/${payload.formId}/builder`)
  return { success: true }
}
