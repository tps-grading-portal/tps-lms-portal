import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLessonPageAction } from './actions'
import { LessonEditor } from './lesson-editor'
import { CourseContent, type FileRow, type LessonRow } from './course-content'
import { PrereqEditor } from './prereq-editor'
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

type RawFile = {
  id: string
  lessonId: string | null
  displayLabel: string | null
  contentFile: {
    id: string; title: string; storageUrl: string | null; mimeType: string | null
    fileSizeBytes: number | null; status: string; fileName: string | null
  }
}

function toFileRow(f: RawFile): FileRow {
  return {
    id:            f.id,
    contentFileId: f.contentFile.id,
    title:         f.contentFile.title,
    fileName:      f.contentFile.fileName,
    storageUrl:    f.contentFile.storageUrl,
    mimeType:      f.contentFile.mimeType,
    fileSizeBytes: f.contentFile.fileSizeBytes,
    status:        f.contentFile.status,
    displayLabel:  f.displayLabel,
  }
}

export default async function LessonPage({ params }: { params: Promise<{ courseCode: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { courseCode } = await params
  const decoded = decodeURIComponent(courseCode)

  const data = await getLessonPageAction(decoded)
  if (!data.event) notFound()
  const { event, studentContext } = data
  const canAuthor = 'canAuthor' in data ? data.canAuthor : false
  const canUpload = 'canUpload' in data ? data.canUpload : false
  const isStudent = 'isStudent' in data ? data.isStudent : false

  const schedule  = event.schedules[0] ?? null
  const lesson    = event.lessonPage
  const objectives: string[] = Array.isArray(lesson?.learningObjectives)
    ? (lesson.learningObjectives as string[])
    : []

  const statusMeta = studentContext ? STATUS_STYLES[studentContext.status] : null

  // Students only see A9-approved (VAULT) files
  const visibleFile = (f: RawFile) => !isStudent || f.contentFile.status === 'VAULT'

  const allFiles: RawFile[] = (lesson?.files ?? []) as RawFile[]
  const courseFiles: FileRow[] = allFiles
    .filter(f => f.lessonId === null && visibleFile(f))
    .map(toFileRow)

  const lessons: LessonRow[] = (lesson?.lessons ?? []).map(l => ({
    id:       l.id,
    title:    l.title,
    overview: l.overview,
    outline:  l.outline,
    tlos:     Array.isArray(l.tlos) ? (l.tlos as string[]) : [],
    plos:     Array.isArray(l.plos) ? (l.plos as string[]) : [],
    files:    (l.files as RawFile[]).filter(visibleFile).map(toFileRow),
  }))

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
                {event.deptCode}
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
            {event.description && (
              <p className="text-white/50 text-xs mt-1">{event.description}</p>
            )}
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

      {/* Course overview */}
      {lesson?.overview && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Course Overview</h2>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{lesson.overview}</p>
        </section>
      )}

      {/* Course-level objectives */}
      {objectives.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Course Learning Objectives</h2>
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

      {/* Course outline */}
      {lesson?.outline && (
        <section className="card">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Course Outline</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{lesson.outline}</pre>
        </section>
      )}

      {/* Course documents + lessons (uploads, TLO/PLO, materials) */}
      <CourseContent
        syllabusEventId={event.id}
        courseFiles={courseFiles}
        lessons={lessons}
        canAuthor={canAuthor}
        canUpload={canUpload && !isStudent}
        isStudent={isStudent}
      />

      {/* Prerequisites — editable by scoped roles */}
      <PrereqEditor
        syllabusEventId={event.id}
        prereqs={event.prerequisites.map(p => ({
          prerequisiteId: p.prerequisiteId,
          courseCode:     p.prerequisite.courseCode,
          title:          p.prerequisite.title,
          isHard:         p.isHard,
        }))}
        canEdit={canAuthor}
      />

      {/* Gradesheet link */}
      {event.isGraded && event.gradesheetTemplate && !isStudent && (
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

      {/* Course-level editor — scoped authority only */}
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
    </div>
  )
}
