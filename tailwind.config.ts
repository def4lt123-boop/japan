import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0d12',
          900: '#12151d',
          800: '#1a1f2b',
          700: '#252c3b',
          600: '#384156',
        },
        shu: {
          50: '#fff4f0',
          100: '#ffe4da',
          200: '#ffc7b3',
          300: '#ff9f7f',
          400: '#ff7047',
          500: '#f04e23',
          600: '#d93a14',
          700: '#b32c11',
        },
        ai: {
          100: '#dbe6f5',
          300: '#9db6dc',
          500: '#3f5f96',
          700: '#26406e',
          900: '#16243d',
        },
        matcha: {
          300: '#a7d3a0',
          500: '#4f9d5b',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
