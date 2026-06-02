/**
 * SSE endpoint — streams live session data to the Panel Chair dashboard.
 * Polls DB every 3 seconds. EventSource auto-reconnects on cellular drops.
 * Auth: verifies the tps_chair_token JWT from cookies.
 */
import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getSessionDisplayData } from '@/lib/session-processor'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export async function GET(req: NextRequest) {
  // Verify chair JWT from cookie
  const token = req.cookies.get('tps_chair_token')?.value
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  let classId: string
  try {
    const { payload } = await jwtVerify(token, secret)
    classId = payload.classId as string
    if (!classId) throw new Error('No classId in token')
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          // Controller closed (client disconnected)
        }
      }

      // Send initial data immediately
      try {
        const data = await getSessionDisplayData(classId)
        send(data)
      } catch {
        send({ error: 'Failed to load session data' })
      }

      // Poll every 3 seconds for updates
      const interval = setInterval(async () => {
        try {
          const data = await getSessionDisplayData(classId)
          send(data)
        } catch {
          // Skip failed polls silently — next poll will retry
        }
      }, 3000)

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Allow EventSource through proxies
      'X-Accel-Buffering': 'no',
    },
  })
}
