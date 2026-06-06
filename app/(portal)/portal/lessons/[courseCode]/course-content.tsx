'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadCourseContentAction, saveLessonAction, deleteLessonAction, detachFileFromLessonAction } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FileRow = {
  id:            string   // LessonPageFile id
  contentFileId: string
  title:         string
  fileName:      string | null
  storageUrl:    string | null
  mimeType:      string | null
  fileSizeBytes: number | null
  status:        string   // ContentStatus
  displayLabel:  string | null
}

export type LessonRow = {
  id:       string
  title:    string
  overview: string | null
  outline:  string | null
  tlos:     string[]
  plos:     string[]
  files:    FileRow[]
}

type Props = {
  syllabusEventId: string
  courseFiles:     FileRow[]   // course-wide materials (lessonId null)
  lessons:         LessonRow[]
  canAuthor:       boolean     // scoped content authority (edit lessons/prereqs)
  canUpload:       boolean     // may submit content (instructors)
  isStudent:       boolean
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileKindLabel(mimeType: string | null, fileName: string | null): string {
  const ext = fileName?.split('.').pop()?.toUpperCase()
  if (ext) return ext
  return mimeType?.split('/')[1]?.toUpperCase() ?? 'FILE'
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileItem({ file, canAuthor, onDetach }: { file: FileRow; canAuthor: boolean; onDetach: () => void }) {
  const approved = file.status === 'VAULT'
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-bold ${
        approved ? 'bg-tps-navy/10 text-tps-navy' : 'bg-amber-50 text-amber-600'
      }`}>
        {fileKindLabel(file.mimeType, file.fileName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {file.displayLabel || file.title}
        </p>
        <p className="text-xs text-gray-400">
          {fmtSize(file.fileSizeBytes)}
          {!approved && (
            <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
              ⏳ Pending Approval — not visible to students
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {file.storageUrl && (
          <a href={file.storageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3 py-1.5">
            Open
          </a>
        )}
        {canAuthor && (
          <button onClick={onDetach} className="text-gray-300 hover:text-red-500 text-lg leading-none" title="Remove from this page">
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ── Upload control ────────────────────────────────────────────────────────────

function UploadButton({
  syllabusEventId, lessonId, label,
}: {
  syllabusEventId: string
  lessonId:        string | null
  label:           string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    const file = files[0]
    startTx(async () => {
      const fd = new FormData()
      fd.set('syllabusEventId', syllabusEventId)
      if (lessonId) fd.set('lessonId', lessonId)
      fd.set('title', file.name.replace(/\.[^.]+$/, ''))
      fd.set('file', file)
      const result = await uploadCourseContentAction(fd)
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.txt,.csv,.zip,.png,.jpg,.jpeg,.mp4"
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        {pending ? 'Uploading…' : label}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ── Lesson editor modal ───────────────────────────────────────────────────────

function ListEditor({
  label, hint, items, setItems, disabled,
}: {
  label:    string
  hint?:    string
  items:    string[]
  setItems: (items: string[]) => void
  disabled: boolean
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => setItems(items.map((o, idx) => idx === i ? e.target.value : o))}
              className="field-input flex-1 text-sm"
              disabled={disabled}
            />
            {items.length > 1 && (
              <button
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 px-1.5"
                disabled={disabled}
              >×</button>
            )}
          </div>
        ))}
        <button onClick={() => setItems([...items, ''])} className="text-xs text-tps-blue hover:underline" disabled={disabled}>
          + Add
        </button>
      </div>
    </div>
  )
}

function LessonModal({
  syllabusEventId, lesson, onClose,
}: {
  syllabusEventId: string
  lesson:          LessonRow | null   // null = new
  onClose:         () => void
}) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [title,    setTitle]    = useState(lesson?.title ?? '')
  const [overview, setOverview] = useState(lesson?.overview ?? '')
  const [outline,  setOutline]  = useState(lesson?.outline ?? '')
  const [tlos,     setTlos]     = useState<string[]>(lesson?.tlos.length ? lesson.tlos : [''])
  const [plos,     setPlos]     = useState<string[]>(lesson?.plos.length ? lesson.plos : [''])

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await saveLessonAction(syllabusEventId, {
        lessonId: lesson?.id ?? null,
        title, overview, outline,
        tlos: tlos.filter(t => t.trim()),
        plos: plos.filter(p => p.trim()),
      })
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  function handleDelete() {
    if (!lesson) return
    if (!confirm(`Delete lesson "${lesson.title}"? Attached materials return to the course level.`)) return
    startTx(async () => {
      await deleteLessonAction(syllabusEventId, lesson.id)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-tps-navy">{lesson ? 'Edit Lesson' : 'Add Lesson'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <label className="field-label">Lesson Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="field-input" placeholder="e.g. Lesson 1 — Subsonic Aerodynamics Review" disabled={pending} autoFocus />
        </div>

        <div>
          <label className="field-label">Overview</label>
          <textarea value={overview} onChange={e => setOverview(e.target.value)} rows={3} className="field-input" disabled={pending} />
        </div>

        <ListEditor
          label="Terminal Learning Objectives (TLOs)"
          items={tlos}
          setItems={setTlos}
          disabled={pending}
        />

        <ListEditor
          label="Program Learning Outcomes Supported (PLOs)"
          hint="Which program outcomes this lesson supports"
          items={plos}
          setItems={setPlos}
          disabled={pending}
        />

        <div>
          <label className="field-label">Lesson Outline</label>
          <textarea value={outline} onChange={e => setOutline(e.target.value)} rows={5} className="field-input font-mono text-sm" disabled={pending} />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={pending || !title.trim()} className="btn-primary flex-1 text-sm py-2.5">
            {pending ? 'Saving…' : 'Save Lesson'}
          </button>
          {lesson && (
            <button onClick={handleDelete} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main course content ───────────────────────────────────────────────────────

export function CourseContent({
  syllabusEventId, courseFiles, lessons, canAuthor, canUpload, isStudent,
}: Props) {
  const router = useRouter()
  const [lessonModal, setLessonModal] = useState<{ lesson: LessonRow | null } | null>(null)
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set(lessons.length === 1 ? [lessons[0].id] : []))

  function toggleLesson(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  async function detach(fileId: string) {
    await detachFileFromLessonAction(fileId)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Course-wide materials */}
      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Course Documents</h2>
          {canUpload && (
            <UploadButton syllabusEventId={syllabusEventId} lessonId={null} label="↑ Upload to Course" />
          )}
        </div>

        {courseFiles.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            {isStudent ? 'No course documents posted yet.' : 'No course-wide documents. Upload lesson plans, syllabi, or references here.'}
          </p>
        ) : (
          <div>
            {courseFiles.map(f => (
              <FileItem key={f.id} file={f} canAuthor={canAuthor} onDetach={() => detach(f.id)} />
            ))}
          </div>
        )}

        {canUpload && !isStudent && (
          <p className="text-[11px] text-gray-400 mt-3 border-t border-gray-50 pt-2">
            Uploads enter the A9 review pipeline (Sandbox → Chair → A9 → Vault).
            Students see files only after A9 approval.
          </p>
        )}
      </section>

      {/* Lessons */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Lessons {lessons.length > 0 && `(${lessons.length})`}
          </h2>
          {canAuthor && (
            <button onClick={() => setLessonModal({ lesson: null })} className="btn-primary text-xs px-3 py-1.5">
              + Add Lesson
            </button>
          )}
        </div>

        {lessons.length === 0 ? (
          <div className="card text-center py-8 text-gray-400 text-sm">
            {canAuthor
              ? 'No lessons yet. Break this course into lessons, each with its own objectives, outline, and materials.'
              : 'Lesson content has not been posted yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, idx) => {
              const open = expanded.has(lesson.id)
              return (
                <div key={lesson.id} className="card p-0 overflow-hidden">
                  {/* Lesson header */}
                  <button
                    onClick={() => toggleLesson(lesson.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
                  >
                    <span className={`text-gray-400 text-sm transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                    <span className="w-7 h-7 rounded-full bg-tps-navy/10 text-tps-navy font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-tps-navy truncate">{lesson.title}</p>
                      <p className="text-xs text-gray-400">
                        {lesson.tlos.length > 0 && `${lesson.tlos.length} TLO${lesson.tlos.length === 1 ? '' : 's'}`}
                        {lesson.tlos.length > 0 && lesson.files.length > 0 && ' · '}
                        {lesson.files.length > 0 && `${lesson.files.length} file${lesson.files.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    {canAuthor && (
                      <span
                        onClick={e => { e.stopPropagation(); setLessonModal({ lesson }) }}
                        className="text-xs text-gray-400 hover:text-tps-navy px-2 cursor-pointer"
                      >
                        Edit
                      </span>
                    )}
                  </button>

                  {/* Lesson body */}
                  {open && (
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-3">
                      {lesson.overview && (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{lesson.overview}</p>
                      )}

                      {lesson.tlos.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                            Terminal Learning Objectives
                          </p>
                          <ol className="space-y-1.5">
                            {lesson.tlos.map((t, i) => (
                              <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                                <span className="shrink-0 text-tps-navy font-bold text-xs mt-0.5">TLO {i + 1}.</span>
                                {t}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {lesson.plos.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                            Program Learning Outcomes Supported
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {lesson.plos.map((p, i) => (
                              <span key={i} className="text-xs bg-tps-navy/5 text-tps-navy px-2 py-1 rounded-lg">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {lesson.outline && (
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Outline</p>
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{lesson.outline}</pre>
                        </div>
                      )}

                      {/* Lesson materials */}
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            Materials — slides, handouts, homework
                          </p>
                          {canUpload && (
                            <UploadButton syllabusEventId={syllabusEventId} lessonId={lesson.id} label="↑ Upload" />
                          )}
                        </div>
                        {lesson.files.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1">No materials posted for this lesson.</p>
                        ) : (
                          <div>
                            {lesson.files.map(f => (
                              <FileItem key={f.id} file={f} canAuthor={canAuthor} onDetach={() => detach(f.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {lessonModal && (
        <LessonModal
          syllabusEventId={syllabusEventId}
          lesson={lessonModal.lesson}
          onClose={() => setLessonModal(null)}
        />
      )}
    </div>
  )
}
