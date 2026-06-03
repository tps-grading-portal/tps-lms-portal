import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
      colors: {
        // TPS brand palette — sourced from the USAF Test Pilot School grad patch
        tps: {
          navy:   '#1B2A4A',  // patch shield background — primary dark
          orange: '#F26522',  // test aviation orange — primary action color
          gold:   '#FFFF00',  // GRADUATE text on patch — use on dark backgrounds only
          red:    '#CC2200',  // patch crimson border — danger/fail accent
          silver: '#A8B4C0',  // X-plane silhouette — secondary text/icons
          // Legacy alias — used throughout as link/focus color, now maps to orange
          blue:   '#F26522',
        },
        grade: {
          discontinuity: '#FFD580',
          resolved:      '#D9F2F2',
          fail:          '#F28B82',
          failText:      '#FF0000',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
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
  },
  plugins: [],
}

export default config
