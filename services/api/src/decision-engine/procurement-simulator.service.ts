import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogisticsService } from '../logistics/logistics.service';
import { MarginProtectionService } from '../margin-protection/margin-protection.service';
import { RoutingService } from '../automation/routing.service';

// Local type mirror — Prisma client will be regenerated after migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimulationRun = any;

export interface SimulationInput {
  productCost: number;
  quantity: number;
  targetPrice: number;
  originCountry: string;
  destinationCountry: string;
  weightKg: number;
  supplierName?: string;
  category?: string;
  contextType?: string;
  contextId?: string;
}

export interface SimulationResult {
  // Inputs echoed
  productCost: number;
  quantity: number;
  targetPrice: number;
  // Shipping
  shippingCost: number;
  shippingProvider: string;
  shippingDays: number;
  // Cost breakdown
  printCost: number;
  platformFee: number;
  finalTotalCost: number;
  // Margin
  finalMarginEur: number;
  finalMarginPct: number;
  // Risk scores (0–100, higher = worse)
  deliveryRiskScore: number;
  supplierRiskScore: number;
  financialRiskScore: number;
  compositeRiskScore: number;
  failureProbability: number;
  // Decision
  recommendedAction: string;
  confidenceScore: number;
  simulationNotes: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

@Injectable()
export class ProcurementSimulatorService {
  // Cast to any so Sprint-14 models are accessible before prisma generate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.prisma;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly logistics: LogisticsService,
    private readonly margin: MarginProtectionService,
    private readonly routing: RoutingService,
  ) {}

  async simulate(input: SimulationInput): Promise<SimulationResult> {
    const notes: string[] = [];

    // 1. Get shipping cost (use cheapest option)
    let shippingCost = 0;
    let shippingProvider = 'unknown';
    let shippingDays = 7;
    try {
      const shipping = await this.logistics.estimateShipping({
        originCountry: input.originCountry,
        destinationCountry: input.destinationCountry,
        weightKg: input.weightKg,
      });
      const cheapest = shipping.cheapest;
      shippingCost = cheapest.totalCost;
      shippingProvider = cheapest.provider;
      shippingDays = cheapest.transitDaysMax;
    } catch {
      shippingCost = input.quantity * 1.5; // fallback: €1.50/unit
      notes.push('Shipping estimated (no zone data for route)');
    }

    // 2. Compute P&L
    const printCost = input.quantity * 2.5;
    const plResult = this.margin.simulatePL({
      salePrice: input.targetPrice,
      productCost: input.productCost,
      shippingCost,
      printCost,
      platformFeePct: 8,
      fulfillmentPct: 12,
      quantity: input.quantity,
    });

    // 3. Compute risk scores
    // Delivery risk: based on transit days and whether customs required
    const deliveryRiskScore = Math.min(
      100,
      shippingDays * 8 +
        (input.destinationCountry === 'US' || input.destinationCountry === 'GB' ? 20 : 0),
    );

    // Supplier risk: from routing matrix reliability score
    let supplierRiskScore = 30; // default medium
    try {
      const matrix = await this.routing.getRoutingMatrix();
      const supplier = input.supplierName
        ? matrix.find(
            (s: { supplierName: string }) =>
              s.supplierName?.toLowerCase() === input.supplierName?.toLowerCase(),
          )
        : matrix[0];
      if (supplier) {
        supplierRiskScore = Math.max(0, 100 - Number(supplier.reliabilityScore));
      }
    } catch {
      /* ignore */
    }

    // Financial risk: based on margin
    const financialRiskScore =
      plResult.netMarginPct < 8
        ? 90
        : plResult.netMarginPct < 15
          ? 60
          : plResult.netMarginPct < 20
            ? 30
            : 10;

    // Composite risk: weighted average
    const compositeRiskScore =
      deliveryRiskScore * 0.3 + supplierRiskScore * 0.35 + financialRiskScore * 0.35;
    const failureProbability = Math.min(95, compositeRiskScore * 0.8);

    // 4. Risk classification
    const riskLevel: 'low' | 'medium' | 'high' =
      compositeRiskScore < 30 ? 'low' : compositeRiskScore < 60 ? 'medium' : 'high';

    // 5. Recommended action
    let recommendedAction = 'Proceed with current configuration';
    if (plResult.netMarginPct < 10) {
      recommendedAction = 'Increase sale price or reduce product cost — margin critical';
      notes.push(`Net margin ${plResult.netMarginPct.toFixed(1)}% is below 10% floor`);
    } else if (shippingDays > 10) {
      recommendedAction = 'Consider express shipping — delivery risk elevated';
      notes.push(`${shippingDays} transit days exceeds standard SLA`);
    } else if (supplierRiskScore > 60) {
      recommendedAction = 'Activate fallback supplier — reliability concerns detected';
    }

    // 6. Confidence score
    const confidenceScore = Math.max(20, 100 - compositeRiskScore * 0.5);

    // 7. Save simulation to DB
    await this.db.simulationRun.create({
      data: {
        contextType: input.contextType ?? 'manual',
        contextId: input.contextId ?? null,
        productCost: input.productCost,
        quantity: input.quantity,
        originCountry: input.originCountry,
        destinationCountry: input.destinationCountry,
        weightKg: input.weightKg,
        targetPrice: input.targetPrice,
        supplierName: input.supplierName ?? null,
        category: input.category ?? null,
        shippingCost,
        shippingProvider,
        shippingDays,
        printCost,
        platformFee: plResult.platformFee,
        finalTotalCost: plResult.totalCost,
        finalMarginEur: plResult.netMargin,
        finalMarginPct: plResult.netMarginPct,
        deliveryRiskScore,
        supplierRiskScore,
        financialRiskScore,
        compositeRiskScore,
        failureProbability,
        recommendedAction,
        confidenceScore,
        simulationNotes: notes,
      },
    });

    return {
      productCost: input.productCost,
      quantity: input.quantity,
      targetPrice: input.targetPrice,
      shippingCost,
      shippingProvider,
      shippingDays,
      printCost,
      platformFee: plResult.platformFee,
      finalTotalCost: plResult.totalCost,
      finalMarginEur: plResult.netMargin,
      finalMarginPct: plResult.netMarginPct,
      deliveryRiskScore,
      supplierRiskScore,
      financialRiskScore,
      compositeRiskScore,
      failureProbability,
      recommendedAction,
      confidenceScore,
      simulationNotes: notes,
      riskLevel,
    };
  }

  // Get recent simulation runs
  async getRecentSimulations(limit = 20): Promise<SimulationRun[]> {
    return this.db.simulationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
