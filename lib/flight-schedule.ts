/**
 * Google Sheets flight schedule integration.
 *
 * Data source: TPS scheduling whiteboard
 *   Sheet ID: 1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU
 *   GID:      2073547997
 *
 * LMS NEVER writes to this sheet. Read-only via Google Sheets API v4.
 * Daily pull cached in FlightScheduleSync + FlightScheduleEntry tables.
 *
 * Schema: one row per student per event type (FLIGHT, GROUND, or NA).
 */
import { db } from '@/lib/db'

const SHEET_ID = '1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU'
const DEFAULT_GID = '2073547997'
const API_BASE    = 'https://sheets.googleapis.com/v4/spreadsheets'

type ParsedEntry = {
  studentName: string
  eventType:   'FLIGHT' | 'GROUND' | 'NA'
  eventTime:   string | null
  notes:       string | null
}

// ── Google Sheets fetch ────────────────────────────────────────────────────────

async function fetchSheetData(date: Date): Promise<ParsedEntry[]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_SHEETS_API_KEY not set — flight schedule unavailable')
    return []
  }

  try {
    // Get sheet metadata to find today's tab
    const metaUrl = `${API_BASE}/${SHEET_ID}?key=${encodeURIComponent(apiKey)}&fields=sheets.properties`
    const metaRes = await fetch(metaUrl, { next: { revalidate: 3600 } })
    if (!metaRes.ok) {
      console.error(`Sheets metadata fetch failed: ${metaRes.status}`)
      return []
    }

    const meta = await metaRes.json() as { sheets: { properties: { title: string; sheetId: number } }[] }
    const dateFormats = buildDateFormats(date)
    const tab = meta.sheets.find(s =>
      dateFormats.some(f => s.properties.title.toLowerCase().includes(f.toLowerCase())),
    )

    const range = tab ? `'${tab.properties.title}'!A1:Z200` : `A1:Z200`
    const dataUrl = `${API_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`
    const dataRes = await fetch(dataUrl, { next: { revalidate: 3600 } })
    if (!dataRes.ok) {
      console.error(`Sheets data fetch failed: ${dataRes.status}`)
      return []
    }

    const data = await dataRes.json() as { values?: string[][] }
    return parseSheetRows(data.values ?? [])
  } catch (err) {
    console.error('fetchSheetData:', err)
    return []
  }
}

function buildDateFormats(d: Date): string[] {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const day = d.getDate().toString().padStart(2, '0')
  const mon = months[d.getMonth()]
  const yr2 = d.getFullYear().toString().slice(-2)
  return [`${day}${mon}${yr2}`, `${day} ${mon}`, `${mon} ${d.getDate()}`]
}

function parseSheetRows(rows: string[][]): ParsedEntry[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const nameIdx   = headers.findIndex(h => h.includes('student') || h.includes('name'))
  const flightIdx = headers.findIndex(h => h.includes('flight') || h.includes('flt'))
  const groundIdx = headers.findIndex(h => h.includes('ground') || h.includes('grd'))
  const naIdx     = headers.findIndex(h => h === 'na' || h === 'n/a')

  const entries: ParsedEntry[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c?.trim())) continue

    const studentName = nameIdx >= 0 ? (row[nameIdx] ?? '').trim() : ''
    if (!studentName) continue

    const flightTime = flightIdx >= 0 ? parseTime(row[flightIdx]) : null
    const groundTime = groundIdx >= 0 ? parseTime(row[groundIdx]) : null
    const isNA       = naIdx >= 0 ? !!(row[naIdx] ?? '').trim() : (!flightTime && !groundTime)

    if (isNA) {
      entries.push({ studentName, eventType: 'NA', eventTime: null, notes: null })
    } else {
      if (flightTime) entries.push({ studentName, eventType: 'FLIGHT', eventTime: flightTime, notes: null })
      if (groundTime) entries.push({ studentName, eventType: 'GROUND', eventTime: groundTime, notes: null })
    }
  }

  return entries
}

function parseTime(val: string | undefined): string | null {
  if (!val?.trim()) return null
  const m = val.trim().match(/^(\d{1,2}):?(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

// ── Sync and persist ──────────────────────────────────────────────────────────

export async function syncFlightSchedule(date?: Date): Promise<void> {
  const target  = date ?? new Date()
  const isoDate = target.toISOString().split('T')[0]

  // Skip if synced within the last hour
  const recent = await db.flightScheduleSync.findFirst({
    where:   { status: 'success', syncedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { syncedAt: 'desc' },
  })
  if (recent) return

  const sync = await db.flightScheduleSync.create({
    data: { sheetId: SHEET_ID, tabGid: DEFAULT_GID, status: 'pending' },
  })

  try {
    const entries = await fetchSheetData(target)

    const todayStart = new Date(isoDate)
    const todayEnd   = new Date(isoDate)
    todayEnd.setDate(todayEnd.getDate() + 1)

    await db.flightScheduleEntry.deleteMany({ where: { scheduleDate: { gte: todayStart, lt: todayEnd } } })

    if (entries.length > 0) {
      await db.flightScheduleEntry.createMany({
        data: entries.map(e => ({
          syncId:       sync.id,
          scheduleDate: todayStart,
          studentName:  e.studentName,
          eventType:    e.eventType,
          eventTime:    e.eventTime,
          notes:        e.notes,
        })),
      })
    }

    await db.flightScheduleSync.update({
      where: { id: sync.id },
      data:  { status: 'success', rowsIngested: entries.length },
    })
  } catch (err) {
    console.error('syncFlightSchedule error:', err)
    await db.flightScheduleSync.update({
      where: { id: sync.id },
      data:  { status: 'error', errorMsg: String(err) },
    })
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getTodaySchedule() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const [entries, lastSync] = await Promise.all([
    db.flightScheduleEntry.findMany({
      where:   { scheduleDate: { gte: todayStart, lt: todayEnd } },
      orderBy: [{ eventType: 'asc' }, { studentName: 'asc' }],
    }),
    db.flightScheduleSync.findFirst({
      where:   { syncedAt: { gte: todayStart } },
      orderBy: { syncedAt: 'desc' },
    }),
  ])

  return { entries, lastSync }
}

/**
 * Check if a student has a flight scheduled today.
 * Name-match against raw sheet data (case-insensitive, lastName partial match).
 */
export async function studentHasFlightToday(
  firstName: string,
  lastName:  string,
): Promise<boolean | null> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const entry = await db.flightScheduleEntry.findFirst({
    where: {
      scheduleDate: { gte: todayStart, lt: todayEnd },
      eventType:    'FLIGHT',
      studentName:  { contains: lastName, mode: 'insensitive' },
    },
  })

  return entry !== null
}
