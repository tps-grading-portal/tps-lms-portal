import type { NextConfig } from 'next'

const config: NextConfig = {
  // bcryptjs needs Node.js crypto — keep in Node.js runtime, not edge
  serverExternalPackages: ['bcryptjs'],

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Increase body size limit for Content Vault file uploads (100 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
}

export default config
