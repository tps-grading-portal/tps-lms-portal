'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { importGradesAction } from './actions'
import { cn } from '@/lib/utils'

type ClassOpt    = { id: string; name: string }
type CritOpt     = { id: string; code: string; name: string }
type ScenarioOpt = { id: string; number: number; label: string }
type StaffOpt    = { id: string; name: string }

interface Props {
  classes:      ClassOpt[]
  criteria:     CritOpt[]
  scenarios:    ScenarioOpt[]
  staffMembers: StaffOpt[]
}

// Required fields that need to be mapped
const REQUIRED_FIELDS = [
  { key: 'studentNumber', label: 'Student Number', hint: 'e.g. 26A-1 or just 1' },
  { key: 'track',         label: 'Track',          hint: 'PILOT, FTE, STC, etc.' },
  { key: 'scenarioNumber',label: 'Scenario Number', hint: 'e.g. 1, 2, 3' },
  { key: 'graderName',    label: 'Grader Name',    hint: 'Staff member last name' },
]

// Auto-detect column from header name
function autoDetect(header: string, key: string): boolean {
  const h = header.toLowerCase()
  if (key === 'studentNumber') return h.includes('student') || h.includes('number')
  if (key === 'track')         return h.includes('track')
  if (key === 'scenarioNumber')return h.includes('scenario')
  if (key === 'graderName')    return h.includes('grader') || h.includes('staff')
  return false
}

function autoCriterionDetect(header: string, code: string): boolean {
  const h = header.toLowerCase()
  const c = code.toLowerCase()
  return h.includes(c) || h.replace(/[^0-9.]/g, '') === code.replace(/[^0-9.]/g, '')
}

type ParsedData = {
  headers: string[]
  rows:    string[][]
}

export function ImportWizard({ classes, criteria, scenarios, staffMembers }: Props) {
  const [step,        setStep]       = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [parsed,      setParsed]     = useState<ParsedData | null>(null)
  const [mapping,     setMapping]    = useState<Record<string, string>>({})  // fieldKey → columnIndex
  const [targetClass, setTargetClass] = useState('')
  const [importing,   setImporting]  = useState(false)
  const [importResult,setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [error,       setError]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Parse uploaded file ─────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][]

        if (rows.length < 2) { setError('File has no data rows.'); return }

        const headers = (rows[0] as string[]).map(String)
        const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''))

        setParsed({ headers, rows: dataRows.map((r) => r.map(String)) })

        // Auto-map fields
        const autoMap: Record<string, string> = {}
        REQUIRED_FIELDS.forEach(({ key }) => {
          const idx = headers.findIndex((h) => autoDetect(h, key))
          if (idx >= 0) autoMap[key] = String(idx)
        })
        criteria.forEach((c) => {
          const idx = headers.findIndex((h) => autoCriterionDetect(h, c.code))
          if (idx >= 0) autoMap[`crit_${c.id}`] = String(idx)
        })
        setMapping(autoMap)
        setStep('map')
      } catch (err) {
        setError('Could not parse file. Make sure it is a valid .xlsx or .csv file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const allMapped = REQUIRED_FIELDS.every((f) => mapping[f.key] !== undefined && mapping[f.key] !== '')
    && criteria.every((c) => mapping[`crit_${c.id}`] !== undefined && mapping[`crit_${c.id}`] !== '')

  // ── Build preview rows ──────────────────────────────────────────────────
  const previewRows = parsed?.rows.slice(0, 5).map((row) => ({
    studentNumber: mapping.studentNumber ? row[parseInt(mapping.studentNumber)] : '—',
    track:         mapping.track         ? row[parseInt(mapping.track)]         : '—',
    scenario:      mapping.scenarioNumber ? row[parseInt(mapping.scenarioNumber)] : '—',
    grader:        mapping.graderName    ? row[parseInt(mapping.graderName)]    : '—',
    grades: criteria.map((c) => ({
      code: c.code,
      val:  mapping[`crit_${c.id}`] ? row[parseInt(mapping[`crit_${c.id}`])] : '—',
    })),
  })) ?? []

  // ── Submit import ───────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed || !targetClass) { setError('Select a target class.'); return }
    setImporting(true)
    setError(null)
    try {
      const result = await importGradesAction({
        classId:   targetClass,
        headers:   parsed.headers,
        rows:      parsed.rows,
        mapping,
        criteriaIds: criteria.map((c) => ({ id: c.id, code: c.code })),
        scenarioMap: Object.fromEntries(scenarios.map((s) => [String(s.number), s.id])),
        staffMap:    Object.fromEntries(staffMembers.map((s) => [s.name.toLowerCase(), s.id])),
      })
      setImportResult(result)
      setStep('done')
    } catch (err) {
      setError('Import failed: ' + String(err))
    }
    setImporting(false)
  }

  // ── Done state ──────────────────────────────────────────────────────────
  if (step === 'done' && importResult) {
    return (
      <div className="card border border-green-300 bg-green-50 space-y-4">
        <h2 className="font-bold text-green-800 text-lg">Import Complete</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-bold text-green-700">{importResult.imported}</p><p className="text-xs text-gray-500">Imported</p></div>
          <div><p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p><p className="text-xs text-gray-500">Skipped (already exist)</p></div>
          <div><p className="text-2xl font-bold text-red-700">{importResult.errors.length}</p><p className="text-xs text-gray-500">Errors</p></div>
        </div>
        {importResult.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
            {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}
        <button onClick={() => { setStep('upload'); setParsed(null); setMapping({}); setImportResult(null) }}
          className="btn-secondary text-sm">
          Import Another File
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Upload ─────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="card border-2 border-dashed border-gray-300 text-center py-12 space-y-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
          <p className="text-4xl">📊</p>
          <p className="text-gray-600 font-medium">Drag and drop an Excel or CSV file here</p>
          <p className="text-gray-400 text-sm">or</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
            Browse Files
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* ── Column mapping ─────────────────────────────────────────────── */}
      {step === 'map' && parsed && (
        <div className="space-y-6">
          {/* Header preview */}
          <div className="card overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              File Preview (first 3 rows)
            </p>
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  {parsed.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1 bg-gray-100 border border-gray-200 text-left text-gray-600 whitespace-nowrap">
                      {i}: {h || '(empty)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 border border-gray-100 text-gray-600 whitespace-nowrap max-w-[100px] truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Target class */}
          <div className="card space-y-2">
            <label className="field-label">Target Class <span className="text-red-500">*</span></label>
            <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)} className="field-select max-w-xs">
              <option value="">Select class to import into…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>Class {c.name}</option>)}
            </select>
          </div>

          {/* Field mapping */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800">Map Columns to Fields</h3>
            <p className="text-sm text-gray-500">
              Select which column from your file corresponds to each required field.
              Auto-detected matches are pre-selected — verify they&apos;re correct.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {REQUIRED_FIELDS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="field-label">{label} <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-400 mb-1">{hint}</p>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    className="field-select text-sm"
                  >
                    <option value="">— select column —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={String(i)}>{i}: {h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <h4 className="font-medium text-gray-700 pt-2 border-t">Criterion Grade Columns</h4>
            <div className="grid md:grid-cols-3 gap-3">
              {criteria.map((c) => (
                <div key={c.id}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {c.code} — {c.name.split(' ').slice(0, 3).join(' ')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mapping[`crit_${c.id}`] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [`crit_${c.id}`]: e.target.value }))}
                    className="field-select text-xs"
                  >
                    <option value="">— select column —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={String(i)}>{i}: {h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep('upload')} className="btn-secondary text-sm">← Back</button>
            <button
              type="button"
              onClick={() => { if (!targetClass) { setError('Select a target class first.'); return }; setStep('preview') }}
              disabled={!allMapped || !targetClass}
              className="btn-primary text-sm"
            >
              Preview Import →
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ────────────────────────────────────────────────────── */}
      {step === 'preview' && parsed && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Preview (first 5 rows of {parsed.rows.length} total)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {['Student #', 'Track', 'Scenario', 'Grader', ...criteria.map((c) => c.code)].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1.5 font-mono">{row.studentNumber}</td>
                      <td className="px-2 py-1.5">{row.track}</td>
                      <td className="px-2 py-1.5">{row.scenario}</td>
                      <td className="px-2 py-1.5">{row.grader}</td>
                      {row.grades.map(({ val }) => (
                        <td key={val} className={cn('px-2 py-1.5 text-center font-mono', Number(val) === 8 ? 'text-red-600 font-bold' : 'text-gray-700')}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {parsed.rows.length} total rows will be imported as finalized grade records.
            </p>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep('map')} className="btn-secondary text-sm">← Adjust Mapping</button>
            <button type="button" onClick={handleImport} disabled={importing} className="btn-primary text-sm">
              {importing ? 'Importing…' : `Import ${parsed.rows.length} rows`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
