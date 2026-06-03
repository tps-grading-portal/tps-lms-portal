/**
 * Student number utilities.
 * Student identifiers are displayed as "{className}-{number}", e.g. "26A-7".
 * Only the integer is stored in the DB; the class prefix is derived at display time.
 */

/** Format a student's display identifier */
export function studentId(className: string, number: number): string {
  return `${className}-${number}`
}

/** Generate a CSV string for the student number assignment sheet */
export function generateStudentCsv(className: string, count: number): string {
  const header = 'Student Number,Class,Real Name (fill in)\n'
  const rows = Array.from({ length: count }, (_, i) =>
    `${className}-${i + 1},${className},`
  ).join('\n')
  return header + rows
}
