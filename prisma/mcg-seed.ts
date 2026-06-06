/**
 * MCG 26A catalog seed — parses the Master Curriculum Guide PDF and creates
 * a SyllabusEvent "shell" for every event in the curriculum.
 *
 * - Source of truth: "MCG 26A.pdf" in the repo root (requires poppler's pdftotext)
 * - Existing SyllabusEvent rows (matched by courseCode) are left untouched
 *   except for filling in tracks/description when they were seeded empty.
 * - Shells are created with isGraded=false and no gradesheet link; grading
 *   linkage stays driven by the gradesheet templates.
 *
 * Run: npx tsx prisma/mcg-seed.ts [--dry-run]
 */

import { PrismaClient, Track, DepartmentCode, EventSuffix } from '@prisma/client'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const db = new PrismaClient()

const PDF_PATH = path.join(__dirname, '..', 'MCG 26A.pdf')
const DEPTS = ['AN', 'CF', 'SO', 'AS', 'PF', 'FQ', 'SY', 'TF', 'TL'] as const

const ALL_TRACKS: Track[] = ['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM']
const FTC_TRACKS: Track[] = ['PILOT', 'RPA', 'FTE', 'CSO_WSO', 'ABM']

const TRACK_TOKEN_MAP: Record<string, Track[]> = {
  P:    ['PILOT'],
  RPA:  ['RPA'],
  FTE:  ['FTE'],
  CSO:  ['CSO_WSO'],
  ABM:  ['ABM'],
  STC:  ['OPERATOR'],
  FTC:  FTC_TRACKS,
}

type ParsedEvent = {
  courseCode:  string         // "CF 5101H"
  deptCode:    DepartmentCode
  eventSuffix: EventSuffix
  phase:       number         // first digit of the event number
  title:       string
  tracks:      Track[]
  moduleLabel: string | null  // e.g. "CF 5100 Life Support Training"
  order:       number         // document order of first definition
}

function parseTracks(annotation: string): Track[] | null {
  // annotation like "ABM/FTE/STC" or "FTC" — returns null if any token is
  // not a known track token (then it's title text, not a track filter)
  const tokens = annotation.split('/').map(t => t.trim())
  const tracks = new Set<Track>()
  for (const tok of tokens) {
    const mapped = TRACK_TOKEN_MAP[tok]
    if (!mapped) return null
    for (const t of mapped) tracks.add(t)
  }
  return [...tracks]
}

function parseMcg(): ParsedEvent[] {
  if (!existsSync(PDF_PATH)) throw new Error(`MCG PDF not found at ${PDF_PATH}`)
  const text = execSync(`pdftotext "${PDF_PATH}" -`, { maxBuffer: 64 * 1024 * 1024 }).toString()
  const lines = text.split('\n')

  const eventRe     = new RegExp(`^(${DEPTS.join('|')}) (\\d{4})([A-Z]) (.+)$`)
  const bareCodeRe  = new RegExp(`^(${DEPTS.join('|')}) (\\d{4})([A-Z])$`)
  const moduleRe    = new RegExp(`^(${DEPTS.join('|')}) (\\d{4}) (.+)$`)

  const events = new Map<string, ParsedEvent>()
  let currentModule: { dept: string; num: number; label: string } | null = null
  let order = 0

  function extractTracksFromTitle(rest: string): { title: string; tracks: Track[] | null } {
    let title = rest.trim()
    let tracks: Track[] | null = null

    const reqdAll = /\[req[''’]?d for all\]\s*$/i
    if (reqdAll.test(title)) {
      tracks = ALL_TRACKS
      title = title.replace(reqdAll, '').trim()
    } else {
      const parenMatch = title.match(/\(([A-Z/]+)\)\s*$/)
      if (parenMatch) {
        const parsed = parseTracks(parenMatch[1])
        if (parsed) {
          tracks = parsed
          title = title.slice(0, parenMatch.index).trim()
        }
      }
    }
    return { title, tracks }
  }

  function record(dept: string, numStr: string, suffix: string, rest: string) {
    const courseCode = `${dept} ${numStr}${suffix}`
    const num = parseInt(numStr)
    const { title, tracks } = extractTracksFromTitle(rest)

    // Module context only counts when this event belongs to it numerically
    const moduleLabel =
      currentModule &&
      currentModule.dept === dept &&
      Math.floor(num / 100) * 100 === currentModule.num
        ? currentModule.label
        : null

    const existing = events.get(courseCode)
    if (!existing) {
      events.set(courseCode, {
        courseCode,
        deptCode:    dept as DepartmentCode,
        eventSuffix: suffix as EventSuffix,
        phase:       parseInt(numStr[0]),
        title,
        tracks:      tracks ?? ALL_TRACKS,
        moduleLabel,
        order:       order++,
      })
    } else {
      // Prefer an occurrence that carries explicit track info or module context
      if (tracks && existing.tracks.length === ALL_TRACKS.length &&
          ALL_TRACKS.every(t => existing.tracks.includes(t))) {
        existing.tracks = tracks
      }
      if (!existing.moduleLabel && moduleLabel) existing.moduleLabel = moduleLabel
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.includes('....')) continue // skip TOC dot-leader lines

    // ── Two-column table layout: a run of bare codes, then a run of titles ──
    // pdftotext flattens "CODE | TITLE" tables into N code lines followed by
    // N title lines (e.g. the AN sections). Pair them positionally.
    if (bareCodeRe.test(line)) {
      const codes: { dept: string; numStr: string; suffix: string }[] = []
      let j = i
      while (j < lines.length) {
        const l = lines[j].trim()
        if (!l) { j++; continue }
        const bc = l.match(bareCodeRe)
        if (!bc) break
        codes.push({ dept: bc[1], numStr: bc[2], suffix: bc[3] })
        j++
      }
      // Collect the same number of non-empty, non-code title lines
      const titles: string[] = []
      while (j < lines.length && titles.length < codes.length) {
        const l = lines[j].trim()
        if (!l) { j++; continue }
        if (bareCodeRe.test(l) || eventRe.test(l) || moduleRe.test(l)) break
        // Page numbers / section noise would break pairing — stop there too
        if (/^\d+$/.test(l)) break
        titles.push(l)
        j++
      }
      if (titles.length === codes.length) {
        for (let k = 0; k < codes.length; k++) {
          record(codes[k].dept, codes[k].numStr, codes[k].suffix, titles[k])
        }
        i = j - 1
        continue
      }
      // Pairing failed — fall through and let inline parsing handle other
      // occurrences of these codes elsewhere in the document.
      continue
    }

    // ── Module heading (no suffix letter), e.g. "CF 5100 Life Support Training"
    const m = line.match(moduleRe)
    if (m && !line.match(eventRe)) {
      const num = parseInt(m[2])
      // Module numbers end in 00; ignore stray numeric mentions
      if (num % 100 === 0) {
        currentModule = { dept: m[1], num, label: `${m[1]} ${m[2]} ${m[3].trim()}` }
      }
      continue
    }

    // ── Inline event line, e.g. "CF 5141A Intro to Emergency Procedures (ABM/FTE/STC)"
    const e = line.match(eventRe)
    if (!e) continue
    record(e[1], e[2], e[3], e[4])
  }

  return [...events.values()]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const parsed = parseMcg()

  // Report
  const byDept: Record<string, number> = {}
  for (const e of parsed) byDept[e.deptCode] = (byDept[e.deptCode] ?? 0) + 1
  console.log(`Parsed ${parsed.length} unique events from MCG 26A:`)
  for (const d of DEPTS) console.log(`  ${d}: ${byDept[d] ?? 0}`)

  if (dryRun) {
    console.log('\n--dry-run: no database changes. Sample events:')
    for (const e of parsed.slice(0, 10)) {
      console.log(`  ${e.courseCode} | ${e.title} | tracks=${e.tracks.join(',')} | module=${e.moduleLabel ?? '—'}`)
    }

    // Flag titles that look like mis-paired prose rather than event names
    const suspicious = parsed.filter(e =>
      e.title.length > 75 ||
      /^[a-z]/.test(e.title) ||
      /[.,;]$/.test(e.title)
    )
    console.log(`\nSuspicious titles (${suspicious.length}):`)
    for (const e of suspicious) console.log(`  ${e.courseCode} | ${e.title}`)
    return
  }

  const existing = await db.syllabusEvent.findMany({ select: { id: true, courseCode: true, description: true, tracks: true } })
  const existingByCode = new Map(existing.map(e => [e.courseCode, e]))

  let created = 0
  let enriched = 0
  let skipped = 0

  for (const e of parsed) {
    const description = e.moduleLabel ? `Module: ${e.moduleLabel}` : null
    const row = existingByCode.get(e.courseCode)

    if (!row) {
      await db.syllabusEvent.create({
        data: {
          courseCode:  e.courseCode,
          title:       e.title,
          deptCode:    e.deptCode,
          eventSuffix: e.eventSuffix,
          phase:       e.phase,
          tracks:      e.tracks,
          description,
          isGraded:    false,
          isActive:    true,
          sortOrder:   e.order,
        },
      })
      created++
    } else if (row.tracks.length === 0 || (!row.description && description)) {
      // Fill gaps on existing rows without touching anything else
      await db.syllabusEvent.update({
        where: { id: row.id },
        data: {
          ...(row.tracks.length === 0 ? { tracks: e.tracks } : {}),
          ...(!row.description && description ? { description } : {}),
        },
      })
      enriched++
    } else {
      skipped++
    }
  }

  const total = await db.syllabusEvent.count()
  console.log(`\nDone. Created ${created} shells, enriched ${enriched} existing, skipped ${skipped} (already complete).`)
  console.log(`SyllabusEvent total in database: ${total}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())
