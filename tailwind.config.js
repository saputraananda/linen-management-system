/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0fafb',
          100: '#d1f0f2',
          200: '#a7e1e4',
          300: '#71ccd1',
          400: '#34b8c0',
          500: '#1ea59e', // Brand Secondary Color
          600: '#188c88',
          700: '#126776', // Brand Primary Color
          800: '#105461',
          900: '#104753',
          950: '#072a32',
        },
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],       // 12px (was 13px)
        sm: ['0.875rem', { lineHeight: '1.25rem' }],   // 14px (was 15px)
        base: ['1rem', { lineHeight: '1.5rem' }],      // 16px (was 17px)
        lg: ['1.125rem', { lineHeight: '1.75rem' }],   // 18px (was 19px)
        xl: ['1.25rem', { lineHeight: '1.875rem' }],   // 20px (was 21px)
        '2xl': ['1.375rem', { lineHeight: '2rem' }],   // 22px (was 24px)
        '3xl': ['1.625rem', { lineHeight: '2.25rem' }], // 26px (was 28px)
      },
    },
  },
  plugins: [],
}
