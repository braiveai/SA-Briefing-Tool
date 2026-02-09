/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sunny: {
          yellow: '#FFD000',
          dark: '#1a1a1a',
          gray: '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
};
