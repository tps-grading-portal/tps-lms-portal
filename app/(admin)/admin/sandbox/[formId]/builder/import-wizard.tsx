'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  extractQuestionsFromText,
  extractQuestionsFromExcel,
  type ExtractedQuestion,
  type ExtractedQuestionType,
  type ExcelSheet,
} from '@/lib/sandbox-question-extractor'
import { cn } from '@/lib/utils'

interface Props {
  onImport: (questions: ExtractedQuestion[]) => void
  onClose:  () => void
  creatorToken?: string  // present when in creator builder
}

const TYPE_LABELS: Record<ExtractedQuestionType, string> = {
  GRADE_1_8:       '1-8 Grade Scale',
  NUMERIC:         'Numeric Scale',
  MULTIPLE_CHOICE: 'Multiple Choice',
  CHECKBOX:        'Checkboxes',
  TEXT:            'Free Text',
  NUMBER:          'Number Entry',
}

const CONFIDENCE_BADGE = (c: number) =>
  c >= 0.85 ? { label: 'High', cls: 'bg-green-100 text-green-700' }
  : c >= 0.65 ? { label: 'Medium', cls: 'bg-amber-100 text-amber-700' }
  : { label: 'Low', cls: 'bg-red-100 text-red-700' }

export function ImportWizard({ onImport, onClose, creatorToken }: Props) {
  const [step,       setStep]       = useState<'upload' | 'review'>('upload')
  const [uploadTab,  setUploadTab]  = useState<'file' | 'paste'>('file')
  const [pastedText, setPastedText] = useState('')
  const [questions,  setQuestions]  = useState<(ExtractedQuestion & { selected: boolean })[]>([])
  const [parsing,    setParsing]    = useState(false)
  const [parseError, setParseError] = useState('')
  const [filename,   setFilename]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePastedText = () => {
    if (!pastedText.trim()) { setParseError('Please paste some text first.'); return }
    setParsing(true)
    setParseError('')
    setFilename('pasted text')
    try {
      const extracted = extractQuestionsFromText(pastedText)
      if (extracted.length === 0) {
        setParseError('No questions detected. Make sure questions are numbered (e.g. "1. Question text") or end with a "?".')
        setParsing(false)
        return
      }
      setQuestions(extracted.map((q) => ({ ...q, selected: true })))
      setStep('review')
    } catch (err) {
      setParseError(String(err))
    }
    setParsing(false)
  }

  const handleFile = async (file: File) => {
    setParseError('')
    setParsing(true)
    setFilename(file.name)

    try {
      let extracted: ExtractedQuestion[] = []

      if (file.name.endsWith('.pdf')) {
        // Client-side PDF extraction via pdfjs-dist (avoids Vercel serverless issues)
        const buffer = await file.arrayBuffer()
        const pdfjsLib = await import('pdfjs-dist')
        // Use CDN worker matching the installed version
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        let pdfText = ''
        for (let p = 1; p <= pdf.numPages; p++) {
          const page    = await pdf.getPage(p)
          const content = await page.getTextContent()
          pdfText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
        }
        if (!pdfText.trim()) {
          throw new Error('No text could be extracted. This PDF may be a scanned image — try copying and pasting the text instead using the "Paste Text" tab.')
        }
        extracted = extractQuestionsFromText(pdfText)

      } else {
        // Client-side Excel/CSV extraction
        const buffer = await file.arrayBuffer()
        const wb     = XLSX.read(buffer, { type: 'array' })
        const sheets: ExcelSheet[] = wb.SheetNames.map((name) => {
          const ws   = wb.Sheets[name]
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
          return { name, rows: rows.filter((r) => r.some((c) => String(c).trim())) }
        })
        extracted = extractQuestionsFromExcel(sheets)
      }

      if (extracted.length === 0) {
        setParseError('No questions could be detected in this file. Try a different file or add questions manually.')
        setParsing(false)
        return
      }

      setQuestions(extracted.map((q) => ({ ...q, selected: true })))
      setStep('review')
    } catch (err) {
      setParseError(String(err instanceof Error ? err.message : err))
    }
    setParsing(false)
  }

  const toggleQ    = (i: number) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, selected: !q.selected } : q))
  const updateType = (i: number, t: ExtractedQuestionType) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, questionType: t } : q))
  const updateLabel = (i: number, l: string) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, label: l } : q))

  const selectedCount = questions.filter((q) => q.selected).length

  const handleImport = () => {
    onImport(questions.filter((q) => q.selected))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-tps-navy text-white px-5 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <p className="text-tps-gold text-[9px] font-bold tracking-widest uppercase">Builder Wizard</p>
            <p className="font-semibold text-sm mt-0.5">
              {step === 'upload' ? 'Import Questions from File' : `Review ${questions.length} extracted questions`}
            </p>
          </div>
          <button onClick={onClose} className="text-tps-silver hover:text-white text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Tab switcher */}
            <div className="flex border-b border-gray-200 gap-1">
              {(['file', 'paste'] as const).map((tab) => (
                <button key={tab} onClick={() => { setUploadTab(tab); setParseError('') }}
                  className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    uploadTab === tab ? 'border-tps-orange text-tps-orange' : 'border-transparent text-gray-500 hover:text-gray-800'
                  )}>
                  {tab === 'file' ? '📂 Upload File' : '📋 Paste Text'}
                </button>
              ))}
            </div>

            {/* Paste Text tab */}
            {uploadTab === 'paste' && (
              <div className="space-y-3">
                <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-800">
                  <p className="font-semibold mb-1">Best option for PDFs that won&apos;t upload</p>
                  <p>Open your document, select all text (Ctrl+A / Cmd+A), copy (Ctrl+C), and paste below. Works with any text document — Word, Google Docs, PDF viewer, etc.</p>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => { setPastedText(e.target.value); setParseError('') }}
                  placeholder={"Paste your document text here…\n\n1. What is your primary track?\n2. Rate your experience from 1-5\n   a) Very Poor\n   b) Poor\n   c) Average\n   d) Good\n   e) Excellent\n3. Additional comments:"}
                  rows={12}
                  className="field-input resize-y text-sm font-mono w-full"
                />
                {parseError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{parseError}</div>}
                <button
                  onClick={handlePastedText}
                  disabled={parsing || !pastedText.trim()}
                  className="btn-primary w-full"
                >
                  {parsing ? 'Extracting questions…' : 'Extract Questions from Text'}
                </button>
              </div>
            )}

            {/* File upload tab */}
            {uploadTab === 'file' && (<>
            <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Supported formats</p>
              <p>Excel (.xlsx, .xls, .csv) — parsed instantly in your browser</p>
              <p>PDF (.pdf) — text-based PDFs only (not scanned images)</p>
            </div>

            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                parsing ? 'border-tps-orange bg-orange-50' : 'border-gray-300 hover:border-tps-orange hover:bg-orange-50',
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
            >
              <p className="text-4xl mb-3">{parsing ? '⏳' : '📄'}</p>
              {parsing ? (
                <p className="text-gray-600 font-medium">Extracting questions from {filename}…</p>
              ) : (
                <>
                  <p className="text-gray-600 font-medium">Drag and drop a file here</p>
                  <p className="text-gray-400 text-sm mt-1">or click to browse</p>
                  <p className="text-gray-400 text-xs mt-2">.xlsx · .xls · .csv · .pdf</p>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {parseError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">{parseError}</div>
            )}

            <div className="card border border-gray-100 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-600">Tips for best results:</p>
              <p>• Number your questions: &quot;1. Question text&quot; or &quot;Q1: Question text&quot;</p>
              <p>• For multiple choice, list options as a) b) c) on separate lines below the question</p>
              <p>• For scales, include range in the question: &quot;Rate from 1 to 5&quot; or &quot;(1-8 scale)&quot;</p>
              <p>• Use section headers in ALL CAPS or followed by a colon to group questions</p>
            </div>
          </>)}
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-shrink-0">
              <p className="text-sm text-gray-600 flex-1">
                Extracted from <strong>{filename}</strong>. Review, edit, then import.
                Uncheck any questions you don&apos;t want to add.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setQuestions((qs) => qs.map((q) => ({ ...q, selected: true })))} className="text-xs text-tps-orange hover:underline">All</button>
                <button onClick={() => setQuestions((qs) => qs.map((q) => ({ ...q, selected: false })))} className="text-xs text-gray-400 hover:underline">None</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {questions.map((q, i) => {
                const badge = CONFIDENCE_BADGE(q.confidence)
                return (
                  <div key={i} className={cn('border-b border-gray-100 px-5 py-3 flex gap-3', !q.selected && 'opacity-50')}>
                    <input
                      type="checkbox"
                      checked={q.selected}
                      onChange={() => toggleQ(i)}
                      className="h-4 w-4 mt-1 rounded border-gray-300 text-tps-orange flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      {q.sectionLabel && (
                        <p className="text-[10px] text-tps-orange font-bold uppercase tracking-wide">{q.sectionLabel}</p>
                      )}
                      <input
                        value={q.label}
                        onChange={(e) => updateLabel(i, e.target.value)}
                        className="w-full text-sm text-gray-800 border-0 border-b border-transparent hover:border-gray-200 focus:border-tps-orange focus:outline-none bg-transparent py-0.5"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={q.questionType}
                          onChange={(e) => updateType(i, e.target.value as ExtractedQuestionType)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                        >
                          {Object.entries(TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', badge.cls)}>
                          {badge.label} confidence
                        </span>
                        {q.options && (
                          <span className="text-[10px] text-gray-400">{q.options.length} options</span>
                        )}
                        {q.scaleMin !== null && (
                          <span className="text-[10px] text-gray-400">{q.scaleMin}–{q.scaleMax} scale</span>
                        )}
                        <span className="text-[10px] text-gray-300 ml-auto">{q.notes}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setStep('upload')} className="btn-secondary text-sm">← Upload Different File</button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="btn-primary text-sm flex-1"
              >
                {selectedCount === 0 ? 'Select at least one question' : `Import ${selectedCount} Question${selectedCount !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
