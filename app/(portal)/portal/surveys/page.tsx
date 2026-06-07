import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSurveysData } from './actions'
import { SurveyDeployForm } from './survey-deploy-form'
import { SurveyRow } from './survey-row'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Survey Module' }

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  const canManage = can(role, 'manage:surveys')
  const canView   = can(role, 'view:sanitized_surveys') || canManage

  if (!canView) return null

  const params = await searchParams

  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    select:  { id: true, name: true },
  })

  const selectedClassId = params.classId ?? classes[0]?.id
  const surveys = selectedClassId ? await getSurveysData(selectedClassId) : []

  const events = canManage ? await db.syllabusEvent.findMany({
    where:   { isActive: true },
    orderBy: { courseCode: 'asc' },
    select:  { id: true, courseCode: true, title: true },
  }) : []

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Survey Module</h1>
          <p className="text-gray-500 text-sm mt-1">
            {canManage
              ? 'Deploy surveys, apply A9 anonymity shield, publish sanitized reports'
              : 'View published feedback reports'}
          </p>
        </div>
        {canManage && selectedClassId && (
          <SurveyDeployForm classId={selectedClassId} classes={classes} events={events} />
        )}
      </div>

      {/* Class selector */}
      {classes.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {classes.map(c => (
            <a
              key={c.id}
              href={`/portal/surveys?classId=${c.id}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                c.id === selectedClassId
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {/* Anonymity shield callout */}
      {canManage && (
        <div className="rounded-xl bg-tps-navy/5 border border-tps-navy/10 px-4 py-3 text-sm text-gray-700 space-y-1">
          <p className="font-semibold text-tps-navy">A9 Anonymity Shield</p>
          <p>
            Student names are <strong>never stored</strong> with survey responses.
            Only track and cohort labels are retained. A9 sanitizes all comments
            before publishing to instructor dashboards — identifiable phrasing is removed.
          </p>
        </div>
      )}

      {/* Survey list */}
      {surveys.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">
          {canManage ? 'No surveys deployed for this class yet. Deploy one above.' : 'No published reports available.'}
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <SurveyRow
              key={s.id}
              id={s.id}
              className={s.class.name}
              eventCode={s.syllabusEvent?.courseCode ?? null}
              surveyType={s.surveyType}
              instructorName={s.instructorName}
              deployedBy={`${s.deployedBy.lastName}, ${s.deployedBy.firstName}`}
              deployedAt={s.deployedAt}
              isActive={s.isActive}
              responseCount={s._count.responses}
              publishedAt={s.sanitizedReport?.publishedAt ?? null}
              hasDraft={!!s.sanitizedReport?.sanitizedText}
              role={role}
            />
          ))}
        </div>
      )}
    </div>
  )
}
