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
      }
    },
  },
  plugins: [],
}
