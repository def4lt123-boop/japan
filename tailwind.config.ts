import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flaeche: 'var(--fläche)',
        karte: 'var(--karte)',
        t: 'var(--text)',
        t2: 'var(--text2)',
        t3: 'var(--text3)',
        rand: 'var(--rand)',
        akzent: 'var(--akzent)',
      },
      borderRadius: {
        kart: 'var(--radius)',
      },
      boxShadow: {
        karte: 'var(--schatten)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
