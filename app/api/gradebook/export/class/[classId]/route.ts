import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildStudentWorkbook } from '@/lib/gradebook-excel'
import { studentLabel } from '@/lib/student-display'
import JSZip from 'jszip'

interface Params { params: Promise<{ classId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { classId } = await params

  const cls = await db.class.findUnique({
    where:   { id: classId },
    include: {
      students: {
        orderBy: { number: 'asc' },
        include: {
          entries: {
            include: {
              template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
              scores:   true,
            },
            orderBy: { template: { courseCode: 'asc' } },
          },
        },
      },
    },
  })

  if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const zip = new JSZip()

  for (const student of cls.students) {
    const buffer   = await buildStudentWorkbook({ ...student, class: { name: cls.name } })
    const label    = studentLabel(cls.name, student.number)
    const filename = `${label}_${student.track}_gradebook.xlsx`
    zip.file(filename, buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${cls.name}_gradebooks.zip"`,
    },
  })
}
