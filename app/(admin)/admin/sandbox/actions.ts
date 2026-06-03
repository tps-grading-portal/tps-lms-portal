'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateCreatorToken, generateFormSlugs, hashPin, generateSlug } from '@/lib/sandbox-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ── Send creator invite ───────────────────────────────────────────────────────

export type InviteResult =
  | { success: true; linkToken: string; pin: string }
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

  // TODO: Send email via Resend when RESEND_API_KEY is configured
  // For now, the admin copies and shares the link/PIN manually

  revalidatePath('/admin/sandbox')
  return { success: true, linkToken, pin }
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
  // Return the plain-text PIN so the UI can display it once
  return { formId: form.id, pin: defaultPin }
}
