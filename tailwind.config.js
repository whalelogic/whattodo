/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./views/**/*.templ", "./static/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        hand: ['"Kalam"', 'cursive'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        neon: {
          pink: '#FF3EA5',
          cyan: '#2EE6D6',
          amber: '#FFD23F',
        },
      },
      boxShadow: {
        neonPink: '0 0 8px #FF3EA5, 0 0 24px rgba(255,62,165,0.4)',
        neonCyan: '0 0 8px #2EE6D6, 0 0 24px rgba(46,230,214,0.4)',
        neonAmber: '0 0 8px #FFD23F, 0 0 24px rgba(255,210,63,0.4)',
      },
    },
  },
  plugins: [],
}
