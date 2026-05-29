/**
 * OMEGA WORLDCLASS — Unified Design Token System
 *
 * Single source of truth for all colors, spacing, shadows, and radii.
 * Use these constants in inline styles and extend via CSS custom properties.
 *
 * CSS Custom Properties are injected in globals.css.
 * These TS exports are for use in JS/JSX inline styles.
 */

// ── Color palette ──────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: {
    base:     'rgb(7,17,31)',
    surface:  'rgb(8,15,28)',
    elevated: 'rgb(10,20,36)',
    overlay:  'rgba(0,0,0,0.6)',
    card:     'rgba(255,255,255,0.03)',
    hover:    'rgba(255,255,255,0.06)',
    active:   'rgba(77,163,255,0.12)',
  },

  // Text
  text: {
    primary:   'rgb(245,247,251)',
    secondary: 'rgba(255,255,255,0.6)',
    muted:     'rgba(255,255,255,0.4)',
    disabled:  'rgba(255,255,255,0.2)',
    inverse:   'rgb(7,17,31)',
  },

  // Brand
  brand: {
    primary:   'rgb(77,163,255)',
    secondary: 'rgb(99,230,190)',
    gradient:  'linear-gradient(135deg, rgb(77,163,255) 0%, rgb(99,230,190) 100%)',
    glow:      'rgba(77,163,255,0.25)',
  },

  // Semantic
  semantic: {
    success: {
      text: 'rgb(99,230,190)',
      bg:   'rgba(99,230,190,0.12)',
      border: 'rgba(99,230,190,0.25)',
    },
    warning: {
      text: 'rgb(245,158,11)',
      bg:   'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.25)',
    },
    error: {
      text: 'rgb(239,68,68)',
      bg:   'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)',
    },
    info: {
      text: 'rgb(77,163,255)',
      bg:   'rgba(77,163,255,0.12)',
      border: 'rgba(77,163,255,0.25)',
    },
  },

  // Borders
  border: {
    subtle:  'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.1)',
    strong:  'rgba(255,255,255,0.18)',
    brand:   'rgba(77,163,255,0.3)',
  },
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────────

export const spacing = {
  px:  '1px',
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  '2xl': '48px',
  '3xl': '64px',
  page: '32px',
  card: '20px',
} as const;

// ── Border radii ───────────────────────────────────────────────────────────────

export const radii = {
  xs:  '4px',
  sm:  '6px',
  md:  '8px',
  lg:  '12px',
  xl:  '16px',
  '2xl': '20px',
  full: '9999px',
  card: '12px',
  modal: '16px',
} as const;

// ── Shadows ────────────────────────────────────────────────────────────────────

export const shadows = {
  sm:    '0 1px 3px rgba(0,0,0,0.3)',
  md:    '0 4px 16px rgba(0,0,0,0.4)',
  lg:    '0 12px 40px rgba(0,0,0,0.5)',
  xl:    '0 24px 60px rgba(0,0,0,0.6)',
  modal: '0 40px 80px rgba(0,0,0,0.6)',
  card:  '0 0 0 1px rgba(255,255,255,0.06)',
  glow:  '0 0 20px rgba(77,163,255,0.25)',
  glowIntense: '0 0 40px rgba(77,163,255,0.4)',
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────

export const type = {
  xs:   { fontSize: '11px', lineHeight: '16px' },
  sm:   { fontSize: '12px', lineHeight: '18px' },
  base: { fontSize: '14px', lineHeight: '20px' },
  md:   { fontSize: '16px', lineHeight: '24px' },
  lg:   { fontSize: '18px', lineHeight: '28px' },
  xl:   { fontSize: '22px', lineHeight: '32px' },
  '2xl': { fontSize: '28px', lineHeight: '36px' },
  '3xl': { fontSize: '36px', lineHeight: '44px' },
} as const;

// ── Z-index scale ──────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  dropdown: 100,
  sticky:  200,
  overlay:  300,
  modal:    400,
  toast:    500,
  tooltip:  600,
} as const;

// ── Status configs (for order/payment/SLA statuses) ───────────────────────────

export type StatusKey = 'ok' | 'warning' | 'critical' | 'info' | 'neutral';

export const statusConfig: Record<StatusKey, { color: string; bg: string; border: string; dot: string; label: string }> = {
  ok:       { color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)',  border: 'rgba(99,230,190,0.25)',  dot: 'bg-emerald-400', label: 'OK' },
  warning:  { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', dot: 'bg-amber-400',   label: 'Atenção' },
  critical: { color: 'rgb(239,68,68)',  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  dot: 'bg-red-400',     label: 'Crítico' },
  info:     { color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)',  border: 'rgba(77,163,255,0.25)',  dot: 'bg-blue-400',    label: 'Info' },
  neutral:  { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', dot: 'bg-white/30', label: 'Neutro' },
};

// ── Breakpoints ────────────────────────────────────────────────────────────────

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ── Transition durations ───────────────────────────────────────────────────────

export const transitions = {
  fast:   'all 120ms cubic-bezier(.22,1,.36,1)',
  base:   'all 200ms cubic-bezier(.22,1,.36,1)',
  slow:   'all 350ms cubic-bezier(.22,1,.36,1)',
  spring: 'all 200ms cubic-bezier(.22,1,.36,1)',
} as const;

// ── GPU acceleration helpers ───────────────────────────────────────────────────

export const gpu = {
  accelerated: {
    transform: 'translateZ(0)',
    willChange: 'transform' as const,
    backfaceVisibility: 'hidden' as const,
  },
} as const;

// ── Glassmorphism presets ──────────────────────────────────────────────────────

export const glass = {
  light: {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  medium: {
    background: 'rgba(8,15,28,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  heavy: {
    background: 'rgba(8,15,28,0.95)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
} as const;

// ── Component presets (inline style objects) ───────────────────────────────────

export const presets = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: radii.card,
    transform: 'translateZ(0)',
  },
  badge: (status: StatusKey) => ({
    padding: '3px 10px',
    borderRadius: radii.full,
    fontSize: '11px',
    fontWeight: 600,
    background: statusConfig[status].bg,
    color: statusConfig[status].color,
    border: `1px solid ${statusConfig[status].border}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  }),
  button: {
    primary: {
      padding: '9px 18px',
      borderRadius: radii.md,
      fontSize: '13px',
      fontWeight: 600,
      background: colors.bg.active,
      color: colors.brand.primary,
      border: `1px solid ${colors.border.brand}`,
      cursor: 'pointer',
      transition: transitions.fast,
    },
    ghost: {
      padding: '9px 18px',
      borderRadius: radii.md,
      fontSize: '13px',
      fontWeight: 600,
      background: colors.bg.hover,
      color: colors.text.secondary,
      border: `1px solid ${colors.border.default}`,
      cursor: 'pointer',
      transition: transitions.fast,
    },
    danger: {
      padding: '9px 18px',
      borderRadius: radii.md,
      fontSize: '13px',
      fontWeight: 600,
      background: colors.semantic.error.bg,
      color: colors.semantic.error.text,
      border: `1px solid ${colors.semantic.error.border}`,
      cursor: 'pointer',
      transition: transitions.fast,
    },
  },
} as const;
