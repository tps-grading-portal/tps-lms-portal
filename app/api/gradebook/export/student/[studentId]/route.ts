import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildStudentWorkbook } from '@/lib/gradebook-excel'
import { studentLabel } from '@/lib/student-display'

interface Params { params: Promise<{ studentId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studentId } = await params

  const student = await db.student.findUnique({
    where:   { id: studentId },
    include: {
      class: { select: { name: true } },
      entries: {
        include: {
          template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
          scores:   true,
        },
        orderBy: { template: { courseCode: 'asc' } },
      },
    },
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer   = await buildStudentWorkbook(student)
  const label    = studentLabel(student.class.name, student.number)
  const filename = `${label}_${student.track}_gradebook.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
