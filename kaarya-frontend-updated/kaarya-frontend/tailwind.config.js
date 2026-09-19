/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: '#F6F7F9',
        ink: {
          900: '#141A21',
          700: '#3A434E',
          500: '#667180',
          300: '#98A2B3',
        },
        line: {
          DEFAULT: '#E4E7EC',
          strong: '#D3D8DF',
        },
        brand: {
          50: '#EEF1FD',
          100: '#DDE3FB',
          500: '#3B52C4',
          600: '#2E43AE',
          700: '#243690',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        pop: '0 8px 24px rgba(16, 24, 40, 0.10)',
      },
      keyframes: {
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 260ms ease-out both',
      },
    },
  },
  plugins: [],
};
