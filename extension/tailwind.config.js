/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./components/**/*.{tsx,ts}", "./lib/**/*.{tsx,ts}", "./*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        g: {
          blue: '#68e5ff',
          'blue-hover': '#98f0ff',
          'blue-bg': 'rgba(104, 229, 255, 0.14)',
          'blue-light': 'rgba(104, 229, 255, 0.24)',
          red: '#ff7b8e',
          'red-bg': 'rgba(255, 123, 142, 0.14)',
          yellow: '#f5cd6a',
          'yellow-bg': 'rgba(245, 205, 106, 0.14)',
          green: '#72f3c0',
          'green-bg': 'rgba(114, 243, 192, 0.14)',
          surface: '#071015',
          'surface-dim': '#0b151d',
          'surface-container': '#101b24',
          'surface-container-high': '#16242f',
          'on-surface': '#edf6fb',
          'on-surface-variant': '#96a9b7',
          outline: '#5b7385',
          'outline-variant': '#223441',
        },
      },
      fontFamily: {
        google: ["'Space Grotesk'", "'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
        'google-text': ["'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        'g-sm': '8px',
        'g-md': '16px',
        'g-lg': '28px',
        'g-full': '100px',
      },
    },
  },
  plugins: [],
}
