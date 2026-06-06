// ── Phase 6 — Makito Pricing Engine ──────────────────────────────────────────

import type { MakitoPriceBreak } from './makito.types';

export interface MakitoPriceCalculation {
  sku: string;
  quantity: number;
  currency: 'EUR';
  unitCost: number;
  productTotal: number;
  decorationCost: number;
  setupCost: number;
  shippingEstimate: number;
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  total: number;
  margin: number;
  marginPct: number;
  profitabilityScore: number;       // 0-100
  salePrice: number;
  salePricePerUnit: number;
  priceBreakApplied?: MakitoPriceBreak;
}

export interface MakitoPricingConfig {
  defaultMarginPct?: number;         // default 35%
  vatRate?: number;                  // default 23% (PT)
  shippingPerKg?: number;            // EUR/kg estimate
  minShipping?: number;              // minimum shipping EUR
}

const DEFAULT_CONFIG: Required<MakitoPricingConfig> = {
  defaultMarginPct: 35,
  vatRate: 23,
  shippingPerKg: 4.5,
  minShipping: 15,
};

export class MakitoPricingEngine {
  private readonly config: Required<MakitoPricingConfig>;

  constructor(config: MakitoPricingConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Find the applicable price break for a given quantity */
  private findPriceBreak(
    basePrice: number,
    priceBreaks: MakitoPriceBreak[],
    quantity: number,
  ): { price: number; breakApplied?: MakitoPriceBreak } {
    if (!priceBreaks.length) return { price: basePrice };
    const sorted = [...priceBreaks].sort((a, b) => b.minQty - a.minQty);
    const applicable = sorted.find((pb) => quantity >= pb.minQty);
    return applicable
      ? { price: applicable.price, breakApplied: applicable }
      : { price: basePrice };
  }

  calculate(opts: {
    sku: string;
    quantity: number;
    basePrice: number;
    priceBreaks?: MakitoPriceBreak[];
    decorationUnitCost?: number;
    setupCost?: number;
    weightKg?: number;
    targetMarginPct?: number;
    vatRate?: number;
    currency?: 'EUR';
  }): MakitoPriceCalculation {
    const {
      sku,
      quantity,
      basePrice,
      priceBreaks = [],
      decorationUnitCost = 0,
      setupCost = 0,
      weightKg = 0.1,
      targetMarginPct = this.config.defaultMarginPct,
      vatRate = this.config.vatRate,
    } = opts;

    const { price: unitCost, breakApplied } = this.findPriceBreak(basePrice, priceBreaks, quantity);

    const productTotal = unitCost * quantity;
    const decorationCost = decorationUnitCost * quantity;
    const shippingEstimate = Math.max(
      this.config.minShipping,
      weightKg * quantity * this.config.shippingPerKg,
    );

    const supplierCost = productTotal + decorationCost + setupCost + shippingEstimate;

    // Sale price with margin applied to cost
    const salePrice = supplierCost / (1 - targetMarginPct / 100);
    const salePricePerUnit = salePrice / quantity;
    const margin = salePrice - supplierCost;
    const marginPct = (margin / salePrice) * 100;

    const subtotal = salePrice;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Profitability: 0-100, based on margin + volume
    const volumeBonus = Math.min(20, Math.log10(quantity + 1) * 10);
    const profitabilityScore = Math.min(100, Math.round(marginPct + volumeBonus));

    return {
      sku,
      quantity,
      currency: 'EUR',
      unitCost,
      productTotal,
      decorationCost,
      setupCost,
      shippingEstimate: Math.round(shippingEstimate * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate,
      total: Math.round(total * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      profitabilityScore,
      salePrice: Math.round(salePrice * 100) / 100,
      salePricePerUnit: Math.round(salePricePerUnit * 100) / 100,
      priceBreakApplied: breakApplied,
    };
  }

  /** Compare pricing for multiple quantities */
  compareQuantities(
    sku: string,
    basePrice: number,
    quantities: number[],
    priceBreaks: MakitoPriceBreak[] = [],
  ): MakitoPriceCalculation[] {
    return quantities.map((qty) =>
      this.calculate({ sku, quantity: qty, basePrice, priceBreaks }),
    );
  }
}
