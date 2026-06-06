import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLessonPageAction } from './actions'
import { LessonEditor } from './lesson-editor'
import Link from 'next/link'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ courseCode: string }> }): Promise<Metadata> {
  const { courseCode } = await params
  return { title: decodeURIComponent(courseCode) }
}

const SUFFIX_LABELS: Record<string, string> = {
  A: 'Academic Lecture', B: 'Async Content', C: 'Control Room',
  E: 'Exam', F: 'Flight', G: 'Ground School', H: 'Ground Training',
  I: 'Ground Test', L: 'Lab', M: 'MIB', O: 'Space Op',
  R: 'Written Report', S: 'Simulator', W: 'Working Group', Y: 'Oral', Z: 'Debrief',
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  LOCKED:      { label: 'Locked',      color: 'bg-gray-100 text-gray-500' },
  UPCOMING:    { label: 'Upcoming',    color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  REVIEW:      { label: 'Needs Review',color: 'bg-red-100 text-red-600' },
}

function FileSizeLabel({ bytes }: { bytes: number | null }) {
  if (!bytes) return null
  if (bytes < 1024)        return <span>{bytes} B</span>
  if (bytes < 1024 * 1024) return <span>{(bytes / 1024).toFixed(0)} KB</span>
  return <span>{(bytes / 1024 / 1024).toFixed(1)} MB</span>
}

export default async function LessonPage({ params }: { params: Promise<{ courseCode: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { courseCode } = await params
  const decoded = decodeURIComponent(courseCode)

  const { event, studentContext, canAuthor } = await getLessonPageAction(decoded)
  if (!event) notFound()

  const schedule  = event.schedules[0] ?? null
  const lesson    = event.lessonPage
  const objectives: string[] = Array.isArray(lesson?.learningObjectives)
    ? (lesson.learningObjectives as string[])
    : []

  const statusMeta = studentContext ? STATUS_STYLES[studentContext.status] : null

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">

      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5 flex-wrap">
        <Link href="/portal/syllabus" className="hover:text-tps-navy">Syllabus</Link>
        <span>/</span>
        <Link href="/portal/academic-schedule" className="hover:text-tps-navy">Schedule</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{event.courseCode}</span>
      </div>

      {/* Header card */}
      <div className="card bg-tps-navy text-white space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold tracking-widest text-white/60 uppercase">
                {event.deptCode} · Phase {event.phase}
              </span>
              <span className="text-xs bg-white/10 rounded px-2 py-0.5 font-mono">
                {SUFFIX_LABELS[event.eventSuffix] ?? event.eventSuffix}
              </span>
              {event.isGraded && (
                <span className="text-xs bg-tps-orange/80 rounded px-2 py-0.5 font-semibold">Graded</span>
              )}
              {event.isCompOral && (
                <span className="text-xs bg-amber-400/80 text-tps-navy rounded px-2 py-0.5 font-bold">Comp Oral</span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{event.courseCode}</h1>
            <p className="text-white/80 text-base mt-0.5">{event.title}</p>
          </div>

          {statusMeta && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${statusMeta.color}`}>
              {statusMeta.label}
              {studentContext?.score !== null && studentContext?.score !== undefined && (
                <span className="ml-1.5">· {studentContext.score.toFixed(1)}%</span>
              )}
            </span>
          )}
        </div>

        {/* Schedule info */}
        {schedule && (
          <div className="flex flex-wrap gap-4 text-sm text-white/70 pt-2 border-t border-white/10">
            {schedule.academicWeek && (
              <span>Week {schedule.academicWeek.weekNumber} · {schedule.academicWeek.label}</span>
            )}
            {schedule.scheduledDate && (
              <span>{new Date(schedule.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            )}
            {schedule.scheduledTime && <span>{schedule.scheduledTime}</span>}
            {schedule.locationRoom && <span>{schedule.locationRoom}</span>}
            {schedule.durationMinutes && <span>{schedule.durationMinutes} min</span>}
            {schedule.instructor && (
              <span className="text-white/90 font-medium">
                Instructor: {schedule.instructor.firstName} {schedule.instructor.lastName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Overview */}
      {lesson?.overview ? (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overview</h2>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{lesson.overview}</p>
        </section>
      ) : !canAuthor ? null : null}

      {/* Learning Objectives */}
      {objectives.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Learning Objectives</h2>
          <ol className="space-y-2">
            {objectives.map((obj, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-tps-navy/10 text-tps-navy font-bold text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                {obj}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Outline */}
      {lesson?.outline && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lesson Outline</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{lesson.outline}</pre>
        </section>
      )}

      {/* Course materials */}
      {lesson?.files && lesson.files.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Course Materials</h2>
          <div className="space-y-2">
            {lesson.files.map(lf => (
              <div key={lf.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-tps-navy/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-tps-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {lf.displayLabel || lf.contentFile.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {lf.contentFile.mimeType?.split('/')[1]?.toUpperCase() ?? 'File'}
                    {' · '}<FileSizeLabel bytes={lf.contentFile.fileSizeBytes} />
                  </p>
                </div>
                {lf.contentFile.storageUrl && (
                  <a
                    href={lf.contentFile.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                  >
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prerequisites */}
      {event.prerequisites.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Prerequisites</h2>
          <div className="flex flex-wrap gap-2">
            {event.prerequisites.map(p => (
              <Link
                key={p.prerequisiteId}
                href={`/portal/lessons/${encodeURIComponent(p.prerequisite.courseCode)}`}
                className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-tps-navy/10 text-gray-700 hover:text-tps-navy px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="font-mono font-bold">{p.prerequisite.courseCode}</span>
                <span className="text-gray-500">{p.prerequisite.title}</span>
                {p.isHard && <span className="text-red-500">·required</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Gradesheet link */}
      {event.isGraded && event.gradesheetTemplate && (
        <section className="card flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-tps-navy">Graded Event</p>
            <p className="text-xs text-gray-500">
              Gradesheet: {event.gradesheetTemplate.courseCode} — {event.gradesheetTemplate.title}
            </p>
          </div>
          <Link href="/portal/grade" className="btn-primary text-sm px-4 py-2 shrink-0">
            Go to Grade Queue
          </Link>
        </section>
      )}

      {/* Lesson editor — instructors only */}
      {canAuthor && (
        <section>
          <LessonEditor
            syllabusEventId={event.id}
            initial={{
              overview:           lesson?.overview ?? '',
              learningObjectives: objectives,
              outline:            lesson?.outline ?? '',
              estimatedMinutes:   lesson?.estimatedMinutes ?? null,
              isPublished:        lesson?.isPublished ?? false,
            }}
          />
        </section>
      )}

      {/* Not yet authored */}
      {!lesson && !canAuthor && (
        <div className="card text-center py-10 text-gray-400 text-sm">
          Lesson content has not been posted yet.
        </div>
      )}
    </div>
  )
}
