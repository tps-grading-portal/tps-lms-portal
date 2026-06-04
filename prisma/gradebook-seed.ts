import { PrismaClient, Track, GradesheetType } from '@prisma/client'

const db = new PrismaClient()

type TaskDef = {
  label:         string
  section?:      string
  isAirmanship?: boolean
  isBonus?:      boolean
  isDemo?:       boolean
  min?:          number | null
  hard?:         boolean   // asterisk
  desired?:      number | null
  weight?:       number    // as percentage e.g. 4 = 4%
  numReq?:       number
}

type TemplateDef = {
  courseCode:    string
  title:         string
  type:          GradesheetType
  tracks:        Track[]
  airmanshipPct: number  // percentage e.g. 20
  tasks:         TaskDef[]
}

const AIRMANSHIP_TASKS_20 = (section = 'Airmanship'): TaskDef[] => [
  { label: 'Basic Aircraft Procedures',          section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
  { label: 'Basic Aircraft Handling',            section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
  { label: 'Local Area Proc./Orientation/Comm',  section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
  { label: 'Situational Awareness/Judgement',    section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
  { label: 'Clearing/Visual Lookout',            section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
]

const AIRMANSHIP_TASKS_10 = (section = 'Airmanship'): TaskDef[] => [
  { label: 'Basic Aircraft Procedures',          section, isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
  { label: 'Basic Aircraft Handling',            section, isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
  { label: 'Local Area Proc./Orientation/Comm',  section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
  { label: 'Situational Awareness/Judgement',    section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
  { label: 'Clearing/Visual Lookout',            section, isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
]

const templates: TemplateDef[] = [

  // ── PF 6121F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 6121F', title: 'T-38 Low L/D Flight',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Card Procedures',           section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Energy Management',         section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Low L/D Theory',            section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'X-24 Approaches - Nominal Pattern',        section: 'Demo',        isDemo: true, numReq: 1 },
      { label: 'X-24 Approaches - Nominal Pattern',        section: 'X-24 Approaches', min: 1, hard: false, desired: 2, weight: 15 },
      { label: 'X-24 Approaches - Off-Nominal Entry',      section: 'X-24 Approaches', isBonus: true, min: 1, hard: false, desired: 2, weight: 5, numReq: 0 },
      { label: 'X-24 Approaches - Flare (prior to touchdown)', section: 'X-24 Approaches', min: 1, hard: false, desired: 3, weight: 10 },
      { label: 'Shuttle Approaches - Shuttle Approach',    section: 'Demo',        isDemo: true, numReq: 1 },
      { label: 'Shuttle Approaches - Shuttle Approach',    section: 'Shuttle Approaches', min: 1, hard: false, desired: 2, weight: 15 },
      { label: 'Shuttle Approaches - Flare (prior to touchdown)', section: 'Shuttle Approaches', min: 1, hard: false, desired: 3, weight: 10 },
    ],
  },

  // ── PF 6221F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 6221F', title: 'Performance Flight - Aero Modeling',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'Test Conduct - SA/Adaptation',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'Test Conduct - Teamwork',            section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - MIL Power Check Climb',       section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - CL 1g Trim Shots',            section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Aeromodeling Sawtooth Climbs',section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Roller Coaster, 0.8M',        section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Wind-Up Turn, 0.8M',          section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Split-S, 0.8M',               section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Roller Coaster, ~1.1M',        section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Split-S, ~1.1M',              section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Penetration Check Descent',    section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Max Range Check Descent',      section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Turning Trim Shots',           section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'FTTs - Spot Landing',                 section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 5 },
    ],
  },

  // ── PF 7112F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 7112F', title: 'Performance Flight - TFBs',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 7.3 },
      { label: 'Test Conduct - SA/Adaptation',       section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 7.3 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 7.3 },
      { label: 'Test Execution - Performance Ground Block', section: 'Test Execution', min: 1, hard: false, desired: 3, weight: 7.3 },
      { label: 'Test Execution - Takeoff Data Collection', section: 'Test Execution', min: 1, hard: false, desired: 2, weight: 7.3 },
      { label: 'Test Execution - TFB IP Demo 300 KIAS',    section: 'Demo', isDemo: true, numReq: 1 },
      { label: 'Test Execution - TFBs Student Data',       section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 29.1, numReq: 4 },
      { label: 'Test Execution - Spot Landing',            section: 'Test Execution', min: 1, hard: false, desired: 2, weight: 7.3 },
    ],
  },

  // ── PF 8222F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 8222F', title: 'Performance Flight - Energy',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation',           section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Test Conduct - SA/Adaptation',                 section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Test Conduct - Communication',                 section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'TOLD Verification - Takeoff (Pitch Attitude Target)',   section: 'TOLD Verification', min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'TOLD Verification - Landing (Pseudo Minimum Roll)',     section: 'TOLD Verification', min: 1, hard: false, desired: 3, weight: 6.2 },
      { label: 'Check Climbs/Descents - Constant Airspeed Entry',      section: 'Check Climbs/Descents', min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Check Climbs/Descents - Constant Power Entry',         section: 'Check Climbs/Descents', min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Check Climbs/Descents - Check Climbs',                 section: 'Check Climbs/Descents', min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Check Climbs/Descents - Check Descents',               section: 'Check Climbs/Descents', min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Turn Performance - Front-Side Anchor',                 section: 'Turn Performance',      min: 2, hard: true,  desired: 3, weight: 6.2 },
      { label: 'Turn Performance - Front-Side Stable Turns',           section: 'Turn Performance',      min: 2, hard: true,  desired: 3, weight: 6.2, numReq: 4 },
      { label: 'Turn Performance - Back-Side Stable Turns',            section: 'Turn Performance',      min: 2, hard: true,  desired: 2, weight: 6.2, numReq: 4 },
      { label: 'Turn Performance - Back-Side Anchor',                  section: 'Turn Performance',      min: 1, hard: true,  desired: 2, weight: 6.2 },
      { label: 'Bonus - T-38: Pseudo SETOS Turn Perf',                 section: 'Bonus', isBonus: true,  min: 1, hard: false, desired: 2, weight: 2.5, numReq: 0 },
      { label: 'Bonus - F-16: Low-Speed AB Turn Perf',                 section: 'Bonus', isBonus: true,  min: 1, hard: false, desired: 2, weight: 2.5, numReq: 0 },
    ],
  },

  // ── PF 8231F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 8231F', title: 'Performance Flight - Takeoff/Landing Verification',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 16.5,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 3.3 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 3.3 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 3.3 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 3.3 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 3.3 },
      { label: 'Test Conduct - Prioritization',          section: 'Test Conduct',        min: 2, hard: true,  desired: 3, weight: 8.3 },
      { label: 'Test Conduct - Energy Management',       section: 'Test Conduct',        min: 2, hard: true,  desired: 3, weight: 8.3 },
      { label: 'Test Conduct - Data Collection',         section: 'Test Conduct',        min: 2, hard: true,  desired: 3, weight: 8.3 },
      { label: 'FTTs - Performance Takeoff',             section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - MIL Check Climb',                 section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - MIL Level Accel',                 section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - 2g MIL Level Decel',              section: 'Flight Test Techniques', min: 1, hard: false, desired: 2, weight: 2.8 },
      { label: 'FTTs - 2g IDLE Level Decel',             section: 'Flight Test Techniques', min: 1, hard: false, desired: 2, weight: 2.8 },
      { label: 'FTTs - STBY MIL Level Accel',            section: 'Flight Test Techniques', min: 1, hard: false, desired: 1, weight: 2.8 },
      { label: 'FTTs - STBY IDLE 2g Level Decel',        section: 'Flight Test Techniques', min: 1, hard: false, desired: 1, weight: 2.8 },
      { label: 'FTTs - Sawtooth Climb',                  section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - MAX Level Accel/Decel',           section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - 4g MAX Level Decel',              section: 'Flight Test Techniques', min: 1, hard: false, desired: 2, weight: 2.8 },
      { label: 'FTTs - 0.84M High Speed Descent',        section: 'Flight Test Techniques', min: 1, hard: false, desired: 2, weight: 2.8 },
      { label: 'FTTs - MIL Level Accel, Turning Entry',  section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'FTTs - MIL Level Accel, Climbing Entry', section: 'Flight Test Techniques', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Bonus - 2g Level Accel, 12k',            section: 'Bonus', isBonus: true,    min: 1, hard: false, desired: 2, weight: 3.0, numReq: 0 },
      { label: 'FTTs - Performance Spot Landing',        section: 'Flight Test Techniques', min: 1, hard: false, desired: 2, weight: 2.8 },
    ],
  },

  // ── PF 8332F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 8332F', title: 'Performance Flight - Performance Testing',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 13.5,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2.7 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2.7 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2.7 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2.7 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2.7 },
      { label: 'Test Conduct - Mission Preparation/Cards', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - Mission Briefing',          section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - Test Point Control',        section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - Test Point Communication',  section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - CRM - Awareness',           section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - CRM - Adaptation',          section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Test Conduct - CRM - Communication',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.0 },
      { label: 'Data Collection - Ground Blocks',          section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Takeoff',                section: 'Data Collection', min: 2, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Check Climb',            section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Level Acceleration',     section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Incremental Drag Descent', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Sawtooth Climb (1.15 Vs)', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Sawtooth Climb (Vy)',    section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Cruise (Best Endurance)', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Cruise (Long Range)',    section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Sustained Turn, 1g',    section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 1.9 },
      { label: 'Data Collection - Sustained Turn, TBD (1)', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 1.9 },
      { label: 'Data Collection - Sustained Turn, TBD (2)', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 1.9 },
      { label: 'Data Collection - Sustained Turn, TBD (3)', section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 1.9 },
      { label: 'Data Collection - Check Descent',          section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Tower Flyby',            section: 'Data Collection', min: 3, hard: false, desired: 3, weight: 3.9 },
      { label: 'Data Collection - Landing',                section: 'Data Collection', min: 1, hard: false, desired: 2, weight: 0.8 },
    ],
  },

  // ── PF 8340R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'PF 8340R', title: 'Performance Final Report',
    type: 'REPORT', tracks: ['PILOT'], airmanshipPct: 0,
    tasks: [
      { label: 'Ground Blocks',                              section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Takeoff',                                    section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Check Climb Time & Distance',                section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Level Acceleration',                         section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Sawtooth Climbs',                            section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Best Endurance Cruise',                      section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Long Range Cruise',                          section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Turn Performance',                           section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Incremental Drag Descent',                   section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Check Descent Time & Distance',              section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Tower Flyby',                                section: 'Content', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Structure & Logic - Executive Summary',      section: 'Structure & Logic',   min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Structure & Logic - Report Organization & Structure', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Structure & Logic - Logical Chain of Reasoning',      section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 6 },
      { label: 'Clarity & Precision - Grammar & Syntax',              section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Clarity & Precision - Punctuation Acronyms & Formatting', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Clarity & Precision - Professional Tone & Word Choice',    section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',  section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',      section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',         section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── FQ 6241F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 6241F', title: 'Flying Qualities Flight - Intro FTTs',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 10,
    tasks: [
      ...AIRMANSHIP_TASKS_10(),
      { label: 'Test Conduct - Mission Preparation',          section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Conduct - Awareness/Adaptation',         section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Conduct - Communication',                section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Conduct - Teamwork',                     section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - Breakout Forces/Freeplay FTT',  section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - Speed Stability FTTs',          section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - Maneuvering Flight FTTs',       section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - SHSS FTTs',                     section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - Flight Path Stability FTT',     section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Test Points - T/O & Lnd Forces/Deflections',  section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 8.2 },
      { label: 'Post Flight - Data Analysis & Evaluation',    section: 'Post Flight',  min: 2, hard: true,  desired: 3, weight: 8.2 },
    ],
  },

  // ── FQ 6251F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 6251F', title: 'Flying Qualities Flight - Dynamic FTTs',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 10,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Conduct - Mission Preparation',       section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 12.6 },
      { label: 'Test Conduct - SA/Adaptation',             section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 4.2 },
      { label: 'Test Conduct - Communication',             section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 4.2 },
      { label: 'Test Conduct - Teamwork',                  section: 'Test Conduct',   min: 2, hard: true,  desired: 3, weight: 4.2 },
      { label: 'Test Techniques - Rap (Effective Time Delay)', section: 'Test Techniques', min: 2, hard: true,  desired: 3, weight: 4.2 },
      { label: 'Test Techniques - Step (Roll Mode)',        section: 'Test Techniques', min: 2, hard: true,  desired: 3, weight: 8.4 },
      { label: 'Test Techniques - Doublet (Short Period and Dutch Roll)', section: 'Test Techniques', min: 2, hard: true, desired: 3, weight: 8.4 },
      { label: 'Test Techniques - Pitch Frequency Sweep',  section: 'Test Techniques', min: 2, hard: true,  desired: 3, weight: 2.1 },
      { label: 'Test Techniques - Step (Spiral Mode)',     section: 'Test Techniques', min: 2, hard: true,  desired: 3, weight: 6.3 },
      { label: 'Test Techniques - Step (Phugoid Mode)',    section: 'Test Techniques', min: 2, hard: true,  desired: 3, weight: 6.3 },
      { label: 'Test Techniques - Spot Landing: Qualitative HQ', section: 'Test Techniques', min: 1, hard: true, desired: 2, weight: 4.2 },
      { label: 'Hand-Held Data - Oscillation Damping and Period', section: 'Hand-Held Data', min: 2, hard: true, desired: 3, weight: 12.6 },
      { label: 'Hand-Held Data - Time Measurement',        section: 'Hand-Held Data', min: 2, hard: true,  desired: 3, weight: 12.6 },
    ],
  },

  // ── FQ 6321R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 6321R', title: 'Flying Qualities Report',
    type: 'REPORT', tracks: ['PILOT'], airmanshipPct: 0,
    tasks: [],  // tasks to be verified from source document
  },

  // ── FQ 7232F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 7232F', title: 'Flying Qualities Flight - Structures',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 10,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Conduct - Mission Preparation',          section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 10 },
      { label: 'Test Conduct - Test SA/Adaptation',           section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 10 },
      { label: 'Test Conduct - Communication',                section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 10 },
      { label: 'Test Conduct - Teamwork/CRM',                 section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 10 },
      { label: 'Test Execution - LCO FTT Execution',          section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 15 },
      { label: 'Test Execution - Structures FTT Execution',   section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 15 },
      { label: 'Test Execution - Abort Maneuver Execution',   section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 10 },
      { label: 'Test Execution - Staying within Cleared Envelope', section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 10 },
    ],
  },

  // ── FQ 8121F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 8121F', title: 'Flying Qualities Flight - HQ Evaluation',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 10,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 1, hard: true,  desired: 2, weight: 2 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Conduct - Mission Preparation',   section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Conduct - Test SA / Adaptation',  section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Conduct - Communication',         section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Conduct - Teamwork',              section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Points - Ground Block',           section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 1.1 },
      { label: 'Test Points - Takeoff / Climb',        section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 4.5 },
      { label: 'Test Points - Dutch Roll Investigation', section: 'Test Points', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Points - Stall Investigation (1g)', section: 'Test Points', min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Points - Stall Investigation (turning)', section: 'Test Points', min: 2, hard: true, desired: 3, weight: 4.5 },
      { label: 'Test Points - Bank Angle Captures',    section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 4.5 },
      { label: 'Test Points - Heading Captures',       section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 4.5 },
      { label: 'Test Points - Pitch (Altitude) Captures', section: 'Test Points', min: 2, hard: true, desired: 3, weight: 4.5 },
      { label: 'Test Points - Propeller Effects',      section: 'Test Points',  min: 1, hard: false, desired: 3, weight: 3.4 },
      { label: 'Test Points - ILS (RNAV) CHR Task',    section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 5.6 },
      { label: 'Test Points - Flare / Landing',        section: 'Test Points',  min: 2, hard: true,  desired: 3, weight: 4.5 },
      { label: 'Debriefing - Review of Pilot Obs/Comm',      section: 'Debriefing', min: 2, hard: true, desired: 3, weight: 5.6 },
      { label: 'Debriefing - Review of Data Collected',      section: 'Debriefing', min: 2, hard: true, desired: 3, weight: 5.6 },
      { label: 'Debriefing - Discussion of Prop Effect Preds vs Obs', section: 'Debriefing', min: 2, hard: true, desired: 3, weight: 3.4 },
      { label: 'Debriefing - Identify Lessons Learned', section: 'Debriefing', min: 2, hard: true,  desired: 3, weight: 4.5 },
    ],
  },

  // ── FQ 8141F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 8141F', title: 'Flying Qualities Flight - HQ with Avionics',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation',  section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Test Conduct - SA/Adaptation',        section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Test Conduct - Communication',        section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Test Conduct - Teamwork',             section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Overall FTT - Ground Block',          section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 0.5 },
      { label: 'Overall FTT - Taxi FTTs',             section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Overall FTT - Fixed Gunsight FTTs',   section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Overall FTT - Route Form. FTTs (CR)', section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Overall FTT - Route Form. FTTs (PA)', section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Overall FTT - Offset Landing Buildup',section: 'Overall FTT Execution', min: 1, hard: false, desired: 3, weight: 0.5 },
      { label: 'Overall FTT - Yaw Pointing FTTs',     section: 'Overall FTT Execution', min: 2, hard: false, desired: 3, weight: 0.5 },
      { label: 'Overall FTT - Offset Landing',        section: 'Overall FTT Execution', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'FTT Qual - Open Loop FTTs',           section: 'FTT Qualification', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'FTT Qual - Workload Buildup',         section: 'FTT Qualification', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'FTT Qual - Displacement SISPIO',      section: 'FTT Qualification', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'FTT Qual - Rate SISPIO',              section: 'FTT Qualification', min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'FTT Qual - CHR FTTs',                 section: 'FTT Qualification', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'FTT Qual - CHR Ratings/Comments',     section: 'FTT Qualification', min: 2, hard: true,  desired: 3, weight: 1 },
    ],
  },

  // ── FQ 9111F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 9111F', title: 'Flying Qualities Flight - SSE',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Preparation/Prebrief', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Awareness/Adaptation',         section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Communication',                section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Teamwork',                     section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Points - Power Off/On Stalls',           section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - Steady Heading Sideslips',      section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - Static Vmca',                   section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - Dynamic Vmca',                  section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - SSE HQ Evaluation',             section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - SSE Min Trim Determination',    section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - Bank Angle Effects Demo',       section: 'Demo', isDemo: true, numReq: 1 },
      { label: 'Test Points - SSE Instrument Approach',       section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Post Flight - Data Analysis & Evaluation',    section: 'Post Flight',  min: 2, hard: false, desired: 3, weight: 5 },
    ],
  },

  // ── FQ 9211F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 9211F', title: 'Flying Qualities Flight - Glider/Spins',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 10,
    tasks: [
      { label: 'General Glider Operations', section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 5 },
      { label: 'Takeoff and Landing',       section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 5 },
      { label: 'Test Conduct - Mission Preparation',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 3 },
      { label: 'Test Conduct - Inflight Analysis/Decision Making', section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Stalls - Forward cg stalls (A/B/C)',       section: 'Stalls', min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'Stalls - Aft cg stalls (A/B/C)',           section: 'Stalls', min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'Spins - Rudder Only Recovery',             section: 'Spins',  min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'Spins - Flight Manual Recovery',           section: 'Spins',  min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'Spins - NASA Modified Recovery',           section: 'Spins',  min: 1, hard: false, desired: 3, weight: 1 },
      { label: 'Spins - Aileron Effects Demo',             section: 'Demo',   isDemo: true, numReq: 1 },
    ],
  },

  // ── FQ 9221F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 9221F', title: 'Flying Qualities Flight - High AOA',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'Test Conduct - SA/Adaptation',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'Test Conduct - Teamwork',            section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'FTTs - CR Stall App and Prevent',    section: 'FTTs', min: 1, hard: true,  desired: 3, weight: 1 },
      { label: 'FTTs - CR Stall Char and Recov',     section: 'FTTs', min: 1, hard: true,  desired: 3, weight: 1 },
      { label: 'FTTs - PA Stall App and Prevent',    section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'FTTs - PA Stall Char and Recov',     section: 'FTTs', min: 2, hard: true,  desired: 3, weight: 1.5 },
      { label: 'FTTs - Lift Boundary Determination', section: 'FTTs', min: 1, hard: true,  desired: 3, weight: 1 },
      { label: 'High AOA Demo - Stab Demo',          section: 'High AOA Demonstrations', min: 1, hard: false, desired: 3, weight: 0.5 },
      { label: 'High AOA Demo - 50/50 Loop',         section: 'High AOA Demonstrations', min: 1, hard: false, desired: 3, weight: 0.5 },
      { label: 'High AOA Demo - Full Aft Stick Sliceback', section: 'High AOA Demonstrations', min: 1, hard: false, desired: 3, weight: 0.5 },
      { label: 'High AOA Demo - Full Aft Stick Climb',     section: 'High AOA Demonstrations', min: 1, hard: false, desired: 2, weight: 0.5 },
    ],
  },

  // ── FQ 9246F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 9246F', title: 'Flying Qualities Flight - Envelope Expansion',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Local Area Proc/Orientation/Comm',  section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgment',    section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Conduct - Test SA/Adaptation',  section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Conduct - Teamwork/CRM',        section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Test Execution - Buildup Adherence',          section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 6 },
      { label: 'Test Execution - Maneuver Execution',         section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Execution - Safety Calls',               section: 'Test Execution', min: 2, hard: true,  desired: 3, weight: 6 },
      { label: 'Test Execution - Real Time Data Interpretation', section: 'Test Execution', min: 2, hard: false, desired: 3, weight: 3 },
    ],
  },

  // ── FQ 9511F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'FQ 9511F', title: 'Flying Qualities Flight - Lat/Dir Investigation',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission Preparation',         section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8 },
      { label: 'Test Conduct - SA/Adaptation During Execution', section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 8 },
      { label: 'Test Conduct - Communication (Debrief)',     section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 8 },
      { label: 'Lat/Dir - Roll angle response delay',        section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - Dutch roll open loop data',        section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - Steady heading sideslip',          section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - Adverse yaw',                     section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - Time to achieve bank angle',       section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - Yaw damper divergence QE',         section: 'Lat/Dir Investigation', min: 1, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - High gain rudder roll tracking',   section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - SISPIO for rudder roll control',   section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Lat/Dir - HQR for rudder roll tracking',    section: 'Lat/Dir Investigation', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Long Invest. - Short period open loop data', section: '0.9M Longitudinal Investigation', min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Long Invest. - Stick force per g',           section: '0.9M Longitudinal Investigation', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Long Invest. - Transient Fs/g (inc delay)',  section: '0.9M Longitudinal Investigation', min: 1, hard: false, desired: 3, weight: 4 },
      { label: 'Long Invest. - 180 phase assessment',        section: '0.9M Longitudinal Investigation', min: 1, hard: false, desired: 3, weight: 4 },
    ],
  },

  // ── SY 6131F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'SY 6131F', title: 'Mission Systems Flight - F-16 Sensors',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      ...AIRMANSHIP_TASKS_20(),
      { label: 'Test Conduct - Mission/Card Preparation', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Test Conduct - Msn SA/Adaptation',        section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Test Conduct - Teamwork',                 section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 0.25 },
      { label: 'Systems - Test Card Step Adherence',      section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Systems - HOTAS Familiarity',             section: 'Systems Test Methodologies', min: 1, hard: false, desired: 3, weight: 4 },
      { label: 'Systems - Pod Functionality Checks',      section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 2 },
      { label: 'Systems - Tracking and Stability Checks', section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 3 },
      { label: 'Systems - Combat ID Method/Comments',     section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 3 },
      { label: 'Systems - Spatial Freq Method/Comments',  section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 3 },
      { label: 'Systems - Op Eval Task & Bedford Scale',  section: 'Systems Test Methodologies', min: 1, hard: false, desired: 3, weight: 3 },
      { label: 'Systems - FCR A/G Functionality Demos',   section: 'Systems Test Methodologies', min: 2, hard: true,  desired: 3, weight: 2 },
    ],
  },

  // ── SY 6132R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'SY 6132R', title: 'Mission Systems Report',
    type: 'REPORT', tracks: ['PILOT'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',             section: 'Structure & Logic',    min: 2, hard: true, desired: 3, weight: 5.65 },
      { label: 'Structure & Logic - Report Organization & Structure', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4.5 },
      { label: 'Structure & Logic - Logical Chain of Reasoning',   section: 'Structure & Logic',    min: 2, hard: true, desired: 3, weight: 3.75 },
      { label: 'Content Obj 1 - Test Methods and Conditions',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Content Obj 1 - Objective Results',                section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 1 - Eng Analysis & Oper. Impact',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 1 - Conclusions & Recomm.',            section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.6 },
      { label: 'Content Obj 2 - Test Methods and Conditions',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Content Obj 2 - Objective Results',                section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 2 - Eng Analysis & Oper. Impact',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 2 - Conclusions & Recomm.',            section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.6 },
      { label: 'Content Obj 6 - Test Methods and Conditions',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Content Obj 6 - Objective Results',                section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 6 - Eng Analysis & Oper. Impact',      section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Content Obj 6 - Conclusions & Recomm.',            section: 'Content & Analysis',   min: 2, hard: true, desired: 3, weight: 0.6 },
      { label: 'Clarity & Precision - Grammar & Syntax',           section: 'Clarity & Precision',  min: 2, hard: true, desired: 3, weight: 0.375 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format',   section: 'Clarity & Precision',  min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice',section: 'Clarity & Precision',  min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',       section: 'Visual Engineering',   min: 2, hard: true, desired: 3, weight: 0.375 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',            section: 'Visual Engineering',   min: 2, hard: true, desired: 3, weight: 0.5 },
      { label: 'Visual Eng - Data Honesty & Context',              section: 'Visual Engineering',   min: 2, hard: true, desired: 3, weight: 0.5 },
    ],
  },

  // ── SY 7212F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'SY 7212F', title: 'Mission Systems Flight - MLE',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Briefing',   section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Test Conduct - Communication',      section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Test Conduct - Teamwork/CRM',       section: 'Test Conduct', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Preparation - Predictions',         section: 'Preparation', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'Preparation - MLE Test Point Priority', section: 'Preparation', min: 2, hard: true, desired: 3, weight: 5 },
      { label: 'Execution - TGP Laser Regression',  section: 'Execution', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Execution - GBU-12 Cold/Hot Pass',  section: 'Execution', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Execution - A-A FCR Event',         section: 'Execution', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Execution - MLE Test Point Priority', section: 'Execution', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Execution - CARA ALOW Regression',  section: 'Execution', min: 2, hard: false, desired: 3, weight: 8 },
      { label: 'Reporting - Oral Debrief',          section: 'Reporting', min: 2, hard: true,  desired: 3, weight: 10 },
    ],
  },

  // ── SY 7511F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'SY 7511F', title: 'Mission Systems Flight - Radar',
    type: 'FLIGHT', tracks: ['PILOT'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Local Area Proc/Orientation/Comm',  section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true, desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Materials/Briefing',  section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 5 },
      { label: 'Test Conduct - Mission Management/Adaptability', section: 'Test Conduct', min: 2, hard: true, desired: 3, weight: 10 },
      { label: 'Test Conduct - Test Specific Comm/CRM',     section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'SLOs - Radar Functionality',        section: 'Specific Learning Objectives', min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'SLOs - Ground Map Test',            section: 'Specific Learning Objectives', min: 2, hard: false, desired: 3, weight: 15 },
      { label: 'SLOs - Ground Moving Target Test',  section: 'Specific Learning Objectives', min: 2, hard: false, desired: 3, weight: 15 },
      { label: 'SLOs - Operational Evaluation',     section: 'Specific Learning Objectives', min: 2, hard: false, desired: 3, weight: 15 },
      { label: 'SLOs - Regression',                 section: 'Specific Learning Objectives', min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Reporting - SPO Debrief',           section: 'Reporting', min: 2, hard: false, desired: 3, weight: 10 },
    ],
  },

  // ── TF 6241F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 6241F', title: 'Test Foundations Flight - Intro',
    type: 'FLIGHT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 1, hard: true,  desired: 2, weight: 15 },
      { label: 'Test Conduct - Awareness/Adaptation', section: 'Test Conduct', min: 1, hard: true, desired: 2, weight: 15 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 1, hard: true,  desired: 2, weight: 15 },
      { label: 'Test Conduct - Teamwork',            section: 'Test Conduct', min: 1, hard: true,  desired: 2, weight: 15 },
      { label: 'Test Points - Check Climb',          section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 5 },
      { label: 'Test Points - Trim Shot',            section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 2.5 },
      { label: 'Test Points - 40% Flaps Level Accel',section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 5 },
      { label: 'Test Points - Check Descent',        section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 5 },
      { label: 'Test Points - RNAV Approach',        section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 5 },
      { label: 'Test Points - Ground Block',         section: 'Test Points',  min: 1, hard: false, desired: 2, weight: 2.5 },
      { label: 'Post Flight - Mission Analysis',     section: 'Post Flight',  min: 1, hard: true,  desired: 2, weight: 5 },
    ],
  },

  // ── TF 6251F ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 6251F', title: 'Test Foundations Flight - SSE',
    type: 'FLIGHT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 20,
    tasks: [
      { label: 'Basic Aircraft Procedures',         section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Basic Aircraft Handling',           section: 'Airmanship', isAirmanship: true, min: 2, hard: true,  desired: 3, weight: 4 },
      { label: 'Local Area Proc./Orientation/Comm', section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Situational Awareness/Judgement',   section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Clearing/Visual Lookout',           section: 'Airmanship', isAirmanship: true, min: 3, hard: true,  desired: 3, weight: 4 },
      { label: 'Test Conduct - Mission Preparation', section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Prebrief',            section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Awareness/Adaptation',section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Communication',       section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Conduct - Teamwork',            section: 'Test Conduct', min: 2, hard: true,  desired: 3, weight: 10 },
      { label: 'Test Points - Takeoff',              section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Points - Check Climb',          section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Points - Turn Performance',     section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - 1.2 Vs Cruise',        section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 5 },
      { label: 'Test Points - Max Range Cruise',     section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Points - SSE Level Accel',      section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Test Points - SSE Sawtooth Climbs',  section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 4 },
      { label: 'Test Points - Level Decel',          section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Points - Check Descent',        section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 3 },
      { label: 'Test Points - Ground Blocks',        section: 'Test Points',  min: 2, hard: false, desired: 3, weight: 2 },
      { label: 'Post Flight - Debrief/Data Analysis',section: 'Post Flight',  min: 2, hard: true,  desired: 3, weight: 5 },
    ],
  },

  // ── TF 6402R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 6402R', title: 'Test Foundations Report - Performance',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',          section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Structure & Logic - Report Org. & Structure',    section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Structure & Logic - Logical Chain of Reasoning', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Take-Off Ground Roll - Test Methods and Conditions', section: 'Take-Off Ground Roll', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Take-Off Ground Roll - Objective Results',           section: 'Take-Off Ground Roll', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Take-Off Ground Roll - Eng Analysis & Oper. Impact', section: 'Take-Off Ground Roll', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Take-Off Ground Roll - Conclusions & Recomm.',       section: 'Take-Off Ground Roll', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'Time/Fuel/Dist to Climb - Test Methods and Conditions', section: 'Time/Fuel/Dist to Climb', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Time/Fuel/Dist to Climb - Objective Results',          section: 'Time/Fuel/Dist to Climb', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Time/Fuel/Dist to Climb - Eng Analysis & Oper. Impact',section: 'Time/Fuel/Dist to Climb', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Time/Fuel/Dist to Climb - Conclusions & Recomm.',      section: 'Time/Fuel/Dist to Climb', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'Clarity & Precision - Grammar & Syntax',               section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1.33 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format',       section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice',    section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',           section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',                section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',                  section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── TF 6403R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 6403R', title: 'Test Foundations Report - Ground Vehicle',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',          section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Structure & Logic - Report Org. & Structure',    section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Structure & Logic - Logical Chain of Reasoning', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'GTO 1 - STO 1 - Vehicle Speed',                  section: 'GTO 1 - Cruise Control', min: 2, hard: true, desired: 3, weight: 2.22 },
      { label: 'GTO 1 - STO 2 - Cruise Control Accuracy',        section: 'GTO 1 - Cruise Control', min: 2, hard: true, desired: 3, weight: 2.22 },
      { label: 'GTO 1 - STO 3 - Cruise Control Interface',       section: 'GTO 1 - Cruise Control', min: 2, hard: true, desired: 3, weight: 2.22 },
      { label: 'GTO 2 - STO 1',                                  section: 'GTO 2 - COTS GPS', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'GTO 2 - STO 2 (NA if unused)',                   section: 'GTO 2 - COTS GPS', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'GTO 2 - STO 3 (NA if unused)',                   section: 'GTO 2 - COTS GPS', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'GTO 2 - STO 4 (NA if unused)',                   section: 'GTO 2 - COTS GPS', min: 2, hard: true, desired: 3, weight: 1.67 },
      { label: 'Clarity & Precision - Grammar & Syntax',         section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1.33 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',     section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',          section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',            section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── TF 7113R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 7113R', title: 'Test Foundations Report - Flying Qualities',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',          section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Structure & Logic - Report Org. & Structure',    section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Structure & Logic - Logical Chain of Reasoning', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Test Methods and Conditions',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Content - Objective Results',                    section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Eng Analysis & Oper. Impact',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Conclusions & Recomm.',                section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Clarity & Precision - Grammar & Syntax',         section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1.33 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',     section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',          section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',            section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── TF 7123R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 7123R', title: 'Test Foundations Report - Mission Systems',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',          section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Structure & Logic - Report Org. & Structure',    section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Structure & Logic - Logical Chain of Reasoning', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Test Methods and Conditions',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Content - Objective Results',                    section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Eng Analysis & Oper. Impact',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Conclusions & Recomm.',                section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Clarity & Precision - Grammar & Syntax',         section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1.33 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',     section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',          section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',            section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── TF 7133R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 7133R', title: 'Test Foundations Report - Structures',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Structure & Logic - Executive Summary',          section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Structure & Logic - Report Org. & Structure',    section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Structure & Logic - Logical Chain of Reasoning', section: 'Structure & Logic', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Test Methods and Conditions',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Content - Objective Results',                    section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Eng Analysis & Oper. Impact',          section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 4 },
      { label: 'Content - Conclusions & Recomm.',                section: 'Content & Analysis', min: 2, hard: true, desired: 3, weight: 3.33 },
      { label: 'Clarity & Precision - Grammar & Syntax',         section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1.33 },
      { label: 'Clarity & Precision - Punct. Acronyms & Format', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Clarity & Precision - Profess. Tone & Word Choice', section: 'Clarity & Precision', min: 2, hard: true, desired: 3, weight: 1 },
      { label: 'Visual Eng - Anatomy of a Valid Plot/Table',     section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2.67 },
      { label: 'Visual Eng - Data-Ink Ratio & Clarity',          section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
      { label: 'Visual Eng - Data Honesty & Context',            section: 'Visual Engineering', min: 2, hard: true, desired: 3, weight: 2 },
    ],
  },

  // ── TF 7502R ──────────────────────────────────────────────────────────────
  {
    courseCode: 'TF 7502R', title: 'Test Foundations Report - Test Plan',
    type: 'REPORT', tracks: ['PILOT', 'FTE', 'CSO_WSO', 'ABM', 'RPA'], airmanshipPct: 0,
    tasks: [
      { label: 'Introduction - Test Item Description',     section: 'Introduction',  min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Introduction - Evaluation Scenario & Reqs', section: 'Introduction', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Test Planning - Specific Test Objectives', section: 'Test Planning', min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Test Planning - Evaluation Elements',      section: 'Test Planning', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Test Planning - Description',              section: 'Test Planning', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Test Planning - Test Methodology',         section: 'Test Planning', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Test Planning - Evaluation Criteria',      section: 'Test Planning', min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Test Cards - Test Cards',                  section: 'Test Cards',    min: 2, hard: false, desired: 3, weight: 1 },
      { label: 'Overall - Grammar',                        section: 'Overall',       min: 2, hard: true,  desired: 3, weight: 1 },
      { label: 'Overall - Mechanics',                      section: 'Overall',       min: 2, hard: true,  desired: 3, weight: 1 },
    ],
  },

]

async function seedGradebook() {
  console.log('Seeding gradebook templates…')

  let created = 0
  for (const t of templates) {
    const existing = await db.gradesheetTemplate.findFirst({
      where: { courseCode: t.courseCode, isActive: true },
    })
    if (existing) {
      console.log(`  skip ${t.courseCode} (already exists)`)
      continue
    }

    await db.gradesheetTemplate.create({
      data: {
        courseCode:    t.courseCode,
        title:         t.title,
        type:          t.type,
        tracks:        t.tracks,
        airmanshipPct: t.airmanshipPct / 100,
        isActive:      true,
        tasks: {
          create: t.tasks.map((task, idx) => ({
            sortOrder:     idx,
            sectionLabel:  task.section ?? null,
            isAirmanship:  task.isAirmanship ?? false,
            isBonus:       task.isBonus ?? false,
            isDemo:        task.isDemo ?? false,
            label:         task.label,
            minScore:      task.min ?? null,
            minScoreHard:  task.hard ?? false,
            desiredScore:  task.desired ?? null,
            weight:        (task.weight ?? 0) / 100,
            numberRequired: task.numReq ?? 1,
          })),
        },
      },
    })
    console.log(`  ✓ ${t.courseCode} — ${t.tasks.length} tasks`)
    created++
  }

  console.log(`Done — ${created} templates created.`)
}

seedGradebook()
  .catch(console.error)
  .finally(() => db.$disconnect())
