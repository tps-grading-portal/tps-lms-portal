'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { validateSandboxToken } from '@/lib/sandbox-auth'
import { scoreSubmission } from '@/lib/sandbox-scoring'
import { revalidatePath } from 'next/cache'

// ── Verify caller has results access (results PIN or admin) ───────────────────
async function verifyResultsAccess(slug: string): Promise<string | null> {
  const authed = await validateSandboxToken('results', slug)
  if (authed) return 'viewer'
  const session = await auth()
  if (session) return 'admin'
  return null
}

// ── Edit a submission's answers ───────────────────────────────────────────────

export async function editSandboxSubmissionAction(
  submissionId: string,
  slug:         string,
  newAnswers:   Record<string, unknown>,
): Promise<{ error?: string }> {
  const access = await verifyResultsAccess(slug)
  if (!access) return { error: 'Unauthorized' }

  const submission = await db.sandboxSubmission.findUnique({
    where:   { id: submissionId },
    include: { form: { include: { questions: true } } },
  })
  if (!submission) return { error: 'Submission not found.' }

  // Recompute score
  let totalScore: number | null = null
  if (submission.form.scoringEnabled) {
    const scorableQs = submission.form.questions.map((q) => ({
      id: q.id, questionType: q.questionType,
      weight: q.weight, pointMap: q.pointMap as Record<string, number> | null,
      scaleMin: q.scaleMin, scaleMax: q.scaleMax, label: q.label,
    }))
    totalScore = scoreSubmission(newAnswers, scorableQs)
  }

  await db.sandboxSubmission.update({
    where: { id: submissionId },
    data:  {
      answers:     newAnswers as Parameters<typeof db.sandboxSubmission.update>[0]['data']['answers'],
      totalScore,
      submittedAt: new Date(),
    },
  })

  revalidatePath(`/sandbox/${slug}/results`)
  return {}
}

// ── Delete a submission ───────────────────────────────────────────────────────

export async function deleteSandboxSubmissionAction(
  submissionId: string,
  slug:         string,
): Promise<{ error?: string }> {
  const access = await verifyResultsAccess(slug)
  if (!access) return { error: 'Unauthorized' }

  await db.sandboxSubmission.delete({ where: { id: submissionId } })
  revalidatePath(`/sandbox/${slug}/results`)
  return {}
}

// ── Grant / revoke cross-survey read access ───────────────────────────────────

export async function grantResultsAccessAction(
  grantedToFormId: string,
  targetFormId:    string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  if (grantedToFormId === targetFormId) return { error: 'Cannot grant access to the same form.' }

  await db.sandboxResultsAccess.upsert({
    where: { grantedToFormId_targetFormId: { grantedToFormId, targetFormId } },
    update: {},
    create: { grantedToFormId, targetFormId, grantedByAdmin: session.user?.name ?? 'admin' },
  })

  revalidatePath('/admin/sandbox')
  return {}
}

export async function revokeResultsAccessAction(
  grantedToFormId: string,
  targetFormId:    string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.sandboxResultsAccess.deleteMany({
    where: { grantedToFormId, targetFormId },
  })

  revalidatePath('/admin/sandbox')
  return {}
}

// ── Fetch submissions for SSE / page load ─────────────────────────────────────

export async function getSandboxSubmissions(formId: string) {
  const subs = await db.sandboxSubmission.findMany({
    where:   { formId },
    orderBy: { submittedAt: 'desc' },
  })
  return subs.map((s) => ({
    id:          s.id,
    subjectName: s.subjectName,
    graderName:  s.graderName,
    answers:     s.answers as Record<string, unknown>,
    totalScore:  s.totalScore,
    submittedAt: s.submittedAt.toISOString(),
  }))
}
