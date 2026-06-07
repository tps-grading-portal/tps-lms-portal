/**
 * MCG 26A prerequisite seed — parses the "Prerequisites:" blocks from the
 * Master Curriculum Guide PDF and links every course to its prerequisites.
 *
 * Document structure: each module lists one or more event groups; each group
 * is followed by a description and a "Prerequisites:" block listing the
 * courses that must come first. The prerequisites apply to every event in
 * the group above the block.
 *
 * Run: npx tsx prisma/mcg-prereq-seed.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const db = new PrismaClient()

const PDF_PATH = path.join(__dirname, '..', 'MCG 26A.pdf')
const DEPTS = ['AN', 'CF', 'SO', 'AS', 'PF', 'FQ', 'SY', 'TF', 'TL']

type PrereqLink = { eventCode: string; prereqCode: string }

function parsePrereqs(): PrereqLink[] {
  if (!existsSync(PDF_PATH)) throw new Error(`MCG PDF not found at ${PDF_PATH}`)
  const text = execSync(`pdftotext "${PDF_PATH}" -`, { maxBuffer: 64 * 1024 * 1024 }).toString()
  const lines = text.split('\n')

  const eventRe    = new RegExp(`^(${DEPTS.join('|')}) (\\d{4})([A-Z])\\b`)
  const moduleRe   = new RegExp(`^(${DEPTS.join('|')}) (\\d{4}) `)
  const prereqHdr  = /^Prerequisites:\s*$/

  const links: PrereqLink[] = []

  // The group of events the next "Prerequisites:" block applies to
  let currentGroup: string[] = []
  // After a Prerequisites block, the next event line starts a fresh group
  let groupClosed = false
  // Are we currently collecting prerequisite lines?
  let collecting = false
  let collectedAny = false

  for (const raw of lines) {
    const line = raw.trim()
    if (line.includes('....')) continue // TOC dot leaders

    if (prereqHdr.test(line)) {
      collecting = true
      collectedAny = false
      continue
    }

    const eventMatch = line.match(eventRe)

    if (collecting) {
      if (!line) {
        // Blanks before the list are padding; a blank AFTER collecting at
        // least one prerequisite terminates the block (the next event line
        // belongs to a new group, not the prereq list).
        if (collectedAny) { collecting = false; groupClosed = true }
        continue
      }
      if (eventMatch) {
        const prereqCode = `${eventMatch[1]} ${eventMatch[2]}${eventMatch[3]}`

        // "[req'd for PF 8211F]" scopes the prerequisite to specific events
        // in the group; "[req'd for all]" (or no annotation) applies to all.
        const scopeMatch = line.match(/\[req[''’]?d for ([^\]]+)\]/i)
        let targets = currentGroup
        if (scopeMatch && !/\ball\b/i.test(scopeMatch[1])) {
          const scopedCodes = [...scopeMatch[1].matchAll(/([A-Z]{2}) ?(\d{4})([A-Z])/g)]
            .map(m => `${m[1]} ${m[2]}${m[3]}`)
          if (scopedCodes.length > 0) {
            targets = currentGroup.filter(c => scopedCodes.includes(c))
            // If the scoped events aren't in the current group (cross-module
            // reference), link them directly anyway.
            for (const code of scopedCodes) {
              if (!targets.includes(code)) targets = [...targets, code]
            }
          }
        }

        for (const eventCode of targets) {
          if (eventCode !== prereqCode) links.push({ eventCode, prereqCode })
        }
        collectedAny = true
        continue
      }
      // "None", a page number, a module heading, or prose — block over
      collecting = false
      groupClosed = true
      // fall through so this line is also processed normally
    }

    // Module heading resets the group
    if (moduleRe.test(line) && !eventMatch) {
      currentGroup = []
      groupClosed = false
      continue
    }

    if (eventMatch) {
      const code = `${eventMatch[1]} ${eventMatch[2]}${eventMatch[3]}`
      if (groupClosed) {
        currentGroup = []
        groupClosed = false
      }
      if (!currentGroup.includes(code)) currentGroup.push(code)
    }
    // Description prose between events and "Prerequisites:" does not reset
    // the group — only a completed prereq block or a module heading does.
  }

  // De-duplicate
  const seen = new Set<string>()
  return links.filter(l => {
    const key = `${l.eventCode}→${l.prereqCode}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const links = parsePrereqs()

  console.log(`Parsed ${links.length} unique prerequisite links from MCG 26A.`)

  // Map course codes → ids
  const events = await db.syllabusEvent.findMany({ select: { id: true, courseCode: true } })
  const idByCode = new Map(events.map(e => [e.courseCode, e.id]))

  const resolved = links.filter(l => idByCode.has(l.eventCode) && idByCode.has(l.prereqCode))
  const unresolved = links.length - resolved.length
  console.log(`${resolved.length} resolve to known courses (${unresolved} reference codes not in the catalog).`)

  if (dryRun) {
    console.log('\n--dry-run: no database changes. Sample links:')
    for (const l of resolved.slice(0, 15)) {
      console.log(`  ${l.eventCode}  ←requires—  ${l.prereqCode}`)
    }
    // Distribution check
    const byEvent = new Map<string, number>()
    for (const l of resolved) byEvent.set(l.eventCode, (byEvent.get(l.eventCode) ?? 0) + 1)
    console.log(`\nEvents with prerequisites: ${byEvent.size}`)
    const max = [...byEvent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log('Most prerequisites:', max.map(([c, n]) => `${c}(${n})`).join(' '))
    return
  }

  const result = await db.syllabusEventPrerequisite.createMany({
    data: resolved.map(l => ({
      eventId:        idByCode.get(l.eventCode)!,
      prerequisiteId: idByCode.get(l.prereqCode)!,
      isHard:         true,
    })),
    skipDuplicates: true,
  })

  const total = await db.syllabusEventPrerequisite.count()
  console.log(`\nDone. Created ${result.count} prerequisite links (skipped existing).`)
  console.log(`SyllabusEventPrerequisite total in database: ${total}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())
