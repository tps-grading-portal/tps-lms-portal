import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Touch-optimized minimum tap target: 44px (Apple HIG / WCAG 2.5.5)
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      colors: {
        // TPS brand palette — high contrast for outdoor / bright-screen use
        tps: {
          navy:    '#0A1628',
          blue:    '#1B3A6B',
          gold:    '#C8A84B',
          silver:  '#8A9BB0',
        },
        // Grade status colors (mirrors legacy system)
        grade: {
          discontinuity: '#FFD580', // amber highlight
          resolved:      '#D9F2F2', // teal success
          fail:          '#F28B82', // red fail
          failText:      '#FF0000',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
