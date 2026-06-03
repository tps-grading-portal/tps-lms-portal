'use server'

import { db } from '@/lib/db'
import { validateSandboxToken, generateFormSlugs, hashPin } from '@/lib/sandbox-auth'
import { revalidatePath } from 'next/cache'

interface SaveFormPayload {
  token:              string
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
    options:      string[] | null
    scaleMin:     number | null
    scaleMax:     number | null
    pointMap:     Record<string, number> | null
    weight:       number | null
    isRequired:   boolean
    sortOrder:    number
  }[]
}

type SaveResult =
  | { submitSlug: string; resultsSlug: string }
  | { error: string }

export async function saveFormAction(payload: SaveFormPayload): Promise<SaveResult> {
  const authed = await validateSandboxToken('creator', payload.token)
  if (!authed) return { error: 'Session expired.' }

  const invite = await db.sandboxCreatorInvite.findUnique({
    where:   { linkToken: payload.token },
    include: { form: true },
  })
  if (!invite) return { error: 'Invite not found.' }

  let submitSlug: string
  let resultsSlug: string
  let formId: string

  if (invite.form) {
    // Update existing form
    formId      = invite.form.id
    submitSlug  = invite.form.submitSlug
    resultsSlug = invite.form.resultsSlug

    await db.sandboxForm.update({
      where: { id: formId },
      data: {
        title:              payload.title,
        description:        payload.description || null,
        mode:               payload.mode as never,
        subjectEntry:       payload.subjectEntry as never,
        graderEntry:        payload.graderEntry as never,
        predefinedSubjects: payload.predefinedSubjects.length > 0 ? payload.predefinedSubjects : undefined,
        scoringEnabled:     payload.scoringEnabled,
        ...(payload.submitPin  ? { submitPinHash:  await hashPin(payload.submitPin)  } : {}),
        ...(payload.resultsPin ? { resultsPinHash: await hashPin(payload.resultsPin) } : {}),
        samePinWarning: !!(payload.submitPin && payload.resultsPin && payload.submitPin === payload.resultsPin),
      },
    })

    // Replace all questions
    await db.sandboxQuestion.deleteMany({ where: { formId } })
  } else {
    // Create new form
    if (!payload.submitPin || !payload.resultsPin) return { error: 'PINs required for new form.' }

    const slugs = await generateFormSlugs()
    submitSlug  = slugs.submitSlug
    resultsSlug = slugs.resultsSlug

    const form = await db.sandboxForm.create({
      data: {
        inviteId:           invite.id,
        title:              payload.title,
        description:        payload.description || null,
        mode:               payload.mode as never,
        subjectEntry:       payload.subjectEntry as never,
        graderEntry:        payload.graderEntry as never,
        predefinedSubjects: payload.predefinedSubjects.length > 0 ? payload.predefinedSubjects : undefined,
        scoringEnabled:     payload.scoringEnabled,
        submitSlug,
        resultsSlug,
        submitPinHash:  await hashPin(payload.submitPin),
        resultsPinHash: await hashPin(payload.resultsPin),
        samePinWarning: payload.submitPin === payload.resultsPin,
      },
    })
    formId = form.id
  }

  // Create questions
  if (payload.questions.length > 0) {
    await db.sandboxQuestion.createMany({
      data: payload.questions.map((q) => ({
        formId,
        questionType: q.questionType as never,
        label:        q.label,
        description:  q.description,
        sectionLabel: q.sectionLabel,
        options:      q.options ?? undefined,
        scaleMin:     q.scaleMin,
        scaleMax:     q.scaleMax,
        pointMap:     q.pointMap ?? undefined,
        weight:       q.weight,
        isRequired:   q.isRequired,
        sortOrder:    q.sortOrder,
      })),
    })
  }

  revalidatePath(`/creator/${payload.token}`)
  return { submitSlug, resultsSlug }
}

// ── Creator PIN reset ─────────────────────────────────────────────────────────

export async function resetCreatorPinAction(
  token:   string,
  type:    'submit' | 'results',
  newPin?: string,
): Promise<{ success: true; newPin: string } | { error: string }> {
  const authed = await validateSandboxToken('creator', token)
  if (!authed) return { error: 'Session expired.' }

  const invite = await db.sandboxCreatorInvite.findUnique({
    where:   { linkToken: token },
    include: { form: { select: { id: true } } },
  })
  if (!invite?.form) return { error: 'Form not found.' }

  const pin  = newPin?.trim() || Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const hash = await hashPin(pin)

  await db.sandboxForm.update({
    where: { id: invite.form.id },
    data:  type === 'submit' ? { submitPinHash: hash } : { resultsPinHash: hash },
  })

  return { success: true, newPin: pin }
}
