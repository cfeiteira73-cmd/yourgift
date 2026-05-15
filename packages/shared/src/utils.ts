import { PricingBreakdown } from './types';

export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function calculateTax(subtotal: number, vatRate = 0.23): number {
  return Math.round(subtotal * vatRate * 100) / 100;
}

export function buildPricingBreakdown(
  base: number,
  printCost: number,
  shippingCost: number,
  marginRate = 0.35,
  vatRate = 0.23
): PricingBreakdown {
  const subtotal = base + printCost;
  const margin = Math.round(subtotal * marginRate * 100) / 100;
  const taxable = subtotal + margin + shippingCost;
  const tax = calculateTax(taxable, vatRate);
  const total = Math.round((taxable + tax) * 100) / 100;

  return {
    subtotal,
    printCost,
    shippingCost,
    margin,
    tax,
    total,
    currency: 'EUR',
  };
}

export function generateOrderRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `YG-${ts}-${rand}`;
}
