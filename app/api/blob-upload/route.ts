import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/lib/auth'

/**
 * Client-side Blob upload handler. Files go browser → Vercel Blob directly,
 * bypassing the 4.5 MB serverless request body cap that broke PDF/PPT/image
 * uploads through server actions. Metadata is registered afterwards via a
 * separate (small) server action call.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await auth()
        if (!session?.user) throw new Error('Unauthorized')

        let purpose = 'vault'
        try { purpose = JSON.parse(clientPayload ?? '{}').purpose ?? 'vault' } catch { /* default */ }

        return {
          allowedContentTypes: [
            'image/*', 'application/*', 'text/*', 'video/*', 'audio/*',
          ],
          maximumSizeInBytes: purpose === 'chat' ? 25 * 1024 * 1024 : 200 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, purpose }),
        }
      },
      onUploadCompleted: async () => {
        // Metadata registration happens via server action after the client
        // receives the blob URL — nothing to do here.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    )
  }
}
