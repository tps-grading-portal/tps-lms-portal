/**
 * Gradebook multi-track update seed
 * 1. Updates track assignments on existing Pilot templates
 * 2. Seeds new track-specific gradesheets
 */
import { PrismaClient, Track, GradesheetType } from '@prisma/client'
const db = new PrismaClient()

// ── 1. Track assignments to ADD to existing Pilot templates ──────────────────

const TRACK_UPDATES: { courseCode: string; addTracks: Track[] }[] = [
  { courseCode: 'PF 6121F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'PF 6221F', addTracks: ['CSO_WSO','RPA'] },
  { courseCode: 'PF 8222F', addTracks: ['RPA'] },
  { courseCode: 'PF 8231F', addTracks: ['RPA'] },
  { courseCode: 'PF 8332F', addTracks: ['ABM','FTE'] },
  { courseCode: 'FQ 6241F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'FQ 6251F', addTracks: ['CSO_WSO','RPA'] },
  { courseCode: 'FQ 7232F', addTracks: ['CSO_WSO','RPA'] },
  { courseCode: 'FQ 8121F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'FQ 8141F', addTracks: ['RPA'] },
  { courseCode: 'FQ 9111F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'FQ 9211F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'FQ 9221F', addTracks: ['RPA'] },
  { courseCode: 'FQ 9246F', addTracks: ['CSO_WSO','RPA'] },
  { courseCode: 'FQ 9511F', addTracks: [] }, // Pilot-only confirmed
  { courseCode: 'SY 6131F', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'SY 6132R', addTracks: ['ABM','CSO_WSO','FTE','RPA'] },
  { courseCode: 'SY 7212F', addTracks: ['CSO_WSO','RPA'] },
]

// ── Helper types ─────────────────────────────────────────────────────────────

type T = { label:string; section?:string; isAirmanship?:boolean; isBonus?:boolean
           isDemo?:boolean; min?:number|null; hard?:boolean; desired?:number|null
           weight?:number; numReq?:number }

type Def = { courseCode:string; title:string; type:GradesheetType; tracks:Track[]
             airmanshipPct:number; tasks:T[] }

// ── CR airmanship helper ─────────────────────────────────────────────────────
const CR_AM = (section='Airmanship'): T[] => [
  { label:'Basic CR Knowledge/Operations',  section, isAirmanship:true, min:1, hard:true,  desired:2, weight:1.25 },
  { label:'Basic Comm/Airspace Mechanics',  section, isAirmanship:true, min:1, hard:true,  desired:2, weight:1.25 },
  { label:'Basic SA/Judgement',             section, isAirmanship:true, min:2, hard:true,  desired:3, weight:2.5  },
]

// Standard 5-task flight airmanship at 2% each
const FLT_AM_2 = (section='Airmanship'): T[] => [
  { label:'Basic Aircraft Procedures',          section, isAirmanship:true, min:1, hard:true, desired:2, weight:2 },
  { label:'Basic Auto FCS Handling',            section, isAirmanship:true, min:1, hard:true, desired:2, weight:2 },
  { label:'Local Area Proc./Orientation/Comm',  section, isAirmanship:true, min:2, hard:true, desired:3, weight:2 },
  { label:'Situational Awareness/Judgement',    section, isAirmanship:true, min:2, hard:true, desired:3, weight:2 },
  { label:'Clearing/Visual Lookout',            section, isAirmanship:true, min:2, hard:true, desired:3, weight:2 },
]

// Standard RPA/CSO flight airmanship (Basic Aircraft Knowledge style)
const FLT_AM_3 = (section='Airmanship'): T[] => [
  { label:'Basic Aircraft Knowledge/Ops',       section, isAirmanship:true, min:1, hard:true, desired:2, weight:3 },
  { label:'Basic Comm/Airspace Mechanics',      section, isAirmanship:true, min:2, hard:true, desired:3, weight:3 },
  { label:'Basic SA/Judgement',                 section, isAirmanship:true, min:2, hard:true, desired:3, weight:3 },
]

// ── 2. New templates ──────────────────────────────────────────────────────────

const NEW_TEMPLATES: Def[] = [

  // ── Check Flights (CF) — Pass/Fail, no scored tasks ────────────────────────
  { courseCode:'CF 6110F', title:'C-172 Airmanship FA-1 (ABM/FTE)',    type:'FLIGHT', tracks:['ABM','FTE'],     airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6111F', title:'C-172 Airmanship FA-2 (ABM/FTE)',    type:'FLIGHT', tracks:['ABM','FTE'],     airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6112F', title:'C-172 Airmanship FA-3 (ABM/FTE)',    type:'FLIGHT', tracks:['ABM','FTE'],     airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6113F', title:'C-172 Airmanship FA-4 (ABM/FTE)',    type:'FLIGHT', tracks:['ABM','FTE'],     airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6114F', title:'C-172 Airmanship FA-5 (ABM/FTE)',    type:'FLIGHT', tracks:['ABM','FTE'],     airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6120F', title:'Check Flight 1 (CSO)',                type:'FLIGHT', tracks:['CSO_WSO'],      airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6121F', title:'Check Flight 2 (CSO)',                type:'FLIGHT', tracks:['CSO_WSO'],      airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6801F', title:'RPA Check Flight 1',                  type:'FLIGHT', tracks:['RPA'],          airmanshipPct:100, tasks:[] },
  { courseCode:'CF 6802F', title:'RPA Check Flight 2',                  type:'FLIGHT', tracks:['RPA'],          airmanshipPct:100, tasks:[] },

  // ── TF 6221C — Control Room Intro (ABM/FTE/STC) ───────────────────────────
  {
    courseCode:'TF 6221C', title:'Test Foundations Control Room Intro',
    type:'CONTROL_ROOM', tracks:['ABM','FTE','OPERATOR'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',    section:'Test Conduct', isDemo:true },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:2, weight:14.6 },
      { label:'Test Plan/Card Adherence',      section:'Test Conduct', min:1, hard:false, desired:2, weight:21.9 },
      { label:'Test Specific Comm/CRM',        section:'Test Conduct', min:1, hard:false, desired:2, weight:21.9 },
      { label:'Limit Adherence/Aborts',        section:'Test Conduct', min:1, hard:false, desired:2, weight:21.9 },
      { label:'Data Collection',               section:'Test Conduct', min:1, hard:false, desired:2, weight:14.6 },
      { label:'Debrief',                       section:'Test Conduct', isDemo:true },
    ],
  },

  // ── TF 6231C — Control Room with EP (ABM/FTE) ─────────────────────────────
  {
    courseCode:'TF 6231C', title:'Test Foundations Control Room - Emergency Procedures',
    type:'CONTROL_ROOM', tracks:['ABM','FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',    section:'Test Conduct', isDemo:true },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:2, weight:10 },
      { label:'Test Plan/Card Adherence',      section:'Test Conduct', min:1, hard:true,  desired:2, weight:20 },
      { label:'Test Specific Comm/CRM',        section:'Test Conduct', min:1, hard:true,  desired:2, weight:30 },
      { label:'Limit Adherence',               section:'Test Conduct', min:1, hard:true,  desired:2, weight:15 },
      { label:'Data Collection',               section:'Test Conduct', min:1, hard:false, desired:2, weight:10 },
      { label:'Simulated EP Response',         section:'Specific Learning Objectives', min:1, hard:false, desired:2, weight:10 },
      { label:'Debrief',                       section:'Test Conduct', isDemo:true },
    ],
  },

  // ── TF 6233C — STC Control Room (STC) ────────────────────────────────────
  {
    courseCode:'TF 6233C', title:'Test Foundations Control Room - STC',
    type:'CONTROL_ROOM', tracks:['OPERATOR'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',    section:'Test Conduct', isDemo:true },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:2, weight:10 },
      { label:'Test Plan/Card Adherence',      section:'Test Conduct', min:1, hard:true,  desired:2, weight:20 },
      { label:'Test Specific Comm/CRM',        section:'Test Conduct', min:1, hard:true,  desired:2, weight:30 },
      { label:'Limit Adherence',               section:'Test Conduct', min:1, hard:true,  desired:2, weight:15 },
      { label:'Data Collection',               section:'Test Conduct', min:1, hard:false, desired:2, weight:10 },
      { label:'Simulated EP Response',         section:'Specific Learning Objectives', min:1, hard:false, desired:2, weight:10 },
      { label:'Debrief',                       section:'Test Conduct', isDemo:true },
    ],
  },

  // ── FQ 6252C — FQ Control Room Intro (ABM/FTE) ───────────────────────────
  {
    courseCode:'FQ 6252C', title:'Flying Qualities Control Room Intro',
    type:'CONTROL_ROOM', tracks:['ABM','FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:5.3 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:2, weight:15.8 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:10.6 },
      { label:'Flight Debrief',                  section:'Test Conduct', min:1, hard:false, desired:2, weight:5.3 },
      { label:'Maneuver Feedback',               section:'Specific Learning Objectives', min:1, hard:true,  desired:3, weight:5.3 },
      { label:'Pre-calc vs. Flt Data Analysis',  section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:5.3 },
    ],
  },

  // ── FQ 7231C — FQ Structures Control Room (ABM/FTE) ──────────────────────
  {
    courseCode:'FQ 7231C', title:'Flying Qualities Control Room - Structures',
    type:'CONTROL_ROOM', tracks:['ABM','FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:6.5 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:3, weight:8.6 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:13 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.3 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.3 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:3, weight:8.6 },
      { label:'Debrief',                         section:'Test Conduct', min:1, hard:false, desired:3, weight:6.5 },
      { label:'Structures',                      section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:8.6 },
      { label:'LCO',                             section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:8.6 },
    ],
  },

  // ── FQ 8160F — FQ Flight Intro (ABM/CSO/FTE) ─────────────────────────────
  {
    courseCode:'FQ 8160F', title:'Flying Qualities Flight - HQ FTT Intro',
    type:'FLIGHT', tracks:['ABM','CSO_WSO','FTE'], airmanshipPct:20,
    tasks: [
      { label:'Basic Aircraft Procedures',          section:'Airmanship', isAirmanship:true, min:2, hard:true, desired:3, weight:4 },
      { label:'Basic Aircraft Handling',            section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:4 },
      { label:'Local Area Proc./Orientation/Comm',  section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:4 },
      { label:'Situational Awareness/Judgement',    section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:4 },
      { label:'Clearing/Visual Lookout',            section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:4 },
      { label:'Mission Preparation',     section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.8 },
      { label:'SA/Adaptation',           section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.8 },
      { label:'Communication',           section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.8 },
      { label:'Teamwork',                section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.8 },
      { label:'Ground Block',            section:'HQ FTT Execution', min:1, hard:true, desired:3, weight:8.9 },
    ],
  },

  // ── FQ 9237C — Advanced FQ Control Room (ABM) ────────────────────────────
  {
    courseCode:'FQ 9237C', title:'Flying Qualities Control Room - Envelope Expansion',
    type:'CONTROL_ROOM', tracks:['ABM'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:9 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:18.1 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Debrief',                         section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Appropriate Buildup Applied',     section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:13.6 },
    ],
  },

  // ── FQ 9247C — FQ Control Room (FTE) ─────────────────────────────────────
  {
    courseCode:'FQ 9247C', title:'Flying Qualities Control Room - Envelope Expansion (FTE)',
    type:'CONTROL_ROOM', tracks:['FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:9 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:18.1 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Debrief',                         section:'Test Conduct', min:1, hard:false, desired:3, weight:9 },
      { label:'Appropriate Buildup Applied',     section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:13.6 },
    ],
  },

  // ── FQ 9502S — FQ Simulator (ABM/CSO/RPA) ────────────────────────────────
  {
    courseCode:'FQ 9502S', title:'Flying Qualities Simulator - HQ Evaluation',
    type:'SIM', tracks:['ABM','CSO_WSO','RPA'], airmanshipPct:0,
    tasks: [
      { label:'Mission Preparation/Cards',    section:'Test Conduct', min:1, hard:true,  desired:3, weight:19.2 },
      { label:'Flight Briefing',              section:'Test Conduct', min:1, hard:true,  desired:3, weight:7.7 },
      { label:'SA/Adaptation',               section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.4 },
      { label:'Communication/Teamwork',      section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.4 },
      { label:'Flight Debriefing',            section:'Test Conduct', min:1, hard:true,  desired:3, weight:7.7 },
      { label:'Model Confirmation',          section:'FTT Conduct', min:1, hard:false, desired:3, weight:5.8 },
      { label:'Cue Functionality',           section:'FTT Conduct', min:1, hard:false, desired:3, weight:5.8 },
      { label:'Preliminary Handling Qualities', section:'FTT Conduct', min:1, hard:false, desired:3, weight:5.8 },
      { label:'Operational Task HQ Eval',    section:'FTT Conduct', min:1, hard:false, desired:3, weight:17.3 },
    ],
  },

  // ── FQ 9503R — FQ Sim Report (ABM/CSO/RPA) ───────────────────────────────
  {
    courseCode:'FQ 9503R', title:'Flying Qualities Simulator Report',
    type:'REPORT', tracks:['ABM','CSO_WSO','RPA'], airmanshipPct:0,
    tasks: [
      { label:'Executive Summary',          section:'Introduction',          min:2, hard:true, desired:3, weight:27.8 },
      { label:'Limitations',               section:'Introduction',          min:2, hard:true, desired:3, weight:2.8 },
      { label:'Results/Analysis',          section:'Model Confirmation',    min:2, hard:true, desired:3, weight:2.8 },
      { label:'Conclusions',               section:'Model Confirmation',    min:2, hard:true, desired:3, weight:2.8 },
      { label:'Recommendations',           section:'Model Confirmation',    min:2, hard:true, desired:3, weight:2.8 },
      { label:'Results/Analysis',          section:'Cue Functionality',     min:2, hard:true, desired:3, weight:2.8 },
      { label:'Conclusions',               section:'Cue Functionality',     min:2, hard:true, desired:3, weight:2.8 },
      { label:'Recommendations',           section:'Cue Functionality',     min:2, hard:true, desired:3, weight:2.8 },
      { label:'Results/Analysis',          section:'Preliminary HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Conclusions',               section:'Preliminary HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Recommendations',           section:'Preliminary HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Results/Analysis',          section:'Operational HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Conclusions',               section:'Operational HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Recommendations',           section:'Operational HQ Eval',   min:2, hard:true, desired:3, weight:5.6 },
      { label:'Grammar & Syntax',          section:'Clarity & Precision',   min:2, hard:true, desired:3, weight:5.0 },
      { label:'Punct. Acronyms & Format',  section:'Clarity & Precision',   min:2, hard:true, desired:3, weight:5.0 },
      { label:'Profess. Tone & Word Choice', section:'Clarity & Precision', min:2, hard:true, desired:3, weight:5.0 },
      { label:'Anatomy of a Valid Plot/Table', section:'Visual Engineering',min:2, hard:true, desired:3, weight:1.66 },
      { label:'Data-Ink Ratio & Clarity',  section:'Visual Engineering',    min:2, hard:true, desired:3, weight:1.66 },
      { label:'Data Honesty & Context',    section:'Visual Engineering',    min:2, hard:true, desired:3, weight:1.66 },
    ],
  },

  // ── FQ 9512C — Advanced FQ Control Room (FTE) ────────────────────────────
  {
    courseCode:'FQ 9512C', title:'Flying Qualities Control Room - Lat/Dir (FTE)',
    type:'CONTROL_ROOM', tracks:['FTE'], airmanshipPct:4.8,
    tasks: [
      { label:'Basic CR Knowledge/Ops',         section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:1.9 },
      { label:'Basic Comm/Airspace Mechanics',  section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:0.95 },
      { label:'Basic SA/Judgement',             section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:1.9 },
      { label:'Mission Materials/Briefing',     section:'Test Conduct', min:1, hard:true,  desired:2, weight:13.6 },
      { label:'Mission Management/Adaptability',section:'Test Conduct', min:1, hard:true,  desired:3, weight:9.1 },
      { label:'Test Plan/Card Adherence',       section:'Test Conduct', min:1, hard:true,  desired:3, weight:9.1 },
      { label:'Test Specific Comm/CRM',         section:'Test Conduct', min:1, hard:true,  desired:3, weight:4.5 },
      { label:'Limit Adherence',                section:'Test Conduct', min:1, hard:true,  desired:3, weight:9.1 },
      { label:'Data Collection',                section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Flight Debrief',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:13.6 },
      { label:'Final Turn Investigation',       section:'Specific Learning Objectives', min:1, hard:true, desired:3, weight:9.1 },
      { label:'0.9 M PIO',                      section:'Specific Learning Objectives', min:1, hard:true, desired:3, weight:9.1 },
      { label:'Report Review',                  section:'Specific Learning Objectives', min:1, hard:true, desired:3, weight:4.5 },
    ],
  },

  // ── PF 8211F — PF Flight (ABM/CSO/FTE) ───────────────────────────────────
  {
    courseCode:'PF 8211F', title:'Performance Flight - Intro FTTs (Non-Pilot)',
    type:'FLIGHT', tracks:['ABM','CSO_WSO','FTE'], airmanshipPct:5,
    tasks: [
      { label:'Basic Aircraft Knowledge/Operations', section:'Airmanship', isAirmanship:true, min:1, hard:true, desired:2, weight:1.25 },
      { label:'Basic Comm/Airspace Mechanics',       section:'Airmanship', isAirmanship:true, min:2, hard:true, desired:3, weight:1.25 },
      { label:'Basic SA/Judgement',                  section:'Airmanship', isAirmanship:true, min:2, hard:true, desired:3, weight:2.5 },
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:9.5 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:3, weight:12.7 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:12.7 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:false, desired:3, weight:12.7 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:false, desired:3, weight:12.7 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:3, weight:12.7 },
      { label:'Debrief',                         section:'Test Conduct', min:1, hard:false, desired:3, weight:9.5 },
      { label:'Energy (Accel/Decel/STC)',        section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:6.3 },
      { label:'Turn Performance',                section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:6.3 },
    ],
  },

  // ── PF 8221C — PF Control Room (ABM/FTE) ─────────────────────────────────
  {
    courseCode:'PF 8221C', title:'Performance Control Room - IADS',
    type:'CONTROL_ROOM', tracks:['ABM','FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:5.3 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:2, weight:15.8 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:15.8 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:2, weight:10.6 },
      { label:'Flight Debrief',                  section:'Test Conduct', min:1, hard:false, desired:2, weight:5.3 },
      { label:'IADS Eventing',                   section:'Specific Learning Objectives', min:1, hard:true,  desired:2, weight:5.3 },
      { label:'IADS Data Debrief',               section:'Specific Learning Objectives', min:1, hard:false, desired:2, weight:5.3 },
    ],
  },

  // ── PF 8302F — Performance Flight 1 (CSO/RPA) ────────────────────────────
  {
    courseCode:'PF 8302F', title:'Performance Flight - Data Collection Intro (CSO/RPA)',
    type:'FLIGHT', tracks:['CSO_WSO','RPA'], airmanshipPct:10,
    tasks: [
      ...FLT_AM_2(),
      { label:'Mission Preparation/Prebrief',  section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Awareness/Adaptation',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Comm/Qualitative Comments',     section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Teamwork',                      section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Takeoff (data collection only)',section:'Test Points',  min:1, hard:false, desired:3, weight:2 },
      { label:'Check Climb',                   section:'Test Points',  min:1, hard:false, desired:3, weight:6 },
      { label:'Trim Shot',                     section:'Test Points',  min:1, hard:false, desired:3, weight:6 },
      { label:'Turn Performance',              section:'Test Points',  min:1, hard:false, desired:3, weight:6 },
      { label:'Climb Entries/Sawtooth Climbs', section:'Test Points',  min:1, hard:false, desired:3, weight:9 },
      { label:'Descent Entries/Level Decels',  section:'Test Points',  min:1, hard:false, desired:3, weight:9 },
      { label:'Check Descent',                 section:'Test Points',  min:1, hard:false, desired:3, weight:6 },
      { label:'Debrief/Data Analysis',         section:'Post Flight',  min:1, hard:true,  desired:3, weight:6 },
    ],
  },

  // ── PF 8311F — Performance Flight 2 (CSO/RPA) ────────────────────────────
  {
    courseCode:'PF 8311F', title:'Performance Flight - Full Envelope (CSO/RPA)',
    type:'FLIGHT', tracks:['CSO_WSO','RPA'], airmanshipPct:10,
    tasks: [
      ...FLT_AM_2(),
      { label:'Mission Preparation',       section:'Test Conduct', min:1, hard:true,  desired:3, weight:9 },
      { label:'Prebrief',                   section:'Test Conduct', min:1, hard:true,  desired:3, weight:9 },
      { label:'Awareness/Adaptation',       section:'Test Conduct', min:1, hard:true,  desired:3, weight:9 },
      { label:'Communication',              section:'Test Conduct', min:1, hard:true,  desired:3, weight:9 },
      { label:'Teamwork/Time Control',      section:'Test Conduct', min:1, hard:true,  desired:3, weight:9 },
      { label:'Takeoff (data collection only)',section:'Test Points', min:1, hard:false, desired:3, weight:3 },
      { label:'Check Climb',                section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Level Acceleration',         section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Sawtooth Climb',             section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Level Deceleration',         section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Sawtooth Descent',           section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Turn Performance',           section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Max Range Cruise',           section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Check Descent',              section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Debrief/Data Analysis',      section:'Post Flight',  min:1, hard:true,  desired:3, weight:8 },
    ],
  },

  // ── PF 8320R — Performance Report (CSO/RPA) ──────────────────────────────
  {
    courseCode:'PF 8320R', title:'Performance Report (CSO/RPA)',
    type:'REPORT', tracks:['CSO_WSO','RPA'], airmanshipPct:0,
    tasks: [
      { label:'Pre/Post-Ground Blocks',     section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Takeoff',                    section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Check Climb',                section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Level Accel',                section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Sawtooth Climbs',            section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Level Decel',                section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Sawtooth Descents',          section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Max Range Cruise',           section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Turn Perf',                  section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Check Descent',              section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Model Utility Eval',         section:'Test and Evaluation', min:2, hard:true, desired:3, weight:4 },
      { label:'Time/Dist/Fuel to Climb',    section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Specific Excess Power',      section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Specific Neg Excess Power',  section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Turn Perf (graph)',          section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Max Range Cruise (graph)',   section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Time/Dist/Fuel to Descend',  section:'Graphs/Charts/Tables', min:2, hard:true, desired:3, weight:4 },
      { label:'Executive Summary',          section:'Structure & Logic',   min:2, hard:true, desired:3, weight:4 },
      { label:'Report Organization & Structure', section:'Structure & Logic', min:2, hard:true, desired:3, weight:4 },
      { label:'Logical Chain of Reasoning', section:'Structure & Logic',   min:2, hard:true, desired:3, weight:4 },
      { label:'Grammar & Syntax',           section:'Clarity & Precision', min:2, hard:true, desired:3, weight:4 },
      { label:'Punct Acronyms & Formatting',section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
      { label:'Profess Tone & Word Choice', section:'Clarity & Precision', min:2, hard:true, desired:3, weight:4 },
      { label:'Bonus',                      section:'Bonus', isBonus:true, min:0, hard:false, desired:3, weight:5, numReq:0 },
    ],
  },

  // ── PF 8341R — Performance Report (ABM) ──────────────────────────────────
  {
    courseCode:'PF 8341R', title:'Performance Report - Model Comparison (ABM)',
    type:'REPORT', tracks:['ABM'], airmanshipPct:0,
    tasks: [
      { label:'Header Info / TID',                  section:'Introduction',        min:1, hard:false, desired:2, weight:6 },
      { label:'Test Objectives / Overview',         section:'Introduction',        min:2, hard:false, desired:3, weight:4 },
      { label:'Ground Blocks',                      section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Takeoff',                            section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Check Climb Time and Dist.',         section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Level Acceleration',                 section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Sawtooth Climbs',                    section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Best Endurance Cruise',              section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Long Range Cruise',                  section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Turn Performance',                   section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Incremental Drag Descent',           section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Check Descent Time and Dist.',       section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Tower Flyby',                        section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Model Utility Evaluation',           section:'Test and Evaluation', min:2, hard:false, desired:3, weight:4 },
      { label:'Summarize validity of model',        section:'Conclusions and Recommendations', min:2, hard:false, desired:3, weight:4 },
      { label:'Summarize recommendations',         section:'Conclusions and Recommendations', min:2, hard:false, desired:3, weight:4 },
      { label:'Time and Distance to Climb',         section:'Graphs', min:2, hard:false, desired:3, weight:6 },
      { label:'Fuel to Climb',                      section:'Graphs', min:2, hard:false, desired:3, weight:3 },
      { label:'Specific Excess Power',              section:'Graphs', min:2, hard:false, desired:3, weight:3 },
      { label:'Turn Performance (graph)',           section:'Graphs', min:2, hard:false, desired:3, weight:3 },
      { label:'Time and Distance to Descend',       section:'Graphs', min:2, hard:false, desired:3, weight:6 },
      { label:'Fuel to Descend',                    section:'Graphs', min:2, hard:false, desired:3, weight:3 },
      { label:'Grammar, Punct., Mechanics',         section:'Overall', min:2, hard:false, desired:3, weight:5 },
      { label:'Production Quality, Format',         section:'Overall', min:2, hard:false, desired:3, weight:5 },
    ],
  },

  // ── SY 7213C — Mission Systems Control Room (ABM/FTE/STC) ─────────────────
  {
    courseCode:'SY 7213C', title:'Mission Systems Control Room - F-16 Sensors',
    type:'CONTROL_ROOM', tracks:['ABM','FTE','OPERATOR'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:false, desired:2, weight:5.7 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:false, desired:3, weight:17.0 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:17.0 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:11.3 },
      { label:'Limit Adherence/Aborts',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:11.3 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:false, desired:3, weight:11.3 },
      { label:'Flight Debrief',                  section:'Test Conduct', min:1, hard:false, desired:3, weight:11.3 },
      { label:'GBU-12',                          section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.39 },
      { label:'MLE Evaluation',                  section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.39 },
      { label:'A/A FCR',                         section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:1.13 },
      { label:'Regression',                      section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:1.13 },
      { label:'Diving Deliveries',               section:'Specific Learning Objectives', min:1, hard:false, desired:2, weight:1.13 },
    ],
  },

  // ── SY 7503F — Mission Systems Flight (ABM/CSO/RPA) ──────────────────────
  {
    courseCode:'SY 7503F', title:'Mission Systems Flight - Sensors & Weapons',
    type:'FLIGHT', tracks:['ABM','CSO_WSO','RPA'], airmanshipPct:9,
    tasks: [
      ...FLT_AM_3(),
      { label:'Mission Briefing',                 section:'Verbal Communication', min:1, hard:true,  desired:3, weight:6.6 },
      { label:'Test Specific Comm/CRM',           section:'Verbal Communication', min:1, hard:true,  desired:3, weight:8.3 },
      { label:'SPO/Release to Ops Debrief',       section:'Verbal Communication', min:1, hard:true,  desired:3, weight:6.6 },
      { label:'Execution Plan/Prioritization',    section:'Preparation',          min:1, hard:true,  desired:3, weight:9.9 },
      { label:'Mission Materials',                section:'Preparation',          min:1, hard:true,  desired:3, weight:9.9 },
      { label:'Flight/Nav Functionality Support', section:'Test Execution',       min:1, hard:true,  desired:3, weight:9.9 },
      { label:'Sensor Functionality',             section:'Test Execution',       min:1, hard:true,  desired:3, weight:9.9 },
      { label:'Weapons Functionality Support',    section:'Test Execution',       min:1, hard:true,  desired:3, weight:9.9 },
      { label:'Flight/Nav Functionality Support', section:'Test Analysis',        min:1, hard:true,  desired:3, weight:6.6 },
      { label:'Sensor Functionality',             section:'Test Analysis',        min:1, hard:true,  desired:3, weight:6.6 },
      { label:'Weapons Functionality Support',    section:'Test Analysis',        min:1, hard:true,  desired:3, weight:6.6 },
    ],
  },

  // ── SY 7512C — Mission Systems Control Room (FTE) ────────────────────────
  {
    courseCode:'SY 7512C', title:'Mission Systems Control Room - Radar (FTE)',
    type:'CONTROL_ROOM', tracks:['FTE'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:true,  desired:2, weight:5.5 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:true,  desired:3, weight:16.6 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Limit Adherence',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Flight Debrief',                  section:'Test Conduct', min:1, hard:true,  desired:3, weight:11 },
      { label:'Radar Functionality',             section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:2.2 },
      { label:'Ground Map Test',                 section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Ground Moving Target',            section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Operational Evaluation',          section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Regression',                      section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'SPO Debrief',                     section:'Reporting', min:1, hard:true,    desired:3, weight:11 },
    ],
  },

  // ── SY 7521O — Mission Systems Control Room (STC) ────────────────────────
  {
    courseCode:'SY 7521O', title:'Mission Systems Control Room - Radar (STC)',
    type:'CONTROL_ROOM', tracks:['OPERATOR'], airmanshipPct:5,
    tasks: [
      ...CR_AM(),
      { label:'Mission Materials/Briefing',      section:'Test Conduct', min:1, hard:true,  desired:2, weight:5.5 },
      { label:'Mission Management/Adaptability', section:'Test Conduct', min:1, hard:true,  desired:3, weight:16.6 },
      { label:'Test Plan/Card Adherence',        section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Test Specific Comm/CRM',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Limit Adherence',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Data Collection',                 section:'Test Conduct', min:1, hard:true,  desired:3, weight:8.8 },
      { label:'Flight Debrief',                  section:'Test Conduct', min:1, hard:true,  desired:3, weight:11 },
      { label:'Radar Functionality',             section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:2.2 },
      { label:'Ground Map Test',                 section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Ground Moving Target',            section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Operational Evaluation',          section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'Regression',                      section:'Specific Learning Objectives', min:1, hard:false, desired:3, weight:3.3 },
      { label:'SPO Debrief',                     section:'Reporting', min:1, hard:true,    desired:3, weight:11 },
    ],
  },

  // ── SY 752xx — STC Written Report placeholder ─────────────────────────────
  {
    courseCode:'SY 752xx', title:'Mission Systems Report - Test Plan (STC)',
    type:'REPORT', tracks:['OPERATOR'], airmanshipPct:0,
    tasks: [],  // Same structure as TF 7502R — tasks to be verified from source
  },

  // ── TF 6251F (2) — RPA variant of TF 6251F ───────────────────────────────
  {
    courseCode:'TF 6251F (2)', title:'Test Foundations Flight - SSE (RPA Variant)',
    type:'FLIGHT', tracks:['RPA'], airmanshipPct:10,
    tasks: [
      ...FLT_AM_2(),
      { label:'Mission Preparation',    section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Prebrief',               section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Awareness/Adaptation',   section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Communication',          section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Teamwork',               section:'Test Conduct', min:1, hard:true,  desired:3, weight:10 },
      { label:'Takeoff',                section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Check Climb',            section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Turn Performance',       section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'1.2 Vs Cruise',          section:'Test Points',  min:1, hard:false, desired:3, weight:5 },
      { label:'Max Range Cruise',       section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'SSE Level Accel',        section:'Test Points',  min:1, hard:false, desired:3, weight:4 },
      { label:'SSE Sawtooth Climbs',    section:'Test Points',  min:1, hard:false, desired:3, weight:4 },
      { label:'Level Decel',            section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Check Descent',          section:'Test Points',  min:1, hard:false, desired:3, weight:3 },
      { label:'Ground Blocks',          section:'Test Points',  min:1, hard:false, desired:3, weight:2 },
      { label:'Debrief/Data Analysis',  section:'Post Flight',  min:1, hard:true,  desired:3, weight:5 },
    ],
  },

  // ── STC-specific: SO 6140S placeholder ───────────────────────────────────
  { courseCode:'SO 6140S', title:'Space Operations GROOT Checkride (STC)',
    type:'FLIGHT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },

  // ── STC-specific: AS series placeholders ─────────────────────────────────
  { courseCode:'AS 7130L',    title:'Astronautical Sciences Lab',               type:'SIM',    tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7140S FQ', title:'Astronautical Sciences Ops Eval (FQ)',     type:'FLIGHT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7140S HQ', title:'Astronautical Sciences Ops Eval (HQ)',     type:'FLIGHT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7150S',    title:'Astronautical Sciences Ops Eval',          type:'FLIGHT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7160S',    title:'Astronautical Sciences Ops Eval (High)',   type:'FLIGHT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7314W',    title:'Astronautical Sciences Design Project',    type:'REPORT', tracks:['OPERATOR'], airmanshipPct:0, tasks:[] },
  { courseCode:'AS 7316R',    title:'Astronautical Sciences Report',            type:'REPORT', tracks:['OPERATOR'], airmanshipPct:0,
    tasks: [
      { label:'Grammar & Syntax',            section:'Clarity & Precision', min:2, hard:true, desired:3, weight:4 },
      { label:'Punct. Acronyms & Format',    section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
      { label:'Profess. Tone & Word Choice', section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
    ],
  },

  // ── STC Reports ───────────────────────────────────────────────────────────
  { courseCode:'TF 6265R', title:'Test Foundations Report - Structures (STC)',
    type:'REPORT', tracks:['OPERATOR'], airmanshipPct:0,
    tasks: [
      { label:'Grammar & Syntax',            section:'Clarity & Precision', min:2, hard:true, desired:3, weight:4 },
      { label:'Punct. Acronyms & Format',    section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
      { label:'Profess. Tone & Word Choice', section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
    ],
  },
  { courseCode:'TF 6268R', title:'Test Foundations Report - Ground Vehicle (STC)',
    type:'REPORT', tracks:['OPERATOR'], airmanshipPct:0,
    tasks: [
      { label:'Grammar & Syntax',            section:'Clarity & Precision', min:2, hard:true, desired:3, weight:4 },
      { label:'Punct. Acronyms & Format',    section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
      { label:'Profess. Tone & Word Choice', section:'Clarity & Precision', min:2, hard:true, desired:3, weight:3 },
    ],
  },
]

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  // 1. Update tracks on existing templates
  console.log('Updating track assignments on existing templates...')
  for (const { courseCode, addTracks } of TRACK_UPDATES) {
    if (addTracks.length === 0) continue
    const tmpl = await db.gradesheetTemplate.findFirst({ where: { courseCode, isActive: true } })
    if (!tmpl) { console.log(`  SKIP (not found): ${courseCode}`); continue }
    const merged = Array.from(new Set([...tmpl.tracks, ...addTracks]))
    if (merged.length === tmpl.tracks.length) { console.log(`  skip (no change): ${courseCode}`); continue }
    await db.gradesheetTemplate.update({ where: { id: tmpl.id }, data: { tracks: merged as Track[] } })
    console.log(`  ✓ ${courseCode}: tracks → [${merged.join(', ')}]`)
  }

  // 2. Create new templates
  console.log('\nSeeding new templates...')
  let created = 0
  for (const t of NEW_TEMPLATES) {
    const existing = await db.gradesheetTemplate.findFirst({ where: { courseCode: t.courseCode, isActive: true } })
    if (existing) { console.log(`  skip (exists): ${t.courseCode}`); continue }
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
            minScore:      task.isDemo ? null : (task.min ?? null),
            minScoreHard:  task.hard ?? false,
            desiredScore:  task.isDemo ? null : (task.desired ?? null),
            weight:        (task.weight ?? 0) / 100,
            numberRequired: task.numReq ?? 1,
          })),
        },
      },
    })
    console.log(`  ✓ ${t.courseCode} (${t.tracks.join('/')}) — ${t.tasks.length} tasks`)
    created++
  }
  console.log(`\nDone — ${created} new templates created.`)
}

run().catch(console.error).finally(() => db.$disconnect())
