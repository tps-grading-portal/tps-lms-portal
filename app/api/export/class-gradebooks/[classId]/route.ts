/**
 * Whole-class gradebook export — one .xlsx per student, zipped.
 * GET /api/export/class-gradebooks/[classId] → .zip download
 */
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { can } from '@/lib/permissions'
import { buildStudentWorkbook } from '@/lib/gradebook-excel'

export const maxDuration = 120

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const session = await auth()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { role } = session.user
  const allowed = can(role, 'grade:queue') || can(role, 'view:all_standings') || can(role, 'manage:classes')
  if (!allowed) return new NextResponse('Forbidden', { status: 403 })

  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        orderBy: { number: 'asc' },
        include: {
          class: { select: { name: true } },
          entries: {
            include: {
              template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
              scores:   true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  })
  if (!cls) return new NextResponse('Class not found', { status: 404 })

  const zip = new JSZip()
  for (const student of cls.students) {
    const buffer = await buildStudentWorkbook(student)
    const safeName = `${student.lastName || 'Student'}_${student.firstName || student.number}`.replace(/[^a-zA-Z0-9_-]/g, '')
    zip.file(`${cls.name}-${String(student.number).padStart(2, '0')}_${safeName}.xlsx`, buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Class_${cls.name}_Gradebooks.zip"`,
    },
  })
}
