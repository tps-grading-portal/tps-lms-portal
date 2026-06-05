import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'

interface PageProps { params: Promise<{ classId: string }> }

export default async function ClassDetailPage({ params }: PageProps) {
  const { classId } = await params

  const cls = await db.class.findUnique({
    where:   { id: classId },
    include: { students: { orderBy: { number: 'asc' }, take: 1 } },
  })
  if (!cls) notFound()

  if (cls.students[0]) {
    redirect(`/admin/gradebook/classes/${classId}/${cls.students[0].id}`)
  }
  redirect('/admin/gradebook')
}
