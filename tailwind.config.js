/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // JAM Beauty official brand colors extracted from logo
        jam: {
          blush: '#efaa9b',        // Official logo blush background
          'blush-light': '#fdf2ef',
          'blush-hover': '#e89887',
          'blush-dark': '#d77c68',
          chocolate: '#45150b',    // Official logo dark brown typography
          espresso: '#2a0e07',
          bg: '#120b0a',           // Luxurious deep espresso-dark background
          card: '#1c1210',         // Rich card surface
          'card-hover': '#251916',
          border: '#3a221d',       // Warm subtle border
          muted: '#a3847e',        // Warm muted text
        },
        brand: {
          900: '#120b0a',
          850: '#18100e',
          800: '#1e1412',
          700: '#32221f',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
