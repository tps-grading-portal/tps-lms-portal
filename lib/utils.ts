/** Generate a cryptographically random numeric PIN of `length` digits */
export function generatePin(length = 6): string {
  // crypto.getRandomValues is available in both Node 19+ and Edge
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (n) => n % 10).join('')
}

/** Join class names, filtering falsy values */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Format a decimal score to 2 decimal places, or return '—' if null */
export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return score.toFixed(2)
}

/** Convert a Track enum value to its display label */
export const TRACK_LABELS: Record<string, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'Operator (STC)',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}
