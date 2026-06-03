/**
 * Rule-based question extractor for The Sandbox builder wizard.
 * Handles text extracted from Excel spreadsheets and PDFs.
 * No AI/API calls — pure pattern matching.
 */

export type ExtractedQuestionType =
  | 'GRADE_1_8' | 'NUMERIC' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'TEXT' | 'NUMBER'

export interface ExtractedQuestion {
  label:        string
  questionType: ExtractedQuestionType
  options:      string[] | null
  scaleMin:     number | null
  scaleMax:     number | null
  sectionLabel: string | null
  confidence:   number // 0–1: 1=certain, 0.7=probable, 0.5=guessed
  notes:        string // human-readable reason for the classification
}

// ── Pattern libraries ─────────────────────────────────────────────────────────

const QUESTION_STARTERS = [
  /^\s*(\d+)\.\s+(.+)$/,                         // 1. Question
  /^\s*(\d+)\)\s+(.+)$/,                         // 1) Question
  /^\s*Q\s*(\d+)\s*[.:]\s*(.+)$/i,               // Q1. / Q1: Question
  /^\s*Question\s+(\d+)\s*[.:]\s*(.+)$/i,        // Question 1: text
  /^\s*(\d+\.\d+)\s+(.+)$/,                      // 1.1 Section question
]

const OPTION_PATTERNS = [
  /^\s*[a-eA-E][\.\)]\s+.+/,     // a) b) c)  or  a. b. c.
  /^\s*\([a-eA-E]\)\s+.+/,       // (a) (b) (c)
  /^\s*[-•*▪]\s+.+/,             // bullet points
]

const SCALE_PATTERNS: { re: RegExp; extract: (m: RegExpMatchArray) => { min: number; max: number } }[] = [
  {
    re: /rate\s+(?:from\s+)?(\d+)\s+to\s+(\d+)/i,
    extract: (m) => ({ min: +m[1], max: +m[2] }),
  },
  {
    re: /scale\s+(?:of\s+)?(\d+)\s*(?:to|-)\s*(\d+)/i,
    extract: (m) => ({ min: +m[1], max: +m[2] }),
  },
  {
    re: /\((\d+)\s*[-–to]+\s*(\d+)\)/,
    extract: (m) => ({ min: +m[1], max: +m[2] }),
  },
  {
    re: /(\d+)\s*=\s*(?:low|poor|never|none|not\s+at\s+all|strongly\s+disagree)/i,
    extract: (m: RegExpMatchArray) => ({ min: +m[1], max: 5 }),
  },
  {
    re: /(\d+)\s*[-–]\s*(\d+)\s+(?:scale|point|rating)/i,
    extract: (m) => ({ min: +m[1], max: +m[2] }),
  },
  {
    re: /scale[:\s]+(\d+)[-–](\d+)/i,
    extract: (m) => ({ min: +m[1], max: +m[2] }),
  },
]

const CHECKBOX_SIGNALS = /select\s+all|check\s+all|mark\s+all|multiple\s+(?:may|can)\s+apply|choose\s+all/i
const NUMERIC_SIGNALS  = /how\s+many|count\s+of|number\s+of|quantity|total\s+number/i
const YES_NO_SIGNALS   = /yes\s+or\s+no|yes\/no/i

// ── Section header detection ──────────────────────────────────────────────────

function isSectionHeader(line: string, nextLine?: string): boolean {
  if (!line.trim()) return false
  const t = line.trim()

  // Markdown headers
  if (/^#+\s+/.test(t)) return true

  // Next line is dashes/equals (underline-style header)
  if (nextLine && /^[-=]{3,}\s*$/.test(nextLine.trim())) return true

  // All-caps line, not too short or too long, no question mark
  if (/^[A-Z][A-Z\s\d\-:&/]{4,59}$/.test(t) && !t.includes('?')) return true

  // Ends with colon, short, not an option
  if (t.endsWith(':') && t.length < 70 && !OPTION_PATTERNS.some((r) => r.test(t))) return true

  return false
}

function cleanSectionHeader(line: string): string {
  return line.trim()
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .replace(/^[^a-zA-Z]+/, '')
    .trim()
}

// ── Question extraction from a line ──────────────────────────────────────────

function matchQuestion(line: string): string | null {
  for (const re of QUESTION_STARTERS) {
    const m = line.match(re)
    if (m) return m[m.length - 1].trim()
  }
  // Fallback: line ends with '?' and is long enough
  if (line.trim().endsWith('?') && line.trim().length > 15) return line.trim()
  return null
}

// ── Scale detection ───────────────────────────────────────────────────────────

function detectScale(questionText: string, lookahead: string[]): { min: number; max: number } | null {
  const combined = [questionText, ...lookahead.slice(0, 3)].join(' ')

  for (const { re, extract } of SCALE_PATTERNS) {
    const m = combined.match(re)
    if (m) {
      const result = (extract as (m: RegExpMatchArray, line: string) => { min: number; max: number })(m, combined)
      if (!isNaN(result.min) && !isNaN(result.max) && result.max > result.min) {
        return result
      }
    }
  }
  return null
}

// ── Option extraction from lookahead ─────────────────────────────────────────

function extractOptions(lookahead: string[]): { options: string[]; consumed: number } | null {
  const opts: string[] = []
  let i = 0
  let gapCount = 0

  while (i < lookahead.length && opts.length < 12) {
    const line = lookahead[i].trim()

    if (!line) {
      gapCount++
      if (gapCount > 1 && opts.length > 0) break
      i++
      continue
    }

    const isOpt = OPTION_PATTERNS.some((r) => r.test(line))
    if (isOpt) {
      // Strip leading marker
      const cleaned = line
        .replace(/^\s*[a-eA-E][\.\)]\s+/, '')
        .replace(/^\s*\([a-eA-E]\)\s+/, '')
        .replace(/^\s*[-•*▪]\s+/, '')
        .trim()
      if (cleaned) opts.push(cleaned)
      gapCount = 0
    } else if (opts.length > 0) {
      // Non-option line after we've started collecting — stop
      break
    } else {
      // Haven't found any options yet — skip blanks but stop on content
      break
    }
    i++
  }

  return opts.length >= 2 ? { options: opts, consumed: i } : null
}

// ── Main type classifier ──────────────────────────────────────────────────────

function classifyQuestion(
  text: string,
  lookahead: string[],
): {
  questionType: ExtractedQuestionType
  options:      string[] | null
  scaleMin:     number | null
  scaleMax:     number | null
  confidence:   number
  notes:        string
  consumed:     number
} {
  // 1. Scale in question text or immediately following
  const scale = detectScale(text, lookahead)
  if (scale) {
    if (scale.min === 1 && scale.max === 8) {
      return { questionType: 'GRADE_1_8', options: null, scaleMin: 1, scaleMax: 8, confidence: 0.95, notes: '1-8 scale detected', consumed: 0 }
    }
    return { questionType: 'NUMERIC', options: null, scaleMin: scale.min, scaleMax: scale.max, confidence: 0.9, notes: `${scale.min}–${scale.max} scale`, consumed: 0 }
  }

  // 2. Multiple choice / checkbox options follow
  const optResult = extractOptions(lookahead)
  if (optResult) {
    const isCheckbox = CHECKBOX_SIGNALS.test(text)
    return {
      questionType: isCheckbox ? 'CHECKBOX' : 'MULTIPLE_CHOICE',
      options: optResult.options,
      scaleMin: null, scaleMax: null,
      confidence: 0.9,
      notes: `${optResult.options.length} options detected`,
      consumed: optResult.consumed,
    }
  }

  // 3. Yes/No
  if (YES_NO_SIGNALS.test(text)) {
    return { questionType: 'MULTIPLE_CHOICE', options: ['Yes', 'No'], scaleMin: null, scaleMax: null, confidence: 0.85, notes: 'Yes/No question', consumed: 0 }
  }

  // 4. Numeric entry
  if (NUMERIC_SIGNALS.test(text)) {
    return { questionType: 'NUMBER', options: null, scaleMin: null, scaleMax: null, confidence: 0.8, notes: 'Numeric entry question', consumed: 0 }
  }

  // 5. Default: free text
  return { questionType: 'TEXT', options: null, scaleMin: null, scaleMax: null, confidence: 0.6, notes: 'Default free text', consumed: 0 }
}

// ── Public API: extract from raw text ────────────────────────────────────────

export function extractQuestionsFromText(rawText: string): ExtractedQuestion[] {
  const lines = rawText.split('\n').map((l) => l.replace(/\r/g, '').trimEnd())
  const results: ExtractedQuestion[] = []
  let currentSection: string | null = null
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // Section header?
    if (isSectionHeader(trimmed, lines[i + 1])) {
      currentSection = cleanSectionHeader(trimmed)
      // Skip underline if present
      if (lines[i + 1] && /^[-=]{3,}\s*$/.test(lines[i + 1].trim())) i++
      i++
      continue
    }

    // Question?
    const questionText = matchQuestion(trimmed)
    if (questionText) {
      const lookahead = lines.slice(i + 1, i + 15).map((l) => l.trim())
      const cls = classifyQuestion(questionText, lookahead)
      results.push({
        label:        questionText,
        questionType: cls.questionType,
        options:      cls.options,
        scaleMin:     cls.scaleMin,
        scaleMax:     cls.scaleMax,
        sectionLabel: currentSection,
        confidence:   cls.confidence,
        notes:        cls.notes,
      })
      i += 1 + cls.consumed
      continue
    }

    i++
  }

  return results
}

// ── Public API: extract from Excel sheet array ────────────────────────────────

export interface ExcelSheet {
  name: string
  rows: string[][]
}

export function extractQuestionsFromExcel(sheets: ExcelSheet[]): ExtractedQuestion[] {
  const results: ExtractedQuestion[] = []

  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue

    const sheetLabel = sheets.length > 1 ? sheet.name : null

    // Detect layout: column-based (questions in col A) vs row-based
    const isColumnBased = sheet.rows.every((row) => row[0] && row[0].trim().length > 10)

    if (isColumnBased) {
      // Each row: col A = question, col B+ = options or metadata
      for (const row of sheet.rows) {
        const questionText = row[0]?.trim()
        if (!questionText) continue
        if (isSectionHeader(questionText)) continue

        const q = matchQuestion(questionText) || (questionText.length > 10 ? questionText : null)
        if (!q) continue

        const options = row.slice(1).map((c) => c?.trim()).filter(Boolean)
        const scaleRow = options.join(' ')

        let questionType: ExtractedQuestionType = 'TEXT'
        let scaleMin: number | null = null
        let scaleMax: number | null = null
        let confidence = 0.7
        let notes = 'Column-based Excel'

        const scale = detectScale(q, options)
        if (scale) {
          questionType = (scale.min === 1 && scale.max === 8) ? 'GRADE_1_8' : 'NUMERIC'
          scaleMin = scale.min; scaleMax = scale.max
          confidence = 0.9; notes = `${scale.min}–${scale.max} scale`
        } else if (options.length >= 2) {
          questionType = 'MULTIPLE_CHOICE'
          confidence = 0.85; notes = `${options.length} options in columns`
        }

        results.push({
          label: q, questionType, options: questionType === 'MULTIPLE_CHOICE' ? options : null,
          scaleMin, scaleMax, sectionLabel: sheetLabel, confidence, notes,
        })
      }
    } else {
      // Row-based: convert to text and use the text extractor
      const text = sheet.rows.map((row) => row.join(' ')).join('\n')
      const extracted = extractQuestionsFromText(text)
      extracted.forEach((q) => {
        results.push({ ...q, sectionLabel: q.sectionLabel ?? sheetLabel })
      })
    }
  }

  return results
}
