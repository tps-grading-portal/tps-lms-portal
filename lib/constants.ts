/**
 * Core grading constants — ported from legacy-apps-script.js
 * These are the authoritative values for all grade calculations.
 */

// Grade scale: ordinal 1–8 → 100-point numeric score
// Grade 8 (Fail) maps to 69 which triggers the auto-fail policy
export const NUMERIC_MAP: Record<number, number> = {
  1: 100, // Well Above Average
  2: 95,  // Above Average
  3: 90,  // Slightly Above Average
  4: 85,  // Average
  5: 80,  // Slightly Below Average
  6: 75,  // Below Average
  7: 70,  // Well Below Average
  8: 69,  // Fail — also triggers auto-fail (entire student score becomes 69)
}

// Criterion weights in sort order (1.1 → 3.1)
// Must sum to exactly 1.0
export const CRITERION_WEIGHTS = [0.15, 0.25, 0.10, 0.20, 0.20, 0.025, 0.075] as const

// Grade labels in display order (value 1–8)
export const GRADE_LABELS: Record<number, string> = {
  1: '1. Well Above Average',
  2: '2. Above Average',
  3: '3. Slightly Above Average',
  4: '4. Average',
  5: '5. Slightly Below Average',
  6: '6. Below Average',
  7: '7. Well Below Average',
  8: '8. Fail',
}

// Discontinuity threshold: two graders differ by more than this on the 1–8 scale
export const DISCONTINUITY_THRESHOLD = 2

// Auto-fail score (any grader giving grade 8 sets the entire student score to this)
export const AUTO_FAIL_SCORE = 69

// Session requires this many grader submissions before auto-processing triggers
export const MIN_GRADERS = 4
export const MAX_GRADERS = 5

// Passing score threshold
export const PASSING_SCORE = 70

// Track canonical names (mirrors legacy TRACK_MAPPINGS)
export const TRACK_DISPLAY: Record<string, string> = {
  PILOT:   'Pilot',
  RPA:     'RPA',
  FTE:     'FTE',
  OPERATOR: 'Operator (STC)',
  CSO_WSO: 'CSO/WSO',
  ABM:     'ABM',
}

// FTC tracks (Flight Test Course) vs STC (Space Test Course)
// Used in Foundation Report for comparative analysis
export const FTC_TRACKS = ['PILOT', 'RPA', 'FTE', 'CSO_WSO', 'ABM'] as const
export const STC_TRACKS = ['OPERATOR'] as const

// Statistics thresholds (from legacy THRESHOLDS constant)
export const STATS_THRESHOLDS = {
  RELIABILITY_CONCERN: 0.7,  // Below this ICC/alpha value shows concern
  GRADER_DEVIATION: 0.5,     // StdDev multiplier to flag grader bias
  DISCRIMINATION_LOW: 0.3,   // Below this is concerning for discrimination index
  DIFFICULTY_EASY: 2.5,      // Below this on 1-8 scale is very easy
  DIFFICULTY_HARD: 5.5,      // Above this on 1-8 scale is very hard
} as const

// Bayesian consensus thresholds
export const BAYESIAN = {
  OUTLIER_THRESHOLD: 3.5,       // Modified Z-Score / MAD threshold
  MIN_BIAS_SAMPLE: 3,           // Min grades to calculate reliable bias
  MIN_POPULATION_SAMPLE: 10,    // Min total grades for population comparison
  WEIGHT_CONSISTENCY: 0.5,      // Consistency component weight
  WEIGHT_EXPERIENCE: 0.3,       // Experience component weight
  WEIGHT_CONFIDENCE: 0.2,       // Confidence component weight
  EXPERIENCE_TIERS: [           // [minGrades, weight]
    [50, 1.0],
    [20, 0.8],
    [10, 0.6],
    [5,  0.4],
    [0,  0.2],
  ] as [number, number][],
} as const
