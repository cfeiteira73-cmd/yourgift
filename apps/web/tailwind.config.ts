import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // yourgift dark design system
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'brand-text': 'rgb(var(--text) / <alpha-value>)',
        'muted-text': 'rgb(var(--muted-text) / <alpha-value>)',
        'brand-border': 'rgb(var(--border) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue) / <alpha-value>)',
        'accent-cyan': 'rgb(var(--accent-cyan) / <alpha-value>)',
        'accent-emerald': 'rgb(var(--accent-emerald) / <alpha-value>)',
        // legacy brand (used by /products, /dashboard, /auth)
        brand: {
          50: '#fdf4ff',
          100: '#fae8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          900: '#581c87',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(77,163,255,0.3)',
        soft: '0 4px 24px rgba(0,0,0,0.18)',
        heavy: '0 8px 40px rgba(0,0,0,0.32)',
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
