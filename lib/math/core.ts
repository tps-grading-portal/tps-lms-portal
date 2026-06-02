/**
 * Core statistical primitives.
 * All functions operate on number arrays and return numbers.
 * Adapted from legacy-apps-script.js helper functions.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1)
}

export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values))
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median Absolute Deviation — robust measure of spread for small samples */
export function mad(values: number[]): number {
  const m = median(values)
  return median(values.map((v) => Math.abs(v - m)))
}

/**
 * Modified Z-Score using MAD (more robust than standard Z for small n).
 * Threshold of 3.5 is the standard recommendation (Iglewicz & Hoaglin 1993).
 */
export function modifiedZScore(value: number, medianVal: number, madVal: number): number {
  if (madVal === 0) return 0
  return (0.6745 * (value - medianVal)) / madVal
}

export function covariance(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0
  const mx = mean(xs)
  const my = mean(ys)
  return xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / (xs.length - 1)
}

export function pearsonR(xs: number[], ys: number[]): number {
  const sdX = stdDev(xs)
  const sdY = stdDev(ys)
  if (sdX === 0 || sdY === 0) return 0
  return covariance(xs, ys) / (sdX * sdY)
}

/** Point-biserial correlation: correlation between binary and continuous variable */
export function pointBiserial(binary: number[], continuous: number[]): number {
  if (binary.length !== continuous.length) return 0
  const n  = binary.length
  const n1 = binary.filter((b) => b === 1).length
  const n0 = n - n1
  if (n1 === 0 || n0 === 0) return 0

  const m1  = mean(continuous.filter((_, i) => binary[i] === 1))
  const m0  = mean(continuous.filter((_, i) => binary[i] === 0))
  const sd  = stdDev(continuous)
  if (sd === 0) return 0

  return ((m1 - m0) / sd) * Math.sqrt((n1 * n0) / (n * n))
}

/** Clamp a value to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
