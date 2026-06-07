/**
 * Single-student full gradebook export.
 * GET /api/export/student/[studentId] → .xlsx download
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { can } from '@/lib/permissions'
import { buildStudentWorkbook } from '@/lib/gradebook-excel'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const session = await auth()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { role } = session.user
  const allowed = can(role, 'grade:queue') || can(role, 'view:all_standings') || can(role, 'manage:classes')
  if (!allowed) return new NextResponse('Forbidden', { status: 403 })

  const { studentId } = await params

  const student = await db.student.findUnique({
    where: { id: studentId },
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
  })
  if (!student) return new NextResponse('Student not found', { status: 404 })

  const buffer = await buildStudentWorkbook(student)

  const safeName = `${student.lastName || 'Student'}_${student.firstName || student.number}`.replace(/[^a-zA-Z0-9_-]/g, '')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${student.class.name}_${safeName}_Gradebook.xlsx"`,
    },
  })
}
