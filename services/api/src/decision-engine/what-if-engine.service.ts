import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementSimulatorService, SimulationInput, SimulationResult } from './procurement-simulator.service';

export interface ScenarioVariant {
  type: 'base' | 'supplier_change' | 'route_change' | 'quantity_bulk' | 'quantity_reduced' | 'sla_premium' | 'sla_economy';
  label: string;
  description: string;
  input: SimulationInput;
}

export interface ScenarioResult {
  type: string;
  label: string;
  description: string;
  result: SimulationResult;
  // Deltas vs base
  marginDeltaEur: number;
  marginDeltaPct: number;
  costDeltaEur: number;
  deliveryDeltaDays: number;
  riskDelta: number;
  // Recommendation
  isOptimal: boolean;
  recommendation: string;
}

export interface WhatIfMatrix {
  base: ScenarioResult;
  scenarios: ScenarioResult[];
  optimal: ScenarioResult;
  summary: string;
  runId: string;
}

export interface WhatIfInput {
  productCost: number;
  salePrice: number;
  quantity: number;
  originCountry: string;
  destinationCountry: string;
  weightKg: number;
  supplierName?: string;
  category?: string;
  decisionCardId?: string;
  tenantId?: string;
}

@Injectable()
export class WhatIfEngineService {
  private get db(): any { return this.prisma; }

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: ProcurementSimulatorService,
  ) {}

  async generateMatrix(input: WhatIfInput): Promise<WhatIfMatrix> {
    const base: SimulationInput = {
      productCost: input.productCost,
      quantity: input.quantity,
      targetPrice: input.salePrice,
      originCountry: input.originCountry,
      destinationCountry: input.destinationCountry,
      weightKg: input.weightKg,
      supplierName: input.supplierName,
      category: input.category,
    };

    // Build scenario variants
    const variants: ScenarioVariant[] = [
      // Supplier change: switch to a lower-cost alternative
      {
        type: 'supplier_change',
        label: 'Switch Supplier',
        description: 'Switch to alternative supplier with -8% product cost',
        input: { ...base, productCost: base.productCost * 0.92, supplierName: 'ALT-SUPPLIER' },
      },
      // Route optimization: change origin (e.g., switch from CN to PL for EU delivery)
      {
        type: 'route_change',
        label: 'Optimize Route',
        description: 'Use regional supplier (PL origin) to reduce shipping',
        input: { ...base, originCountry: base.destinationCountry === 'PT' || base.destinationCountry === 'ES' ? 'PL' : 'NL', weightKg: base.weightKg },
      },
      // Quantity bulk: order 2x for volume discount
      {
        type: 'quantity_bulk',
        label: 'Bulk Order (+50%)',
        description: 'Increase quantity 50% for volume discount (-12% unit cost)',
        input: { ...base, quantity: Math.round(base.quantity * 1.5), productCost: base.productCost * 0.88 },
      },
      // Quantity reduced: lower risk with smaller batch
      {
        type: 'quantity_reduced',
        label: 'Reduced Batch (-30%)',
        description: 'Reduce quantity 30% to lower financial risk',
        input: { ...base, quantity: Math.round(base.quantity * 0.7) },
      },
      // SLA premium: faster delivery, higher cost
      {
        type: 'sla_premium',
        label: 'Premium SLA (2-day)',
        description: 'Priority shipping for faster delivery (+35% shipping)',
        input: { ...base, weightKg: base.weightKg * 1.35 }, // proxy: higher weight = premium shipping
      },
      // SLA economy: slower, cheaper
      {
        type: 'sla_economy',
        label: 'Economy SLA (12-day)',
        description: 'Economy shipping for maximum cost savings (-25% shipping)',
        input: { ...base, weightKg: base.weightKg * 0.75 }, // proxy: lower weight = economy shipping
      },
    ];

    // Run base + all variants in parallel
    const [baseResult, ...variantResults] = await Promise.all([
      this.simulator.simulate(base),
      ...variants.map((v) => this.simulator.simulate(v.input)),
    ]);

    const toScenarioResult = (
      variant: ScenarioVariant | null,
      result: SimulationResult,
      isBase = false,
    ): ScenarioResult => {
      const marginDeltaEur = isBase ? 0 : result.finalMarginEur - baseResult.finalMarginEur;
      const marginDeltaPct = isBase ? 0 : result.finalMarginPct - baseResult.finalMarginPct;
      const costDeltaEur = isBase ? 0 : result.finalTotalCost - baseResult.finalTotalCost;
      const deliveryDeltaDays = isBase ? 0 : result.shippingDays - baseResult.shippingDays;
      const riskDelta = isBase ? 0 : result.compositeRiskScore - baseResult.compositeRiskScore;

      let recommendation = 'Base scenario';
      if (!isBase && variant) {
        if (marginDeltaEur > 0 && riskDelta <= 0) recommendation = `+€${marginDeltaEur.toFixed(0)} margin, lower risk`;
        else if (marginDeltaEur > 0) recommendation = `+€${marginDeltaEur.toFixed(0)} margin, +${riskDelta.toFixed(0)} risk`;
        else if (costDeltaEur < 0) recommendation = `€${Math.abs(costDeltaEur).toFixed(0)} cost savings`;
        else if (deliveryDeltaDays < 0) recommendation = `${Math.abs(deliveryDeltaDays)}d faster delivery`;
        else recommendation = `${marginDeltaEur >= 0 ? '+' : ''}€${marginDeltaEur.toFixed(0)} margin impact`;
      }

      return {
        type: variant?.type ?? 'base',
        label: variant?.label ?? 'Base Scenario',
        description: variant?.description ?? 'Current procurement parameters',
        result,
        marginDeltaEur,
        marginDeltaPct,
        costDeltaEur,
        deliveryDeltaDays,
        riskDelta,
        isOptimal: false,
        recommendation,
      };
    };

    const baseScenario = toScenarioResult(null, baseResult, true);
    const scenarioResults = variants.map((v, i) => toScenarioResult(v, variantResults[i], false));

    // Find optimal: maximize margin improvement with acceptable risk delta (< +10)
    let optimal = baseScenario;
    for (const s of scenarioResults) {
      const currentBestDelta = optimal.type === 'base' ? 0 : optimal.marginDeltaEur;
      if (s.marginDeltaEur > currentBestDelta && s.riskDelta < 15) {
        optimal = s;
      }
    }
    optimal.isOptimal = true;

    const maxSavingsEur = Math.max(...scenarioResults.map((s) => s.marginDeltaEur), 0);
    const summary = optimal.type === 'base'
      ? 'Base scenario is optimal — no alternative improves margin without increasing risk beyond threshold.'
      : `${optimal.label} is optimal: ${optimal.recommendation}. Maximum additional margin: €${maxSavingsEur.toFixed(0)}.`;

    // Persist the run
    const run = await this.db.whatIfScenarioRun.create({
      data: {
        tenantId: input.tenantId ?? 'default',
        decisionCardId: input.decisionCardId ?? null,
        baseProductCost: input.productCost,
        baseSalePrice: input.salePrice,
        baseQuantity: input.quantity,
        baseOrigin: input.originCountry,
        baseDestination: input.destinationCountry,
        baseWeightKg: input.weightKg,
        baseSupplierName: input.supplierName ?? null,
        baseMarginEur: baseResult.finalMarginEur,
        baseMarginPct: baseResult.finalMarginPct,
        baseShippingCost: baseResult.shippingCost,
        baseRiskScore: baseResult.compositeRiskScore,
        baseDeliveryDays: baseResult.shippingDays,
        scenarios: scenarioResults as unknown as object,
        optimalScenario: optimal.type,
        optimalReasoning: summary,
        maxSavingsEur,
      },
    });

    return {
      base: baseScenario,
      scenarios: scenarioResults,
      optimal,
      summary,
      runId: run.id,
    };
  }

  async getRecentRuns(tenantId?: string, limit = 10): Promise<any[]> {
    return this.db.whatIfScenarioRun.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRun(id: string): Promise<any> {
    return this.db.whatIfScenarioRun.findUnique({ where: { id } });
  }
}
