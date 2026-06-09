/**
 * YourGift — Application Constants
 * SINGLE SOURCE OF TRUTH — do not duplicate these in individual files
 *
 * IMMUTABLE: ADMIN_EMAILS is defined by Carlos and must never be changed by dev.
 */

// ── Admin gate — IMMUTABLE ────────────────────────────────────────────────────
export const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'] as const;

/**
 * Returns true if the given email belongs to an admin.
 * Safe for both server-side and client-side use.
 * Input is normalized to lowercase before comparison.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase().trim());
}

// ── Brand ─────────────────────────────────────────────────────────────────────
export const BRAND = {
  name:     'YourGift',
  domain:   'yourgift.pt',
  email:    'geral@yourgift.pt',
  url:      'https://www.yourgift.pt',
  phone:    '+351 210 000 000',
  address:  'Lisboa, Portugal',
} as const;

// ── Design tokens (JS/TS side) ────────────────────────────────────────────────
export const BRONZE = {
  mid:    '#b8975e',
  light:  '#d4b47a',
  dark:   '#9a7c4a',
  subtle: 'rgba(154,124,74,0.18)',
  glow:   'rgba(154,124,74,0.06)',
} as const;

export const PALETTE = {
  bg:       '#090907',
  surface:  '#0f0f0c',
  elevated: '#141411',
  text:     '#f0ece4',
  muted:    'rgba(240,236,228,0.42)',
  faint:    'rgba(240,236,228,0.18)',
} as const;

// ── API ───────────────────────────────────────────────────────────────────────
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://yourgift-api.onrender.com';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

// ── Pagination ────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE   = 50;

// ── Cache TTLs (seconds) ──────────────────────────────────────────────────────
export const TTL = {
  products:    60,       // 1 min — catalog changes infrequently
  categories:  300,      // 5 min
  currencies:  3600,     // 1 hour
  static:      86400,    // 24 hours
} as const;
