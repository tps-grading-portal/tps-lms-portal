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
    keyframes: {
      'horn-pop': {
        '0%':   { transform: 'scale(0) rotate(-20deg)', opacity: '0' },
        '60%':  { transform: 'scale(1.35) rotate(15deg)', opacity: '1' },
        '80%':  { transform: 'scale(0.9) rotate(-8deg)' },
        '100%': { transform: 'scale(1.1) rotate(10deg)' },
      },
    },
    animation: {
      'horn-pop': 'horn-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    },
  },
  plugins: [],
}

export default config
