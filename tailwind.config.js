/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        aeginel: {
          green: '#16a34a',
          yellow: '#ca8a04',
          orange: '#ea580c',
          red: '#dc2626',
          bg: '#ffffff',
          card: '#f8fafc',
          border: '#e2e8f0',
          text: '#1e293b',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
