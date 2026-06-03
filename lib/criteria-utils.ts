/**
 * Criteria utilities — handles the template/snapshot pattern.
 *
 * Global template (classId = null) is what the admin edits in /admin/rubric.
 * When a class is activated, the template is copied ("snapshotted") to that
 * class. All grading and scoring for that class forever uses its frozen copy.
 */
import { db } from '@/lib/db'

/** Get criteria for a specific class, falling back to the global template */
export async function getCriteriaForClass(classId: string) {
  const classCriteria = await db.criterion.findMany({
    where: { classId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  if (classCriteria.length > 0) return classCriteria

  return db.criterion.findMany({
    where: { classId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

/** Get the global template only */
export async function getTemplateCriteria() {
  return db.criterion.findMany({
    where: { classId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

/**
 * Copy the current global template into a class-specific frozen snapshot.
 * Called once when a class is created. Idempotent — skips if snapshot exists.
 */
export async function snapshotCriteriaForClass(
  classId: string,
  tx?: Parameters<Parameters<typeof db.$transaction>[0]>[0],
): Promise<void> {
  const client = tx ?? db

  const existing = await client.criterion.count({ where: { classId } })
  if (existing > 0) return // already snapshotted

  const template = await client.criterion.findMany({
    where: { classId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  if (template.length === 0) return

  await client.criterion.createMany({
    data: template.map(({ id: _id, classId: _cid, ...rest }) => ({
      ...rest,
      classId,
      isActive: true,
    })),
  })
}

/** Check whether a class already has its criteria snapshot */
export async function classHasCriteriaSnapshot(classId: string): Promise<boolean> {
  const count = await db.criterion.count({ where: { classId } })
  return count > 0
}
