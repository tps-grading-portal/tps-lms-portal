'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { fetchStatsData } from '@/lib/math/aggregate'
import { applyBayesianToAll } from '@/lib/math/bayesian'
import { revalidatePath } from 'next/cache'

// ── Apply Bayesian consensus to all sessions in selected classes ──────────────

export type BayesianApplyResult =
  | { error: string }
  | { success: true; updated: number; skipped: number }

export async function applyBayesianAction(
  classIds: string[],
): Promise<BayesianApplyResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  if (!classIds.length) return { error: 'No classes selected.' }

  // Fetch historical data from ALL classes (for cross-class bias calculation)
  const allClassIds = (await db.class.findMany({ select: { id: true } })).map((c) => c.id)
  const allData = await fetchStatsData(allClassIds)

  // Target: only the selected classes
  const targetData = allData.filter((s) => classIds.includes(s.classId))

  if (targetData.length === 0) return { error: 'No complete sessions found for selected classes.' }

  const results = applyBayesianToAll(targetData, allData)

  let updated = 0
  let skipped = 0

  for (const result of results) {
    if (result.bayesianScore === null) { skipped++; continue }

    // Only update if the Bayesian score differs meaningfully (>0.01 pts)
    const current = result.originalScore
    if (current !== null && Math.abs(result.bayesianScore - current) < 0.01) {
      skipped++
      continue
    }

    await db.gradingSession.update({
      where: { id: result.sessionId },
      data:  { finalScore: result.bayesianScore },
    })
    updated++
  }

  revalidatePath('/admin/stats')
  revalidatePath('/admin/classes')

  return { success: true, updated, skipped }
}

// ── Preview Bayesian changes without applying ─────────────────────────────────

export async function previewBayesianAction(classIds: string[]) {
  const session = await auth()
  if (!session) return null

  const allClassIds = (await db.class.findMany({ select: { id: true } })).map((c) => c.id)
  const allData     = await fetchStatsData(allClassIds)
  const targetData  = allData.filter((s) => classIds.includes(s.classId))

  return applyBayesianToAll(targetData, allData)
}
