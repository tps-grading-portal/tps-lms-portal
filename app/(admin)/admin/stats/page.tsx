import { fetchAvailableClasses, runFullAnalysis } from '@/lib/math/aggregate'
import { fetchSurveyData } from '@/lib/math/aggregate'
import { generateFoundationReport } from '@/lib/math/foundation'
import { db } from '@/lib/db'
import { StatsDashboard } from './stats-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Statistics' }

interface PageProps {
  searchParams: Promise<{ classIds?: string | string[] }>
}

export default async function StatsPage({ searchParams }: PageProps) {
  const params     = await searchParams
  const availableClasses = await fetchAvailableClasses()

  // Parse selected class IDs from query params
  const rawIds = params.classIds
  let selectedIds: string[] =
    rawIds === undefined
      ? availableClasses.filter((c) => c.isActive).map((c) => c.id)
      : Array.isArray(rawIds)
      ? rawIds
      : [rawIds]

  // Default to active class if nothing explicitly selected
  if (selectedIds.length === 0 && availableClasses.length > 0) {
    const active = availableClasses.find((c) => c.isActive)
    if (active) selectedIds = [active.id]
  }

  // Run full analysis if classes are selected
  let analysisResult = null
  let foundationReport = null
  if (selectedIds.length > 0) {
    const [result, surveyData, criteriaList] = await Promise.all([
      runFullAnalysis(selectedIds),
      fetchSurveyData(selectedIds),
      db.criterion.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, code: true, name: true, weight: true } }),
    ])

    analysisResult = result

    // Generate Foundation Report
    const selectedClassNames = availableClasses
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => c.name)

    foundationReport = generateFoundationReport(
      result.analysis,
      result.data,
      criteriaList,
      surveyData.studentSurveys,
      surveyData.instructorSurveys,
      selectedClassNames,
    )
  }

  return (
    <StatsDashboard
      availableClasses={availableClasses}
      selectedIds={selectedIds}
      analysis={analysisResult?.analysis ?? null}
      data={analysisResult?.data ?? []}
      criteriaList={analysisResult?.criteriaList ?? []}
      foundationReport={foundationReport}
    />
  )
}
