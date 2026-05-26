import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LandedCostService, LandedCostInput } from '../logistics/landed-cost.service';
import { ProcurementAccuracyService } from '../intelligence/procurement-accuracy.service';

/**
 * ProcurementDecisionCardService
 *
 * The "one screen, full context" procurement decision surface.
 *
 * Aggregates ALL signals for a quote decision into a single card:
 * - Landed cost (product + shipping + duties + VAT)
 * - Supplier trust score (from historical accuracy)
 * - Budget availability (does this fit within approved budget?)
 * - Delivery feasibility (lead time vs. event/campaign deadline)
 * - Risk assessment (3-level: GREEN / AMBER / RED)
 * - Recommended action with clear reasoning
 *
 * Philosophy: "Everything a procurement manager needs to decide,
 * on one screen, in under 30 seconds."
 */

export interface DecisionCardInput {
  tenantId: string;
  quoteId?: string;

  // Product
  productName: string;
  quantity: number;
  unitPriceEur: number;
  weightKgTotal: number;
  hsCommodityCode?: string;

  // Supplier
  supplierId: string;
  supplierName: string;
  originCountry: string;
  quotedLeadDays: number;

  // Destination
  destinationCountry: string;

  // Budget
  budgetId?: string;
  availableBudgetEur?: number;

  // Timeline
  requiredByDate?: string;  // ISO date

  // Carrier preference
  carrier?: 'dhl' | 'dpd' | 'gls' | 'ups' | 'fedex' | 'best';
}

export interface DecisionCard {
  // Identity
  cardId: string;
  tenantId: string;
  quoteId?: string;
  generatedAt: string;

  // What you're deciding
  summary: string;

  // Cost breakdown (full truth)
  cost: {
    unitPrice: number;
    quantity: number;
    productTotal: number;
    shipping: number;
    duties: number;
    vat: number;
    handling: number;
    insurance: number;
    totalLandedCost: number;
    costPerUnit: number;
    landingMarkupPct: number;
    carrier: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  // Budget signal
  budget: {
    available: number | null;
    required: number;
    withinBudget: boolean;
    utilizationPct: number | null;
    remainingAfter: number | null;
    status: 'OK' | 'TIGHT' | 'OVER' | 'UNKNOWN';
  };

  // Supplier trust signal
  supplier: {
    id: string;
    name: string;
    trustScore: number | null;
    tier: 'GOLD' | 'SILVER' | 'BRONZE' | 'PROBATION' | 'NEW';
    totalOrders: number;
    onTimeDeliveryRate: number | null;
    costAccuracyRate: number | null;
    recommendation: string;
  };

  // Delivery signal
  delivery: {
    quotedLeadDays: number;
    estimatedArrival: string | null;
    requiredByDate: string | null;
    daysBuffer: number | null;
    feasible: boolean;
    status: 'ON_TIME' | 'TIGHT' | 'LATE' | 'UNKNOWN';
  };

  // Overall risk
  risk: {
    level: 'GREEN' | 'AMBER' | 'RED';
    score: number;       // 0-100
    factors: string[];   // human-readable risk factors
  };

  // Decision
  recommendation: {
    action: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REQUEST_REVISION' | 'REJECT';
    label: string;
    reasoning: string;
    conditions?: string[];
    alternatives?: string[];
  };
}

@Injectable()
export class ProcurementDecisionCardService {
  private readonly logger = new Logger(ProcurementDecisionCardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly landedCostService: LandedCostService,
    private readonly accuracyService: ProcurementAccuracyService,
  ) {}

  /**
   * Generate a complete procurement decision card.
   * This is the single API call the frontend makes to render the decision UI.
   */
  async generate(input: DecisionCardInput): Promise<DecisionCard> {
    const cardId = `dc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    this.logger.log(
      `Generating decision card: supplier=${input.supplierName} ` +
      `product=${input.productName} qty=${input.quantity}`,
    );

    // ── Parallel data fetch ───────────────────────────────────────────────
    const [landedCost, supplierProfile] = await Promise.allSettled([
      Promise.resolve(this.landedCostService.calculate({
        unitPrice: input.unitPriceEur,
        quantity: input.quantity,
        weightKg: input.weightKgTotal,
        originCountry: input.originCountry,
        destinationCountry: input.destinationCountry,
        hsCommodityCode: input.hsCommodityCode,
        carrier: input.carrier,
      } satisfies LandedCostInput)),
      this.accuracyService.getSupplierTrustProfile(input.supplierId),
    ]);

    const cost = landedCost.status === 'fulfilled' ? landedCost.value : null;
    const profile = supplierProfile.status === 'fulfilled' ? supplierProfile.value : null;

    const totalRequired = cost?.totalLandedCost ?? input.unitPriceEur * input.quantity;

    // ── Budget signal ─────────────────────────────────────────────────────
    const availableBudget = input.availableBudgetEur ?? null;
    const budgetSection = this.buildBudgetSection(totalRequired, availableBudget);

    // ── Supplier signal ───────────────────────────────────────────────────
    const supplierSection = this.buildSupplierSection(input.supplierId, input.supplierName, profile);

    // ── Delivery signal ───────────────────────────────────────────────────
    const deliverySection = this.buildDeliverySection(
      input.quotedLeadDays,
      input.requiredByDate,
      now,
    );

    // ── Risk assessment ───────────────────────────────────────────────────
    const riskSection = this.buildRiskSection(budgetSection, supplierSection, deliverySection, cost);

    // ── Recommendation ────────────────────────────────────────────────────
    const recommendation = this.buildRecommendation(riskSection, budgetSection, supplierSection, deliverySection);

    const card: DecisionCard = {
      cardId,
      tenantId: input.tenantId,
      quoteId: input.quoteId,
      generatedAt: now.toISOString(),
      summary: `${input.quantity}× ${input.productName} from ${input.supplierName} — €${totalRequired.toFixed(2)} landed`,

      cost: cost ? {
        unitPrice: cost.productCost / input.quantity,
        quantity: input.quantity,
        productTotal: cost.productCost,
        shipping: cost.shippingCost,
        duties: cost.customsDuties,
        vat: cost.vat,
        handling: cost.handlingFee,
        insurance: cost.insuranceCost,
        totalLandedCost: cost.totalLandedCost,
        costPerUnit: cost.costPerUnit,
        landingMarkupPct: cost.landingMarkupPct,
        carrier: cost.carrier,
        confidence: cost.confidence,
      } : {
        unitPrice: input.unitPriceEur,
        quantity: input.quantity,
        productTotal: input.unitPriceEur * input.quantity,
        shipping: 0, duties: 0, vat: 0, handling: 0, insurance: 0,
        totalLandedCost: input.unitPriceEur * input.quantity,
        costPerUnit: input.unitPriceEur,
        landingMarkupPct: 0,
        carrier: 'unknown',
        confidence: 'LOW',
      },

      budget: budgetSection,
      supplier: supplierSection,
      delivery: deliverySection,
      risk: riskSection,
      recommendation,
    };

    this.logger.log(
      `Decision card ${cardId}: risk=${riskSection.level} ` +
      `action=${recommendation.action} total=€${totalRequired.toFixed(2)}`,
    );

    return card;
  }

  // ── Section builders ──────────────────────────────────────────────────────

  private buildBudgetSection(
    required: number,
    available: number | null,
  ): DecisionCard['budget'] {
    if (available === null) {
      return {
        available: null, required, withinBudget: true,
        utilizationPct: null, remainingAfter: null, status: 'UNKNOWN',
      };
    }

    const withinBudget = required <= available;
    const utilizationPct = available > 0 ? (required / available) * 100 : 100;
    const remainingAfter = available - required;

    const status: DecisionCard['budget']['status'] =
      !withinBudget    ? 'OVER' :
      utilizationPct > 90 ? 'TIGHT' : 'OK';

    return { available, required, withinBudget, utilizationPct, remainingAfter, status };
  }

  private buildSupplierSection(
    id: string,
    name: string,
    profile: Awaited<ReturnType<ProcurementAccuracyService['getSupplierTrustProfile']>>,
  ): DecisionCard['supplier'] {
    if (!profile) {
      return {
        id, name, trustScore: null, tier: 'NEW',
        totalOrders: 0, onTimeDeliveryRate: null, costAccuracyRate: null,
        recommendation: 'No order history — apply standard supplier vetting',
      };
    }

    return {
      id,
      name,
      trustScore: profile.trustScore,
      tier: profile.tier,
      totalOrders: profile.totalOrders,
      onTimeDeliveryRate: profile.onTimeDeliveryRate,
      costAccuracyRate: profile.costAccuracyRate,
      recommendation: profile.recommendation,
    };
  }

  private buildDeliverySection(
    quotedLeadDays: number,
    requiredByDate: string | undefined,
    now: Date,
  ): DecisionCard['delivery'] {
    const estimatedArrival = new Date(now.getTime() + quotedLeadDays * 86_400_000).toISOString().split('T')[0];

    if (!requiredByDate) {
      return {
        quotedLeadDays, estimatedArrival,
        requiredByDate: null, daysBuffer: null,
        feasible: true, status: 'UNKNOWN',
      };
    }

    const required = new Date(requiredByDate);
    const estimated = new Date(estimatedArrival);
    const daysBuffer = Math.floor((required.getTime() - estimated.getTime()) / 86_400_000);
    const feasible = daysBuffer >= 0;

    const status: DecisionCard['delivery']['status'] =
      daysBuffer < 0     ? 'LATE' :
      daysBuffer <= 3    ? 'TIGHT' : 'ON_TIME';

    return {
      quotedLeadDays, estimatedArrival,
      requiredByDate, daysBuffer, feasible, status,
    };
  }

  private buildRiskSection(
    budget: DecisionCard['budget'],
    supplier: DecisionCard['supplier'],
    delivery: DecisionCard['delivery'],
    cost: ReturnType<LandedCostService['calculate']> | null,
  ): DecisionCard['risk'] {
    const factors: string[] = [];
    let score = 0;

    // Budget risk
    if (budget.status === 'OVER')  { score += 40; factors.push('Over budget'); }
    if (budget.status === 'TIGHT') { score += 15; factors.push('Budget utilisation >90%'); }

    // Supplier risk
    if (supplier.tier === 'PROBATION') { score += 35; factors.push('Supplier on probation'); }
    if (supplier.tier === 'NEW')       { score += 20; factors.push('New supplier — no history'); }
    if (supplier.tier === 'BRONZE')    { score += 10; factors.push('Supplier trust: BRONZE'); }
    if (supplier.onTimeDeliveryRate !== null && supplier.onTimeDeliveryRate < 70) {
      score += 15; factors.push(`Low on-time rate: ${supplier.onTimeDeliveryRate}%`);
    }

    // Delivery risk
    if (delivery.status === 'LATE')  { score += 35; factors.push(`Arrives ${Math.abs(delivery.daysBuffer ?? 0)} days late`); }
    if (delivery.status === 'TIGHT') { score += 15; factors.push('Tight delivery window (≤3 days buffer)'); }

    // Cost confidence risk
    if (cost?.confidence === 'LOW') { score += 10; factors.push('Landed cost estimate low confidence'); }

    // Landing markup risk (>20% markup is high)
    if (cost && cost.landingMarkupPct > 20) {
      score += 10; factors.push(`High landing markup: ${cost.landingMarkupPct.toFixed(0)}%`);
    }

    const capped = Math.min(100, score);
    const level: DecisionCard['risk']['level'] =
      capped >= 60 ? 'RED' :
      capped >= 30 ? 'AMBER' : 'GREEN';

    return { level, score: capped, factors };
  }

  private buildRecommendation(
    risk: DecisionCard['risk'],
    budget: DecisionCard['budget'],
    supplier: DecisionCard['supplier'],
    delivery: DecisionCard['delivery'],
  ): DecisionCard['recommendation'] {
    if (risk.level === 'RED') {
      const conditions: string[] = [];
      const alternatives: string[] = [];

      if (budget.status === 'OVER') alternatives.push('Request additional budget approval');
      if (supplier.tier === 'PROBATION') alternatives.push('Source from an alternative supplier');
      if (delivery.status === 'LATE') alternatives.push('Negotiate expedited shipping or adjust deadline');

      return {
        action: 'REJECT',
        label: 'Do not proceed',
        reasoning: `High risk (${risk.score}/100): ${risk.factors.join('; ')}`,
        alternatives,
      };
    }

    if (risk.level === 'AMBER') {
      const conditions: string[] = [];
      if (budget.status === 'TIGHT') conditions.push('Confirm budget holder approval');
      if (supplier.tier === 'NEW' || supplier.tier === 'BRONZE') conditions.push('Request supplier references or quality certificate');
      if (delivery.status === 'TIGHT') conditions.push('Confirm delivery window in writing with supplier');

      return {
        action: 'APPROVE_WITH_CONDITIONS',
        label: 'Approve with conditions',
        reasoning: `Moderate risk (${risk.score}/100): ${risk.factors.join('; ')}`,
        conditions,
      };
    }

    // GREEN
    return {
      action: 'APPROVE',
      label: 'Approve',
      reasoning: risk.factors.length === 0
        ? 'All signals green — proceed with confidence'
        : `Low risk (${risk.score}/100): ${risk.factors.join('; ')} — acceptable`,
    };
  }
}
