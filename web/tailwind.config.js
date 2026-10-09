export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#111827',
        surface2: '#1f2937',
        accent: '#38bdf8',
        accent2: '#22c55e',
        warn: '#f97316',
        danger: '#ef4444',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [],
};
