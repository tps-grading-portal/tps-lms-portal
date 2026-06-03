/**
 * Server-side PDF text extraction endpoint.
 * Accepts a multipart/form-data upload of a PDF file,
 * returns the extracted plain text for client-side question parsing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { validateSandboxToken } from '@/lib/sandbox-auth'

export async function POST(req: NextRequest) {
  const adminSession  = await auth()
  const creatorToken  = req.headers.get('x-creator-token')
  const creatorAuthed = creatorToken
    ? await validateSandboxToken('creator', creatorToken)
    : false

  if (!adminSession && !creatorAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Use require() so pdf-parse works without ESM complications
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
    const parsed   = await pdfParse(buffer)

    return NextResponse.json({ text: parsed.text, pages: parsed.numpages })
  } catch (err) {
    console.error('PDF extraction error:', err)
    return NextResponse.json(
      { error: 'Could not extract text from PDF. Make sure the file is a text-based PDF (not a scanned image).' },
      { status: 422 },
    )
  }
}
