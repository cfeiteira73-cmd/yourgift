import { Injectable, Logger } from '@nestjs/common';

/**
 * LandedCostService — Procurement Reality Engine
 *
 * Calculates the TRUE total cost of procuring goods:
 *   Landed Cost = Product Cost + Shipping + Customs Duties + VAT + Handling + Insurance
 *
 * This is the foundation for:
 * - Honest quote display ("what you'll actually pay")
 * - Supplier comparison on a level playing field
 * - CFO-ready spend reporting
 * - Savings rate calculation vs. market benchmark
 */

export interface LandedCostInput {
  /** Product unit price in EUR */
  unitPrice: number;
  /** Order quantity */
  quantity: number;
  /** Total weight in kg */
  weightKg: number;
  /** Origin country code (ISO 3166-1 alpha-2) */
  originCountry: string;
  /** Destination country code */
  destinationCountry: string;
  /** HS commodity code (6-digit Harmonized System) for duty lookup */
  hsCommodityCode?: string;
  /** Declared value for customs — defaults to unitPrice × quantity */
  declaredValue?: number;
  /** Carrier preference */
  carrier?: 'dhl' | 'dpd' | 'gls' | 'ups' | 'fedex' | 'best';
  /** Incoterms — affects who pays duties/insurance */
  incoterms?: 'DAP' | 'DDP' | 'EXW' | 'FOB';
  /** Whether to include insurance (recommended for orders > €500) */
  includeInsurance?: boolean;
}

export interface LandedCostBreakdown {
  /** Product subtotal (unitPrice × quantity) */
  productCost: number;
  /** Estimated shipping cost in EUR */
  shippingCost: number;
  /** Import duties based on HS code and origin */
  customsDuties: number;
  /** VAT at destination (Portugal: 23%, Spain: 21%, UK: 20%) */
  vat: number;
  /** Handling / customs clearance fee */
  handlingFee: number;
  /** Cargo insurance (0.5% of declared value if enabled) */
  insuranceCost: number;
  /** TOTAL landed cost */
  totalLandedCost: number;
  /** Cost per unit (total / quantity) */
  costPerUnit: number;
  /** Effective markup over product cost (%) */
  landingMarkupPct: number;
  /** Carrier used for this calculation */
  carrier: string;
  /** Incoterms applied */
  incoterms: string;
  /** Breakdown detail lines for UI display */
  lines: LandedCostLine[];
  /** Calculated at timestamp */
  calculatedAt: string;
  /** Confidence: HIGH (carrier API) | MEDIUM (rate card) | LOW (estimate) */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface LandedCostLine {
  label: string;
  amount: number;
  basis: string;
  included: boolean;
}

/**
 * Duty rates by HS chapter (first 2 digits) and trade agreement.
 * EU → EU: 0% (free movement). Third country: varies.
 *
 * Source: EU TARIC database approximations.
 * In production: query TARIC API or a duty database.
 */
const EU_DUTY_RATES: Record<string, number> = {
  '39': 0.065,  // Plastics — 6.5%
  '42': 0.030,  // Leather goods — 3%
  '61': 0.120,  // Knit clothing — 12%
  '62': 0.120,  // Woven clothing — 12%
  '63': 0.120,  // Textile articles — 12%
  '73': 0.030,  // Iron/steel articles — 3%
  '84': 0.020,  // Machinery — 2%
  '85': 0.030,  // Electronics — 3%
  '94': 0.030,  // Furniture — 3%
  '95': 0.045,  // Toys/games — 4.5%
  '96': 0.030,  // Miscellaneous — 3%
};

const EU_COUNTRIES = new Set([
  'PT','ES','FR','DE','IT','NL','BE','PL','SE','AT','CH','DK','FI','IE','GR',
  'CZ','RO','HU','SK','BG','HR','SI','EE','LV','LT','LU','MT','CY',
]);

const VAT_RATES: Record<string, number> = {
  PT: 0.23, ES: 0.21, FR: 0.20, DE: 0.19, IT: 0.22, NL: 0.21,
  BE: 0.21, PL: 0.23, SE: 0.25, AT: 0.20, DK: 0.25, FI: 0.24,
  UK: 0.20, CH: 0.077, US: 0,   CN: 0.13,
};

/**
 * Estimated shipping rates (EUR) per kg per carrier for EU intra-zone.
 * In production: replace with live carrier API calls.
 */
const CARRIER_BASE_RATES: Record<string, { baseEur: number; perKgEur: number; fuelSurcharge: number }> = {
  dhl:   { baseEur: 6.50, perKgEur: 0.85, fuelSurcharge: 0.22 },
  dpd:   { baseEur: 5.80, perKgEur: 0.75, fuelSurcharge: 0.18 },
  gls:   { baseEur: 5.20, perKgEur: 0.70, fuelSurcharge: 0.15 },
  ups:   { baseEur: 7.20, perKgEur: 0.95, fuelSurcharge: 0.25 },
  fedex: { baseEur: 7.80, perKgEur: 1.10, fuelSurcharge: 0.28 },
};

@Injectable()
export class LandedCostService {
  private readonly logger = new Logger(LandedCostService.name);

  /**
   * Calculate the full landed cost for a procurement order.
   */
  calculate(input: LandedCostInput): LandedCostBreakdown {
    const {
      unitPrice,
      quantity,
      weightKg,
      originCountry,
      destinationCountry,
      hsCommodityCode,
      incoterms = 'DAP',
      includeInsurance = false,
    } = input;

    const productCost = unitPrice * quantity;
    const declaredValue = input.declaredValue ?? productCost;

    // ── Carrier selection ─────────────────────────────────────────────────
    const carrier = this.selectCarrier(input.carrier, weightKg);
    const shippingCost = this.estimateShipping(carrier, weightKg, originCountry, destinationCountry);

    // ── Customs duties ────────────────────────────────────────────────────
    const customsDuties = this.calculateDuties(
      declaredValue,
      originCountry,
      destinationCountry,
      hsCommodityCode,
    );

    // ── VAT ───────────────────────────────────────────────────────────────
    const vatBase = declaredValue + shippingCost + customsDuties;
    const vatRate = VAT_RATES[destinationCountry.toUpperCase()] ?? 0.23;
    const vat = vatBase * vatRate;

    // ── Handling / customs clearance ──────────────────────────────────────
    const handlingFee = this.calculateHandling(originCountry, destinationCountry, declaredValue);

    // ── Insurance ─────────────────────────────────────────────────────────
    const insuranceCost = includeInsurance || declaredValue > 500
      ? declaredValue * 0.005
      : 0;

    // ── Totals ────────────────────────────────────────────────────────────
    const totalLandedCost = productCost + shippingCost + customsDuties + vat + handlingFee + insuranceCost;
    const costPerUnit = totalLandedCost / quantity;
    const landingMarkupPct = ((totalLandedCost - productCost) / productCost) * 100;

    const lines: LandedCostLine[] = [
      { label: 'Product cost',     amount: productCost,    basis: `${quantity} × €${unitPrice.toFixed(2)}`,    included: true },
      { label: 'Shipping',         amount: shippingCost,   basis: `${carrier.toUpperCase()} · ${weightKg}kg`,  included: true },
      { label: 'Customs duties',   amount: customsDuties,  basis: hsCommodityCode ? `HS ${hsCommodityCode}` : 'estimated', included: customsDuties > 0 },
      { label: `VAT (${(vatRate * 100).toFixed(0)}%)`,  amount: vat,     basis: destinationCountry,      included: vat > 0 },
      { label: 'Handling / clearance', amount: handlingFee, basis: 'customs processing',                  included: handlingFee > 0 },
      { label: 'Cargo insurance',  amount: insuranceCost,  basis: '0.5% declared value',                    included: insuranceCost > 0 },
    ];

    this.logger.debug(
      `Landed cost: product=${productCost.toFixed(2)} shipping=${shippingCost.toFixed(2)} ` +
      `duties=${customsDuties.toFixed(2)} vat=${vat.toFixed(2)} total=${totalLandedCost.toFixed(2)}`,
    );

    return {
      productCost,
      shippingCost,
      customsDuties,
      vat,
      handlingFee,
      insuranceCost,
      totalLandedCost,
      costPerUnit,
      landingMarkupPct,
      carrier,
      incoterms,
      lines,
      calculatedAt: new Date().toISOString(),
      confidence: 'MEDIUM', // upgrade to HIGH when carrier APIs are connected
    };
  }

  /**
   * Compare multiple suppliers by landed cost — core of the decision engine.
   */
  compareSuppliers(
    suppliers: Array<{ id: string; name: string; costInput: LandedCostInput }>,
  ): Array<{ supplierId: string; supplierName: string; breakdown: LandedCostBreakdown; rank: number }> {
    const results = suppliers.map(({ id, name, costInput }) => ({
      supplierId: id,
      supplierName: name,
      breakdown: this.calculate(costInput),
      rank: 0,
    }));

    // Rank by total landed cost (ascending)
    results.sort((a, b) => a.breakdown.totalLandedCost - b.breakdown.totalLandedCost);
    results.forEach((r, i) => { r.rank = i + 1; });

    return results;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private selectCarrier(preference: string | undefined, weightKg: number): string {
    if (preference && preference !== 'best') return preference;

    // 'best' = cheapest for the weight tier
    if (weightKg <= 2)  return 'gls';    // GLS is cheapest for light parcels
    if (weightKg <= 10) return 'dpd';
    if (weightKg <= 30) return 'dhl';
    return 'dhl';                          // DHL best for heavy/pallet
  }

  private estimateShipping(
    carrier: string,
    weightKg: number,
    originCountry: string,
    destinationCountry: string,
  ): number {
    const rates = CARRIER_BASE_RATES[carrier] ?? CARRIER_BASE_RATES['dpd'];
    const { baseEur, perKgEur, fuelSurcharge } = rates;

    // Cross-border surcharge for non-EU or long-haul
    const crossBorderMultiplier =
      !EU_COUNTRIES.has(originCountry.toUpperCase()) ||
      !EU_COUNTRIES.has(destinationCountry.toUpperCase())
        ? 2.5 : 1.0;

    const base = (baseEur + perKgEur * weightKg) * crossBorderMultiplier;
    const fuel = base * fuelSurcharge;
    return Math.round((base + fuel) * 100) / 100;
  }

  private calculateDuties(
    declaredValue: number,
    originCountry: string,
    destinationCountry: string,
    hsCommodityCode?: string,
  ): number {
    // EU → EU: no duties (free movement)
    if (
      EU_COUNTRIES.has(originCountry.toUpperCase()) &&
      EU_COUNTRIES.has(destinationCountry.toUpperCase())
    ) {
      return 0;
    }

    if (!hsCommodityCode) {
      // No HS code → use 5% default estimate
      return Math.round(declaredValue * 0.05 * 100) / 100;
    }

    const chapter = hsCommodityCode.substring(0, 2);
    const rate = EU_DUTY_RATES[chapter] ?? 0.035; // default 3.5%
    return Math.round(declaredValue * rate * 100) / 100;
  }

  private calculateHandling(
    originCountry: string,
    destinationCountry: string,
    declaredValue: number,
  ): number {
    // EU → EU: minimal handling
    if (
      EU_COUNTRIES.has(originCountry.toUpperCase()) &&
      EU_COUNTRIES.has(destinationCountry.toUpperCase())
    ) {
      return 0;
    }

    // Non-EU imports: customs clearance fee
    if (declaredValue < 150) return 0;         // De minimis — no clearance
    if (declaredValue < 1000) return 25;       // Standard clearance
    if (declaredValue < 5000) return 45;
    return 75;                                   // Complex clearance
  }
}
