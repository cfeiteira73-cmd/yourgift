import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ROIInput {
  annualProcurementSpendEur: number;
  supplierCount: number;
  manualProcessHoursPerWeek: number;
  primaryCategory?: string;
  region?: string;
  currentAvgMarginPct?: number;
}

export interface ROIProjection {
  // Input echo
  input: ROIInput;

  // 12-month projections
  projectedSavings: {
    routingOptimizationEur: number;     // 4% of spend via supplier routing
    marginProtectionEur: number;         // 2.5% via margin floor enforcement
    avoidedCostsEur: number;             // 3% in avoided errors/delays
    timeAutomationValueEur: number;      // 65% automation at €75/hr
    totalProjected12mEur: number;
  };

  // Platform tiers
  tiers: Array<{
    name: string;
    mode: string;
    monthlyPriceEur: number;
    annualCostEur: number;
    projectedAnnualValueEur: number;
    netROIEur: number;
    roiMultiple: number;
    paybackMonths: number;
    description: string;
    features: string[];
  }>;

  // Network benchmark comparison
  benchmarkComparison: {
    yourCurrentMarginPct: number;
    globalAvgMarginPct: number;
    improvementPotentialPct: number;
    improvementValueEur: number;
  };

  // Summary
  bestTier: string;
  headline: string;  // "Your procurement could create €XXX in value over 12 months"
}

@Injectable()
export class ROICalculatorService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async calculate(input: ROIInput): Promise<ROIProjection> {
    const spend = input.annualProcurementSpendEur;
    const hoursPerWeek = input.manualProcessHoursPerWeek;

    // Get benchmark data for context
    let globalAvgMargin = 27.5;
    try {
      const marginBenchmark = await this.db.networkBenchmark.findFirst({
        where: { benchmarkType: 'decision_margin', region: input.region ?? null },
      });
      if (marginBenchmark) globalAvgMargin = Number(marginBenchmark.globalAvgValue);
    } catch { }

    // Category-specific efficiency multiplier
    let efficiencyMultiplier = 1.0;
    try {
      if (input.primaryCategory) {
        const catIntel = await this.db.categoryIntelligence.findFirst({
          where: { category: input.primaryCategory },
        });
        if (catIntel) {
          // Higher-margin categories benefit more from optimization
          efficiencyMultiplier = Math.min(1.4, 0.8 + Number(catIntel.avgMarginPct) / 100);
        }
      }
    } catch { }

    // Savings calculations
    const routingOptimizationEur = Math.round(spend * 0.04 * efficiencyMultiplier * 100) / 100;
    const marginProtectionEur = Math.round(spend * 0.025 * 100) / 100;
    const avoidedCostsEur = Math.round(spend * 0.03 * 100) / 100;
    const annualHours = hoursPerWeek * 52;
    const automatedHours = annualHours * 0.65;
    const timeAutomationValueEur = Math.round(automatedHours * 75 * 100) / 100;
    const totalProjected12mEur = routingOptimizationEur + marginProtectionEur + avoidedCostsEur + timeAutomationValueEur;

    // Value at each adoption level (progressive unlock)
    const shadowValue = Math.round(totalProjected12mEur * 0.0);   // shadow just reveals, doesn't create
    const assistedValue = Math.round(totalProjected12mEur * 0.45);
    const controlledValue = Math.round(totalProjected12mEur * 0.75);
    const autonomousValue = Math.round(totalProjected12mEur * 1.0);

    const tiers = [
      {
        name: 'Shadow Mode',
        mode: 'shadow',
        monthlyPriceEur: 0,
        annualCostEur: 0,
        projectedAnnualValueEur: shadowValue,
        netROIEur: shadowValue,
        roiMultiple: 0,
        paybackMonths: 0,
        description: 'Observe, simulate, discover. Zero risk, zero commitment. Reveals hidden savings without executing anything.',
        features: [
          'Full system visibility',
          'Shadow simulation of every procurement event',
          'Savings identification reports',
          'Supplier intelligence access',
          'Global benchmark comparison',
        ],
      },
      {
        name: 'Assisted Intelligence',
        mode: 'assisted',
        monthlyPriceEur: 2000,
        annualCostEur: 24000,
        projectedAnnualValueEur: assistedValue,
        netROIEur: assistedValue - 24000,
        roiMultiple: Math.round((assistedValue / 24000) * 10) / 10,
        paybackMonths: Math.ceil(24000 / (assistedValue / 12)),
        description: 'AI generates Decision Cards for every procurement event. Your team approves. Full reasoning visible.',
        features: [
          'Decision Cards with full AI reasoning',
          'Global benchmark on every decision',
          'Governance policy enforcement',
          'Decision trace audit trail',
          'Trust score tracking',
        ],
      },
      {
        name: 'Controlled Execution',
        mode: 'controlled',
        monthlyPriceEur: 4500,
        annualCostEur: 54000,
        projectedAnnualValueEur: controlledValue,
        netROIEur: controlledValue - 54000,
        roiMultiple: Math.round((controlledValue / 54000) * 10) / 10,
        paybackMonths: Math.ceil(54000 / (controlledValue / 12)),
        description: 'Low-risk decisions execute automatically. Medium/high risk requires approval. Maximum governance.',
        features: [
          'Auto-execution of risk-score < 35 decisions',
          'Full governance policy compliance',
          'Margin protection engine active',
          'Cross-tenant benchmark intelligence',
          'CFO ROI reporting',
        ],
      },
      {
        name: 'Full Autonomy',
        mode: 'autonomous',
        monthlyPriceEur: 8000,
        annualCostEur: 96000,
        projectedAnnualValueEur: autonomousValue,
        netROIEur: autonomousValue - 96000,
        roiMultiple: Math.round((autonomousValue / 96000) * 10) / 10,
        paybackMonths: Math.ceil(96000 / (autonomousValue / 12)),
        description: 'Full governance-constrained autonomy. Maximum ROI. Requires composite trust score ≥ 85.',
        features: [
          'Full autonomous execution within governance rules',
          'Level 3 trust autonomy required',
          'Global DIN network intelligence',
          'Proof engine financial validation',
          '% of savings alignment available',
        ],
      },
    ];

    // Benchmark comparison
    const currentMargin = input.currentAvgMarginPct ?? globalAvgMargin * 0.9;
    const improvementPotentialPct = Math.max(0, globalAvgMargin - currentMargin);
    const improvementValueEur = Math.round(spend * (improvementPotentialPct / 100) * 100) / 100;

    const bestTier = tiers[1].name; // Default recommend Assisted for new customers

    return {
      input,
      projectedSavings: {
        routingOptimizationEur,
        marginProtectionEur,
        avoidedCostsEur,
        timeAutomationValueEur,
        totalProjected12mEur,
      },
      tiers,
      benchmarkComparison: {
        yourCurrentMarginPct: Math.round(currentMargin * 10) / 10,
        globalAvgMarginPct: Math.round(globalAvgMargin * 10) / 10,
        improvementPotentialPct: Math.round(improvementPotentialPct * 10) / 10,
        improvementValueEur,
      },
      bestTier,
      headline: `Your procurement could create €${totalProjected12mEur.toLocaleString('en-EU')} in measurable value over 12 months`,
    };
  }
}
