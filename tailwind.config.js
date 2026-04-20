/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: {
          dark: '#111827',
          DEFAULT: '#ffffff'
        },
        card: {
          dark: '#1F2937', // Gray 800
        },
        border: {
          dark: '#374151', // Gray 700
        },
        primary: {
          DEFAULT: '#F43F5E', // Rose 500 (Sushi theme)
        },
        success: {
          DEFAULT: '#10B981', // Emerald 500
        },
        danger: {
          DEFAULT: '#EF4444', // Red 500
        },
        warning: {
          DEFAULT: '#F59E0B', // Amber 500
        },
        info: {
          DEFAULT: '#3B82F6', // Blue 500
        }
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'card-flash': 'card-flash 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.005)' },
        },
        'card-flash': {
          '0%, 100%': { borderColor: 'rgba(244, 63, 94, 0.1)' },
          '50%': { borderColor: 'rgba(244, 63, 94, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
