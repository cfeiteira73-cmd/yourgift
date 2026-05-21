import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#07111f',
          900: '#0b1526',
          800: '#102131',
          700: '#152840',
        },
        accent: {
          blue: '#4da3ff',
          cyan: '#74e7ff',
          emerald: '#63e6be',
        },
        brand: {
          400: '#4da3ff',
          500: '#3b8de0',
          600: '#2a76c0',
          700: '#1d5fa0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
