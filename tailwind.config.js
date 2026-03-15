/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        aeginel: {
          bg:            '#0d1117',
          surface:       '#161b22',
          surface2:      '#21262d',
          border:        '#30363d',
          text:          '#e6edf3',
          muted:         '#8b949e',
          green:         '#3fb950',
          'green-bright':'#10d97e',
          yellow:        '#d29922',
          orange:        '#db6d28',
          red:           '#f85149',
          blue:          '#58a6ff',
        },
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(63, 185, 80, 0.4)',
        'glow-red':   '0 0 12px rgba(248, 81, 73, 0.4)',
        'glow-blue':  '0 0 12px rgba(88, 166, 255, 0.35)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up':   'slideUp 0.2s ease-out',
        'fade-in':    'fadeIn 0.15s ease-out',
        'count-in':   'countIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.45' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        countIn: {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
