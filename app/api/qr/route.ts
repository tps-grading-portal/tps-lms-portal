import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  try {
    const decoded = decodeURIComponent(url)
    const svg = await QRCode.toString(decoded, {
      type: 'svg',
      margin: 2,
      width: 256,
      color: {
        dark: '#0A1628',  // TPS navy
        light: '#FFFFFF',
      },
    })

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        // Cache QR codes for 1 hour — they only change when URLs change
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
