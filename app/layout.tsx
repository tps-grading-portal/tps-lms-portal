import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | TPS Grading Portal',
    default: 'TPS Grading Portal',
  },
  description: 'USAF Test Pilot School — Comprehensive Oral Examination Grading System',
  // Prevent search engine indexing of an internal tool
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Critical for mobile-first — prevents iOS auto-zoom on form inputs
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1B3A6B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
