/**
 * LMS v3 seed — runs after existing seed.ts
 * Seeds: default System Admin user, syllabus events from MCG 26A, default curriculum weights
 */
import { PrismaClient, DepartmentCode, EventSuffix, Track, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ── Syllabus events from MCG 26A (graded events only — linked to gradesheet templates) ──

type EventDef = {
  courseCode: string
  title: string
  deptCode: DepartmentCode
  suffix: EventSuffix
  phase: number
  creditHours?: number
  isGraded?: boolean
  isCompOral?: boolean
  tracks: Track[]
  description?: string
}

const EVENTS: EventDef[] = [
  // ── CHECK FLIGHTS (pass/fail, not graded in gradebook) ──────────────────────
  { courseCode: 'CF 6110F', title: 'C-172 Airmanship FA-1 (ABM/FTE)',    deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'CF 6111F', title: 'C-172 Airmanship FA-2 (ABM/FTE)',    deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'CF 6112F', title: 'C-172 Airmanship FA-3 (ABM/FTE)',    deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'CF 6113F', title: 'C-172 Airmanship FA-4 (ABM/FTE)',    deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'CF 6114F', title: 'C-172 Airmanship FA-5 (ABM/FTE)',    deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'CF 6120F', title: 'Check Flight 1 (CSO)',                deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['CSO_WSO'],      isGraded: true },
  { courseCode: 'CF 6121F', title: 'Check Flight 2 (CSO)',                deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['CSO_WSO'],      isGraded: true },
  { courseCode: 'CF 6801F', title: 'RPA Check Flight 1',                  deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['RPA'],          isGraded: true },
  { courseCode: 'CF 6802F', title: 'RPA Check Flight 2',                  deptCode: 'CF', suffix: 'F', phase: 6, tracks: ['RPA'],          isGraded: true },

  // ── TEST FOUNDATIONS ───���───────────────────────────────────────────────────
  { courseCode: 'TF 6221C', title: 'Test Foundations Control Room Intro', deptCode: 'TF', suffix: 'C', phase: 6, tracks: ['ABM','FTE','OPERATOR'], isGraded: true, creditHours: 1 },
  { courseCode: 'TF 6231C', title: 'TF Control Room - Emergency Proc',    deptCode: 'TF', suffix: 'C', phase: 6, tracks: ['ABM','FTE'],     isGraded: true },
  { courseCode: 'TF 6233C', title: 'TF Control Room - STC',               deptCode: 'TF', suffix: 'C', phase: 6, tracks: ['OPERATOR'],      isGraded: true },
  { courseCode: 'TF 6241F', title: 'Test Foundations Flight - Intro',     deptCode: 'TF', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 6251F', title: 'Test Foundations Flight - SSE',       deptCode: 'TF', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 6402R', title: 'TF Report - Performance',             deptCode: 'TF', suffix: 'R', phase: 6, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 6403R', title: 'TF Report - Ground Vehicle',          deptCode: 'TF', suffix: 'R', phase: 6, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 7113R', title: 'TF Report - Flying Qualities',        deptCode: 'TF', suffix: 'R', phase: 7, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 7123R', title: 'TF Report - Mission Systems',         deptCode: 'TF', suffix: 'R', phase: 7, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 7133R', title: 'TF Report - Structures',              deptCode: 'TF', suffix: 'R', phase: 7, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 7502R', title: 'TF Report - Test Plan',               deptCode: 'TF', suffix: 'R', phase: 7, creditHours: 1, tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA'], isGraded: true },
  { courseCode: 'TF 6265R', title: 'TF Report - Structures (STC)',        deptCode: 'TF', suffix: 'R', phase: 6, tracks: ['OPERATOR'],      isGraded: true },
  { courseCode: 'TF 6268R', title: 'TF Report - Ground Vehicle (STC)',    deptCode: 'TF', suffix: 'R', phase: 6, tracks: ['OPERATOR'],      isGraded: true },

  // ── COMPREHENSIVE EXAMS ────────────────────────────────────────────────────
  { courseCode: 'TF 9102E', title: 'Comprehensive Written Exam',  deptCode: 'TF', suffix: 'E', phase: 9, creditHours: 3,
    tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA','OPERATOR'], isGraded: true },
  { courseCode: 'TF 9111E', title: 'Comprehensive Oral Exam',     deptCode: 'TF', suffix: 'E', phase: 9, creditHours: 3,
    tracks: ['PILOT','FTE','CSO_WSO','ABM','RPA','OPERATOR'], isGraded: true, isCompOral: true,
    description: 'Students develop a test plan for an assigned scenario and defend it to a review board of TPS instructors. Evaluated on objectives, risk management, engineering principles, instrumentation, test judgment, and communication.' },

  // ── PERFORMANCE ────────────────���───────────────────────────────────────────
  { courseCode: 'PF 6121F', title: 'T-38 Low L/D Flight',                         deptCode: 'PF', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'PF 6221F', title: 'Performance Flight - Aero Modeling',           deptCode: 'PF', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'PF 7112F', title: 'Performance Flight - TFBs',                    deptCode: 'PF', suffix: 'F', phase: 7, creditHours: 1, tracks: ['PILOT'], isGraded: true },
  { courseCode: 'PF 8211F', title: 'Performance Flight - Intro FTTs (Non-Pilot)',  deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['ABM','CSO_WSO','FTE'], isGraded: true },
  { courseCode: 'PF 8221C', title: 'Performance Control Room - IADS',              deptCode: 'PF', suffix: 'C', phase: 8, tracks: ['ABM','FTE'], isGraded: true },
  { courseCode: 'PF 8222F', title: 'Performance Flight - Energy',                  deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['PILOT','RPA'], isGraded: true },
  { courseCode: 'PF 8231F', title: 'Performance Flight - T/O Landing Verification', deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['PILOT','RPA'], isGraded: true },
  { courseCode: 'PF 8302F', title: 'Performance Flight - Data Collection Intro',   deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'PF 8311F', title: 'Performance Flight - Full Envelope (CSO/RPA)', deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'PF 8320R', title: 'Performance Report (CSO/RPA)',                 deptCode: 'PF', suffix: 'R', phase: 8, creditHours: 1, tracks: ['CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'PF 8332F', title: 'Performance Flight - Performance Testing',     deptCode: 'PF', suffix: 'F', phase: 8, creditHours: 1, tracks: ['PILOT','ABM','FTE'], isGraded: true },
  { courseCode: 'PF 8340R', title: 'Performance Final Report',                     deptCode: 'PF', suffix: 'R', phase: 8, creditHours: 2, tracks: ['PILOT'], isGraded: true },
  { courseCode: 'PF 8341R', title: 'Performance Report - Model Comparison (ABM)',  deptCode: 'PF', suffix: 'R', phase: 8, creditHours: 1, tracks: ['ABM'], isGraded: true },

  // ── FLYING QUALITIES ───────────────────────────────────────────────────────
  { courseCode: 'FQ 6241F', title: 'FQ Flight - Intro FTTs',            deptCode: 'FQ', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'FQ 6251F', title: 'FQ Flight - Dynamic FTTs',          deptCode: 'FQ', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'FQ 6252C', title: 'FQ Control Room Intro',             deptCode: 'FQ', suffix: 'C', phase: 6, tracks: ['ABM','FTE'], isGraded: true },
  { courseCode: 'FQ 6321R', title: 'Flying Qualities Report',           deptCode: 'FQ', suffix: 'R', phase: 6, creditHours: 1, tracks: ['PILOT'], isGraded: true },
  { courseCode: 'FQ 7231C', title: 'FQ Control Room - Structures',      deptCode: 'FQ', suffix: 'C', phase: 7, tracks: ['ABM','FTE'], isGraded: true },
  { courseCode: 'FQ 7232F', title: 'FQ Flight - Structures',            deptCode: 'FQ', suffix: 'F', phase: 7, creditHours: 1, tracks: ['PILOT','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'FQ 8121F', title: 'FQ Flight - HQ Evaluation',         deptCode: 'FQ', suffix: 'F', phase: 8, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'FQ 8141F', title: 'FQ Flight - HQ with Avionics',      deptCode: 'FQ', suffix: 'F', phase: 8, creditHours: 1, tracks: ['PILOT','RPA'], isGraded: true },
  { courseCode: 'FQ 8160F', title: 'FQ Flight - HQ FTT Intro',          deptCode: 'FQ', suffix: 'F', phase: 8, creditHours: 1, tracks: ['ABM','CSO_WSO','FTE'], isGraded: true },
  { courseCode: 'FQ 9111F', title: 'FQ Flight - SSE',                   deptCode: 'FQ', suffix: 'F', phase: 9, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'FQ 9211F', title: 'FQ Flight - Glider/Spins',          deptCode: 'FQ', suffix: 'F', phase: 9, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'FQ 9221F', title: 'FQ Flight - High AOA',              deptCode: 'FQ', suffix: 'F', phase: 9, creditHours: 1, tracks: ['PILOT','RPA'], isGraded: true },
  { courseCode: 'FQ 9237C', title: 'FQ Control Room - Envelope Exp (ABM)', deptCode: 'FQ', suffix: 'C', phase: 9, tracks: ['ABM'], isGraded: true },
  { courseCode: 'FQ 9246F', title: 'FQ Flight - Envelope Expansion',    deptCode: 'FQ', suffix: 'F', phase: 9, creditHours: 1, tracks: ['PILOT','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'FQ 9247C', title: 'FQ Control Room - Envelope Exp (FTE)', deptCode: 'FQ', suffix: 'C', phase: 9, tracks: ['FTE'], isGraded: true },
  { courseCode: 'FQ 9502S', title: 'FQ Simulator - HQ Evaluation',      deptCode: 'FQ', suffix: 'S', phase: 9, creditHours: 1, tracks: ['ABM','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'FQ 9503R', title: 'FQ Simulator Report',               deptCode: 'FQ', suffix: 'R', phase: 9, creditHours: 1, tracks: ['ABM','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'FQ 9511F', title: 'FQ Flight - Lat/Dir Investigation', deptCode: 'FQ', suffix: 'F', phase: 9, creditHours: 1, tracks: ['PILOT'], isGraded: true },
  { courseCode: 'FQ 9512C', title: 'FQ Control Room - Lat/Dir (FTE)',   deptCode: 'FQ', suffix: 'C', phase: 9, tracks: ['FTE'], isGraded: true },

  // ── MISSION SYSTEMS ──────────────────────────────────────────���─────────────
  { courseCode: 'SY 6131F', title: 'Mission Systems Flight - F-16 Sensors', deptCode: 'SY', suffix: 'F', phase: 6, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'SY 6132R', title: 'Mission Systems Report',               deptCode: 'SY', suffix: 'R', phase: 6, creditHours: 1, tracks: ['PILOT','ABM','CSO_WSO','FTE','RPA'], isGraded: true },
  { courseCode: 'SY 7212F', title: 'Mission Systems Flight - MLE',          deptCode: 'SY', suffix: 'F', phase: 7, creditHours: 1, tracks: ['PILOT','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'SY 7213C', title: 'Mission Systems Control Room - F-16',   deptCode: 'SY', suffix: 'C', phase: 7, tracks: ['ABM','FTE','OPERATOR'], isGraded: true },
  { courseCode: 'SY 7503F', title: 'Mission Systems Flight - Sensors & Weapons', deptCode: 'SY', suffix: 'F', phase: 7, creditHours: 1, tracks: ['ABM','CSO_WSO','RPA'], isGraded: true },
  { courseCode: 'SY 7511F', title: 'Mission Systems Flight - Radar',        deptCode: 'SY', suffix: 'F', phase: 7, creditHours: 1, tracks: ['PILOT'], isGraded: true },
  { courseCode: 'SY 7512C', title: 'Mission Systems Control Room - Radar (FTE)', deptCode: 'SY', suffix: 'C', phase: 7, tracks: ['FTE'], isGraded: true },
  { courseCode: 'SY 7521O', title: 'Mission Systems Control Room - Radar (STC)', deptCode: 'SY', suffix: 'O', phase: 7, tracks: ['OPERATOR'], isGraded: true },

  // ── ASTRONAUTICAL SCIENCES ─────��──────────────────────────────��────────────
  { courseCode: 'AS 7130L',    title: 'Astronautical Sciences Lab',                 deptCode: 'AS', suffix: 'L', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7140S FQ', title: 'Astronautical Sciences Ops Eval (FQ)',       deptCode: 'AS', suffix: 'S', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7140S HQ', title: 'Astronautical Sciences Ops Eval (HQ)',       deptCode: 'AS', suffix: 'S', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7150S',    title: 'Astronautical Sciences Ops Eval',            deptCode: 'AS', suffix: 'S', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7160S',    title: 'Astronautical Sciences Ops Eval (High)',     deptCode: 'AS', suffix: 'S', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7314W',    title: 'Astronautical Sciences Design Project',      deptCode: 'AS', suffix: 'W', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'AS 7316R',    title: 'Astronautical Sciences Report',              deptCode: 'AS', suffix: 'R', phase: 7, tracks: ['OPERATOR'], isGraded: true },

  // ── SPACE OPERATIONS ──────────────────────────────────────────────────────
  { courseCode: 'SO 6140S', title: 'Space Operations GROOT Checkride (STC)', deptCode: 'SO', suffix: 'S', phase: 6, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'SY 752xx', title: 'Mission Systems Report - Test Plan (STC)', deptCode: 'SY', suffix: 'R', phase: 7, tracks: ['OPERATOR'], isGraded: true },
  { courseCode: 'TF 6251F (2)', title: 'TF Flight - SSE (RPA Variant)',      deptCode: 'TF', suffix: 'F', phase: 6, tracks: ['RPA'], isGraded: true },
]

async function seedSyllabusEvents() {
  console.log('\nSeeding syllabus events...')
  let created = 0

  for (const ev of EVENTS) {
    const existing = await db.syllabusEvent.findFirst({ where: { courseCode: ev.courseCode } })
    if (existing) { console.log(`  skip ${ev.courseCode}`); continue }

    // Try to find matching gradesheet template
    const template = await db.gradesheetTemplate.findFirst({
      where: { courseCode: ev.courseCode, isActive: true },
    })

    await db.syllabusEvent.create({
      data: {
        courseCode:          ev.courseCode,
        title:               ev.title,
        deptCode:            ev.deptCode,
        eventSuffix:         ev.suffix,
        phase:               ev.phase,
        creditHours:         ev.creditHours ?? 0,
        description:         ev.description ?? null,
        isGraded:            ev.isGraded ?? false,
        isActive:            true,
        isCompOral:          ev.isCompOral ?? false,
        tracks:              ev.tracks,
        gradesheetTemplateId: template?.id ?? null,
        sortOrder:           ev.phase * 100,
      },
    })
    console.log(`  ✓ ${ev.courseCode}${template ? ' (linked to template)' : ''}`)
    created++
  }
  console.log(`  Done — ${created} events seeded.`)
}

async function seedDefaultAdmin() {
  console.log('\nSeeding default System Admin user...')
  const existing = await db.user.findFirst({ where: { email: 'admin@tps.af.mil' } })
  if (existing) { console.log('  skip (already exists)'); return }

  const hash = await bcrypt.hash('TPS-Admin-2026!', 12)
  await db.user.create({
    data: {
      email:        'admin@tps.af.mil',
      firstName:    'System',
      lastName:     'Admin',
      passwordHash: hash,
      role:         'SYSTEM_ADMIN',
      isActive:     true,
    },
  })
  console.log('  ✓ Created: admin@tps.af.mil / TPS-Admin-2026! (CHANGE IMMEDIATELY)')
}

async function main() {
  await seedDefaultAdmin()
  await seedSyllabusEvents()
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
