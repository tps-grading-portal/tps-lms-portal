'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ReferenceLine, Legend,
} from 'recharts'
import type { FullAnalysisResult } from '@/lib/math/types'
import { TRACK_LABELS } from '@/lib/utils'

interface Props { analysis: FullAnalysisResult }

export function StatsCharts({ analysis }: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <GraderAveragesChart analysis={analysis} />
      <TrackPerformanceChart analysis={analysis} />
      <CriterionDifficultyChart analysis={analysis} />
      <ScoreDistributionChart analysis={analysis} />
    </div>
  )
}

// ── Grader averages bar chart ─────────────────────────────────────────────────
function GraderAveragesChart({ analysis }: Props) {
  const data = analysis.graderBias.map((g) => ({
    name:  g.graderName.split(' ').slice(-1)[0], // last name only
    avg:   +g.avgScore.toFixed(1),
    bias:  g.bias,
  }))

  if (data.length === 0) return null

  const biasColor = (bias: string) =>
    bias === 'Lenient' ? '#60a5fa' : bias === 'Strict' ? '#f87171' : '#6b7280'

  return (
    <ChartCard title="Grader Average Scores">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v}`, 'Avg Score']} />
          <ReferenceLine y={85} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Avg=4', fontSize: 10 }} />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={biasColor(entry.bias)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1 text-center">Blue=Lenient · Red=Strict · Gray=Neutral</p>
    </ChartCard>
  )
}

// ── Track performance ─────────────────────────────────────────────────────────
function TrackPerformanceChart({ analysis }: Props) {
  const data = analysis.tracks
    .filter((t) => t.avgScore !== null)
    .map((t) => ({
      name:    TRACK_LABELS[t.track] ?? t.track,
      avg:     +(t.avgScore ?? 0).toFixed(1),
      passRate: +((t.passRate ?? 0) * 100).toFixed(0),
    }))

  if (data.length === 0) return null

  return (
    <ChartCard title="Track Performance">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" domain={[60, 100]} tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [`${v}`, 'Avg Score']} />
          <Bar dataKey="avg" fill="#1B3A6B" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Criterion difficulty scatter ──────────────────────────────────────────────
function CriterionDifficultyChart({ analysis }: Props) {
  const data = analysis.criterionStats
    .filter((c) => c.avgDifficulty !== null && c.discrimination !== null)
    .map((c) => ({
      code:           c.code,
      difficulty:     +(c.avgDifficulty ?? 0).toFixed(2),
      discrimination: +(c.discrimination ?? 0).toFixed(3),
    }))

  if (data.length === 0) return null

  return (
    <ChartCard title="Difficulty vs Discrimination (by criterion)">
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="difficulty"     name="Difficulty"     type="number" domain={[1, 8]}   tick={{ fontSize: 11 }} label={{ value: 'Difficulty (1-8)', position: 'insideBottom', offset: -2, fontSize: 10 }} />
          <YAxis dataKey="discrimination" name="Discrimination" type="number" domain={[-1, 1]}  tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
            if (!payload?.length) return null
            const d = payload[0].payload as { code: string; difficulty: number; discrimination: number }
            return (
              <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
                <p className="font-bold">{d.code}</p>
                <p>Difficulty: {d.difficulty}</p>
                <p>Discrimination: {d.discrimination}</p>
              </div>
            )
          }} />
          <ReferenceLine y={0.3} stroke="#94a3b8" strokeDasharray="4 4" />
          <Scatter data={data} fill="#1B3A6B">
            {data.map((entry, i) => (
              <Cell key={i} fill={(entry.discrimination ?? 0) < 0.3 ? '#f87171' : '#1B3A6B'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1 text-center">Red = discrimination &lt; 0.30 (concerning)</p>
    </ChartCard>
  )
}

// ── Score distribution ────────────────────────────────────────────────────────
function ScoreDistributionChart({ analysis }: Props) {
  // Build histogram buckets: 69 (fail), 70-74, 75-79, 80-84, 85-89, 90-94, 95-100
  const buckets: { label: string; count: number; isFail: boolean }[] = [
    { label: '≤69 (Fail)', count: 0, isFail: true  },
    { label: '70-74',      count: 0, isFail: false },
    { label: '75-79',      count: 0, isFail: false },
    { label: '80-84',      count: 0, isFail: false },
    { label: '85-89',      count: 0, isFail: false },
    { label: '90-94',      count: 0, isFail: false },
    { label: '95-100',     count: 0, isFail: false },
  ]

  const getIdx = (score: number) => {
    if (score <= 69) return 0
    if (score < 75)  return 1
    if (score < 80)  return 2
    if (score < 85)  return 3
    if (score < 90)  return 4
    if (score < 95)  return 5
    return 6
  }

  for (const graderScores of analysis.scoresByGrader.values()) {
    for (const s of graderScores) buckets[getIdx(s)].count++
  }

  if (buckets.every((b) => b.count === 0)) return null

  return (
    <ChartCard title="Score Distribution (grader weighted sums)">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={buckets} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v}`, 'Count']} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => <Cell key={i} fill={b.isFail ? '#f87171' : '#1B3A6B'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      {children}
    </div>
  )
}
