/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cyberpunk Neon Colors
        'neon-cyan': '#00FFFF',
        'neon-magenta': '#FF00FF',
        'neon-green': '#00FF00',
        'neon-blue': '#0080FF',
        'neon-pink': '#FF006E',

        // Dark Mode Base
        'deep-black': '#0A0E27',
        'dark-surface': '#1A1F3A',
        'dark-card': 'rgba(26, 31, 58, 0.8)',

        // Text Colors
        'text-primary': '#E0E7FF',
        'text-muted': '#94A3B8',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 255, 255, 0.5)',
        'neon-magenta': '0 0 20px rgba(255, 0, 255, 0.5)',
        'neon-green': '0 0 20px rgba(0, 255, 0, 0.5)',
        'neon-blue': '0 0 20px rgba(0, 128, 255, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.8)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
