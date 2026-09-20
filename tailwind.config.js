/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"A Jannat LT"', '"Segoe UI"', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      colors: {
        // مستوحاة من هوية القالب الرسمي (الأخضر 018755 والذهبي في شعار الزائر السري)
        brand: {
          50: '#e8f6f0',
          100: '#c7eadb',
          200: '#94d6bb',
          300: '#5bbd96',
          400: '#2aa274',
          500: '#018755',
          600: '#017449',
          700: '#015d3b',
          800: '#03482f',
          900: '#053a27',
        },
        gold: {
          50: '#f8f5ec',
          100: '#eee7d2',
          400: '#bfae7e',
          500: '#a89a6b',
          600: '#8b7f55',
        },
        ink: {
          DEFAULT: '#33475b',
          muted: '#6b7c8f',
        },
        sky: {
          cluster: '#4fc3f7',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 38, 29, 0.04), 0 4px 16px rgba(16, 38, 29, 0.06)',
      },
    },
  },
  plugins: [],
};
