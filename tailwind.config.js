/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#5677fc', // Primary accent blue
          600: '#3b54db',
          700: '#2c3eb2',
          800: '#23308f',
          900: '#202a73',
          950: '#131846',
        },
        slate: {
          950: '#0b0f19', // Sleek deep background
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif'
        ],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
