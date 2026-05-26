import { PricingBreakdown } from './types';
import { MARGIN_RATE, VAT_RATE, VOLUME_DISCOUNTS, SHIPPING_RATES, PRINT_TECHNIQUES } from './constants';

// ─────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────

export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateTax(subtotal: number, vatRate = VAT_RATE): number {
  return Math.round(subtotal * vatRate * 100) / 100;
}

export function getVolumeDiscount(quantity: number): number {
  for (const tier of VOLUME_DISCOUNTS) {
    if (quantity >= tier.minQty) return tier.discount;
  }
  return 0;
}

export function estimatePrintCost(technique: string, quantity: number): number {
  const tech = PRINT_TECHNIQUES[technique as keyof typeof PRINT_TECHNIQUES];
  const rate = tech?.baseRate ?? 2.0;
  const discount = getVolumeDiscount(quantity);
  return Math.round(rate * quantity * (1 - discount) * 100) / 100;
}

export function estimateShipping(quantity: number, country: string): number {
  const base = SHIPPING_RATES[country] ?? SHIPPING_RATES.DEFAULT;
  const weight = quantity * 0.1; // ~100g per unit
  return Math.round((base + weight) * 100) / 100;
}

export function buildPricingBreakdown(
  baseCost: number,
  printCost: number,
  shippingCost: number,
  marginRate = MARGIN_RATE,
  vatRate = VAT_RATE,
): PricingBreakdown {
  const subtotal = baseCost + printCost;
  const margin = Math.round(subtotal * marginRate * 100) / 100;
  const taxable = subtotal + margin + shippingCost;
  const tax = calculateTax(taxable, vatRate);
  const total = Math.round((taxable + tax) * 100) / 100;

  return {
    subtotal,
    printCost,
    shippingCost,
    margin,
    marginRate,
    tax,
    total,
    currency: 'EUR',
  };
}

// ─────────────────────────────────────────────
// REF GENERATION
// ─────────────────────────────────────────────

export function generateOrderRef(): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `YGO-${yyyymmdd}-${rand}`;
}

export function generateQuoteRef(): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `YGQ-${yyyymmdd}-${rand}`;
}

export function generateStoreSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 5);
  return `${base}-${suffix}`;
}

// ─────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfLastMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0);
}

export function endOfLastMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

export function isValidNif(nif: string): boolean {
  const n = nif.replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) return false;
  const check = n.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += check[i] * (9 - i);
  const remainder = sum % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;
  return check[8] === expected;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function emailMatchesDomain(email: string, allowedEmails: string[]): boolean {
  if (allowedEmails.length === 0) return true;
  return allowedEmails.some((allowed) => {
    if (allowed.startsWith('@')) {
      return email.endsWith(allowed);
    }
    return email === allowed;
  });
}
