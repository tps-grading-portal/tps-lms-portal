import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    // Server Actions are stable in Next.js 15 — no flag needed
  },
  // Minimize JS payload on mobile
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

export default config
