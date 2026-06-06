// MCG 26A curriculum organization — courses grouped by department prefix,
// in the order the Master Curriculum Guide presents them:
// Ancillary → Check Flights / Space Ops → Domain Sciences (AS, PF, FQ) →
// Mission Systems → Test Foundations → Test Leadership

export const MCG_DEPT_ORDER = ['AN', 'CF', 'SO', 'AS', 'PF', 'FQ', 'SY', 'TF', 'TL'] as const

export type McgDept = (typeof MCG_DEPT_ORDER)[number]

export const MCG_DEPT_LABELS: Record<McgDept, string> = {
  AN: 'Ancillary',
  CF: 'Check Flights',
  SO: 'Space Operations',
  AS: 'Astronautical Sciences',
  PF: 'Performance',
  FQ: 'Flying Qualities',
  SY: 'Mission Systems',
  TF: 'Test Foundations',
  TL: 'Test Leadership',
}

/** Extract the department prefix from a course code like "TF 6241F" → "TF" */
export function deptFromCourseCode(courseCode: string): string {
  return courseCode.trim().split(/[\s\d]/)[0].toUpperCase()
}

/** Sort index for a department prefix — unknown prefixes sort last */
export function deptSortIndex(dept: string): number {
  const idx = (MCG_DEPT_ORDER as readonly string[]).indexOf(dept)
  return idx === -1 ? MCG_DEPT_ORDER.length : idx
}

/** Display label for a department prefix — falls back to the raw prefix */
export function deptLabel(dept: string): string {
  return MCG_DEPT_LABELS[dept as McgDept] ?? dept
}
