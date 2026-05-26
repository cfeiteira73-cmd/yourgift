import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BriefParserService } from './brief-parser.service';
import { ProcurementBrief, ProcurementPlan } from '@prisma/client';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SuggestedProduct {
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  supplierId: string;
  supplierName: string;
  estimatedProductionDays: number;
}

export interface RiskFactor {
  factor: string;
  impact: string;
  mitigation: string;
}

export interface ProcurementPlanResult {
  briefId: string;
  planId: string;
  recommendedSupplier: string;
  fallbackSupplier: string | null;
  routingConfidence: number;
  routingReason: string;
  suggestedProducts: SuggestedProduct[];
  unitCost: number;
  quantity: number;
  totalProductCost: number;
  estimatedShipping: number;
  printCost: number;
  platformFee: number;
  totalCost: number;
  salePriceRecommended: number;
  expectedMarginPct: number;
  productionDays: number;
  shippingDays: number;
  totalDays: number;
  deliveryDateEstimate: Date;
  meetsDeadline: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  confidenceScore: number;
  aiReasoning: string;
  aiRecommendations: string[];
  aiWarnings: string[];
}

// ─── Product catalog ─────────────────────────────────────────────────────────

interface CatalogItem {
  name: string;
  unitPrice: number;
  productionDays: number;
}

const PRODUCT_CATALOG: Record<string, CatalogItem[]> = {
  bags: [
    { name: 'Premium Tote Bag', unitPrice: 12.5, productionDays: 7 },
    { name: 'Branded Backpack', unitPrice: 28.0, productionDays: 10 },
  ],
  stationery: [
    { name: 'Branded Notebook A5', unitPrice: 6.5, productionDays: 5 },
    { name: 'Executive Pen Set', unitPrice: 14.0, productionDays: 5 },
  ],
  drinkware: [
    { name: 'Insulated Water Bottle 500ml', unitPrice: 18.0, productionDays: 7 },
    { name: 'Coffee Travel Mug', unitPrice: 15.0, productionDays: 6 },
  ],
  apparel: [
    { name: 'Organic Cotton Polo', unitPrice: 22.0, productionDays: 12 },
    { name: 'Branded Jacket', unitPrice: 45.0, productionDays: 14 },
  ],
  tech: [
    { name: 'Wireless Charging Pad', unitPrice: 24.0, productionDays: 8 },
    { name: 'USB-C Hub', unitPrice: 32.0, productionDays: 7 },
  ],
  kits: [
    { name: 'Welcome Onboarding Kit', unitPrice: 45.0, productionDays: 10 },
    { name: 'Starter Work Pack', unitPrice: 38.0, productionDays: 9 },
  ],
  premium_gifts: [
    { name: 'Premium Gift Box Set', unitPrice: 75.0, productionDays: 12 },
    { name: 'Luxury Corporate Kit', unitPrice: 120.0, productionDays: 14 },
  ],
  general: [
    { name: 'Branded Tote Bag', unitPrice: 10.0, productionDays: 7 },
    { name: 'Promotional Notebook', unitPrice: 5.5, productionDays: 5 },
  ],
};

// ─── International/customs destinations ──────────────────────────────────────

const CUSTOMS_REQUIRED = new Set(['GB', 'UK', 'US', 'USA', 'AE', 'UAE', 'Dubai']);

@Injectable()
export class ProcurementAgentService {
  private readonly logger = new Logger(ProcurementAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: BriefParserService,
    private readonly events: EventBusService,
  ) {}

  // ── processBrief ────────────────────────────────────────────────────────────

  async processBrief(description: string, tenantId = 'default'): Promise<ProcurementBrief> {
    const parsed = this.parser.parse(description);

    const brief = await this.prisma.procurementBrief.create({
      data: {
        tenantId,
        description,
        parsedQuantity: parsed.quantity ?? undefined,
        parsedBudgetEur: parsed.budgetEur ?? undefined,
        parsedDestination: parsed.destination ?? undefined,
        parsedTimelineDays: parsed.timelineDays ?? undefined,
        parsedUrgency: parsed.urgency,
        parsedCategory: parsed.category ?? undefined,
        parsedKeywords: parsed.keywords,
        status: 'processing',
      },
    });

    // Fire-and-forget — plan generates asynchronously
    void this.generatePlan(brief.id).catch((err: unknown) => {
      this.logger.error(`generatePlan failed for brief ${brief.id}`, err);
    });

    return brief;
  }

  // ── generatePlan ────────────────────────────────────────────────────────────

  async generatePlan(briefId: string): Promise<ProcurementPlanResult> {
    try {
      // Step 1: Load brief
      const brief = await this.prisma.procurementBrief.findUnique({
        where: { id: briefId },
      });
      if (!brief) throw new NotFoundException(`Brief ${briefId} not found`);

      const parsed = this.parser.parse(brief.description);
      const quantity = parsed.quantity ?? 50;
      const keywords = parsed.keywords;

      // Step 2: Supplier selection from routing matrix
      const categoryFilter = parsed.category
        ? { OR: [{ category: parsed.category }, { category: 'all' }] }
        : {};

      const suppliers = await this.prisma.supplierRoutingMatrix.findMany({
        where: {
          isActive: true,
          ...categoryFilter,
        },
        orderBy: { reliabilityScore: 'desc' },
      });

      // Compute composite score
      type ScoredSupplier = {
        supplierId: string;
        supplierName: string;
        composite: number;
        leadTimeDays: number;
      };

      const scored: ScoredSupplier[] = suppliers.map((s) => ({
        supplierId: s.supplierId,
        supplierName: s.supplierName,
        leadTimeDays: s.leadTimeDays,
        composite:
          Number(s.reliabilityScore) * 0.4 +
          Number(s.priceScore) * 0.35 +
          (100 - Math.min(s.leadTimeDays * 3, 100)) * 0.25,
      }));

      scored.sort((a, b) => b.composite - a.composite);

      // Check regional routing rules for destination
      let preferredSuppliers: string[] = [];
      if (parsed.destination) {
        const regionalRule = await this.prisma.regionalRoutingRule.findFirst({
          where: {
            isActive: true,
            countryCodes: { has: parsed.destination },
          },
        });
        if (regionalRule) {
          preferredSuppliers = regionalRule.preferredSuppliers;
        }
      }

      // Pick best supplier (prefer regional if available)
      let primary: ScoredSupplier | undefined;
      let fallback: ScoredSupplier | undefined;

      if (preferredSuppliers.length > 0) {
        primary = scored.find((s) => preferredSuppliers.includes(s.supplierId));
      }
      if (!primary) {
        primary = scored[0];
      }
      fallback = scored.find((s) => s.supplierId !== primary?.supplierId);

      const recommendedSupplier = primary?.supplierName ?? 'Midocean';
      const fallbackSupplier = fallback?.supplierName ?? null;
      const routingConfidence = primary
        ? Math.min(95, Math.round(primary.composite))
        : 75;

      const routingReason = primary
        ? `${recommendedSupplier} selected for superior reliability (${routingConfidence}% confidence). Composite score based on reliability, pricing competitiveness, and lead time for ${parsed.category ?? 'general'} category.`
        : `Default supplier selected based on platform routing rules.`;

      // Step 3: Product suggestions
      const catalogKey = parsed.category ?? 'general';
      const catalogItems: CatalogItem[] =
        PRODUCT_CATALOG[catalogKey] ??
        PRODUCT_CATALOG['general'] ??
        [];

      let selectedItems = catalogItems.slice(0, 2).map((item) => ({ ...item }));

      // Apply keyword multipliers
      const isLuxury = keywords.includes('luxury');
      const isEco = keywords.includes('eco');
      if (isLuxury) {
        selectedItems = selectedItems.map((item) => ({
          ...item,
          unitPrice: Math.round(item.unitPrice * 1.8 * 100) / 100,
        }));
      }
      if (isEco) {
        selectedItems = selectedItems.map((item) => ({
          ...item,
          unitPrice: Math.round(item.unitPrice * 1.3 * 100) / 100,
        }));
      }

      // Budget check: if budget known, try to fit within budget per person
      if (parsed.budgetEur && parsed.quantity) {
        const budgetPerPerson = parsed.budgetEur / parsed.quantity;
        selectedItems = selectedItems.map((item) => {
          if (item.unitPrice > budgetPerPerson * 0.9) {
            return { ...item, unitPrice: Math.round(budgetPerPerson * 0.85 * 100) / 100 };
          }
          return item;
        });
      }

      const suggestedProducts: SuggestedProduct[] = selectedItems.map((item) => ({
        name: item.name,
        category: catalogKey,
        unitPrice: item.unitPrice,
        quantity,
        supplierId: primary?.supplierId ?? 'midocean',
        supplierName: recommendedSupplier,
        estimatedProductionDays: item.productionDays,
      }));

      // Step 4: Financial calculation
      const primaryProduct = selectedItems[0] ?? { unitPrice: 10, productionDays: 7 };
      const unitCost = primaryProduct.unitPrice;
      const totalProductCost = Math.round(unitCost * quantity * 100) / 100;
      const printCost = Math.round(quantity * 2.5 * 100) / 100;

      // Shipping zone
      const destination = parsed.destination ?? '';
      const isInternational =
        CUSTOMS_REQUIRED.has(destination) ||
        (!destination.match(/portugal|spain|germany|france|italy|netherlands|poland/i) &&
          destination !== '');

      let estimatedShipping: number;
      if (isInternational) {
        estimatedShipping = Math.min(quantity * 2.5, 500);
      } else {
        estimatedShipping = Math.min(quantity * 0.8, 150);
      }
      estimatedShipping = Math.round(estimatedShipping * 100) / 100;

      const platformFee = Math.round(totalProductCost * 0.08 * 100) / 100;
      const totalCost = Math.round((totalProductCost + printCost + estimatedShipping + platformFee) * 100) / 100;
      const salePriceRecommended = Math.round((totalCost / 0.78) * 100) / 100;
      const expectedMarginPct =
        Math.round(((salePriceRecommended - totalCost) / salePriceRecommended) * 100 * 100) / 100;

      // Step 5: Timeline
      const productionDays = primaryProduct.productionDays;

      let shippingDays: number;
      if (parsed.urgency === 'critical' || parsed.urgency === 'high') {
        shippingDays = 2;
      } else if (isInternational) {
        shippingDays = 7;
      } else if (destination.match(/uk|gb/i)) {
        shippingDays = 4;
      } else {
        shippingDays = 3;
      }

      const totalDays = productionDays + shippingDays;
      const deliveryDateEstimate = new Date();
      deliveryDateEstimate.setDate(deliveryDateEstimate.getDate() + totalDays);

      const meetsDeadline = parsed.timelineDays != null ? totalDays <= parsed.timelineDays : true;

      // Step 6: Risk assessment
      const riskFactors: RiskFactor[] = [];

      if (parsed.timelineDays != null && totalDays > parsed.timelineDays) {
        riskFactors.push({
          factor: 'Timeline Risk',
          impact: `Estimated ${totalDays} days exceeds requested ${parsed.timelineDays} days`,
          mitigation: 'Use express shipping to reduce transit time by 2-3 days',
        });
      }

      if (expectedMarginPct < 15) {
        riskFactors.push({
          factor: 'Margin Risk',
          impact: `Expected margin ${expectedMarginPct.toFixed(1)}% is below 15% target`,
          mitigation: 'Increase recommended sale price or negotiate supplier discount for volume',
        });
      }

      if (CUSTOMS_REQUIRED.has(destination)) {
        riskFactors.push({
          factor: 'Customs Risk',
          impact: 'International shipment may add 2-3 business days for customs clearance',
          mitigation: 'DHL Express recommended with pre-clearance documentation',
        });
      }

      if (quantity > 500 && productionDays > 10) {
        riskFactors.push({
          factor: 'Volume Risk',
          impact: 'Large quantity with long production may strain supplier capacity',
          mitigation: 'Split order across 2 suppliers to ensure on-time delivery',
        });
      }

      const riskLevel: 'low' | 'medium' | 'high' =
        riskFactors.length === 0 ? 'low' : riskFactors.length <= 2 ? 'medium' : 'high';

      let confidenceScore = 85;
      confidenceScore -= riskFactors.length * 5;
      if (!parsed.category) confidenceScore -= 10;
      if (!parsed.budgetEur) confidenceScore -= 10;
      confidenceScore = Math.max(30, confidenceScore);

      // Step 7: AI narrative
      const categoryLabel = parsed.category ? parsed.category.replace('_', ' ') : 'general goods';
      const aiReasoning =
        `Based on your procurement brief for ${quantity} recipients${parsed.destination ? ` in ${parsed.destination}` : ''}, ` +
        `we selected ${recommendedSupplier} as the primary supplier for ${categoryLabel}. ` +
        (keywords.includes('luxury') ? 'Premium pricing has been applied to reflect the luxury positioning. ' : '') +
        (keywords.includes('eco') ? 'Eco-friendly sourcing premium has been factored in. ' : '') +
        `The recommended product is "${suggestedProducts[0]?.name ?? 'branded merchandise'}" at €${unitCost.toFixed(2)}/unit. ` +
        `Total procurement cost is €${totalCost.toFixed(2)} with a recommended sale price of €${salePriceRecommended.toFixed(2)}, ` +
        `targeting a ${expectedMarginPct.toFixed(1)}% gross margin. ` +
        `Estimated delivery in ${totalDays} days (${productionDays}d production + ${shippingDays}d shipping).` +
        (fallbackSupplier ? ` ${fallbackSupplier} is available as a fallback.` : '');

      const aiRecommendations: string[] = [
        `Request volume discount from ${recommendedSupplier} for orders over 100 units`,
        `Add branded packaging (+€1.50/unit) to enhance unboxing experience`,
        parsed.budgetEur
          ? `Budget utilization: ${Math.round((totalCost / parsed.budgetEur) * 100)}% — ${totalCost < parsed.budgetEur ? 'within budget with room for upgrades' : 'slightly over — consider simplifying packaging'}`
          : 'Provide budget estimate to optimize product selection',
      ];

      if (keywords.includes('onboarding') || keywords.includes('welcome')) {
        aiRecommendations.push('Consider adding a personalized welcome card (+€0.50/unit) for onboarding kits');
      }

      const aiWarnings: string[] = [];
      if (!meetsDeadline && parsed.timelineDays) {
        aiWarnings.push(
          `Standard production + shipping (${totalDays} days) exceeds your ${parsed.timelineDays}-day deadline. Express options required.`,
        );
      }
      if (!parsed.quantity) {
        aiWarnings.push('Quantity not specified — estimate based on typical order. Confirm headcount for accurate pricing.');
      }
      if (!parsed.destination) {
        aiWarnings.push('Destination not detected — shipping costs estimated for EU domestic. Update if shipping internationally.');
      }

      // Step 8: Save to DB
      const plan = await this.prisma.procurementPlan.create({
        data: {
          briefId,
          tenantId: brief.tenantId,
          recommendedSupplier,
          fallbackSupplier,
          routingConfidence,
          routingReason,
          suggestedProducts: suggestedProducts as unknown as object,
          unitCost,
          quantity,
          totalProductCost,
          estimatedShipping,
          printCost,
          platformFee,
          totalCost,
          salePriceRecommended,
          expectedMarginPct,
          productionDays,
          shippingDays,
          totalDays,
          deliveryDateEstimate,
          meetsDeadline,
          riskLevel,
          riskFactors: riskFactors as unknown as object,
          confidenceScore,
          aiReasoning,
          aiRecommendations,
          aiWarnings,
          isApproved: false,
        },
      });

      await this.prisma.procurementBrief.update({
        where: { id: briefId },
        data: { status: 'planned' },
      });

      this.events.emit('procurement.plan.generated', { briefId, planId: plan.id });

      return {
        briefId,
        planId: plan.id,
        recommendedSupplier,
        fallbackSupplier,
        routingConfidence,
        routingReason,
        suggestedProducts,
        unitCost,
        quantity,
        totalProductCost,
        estimatedShipping,
        printCost,
        platformFee,
        totalCost,
        salePriceRecommended,
        expectedMarginPct,
        productionDays,
        shippingDays,
        totalDays,
        deliveryDateEstimate,
        meetsDeadline,
        riskLevel,
        riskFactors,
        confidenceScore,
        aiReasoning,
        aiRecommendations,
        aiWarnings,
      };
    } catch (err) {
      this.logger.error(`generatePlan error for brief ${briefId}`, err);
      await this.prisma.procurementBrief.update({
        where: { id: briefId },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  // ── getBriefWithPlan ─────────────────────────────────────────────────────────

  async getBriefWithPlan(
    briefId: string,
  ): Promise<ProcurementBrief & { plan: ProcurementPlan | null }> {
    const brief = await this.prisma.procurementBrief.findUnique({
      where: { id: briefId },
      include: { plan: true },
    });
    if (!brief) throw new NotFoundException(`Brief ${briefId} not found`);
    return brief;
  }

  // ── listBriefs ───────────────────────────────────────────────────────────────

  async listBriefs(
    tenantId = 'default',
    limit = 20,
  ): Promise<Array<ProcurementBrief & { plan: ProcurementPlan | null }>> {
    return this.prisma.procurementBrief.findMany({
      where: { tenantId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── approvePlan ──────────────────────────────────────────────────────────────

  async approvePlan(planId: string, approvedBy: string): Promise<void> {
    const plan = await this.prisma.procurementPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    await this.prisma.procurementPlan.update({
      where: { id: planId },
      data: {
        isApproved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    await this.prisma.procurementBrief.update({
      where: { id: plan.briefId },
      data: { status: 'approved' },
    });

    this.events.emit('procurement.plan.approved', { planId, briefId: plan.briefId, approvedBy });
  }
}
