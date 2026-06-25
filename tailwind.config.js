/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        gtd: {
          today:     '#06b6d4',
          backlog:   '#6366f1',
          waiting:   '#f59e0b',
          someday:   '#10b981',
          reference: '#64748b',
          now:       '#22c55e',
          discard:   '#ef4444',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
