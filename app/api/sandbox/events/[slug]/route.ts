import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { db } from '@/lib/db'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Verify results PIN JWT
  const cookieName = `sbx_results_${slug.slice(0, 16)}`
  const token = req.cookies.get(cookieName)?.value
  if (!token) return new Response('Unauthorized', { status: 401 })

  try {
    await jwtVerify(token, secret)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const form = await db.sandboxForm.findUnique({
    where: { resultsSlug: slug },
    select: { id: true },
  })
  if (!form) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* closed */ }
      }

      // Initial data
      const submissions = await getSubmissions(form.id)
      send(submissions)

      // Poll every 5s
      const interval = setInterval(async () => {
        try {
          const fresh = await getSubmissions(form.id)
          send(fresh)
        } catch { /* skip */ }
      }, 5000)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch { /* closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function getSubmissions(formId: string) {
  const subs = await db.sandboxSubmission.findMany({
    where:   { formId },
    orderBy: { submittedAt: 'desc' },
  })
  return subs.map((s) => ({
    id:          s.id,
    subjectName: s.subjectName,
    graderName:  s.graderName,
    answers:     s.answers,
    totalScore:  s.totalScore,
    submittedAt: s.submittedAt.toISOString(),
  }))
}
