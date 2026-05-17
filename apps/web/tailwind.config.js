/** @type {import('tailwindcss').Config} */
const animate = require('tailwindcss-animate');

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    { pattern: /^(grid|flex|block|hidden|inline|items|justify|self|place)/ },
    { pattern: /^(grid-cols|grid-rows|col|row|gap|space)/ },
    { pattern: /^(w|h|min|max)/ },
    { pattern: /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-/ },
    { pattern: /^(text|font|leading|tracking|whitespace|truncate|overflow)/ },
    { pattern: /^(bg|border|rounded|shadow|ring|opacity|cursor|pointer)/ },
    { pattern: /^(absolute|relative|fixed|sticky|top|right|bottom|left|inset|z)/ },
    { pattern: /^(transition|duration|ease|animate|transform|translate|rotate|scale)/ },
    { pattern: /^(divide|backdrop|blur|brightness|contrast)/ },
    {
      pattern: /^(sm:|md:|lg:|xl:|2xl:)/,
      variants: ['sm', 'md', 'lg', 'xl', '2xl'],
    },
    { pattern: /^(hover:|focus:|active:|group-hover:)/ },
    { pattern: /^(aspect|object|overflow|float)/ },
    'lg:grid-cols-2', 'lg:flex', 'lg:hidden', 'lg:block', 'lg:items-center',
    'lg:gap-16', 'lg:gap-12', 'lg:pt-32', 'lg:pb-20', 'sm:flex-row', 'sm:w-auto',
    'sm:items-center', 'sm:text-5xl', 'md:px-8', 'md:pt-32', 'md:pb-20', 'md:text-right',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'brand-text': 'rgb(var(--text) / <alpha-value>)',
        'muted-text': 'rgb(var(--muted-text) / <alpha-value>)',
        'brand-border': 'rgb(var(--border) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue) / <alpha-value>)',
        'accent-cyan': 'rgb(var(--accent-cyan) / <alpha-value>)',
        'accent-emerald': 'rgb(var(--accent-emerald) / <alpha-value>)',
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
