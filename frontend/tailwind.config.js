/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(0 0 0 / 0.25), 0 0 0 1px rgb(15 23 42 / 0.4)',
        'glow-blue': '0 0 0 1px rgba(59,130,246,.25), 0 8px 30px -12px rgba(59,130,246,.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [],
}
