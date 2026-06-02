'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { applyBayesianAction, previewBayesianAction } from './actions'
import { StatsCharts } from './stats-charts'
import type { FullAnalysisResult, SessionStats } from '@/lib/math/types'
import { cn } from '@/lib/utils'

interface Props {
  availableClasses: { id: string; name: string; isActive: boolean }[]
  selectedIds:      string[]
  analysis:         FullAnalysisResult | null
  data:             SessionStats[]
  criteriaList:     { id: string; code: string; name: string; weight: number }[]
  foundationReport: string | null
}

export function StatsDashboard({
  availableClasses,
  selectedIds,
  analysis,
  data,
  criteriaList,
  foundationReport,
}: Props) {
  const router    = useRouter()
  const [, startT] = useTransition()
  const [activeTab, setActiveTab] = useState<'overview' | 'reliability' | 'graders' | 'criteria' | 'performance' | 'bayesian' | 'report'>('overview')
  const [bayesianPreview, setBayesianPreview] = useState<Awaited<ReturnType<typeof previewBayesianAction>> | null>(null)
  const [bayesianResult,  setBayesianResult]  = useState<string | null>(null)
  const [reportCopied,    setReportCopied]    = useState(false)
  const [isPending,       setIsPending]       = useState(false)

  const handleClassToggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    const params = new URLSearchParams()
    next.forEach((x) => params.append('classIds', x))
    startT(() => router.push(`/admin/stats?${params}`, { scroll: false }))
  }

  const handleBayesianPreview = async () => {
    setIsPending(true)
    const preview = await previewBayesianAction(selectedIds)
    setBayesianPreview(preview)
    setActiveTab('bayesian')
    setIsPending(false)
  }

  const handleBayesianApply = async () => {
    setIsPending(true)
    const result = await applyBayesianAction(selectedIds)
    if ('success' in result) {
      setBayesianResult(`✓ Applied: ${result.updated} sessions updated, ${result.skipped} unchanged.`)
      setBayesianPreview(null)
      router.refresh()
    } else {
      setBayesianResult(`Error: ${result.error}`)
    }
    setIsPending(false)
  }

  const copyReport = () => {
    if (!foundationReport) return
    navigator.clipboard.writeText(foundationReport).then(() => {
      setReportCopied(true)
      setTimeout(() => setReportCopied(false), 3000)
    })
  }

  const noData = !analysis || data.length === 0

  const TABS = [
    { id: 'overview',     label: 'Overview'     },
    { id: 'reliability',  label: 'Reliability'  },
    { id: 'graders',      label: 'Graders'      },
    { id: 'criteria',     label: 'Criteria'     },
    { id: 'performance',  label: 'Performance'  },
    { id: 'bayesian',     label: 'Bayesian'     },
    { id: 'report',       label: 'Foundation'   },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Statistics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.length} sessions analysed across {selectedIds.length} class{selectedIds.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleBayesianPreview}
            disabled={isPending || noData}
            className="btn-secondary text-sm"
          >
            {isPending ? 'Loading…' : 'Preview Bayesian Consensus'}
          </button>
          {foundationReport && (
            <button onClick={() => setActiveTab('report')} className="btn-primary text-sm">
              Foundation Report
            </button>
          )}
        </div>
      </div>

      {/* Class selector */}
      <div className="flex flex-wrap gap-2">
        {availableClasses.map((cls) => (
          <button
            key={cls.id}
            onClick={() => handleClassToggle(cls.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              selectedIds.includes(cls.id)
                ? 'bg-tps-blue text-white border-tps-blue'
                : 'bg-white text-gray-600 border-gray-300 hover:border-tps-blue',
            )}
          >
            {cls.name} {cls.isActive && <span className="text-[10px]">●</span>}
          </button>
        ))}
      </div>

      {noData && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No finalized sessions in selected classes</p>
          <p className="text-sm mt-1">Complete and finalize grading sessions to see statistics.</p>
        </div>
      )}

      {!noData && (
        <>
          {/* Tab navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-tps-blue text-tps-blue'
                      : 'border-transparent text-gray-500 hover:text-gray-800',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && <OverviewTab analysis={analysis!} />}
          {activeTab === 'reliability' && <ReliabilityTab analysis={analysis!} criteriaList={criteriaList} />}
          {activeTab === 'graders' && <GradersTab analysis={analysis!} />}
          {activeTab === 'criteria' && <CriteriaTab analysis={analysis!} />}
          {activeTab === 'performance' && <PerformanceTab analysis={analysis!} data={data} />}
          {activeTab === 'bayesian' && (
            <BayesianTab
              preview={bayesianPreview}
              result={bayesianResult}
              onApply={handleBayesianApply}
              isPending={isPending}
            />
          )}
          {activeTab === 'report' && (
            <ReportTab
              report={foundationReport!}
              copied={reportCopied}
              onCopy={copyReport}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ analysis }: { analysis: FullAnalysisResult }) {
  const { summary, reliability } = analysis
  const fmt = (n: number | null | undefined, d = 2) =>
    n === null || n === undefined || isNaN(n) ? 'N/A' : n.toFixed(d)
  const fmtPct = (n: number | null | undefined) =>
    n === null || n === undefined || isNaN(n) ? 'N/A' : `${(n * 100).toFixed(1)}%`

  const cards = [
    { label: 'Sessions',        value: summary.totalStudents },
    { label: 'Graders',         value: summary.totalGraders.size },
    { label: 'Avg Score',       value: fmt(summary.avgScore) },
    { label: 'Score Std Dev',   value: fmt(summary.scoreStdDev) },
    { label: 'Pass Rate',       value: fmtPct(summary.passingRate) },
    { label: 'Fail Rate',       value: fmtPct(summary.failRate), warn: (summary.failRate ?? 0) > 0.1 },
    { label: 'ICC Overall',     value: fmt(reliability.icc), warn: (reliability.icc ?? 1) < 0.7 },
    { label: "Cronbach's α",    value: fmt(reliability.cronbachAlpha), warn: (reliability.cronbachAlpha ?? 1) < 0.7 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, warn }) => (
          <div key={label} className={cn('card border', warn ? 'border-amber-300 bg-amber-50' : 'border-gray-200')}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={cn('text-2xl font-bold', warn ? 'text-amber-700' : 'text-tps-navy')}>{value}</p>
          </div>
        ))}
      </div>
      <StatsCharts analysis={analysis} />
    </div>
  )
}

// ── Reliability tab ───────────────────────────────────────────────────────────
function ReliabilityTab({ analysis, criteriaList }: { analysis: FullAnalysisResult; criteriaList: { id: string; code: string; name: string }[] }) {
  const { reliability } = analysis
  const fmt = (n: number | null | undefined) => n === null || n === undefined || isNaN(n) ? 'N/A' : n.toFixed(3)
  const badge = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return 'bg-gray-100 text-gray-500'
    if (n < 0.7) return 'bg-red-100 text-red-700'
    if (n < 0.8) return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  const metrics = [
    { label: 'ICC(2,k) Overall',    value: reliability.icc,           note: 'Inter-rater reliability of weighted scores' },
    { label: "Kendall's W",         value: reliability.kendallW,       note: 'Concordance of grader rankings' },
    { label: "Fleiss' Kappa (P/F)", value: reliability.fleissKappa,    note: 'Agreement on pass vs fail classification' },
    { label: "Cronbach's Alpha",    value: reliability.cronbachAlpha,  note: 'Internal consistency across criteria' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {metrics.map(({ label, value, note }) => (
          <div key={label} className="card border border-gray-200">
            <p className="text-xs text-gray-400 mb-1">{note}</p>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{label}</span>
              <span className={cn('text-lg font-bold px-3 py-1 rounded-lg', badge(value))}>{fmt(value)}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold text-gray-700 mb-3">ICC by Criterion</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Code', 'Criterion', 'ICC', 'Item-Total r'].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {criteriaList.map((c) => {
                const icc  = reliability.iccByCriterion.get(c.id) ?? null
                const itc  = reliability.itemTotalCorrelations.get(c.code) ?? null
                return (
                  <tr key={c.id} className="bg-white">
                    <td className="px-4 py-2 font-mono font-bold text-tps-blue text-xs">{c.code}</td>
                    <td className="px-4 py-2 text-gray-700">{c.name}</td>
                    <td className="px-4 py-2"><span className={cn('px-2 py-0.5 rounded text-xs font-bold', badge(icc))}>{fmt(icc)}</span></td>
                    <td className="px-4 py-2 font-mono text-xs">{fmt(itc)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.gTheory && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">G-Theory Variance Components</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card border border-gray-200 space-y-2 text-sm">
              {[
                ['Student (true ability)',  analysis.gTheory.studentPercent],
                ['Grader (rater effect)',   analysis.gTheory.graderPercent],
                ['Criterion (item)',        analysis.gTheory.criterionPercent],
                ['Residual (error)',        analysis.gTheory.residualPercent],
              ].map(([label, pct]) => (
                <div key={label as string} className="flex items-center justify-between gap-4">
                  <span className="text-gray-600">{label as string}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-tps-blue rounded-full" style={{ width: `${((pct as number) * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="font-bold text-xs w-12 text-right">{((pct as number) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Predicted Reliability (Spearman-Brown)</p>
              {analysis.gTheory.predictedByGraders.map(({ n, reliability }) => (
                <div key={n} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="text-gray-500">{n} grader{n !== 1 ? 's' : ''}</span>
                  <span className={cn('font-bold', reliability >= 0.8 ? 'text-green-700' : reliability >= 0.7 ? 'text-amber-700' : 'text-red-600')}>{reliability.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Graders tab ───────────────────────────────────────────────────────────────
function GradersTab({ analysis }: { analysis: FullAnalysisResult }) {
  const biasBadge = (bias: string) =>
    bias === 'Lenient' ? 'bg-blue-100 text-blue-700' :
    bias === 'Strict'  ? 'bg-red-100 text-red-700' :
    'bg-gray-100 text-gray-600'

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Bias threshold: Z &gt; +0.5 SD = Lenient, Z &lt; -0.5 SD = Strict.
        Correction = population mean − grader mean.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Grader', 'Avg Score', 'Std Dev', 'Z-Score', 'Bias', 'Correction', 'n', 'Reliability'].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {analysis.graderBias.map((g) => (
              <tr key={g.graderName} className="bg-white hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{g.graderName}</td>
                <td className="px-4 py-2 font-mono">{g.avgScore.toFixed(1)}</td>
                <td className="px-4 py-2 font-mono">{g.stdDev.toFixed(2)}</td>
                <td className="px-4 py-2 font-mono">{g.zScore > 0 ? '+' : ''}{g.zScore.toFixed(2)}</td>
                <td className="px-4 py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', biasBadge(g.bias))}>{g.bias}</span></td>
                <td className="px-4 py-2 font-mono">{g.correction > 0 ? '+' : ''}{g.correction.toFixed(2)}</td>
                <td className="px-4 py-2">{g.totalGrades}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{g.reliability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Criteria tab ──────────────────────────────────────────────────────────────
function CriteriaTab({ analysis }: { analysis: FullAnalysisResult }) {
  const fmt = (n: number | null | undefined, d = 2) => n === null || n === undefined || isNaN(n) ? '—' : n.toFixed(d)
  const fmtPct = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>{['Code', 'Criterion', 'Weight', 'Avg Score', 'Difficulty', 'Discrimination', 'Fail Rate'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {analysis.criterionStats.map((c) => (
            <tr key={c.criterionId} className="bg-white hover:bg-gray-50">
              <td className="px-3 py-2 font-mono font-bold text-tps-blue text-xs">{c.code}</td>
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2 text-gray-500">{(c.weight * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 font-mono">{fmt(c.avgNumericScore)}</td>
              <td className="px-3 py-2">
                <span className={cn('text-xs', c.avgDifficulty !== null && c.avgDifficulty < 2.5 ? 'text-green-600' : c.avgDifficulty !== null && c.avgDifficulty > 5.5 ? 'text-red-600' : 'text-gray-600')}>
                  {fmt(c.avgDifficulty)} {c.avgDifficulty !== null && (c.avgDifficulty < 2.5 ? '(Easy)' : c.avgDifficulty > 5.5 ? '(Hard)' : '(Mod)')}
                </span>
              </td>
              <td className="px-3 py-2 font-mono">{fmt(c.discrimination)}</td>
              <td className="px-3 py-2"><span className={cn('text-xs', (c.failRate ?? 0) > 0.2 ? 'text-red-600 font-bold' : 'text-gray-600')}>{fmtPct(c.failRate)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Performance tab ───────────────────────────────────────────────────────────
function PerformanceTab({ analysis }: { analysis: FullAnalysisResult; data: SessionStats[] }) {
  const fmt = (n: number | null | undefined) => n === null || n === undefined || isNaN(n) ? '—' : n.toFixed(2)
  const fmtPct = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Scenario Performance</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Scenario', 'n', 'Avg', 'StdDev*', 'Pass%'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analysis.scenarios.map((s) => (
                  <tr key={s.scenario} className="bg-white">
                    <td className="px-3 py-2">{s.scenario}</td>
                    <td className="px-3 py-2">{s.studentCount}</td>
                    <td className="px-3 py-2 font-mono">{fmt(s.avgScore)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmt(s.stdDev)}</td>
                    <td className="px-3 py-2">{fmtPct(s.passRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-1">* StdDev excludes auto-fail scores (69)</p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Track Performance</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Track', 'n', 'Avg', 'StdDev', 'Pass%'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analysis.tracks.map((t) => (
                  <tr key={t.track} className="bg-white">
                    <td className="px-3 py-2">{t.track}</td>
                    <td className="px-3 py-2">{t.studentCount}</td>
                    <td className="px-3 py-2 font-mono">{fmt(t.avgScore)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmt(t.stdDev)}</td>
                    <td className="px-3 py-2">{fmtPct(t.passRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Bayesian tab ──────────────────────────────────────────────────────────────
function BayesianTab({
  preview, result, onApply, isPending,
}: {
  preview:   Awaited<ReturnType<typeof previewBayesianAction>>
  result:    string | null
  onApply:   () => void
  isPending: boolean
}) {
  if (!preview && !result) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <p className="font-medium">No preview loaded yet.</p>
        <p className="text-sm mt-1">Click &quot;Preview Bayesian Consensus&quot; from the top to generate.</p>
      </div>
    )
  }

  const changed = preview?.filter((r) => r.delta !== null && Math.abs(r.delta) >= 0.01) ?? []

  return (
    <div className="space-y-4">
      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <strong>Bayesian Consensus</strong> applies bias correction (population mean − grader mean)
        and reliability weighting (consistency 50%, experience 30%, confidence 20%) to compute
        adjusted final scores. Graders with insufficient history use default weights.
        Auto-fail grades (8) are never adjusted.
      </div>

      {result && (
        <div className={cn('card border text-sm', result.startsWith('✓') ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-700')}>
          {result}
        </div>
      )}

      {preview && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {changed.length} session{changed.length !== 1 ? 's' : ''} would be updated
              ({(preview.length - changed.length)} unchanged)
            </p>
            <button
              onClick={onApply}
              disabled={isPending || changed.length === 0}
              className="btn-primary text-sm"
            >
              {isPending ? 'Applying…' : `Apply to ${changed.length} Session${changed.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Student', 'Current', 'Bayesian', 'Δ', 'Confidence'].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((r) => (
                  <tr key={r.sessionId} className={cn('bg-white', r.delta !== null && Math.abs(r.delta) >= 0.5 && 'bg-amber-50')}>
                    <td className="px-4 py-2 font-medium">{r.studentName}</td>
                    <td className="px-4 py-2 font-mono">{r.originalScore?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2 font-mono font-bold">{r.bayesianScore?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.delta !== null ? (
                        <span className={r.delta > 0.01 ? 'text-green-600' : r.delta < -0.01 ? 'text-red-600' : 'text-gray-400'}>
                          {r.delta > 0 ? '+' : ''}{r.delta.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Foundation Report tab ─────────────────────────────────────────────────────
function ReportTab({ report, copied, onCopy }: { report: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">LLM Foundation Report</h3>
          <p className="text-sm text-gray-500 mt-0.5">Copy all content and paste into a new Claude or ChatGPT conversation.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(report)}`}
            download="TPS-Foundation-Report.txt"
            className="btn-secondary text-sm"
          >
            Download .txt
          </a>
          <button onClick={onCopy} className="btn-primary text-sm">
            {copied ? '✓ Copied!' : 'Copy All'}
          </button>
        </div>
      </div>

      <textarea
        readOnly
        value={report}
        className="w-full h-[600px] font-mono text-xs p-4 border border-gray-200 rounded-xl bg-gray-50 resize-y focus:outline-none"
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />

      <p className="text-xs text-gray-400">
        Report length: ~{Math.round(report.length / 5)} words · {report.split('\n').length} lines
      </p>
    </div>
  )
}
