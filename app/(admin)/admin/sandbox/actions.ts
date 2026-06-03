'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateCreatorToken, generateFormSlugs, hashPin, generateSlug } from '@/lib/sandbox-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Resend } from 'resend'

// ── Send creator invite ───────────────────────────────────────────────────────

export type InviteResult =
  | { success: true; linkToken: string; pin: string; emailSent: boolean; recipientEmail: string }
  | { success: false; error: string }

export async function createCreatorInviteAction(formData: FormData): Promise<InviteResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const recipientName  = formData.get('recipientName')?.toString()?.trim()
  const recipientEmail = formData.get('recipientEmail')?.toString()?.trim()
  const formSubject    = formData.get('formSubject')?.toString()?.trim()

  if (!recipientName || !recipientEmail || !formSubject) {
    return { success: false, error: 'All fields are required.' }
  }

  const pin        = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const pinHash    = await hashPin(pin)
  const linkToken  = await generateCreatorToken()

  await db.sandboxCreatorInvite.create({
    data: {
      recipientName,
      recipientEmail,
      formSubject,
      linkToken,
      pinHash,
      sentByAdmin: session.user?.name ?? 'admin',
      emailSent:   false, // set true after email sends
    },
  })

  // Send invite email via Resend
  const baseUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const creatorUrl = `${baseUrl}/creator/${linkToken}`

  let emailSent = false
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from:    'TPS Test Foundations <onboarding@resend.dev>',
      to:      recipientEmail,
      subject: `You've been invited to build a form — ${formSubject}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1B2A4A">
          <div style="background:#1B2A4A;padding:20px 24px;border-bottom:3px solid #F26522">
            <p style="color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0">
              USAF Test Pilot School — Test Foundations
            </p>
          </div>
          <div style="padding:32px 24px;background:#ffffff">
            <h1 style="font-size:20px;margin:0 0 8px">Hi ${recipientName},</h1>
            <p style="color:#374151;line-height:1.6;margin:0 0 24px">
              You've been invited to build a survey form for:<br/>
              <strong style="color:#1B2A4A">${formSubject}</strong>
            </p>

            <div style="background:#FFF7ED;border:1px solid #F26522;border-radius:8px;padding:20px 24px;margin:0 0 24px">
              <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#F26522;margin:0 0 12px">
                Your Access Details — Save These
              </p>
              <p style="margin:0 0 8px;font-size:14px">
                <strong>Builder Link:</strong><br/>
                <a href="${creatorUrl}" style="color:#F26522;word-break:break-all">${creatorUrl}</a>
              </p>
              <p style="margin:0;font-size:14px">
                <strong>PIN:</strong>
                <span style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:4px;color:#1B2A4A;margin-left:8px">${pin}</span>
              </p>
            </div>

            <p style="color:#374151;line-height:1.6;margin:0 0 8px;font-size:14px">
              Click the link above, enter your PIN, and you'll be taken directly to the form builder.
              You can return to your form at any time using the same link and PIN.
            </p>
            <p style="color:#6B7280;font-size:12px;margin:24px 0 0">
              Sent by TPS Test Foundations · USAF Test Pilot School
            </p>
          </div>
        </div>
      `,
    })
    if (!error) emailSent = true
  }

  await db.sandboxCreatorInvite.update({
    where: { linkToken },
    data:  { emailSent },
  })

  revalidatePath('/admin/sandbox')
  return { success: true, linkToken, pin, emailSent, recipientEmail }
}

// ── Delete / revoke a creator invite and all its content ────────────────────

export async function revokeAndDeleteInviteAction(
  inviteId: string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const invite = await db.sandboxCreatorInvite.findUnique({
    where:   { id: inviteId },
    include: { form: { include: { submissions: true } } },
  })
  if (!invite) return { error: 'Invite not found.' }

  // Delete cascade: submissions → form → invite
  if (invite.form) {
    await db.sandboxSubmission.deleteMany({ where: { formId: invite.form.id } })
    await db.sandboxQuestion.deleteMany({  where: { formId: invite.form.id } })
    await db.sandboxForm.delete({ where: { id: invite.form.id } })
  }
  await db.sandboxCreatorInvite.delete({ where: { id: inviteId } })

  revalidatePath('/admin/sandbox')
  return {}
}

// ── Delete standalone form (admin-created, no invite) ────────────────────────

export async function deleteSandboxFormAction(formId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.sandboxSubmission.deleteMany({ where: { formId } })
  await db.sandboxQuestion.deleteMany({  where: { formId } })
  await db.sandboxForm.delete({ where: { id: formId } })

  revalidatePath('/admin/sandbox')
  return {}
}

// ── Reset a form's submit or results PIN ─────────────────────────────────────

export type PinResetResult =
  | { success: true; newPin: string }
  | { success: false; error: string }

export async function resetSandboxPinAction(
  formId:  string,
  pinType: 'submit' | 'results',
  customPin?: string,
): Promise<PinResetResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const newPin  = customPin?.trim() || Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const newHash = await hashPin(newPin)

  await db.sandboxForm.update({
    where: { id: formId },
    data:  pinType === 'submit'
      ? { submitPinHash: newHash }
      : { resultsPinHash: newHash },
  })

  revalidatePath('/admin/sandbox')
  return { success: true, newPin }
}

// ── Admin creates a form directly (no invite needed) ─────────────────────────

export async function adminCreateFormAction(
  title: string,
): Promise<{ formId?: string; pin?: string; error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const { submitSlug, resultsSlug } = await generateFormSlugs()
  const defaultPin  = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const pinHash     = await hashPin(defaultPin)

  const form = await db.sandboxForm.create({
    data: {
      title,
      submitSlug,
      resultsSlug,
      submitPinHash:  pinHash,
      resultsPinHash: pinHash,
      samePinWarning: true,
    },
  })

  revalidatePath('/admin/sandbox')
  return { formId: form.id, pin: defaultPin }
}

// ── Duplicate a form ──────────────────────────────────────────────────────────

export async function duplicateSandboxFormAction(
  sourceFormId: string,
  newTitle:     string,
): Promise<{ formId?: string; pin?: string; error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const source = await db.sandboxForm.findUnique({
    where:   { id: sourceFormId },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!source) return { error: 'Source form not found.' }

  const { submitSlug, resultsSlug } = await generateFormSlugs()
  const pin     = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const pinHash = await hashPin(pin)

  const newForm = await db.sandboxForm.create({
    data: {
      title:              newTitle || `${source.title} (copy)`,
      description:        source.description,
      mode:               source.mode,
      subjectEntry:       source.subjectEntry,
      graderEntry:        source.graderEntry,
      predefinedSubjects: source.predefinedSubjects ?? undefined,
      scoringEnabled:     source.scoringEnabled,
      submitSlug,
      resultsSlug,
      submitPinHash:  pinHash,
      resultsPinHash: pinHash,
      samePinWarning: true,
    },
  })

  // Clone all questions
  if (source.questions.length > 0) {
    await db.sandboxQuestion.createMany({
      data: source.questions.map((q) => ({
        formId:       newForm.id,
        questionType: q.questionType,
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

  revalidatePath('/admin/sandbox')
  return { formId: newForm.id, pin }
}

// ── Cross-survey read access (admin UI wrappers) ──────────────────────────────

export async function adminGrantAccessAction(
  grantedToFormId: string,
  targetFormId:    string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  if (grantedToFormId === targetFormId) return { error: 'Cannot grant access to the same form.' }

  await db.sandboxResultsAccess.upsert({
    where:  { grantedToFormId_targetFormId: { grantedToFormId, targetFormId } },
    update: {},
    create: { grantedToFormId, targetFormId, grantedByAdmin: session.user?.name ?? 'admin' },
  })

  revalidatePath(`/admin/sandbox/${targetFormId}`)
  return {}
}

export async function adminRevokeAccessAction(
  grantedToFormId: string,
  targetFormId:    string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.sandboxResultsAccess.deleteMany({ where: { grantedToFormId, targetFormId } })
  revalidatePath(`/admin/sandbox/${targetFormId}`)
  return {}
}
