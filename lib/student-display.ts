/** Returns the display identifier for a student, e.g. "26A-5" */
export function studentLabel(className: string, studentNumber: number): string {
  return `${className}-${studentNumber}`
}
