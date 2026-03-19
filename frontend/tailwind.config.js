/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: '#0a0f1a',
          surface: '#111827',
          border: '#1e293b',
          safe: '#00ff88',
          danger: '#ff3366',
          warning: '#ffaa00',
          accent: '#00ff88',
          muted: '#64748b',
          text: '#e2e8f0',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shield-spin': 'shieldSpin 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scan-line': 'scanLine 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px #00ff88, 0 0 20px rgba(0,255,136,0.3)' },
          '50%': { boxShadow: '0 0 20px #00ff88, 0 0 60px rgba(0,255,136,0.5)' },
        },
        shieldSpin: {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 10px rgba(0,255,136,0.5))' },
          '50%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 25px rgba(0,255,136,0.8))' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
};
