import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BenchmarkComparison {
  globalAvg: number;
  globalP25: number;
  globalP75: number;
  yourValue: number;
  percentilePct: number;   // 0–100, where you rank
  vsBenchmarkPct: number;  // positive = better than avg, negative = worse
  label: string;           // "18% above global avg"
}

@Injectable()
export class GlobalIntelligenceService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async getSupplierScores(): Promise<any[]> {
    return this.db.supplierGlobalScore.findMany({
      orderBy: { globalReliabilityScore: 'desc' },
    });
  }

  async getRouteIntelligence(): Promise<any[]> {
    return this.db.routeIntelligence.findMany({
      orderBy: [{ onTimeDeliveryRatePct: 'desc' }],
    });
  }

  async getCategoryIntelligence(): Promise<any[]> {
    return this.db.categoryIntelligence.findMany({
      orderBy: [{ avgMarginPct: 'desc' }],
    });
  }

  async getNetworkBenchmarks(): Promise<any[]> {
    return this.db.networkBenchmark.findMany({
      orderBy: { benchmarkType: 'asc' },
    });
  }

  async getBenchmarkComparison(
    benchmarkType: string,
    yourValue: number,
    options?: { region?: string; category?: string; carrierCode?: string },
  ): Promise<BenchmarkComparison | null> {
    // Try exact match first, then fallback to type-only
    let benchmark = await this.db.networkBenchmark.findFirst({
      where: {
        benchmarkType,
        region: options?.region ?? null,
        category: options?.category ?? null,
        carrierCode: options?.carrierCode ?? null,
      },
    });

    if (!benchmark) {
      benchmark = await this.db.networkBenchmark.findFirst({
        where: { benchmarkType },
        orderBy: { sampleCount: 'desc' },
      });
    }

    if (!benchmark) return null;

    const globalAvg = Number(benchmark.globalAvgValue);
    const globalP25 = Number(benchmark.globalP25Value);
    const globalP75 = Number(benchmark.globalP75Value);

    // For margin: higher is better. For delivery_days/approval_speed: lower is better.
    const higherIsBetter = benchmarkType.includes('margin');
    const diff = higherIsBetter
      ? ((yourValue - globalAvg) / globalAvg) * 100
      : ((globalAvg - yourValue) / globalAvg) * 100;

    // Percentile estimate: linear interpolation between p25 and p75
    let percentile: number;
    if (higherIsBetter) {
      if (yourValue <= globalP25) percentile = 25;
      else if (yourValue >= globalP75) percentile = 75;
      else percentile = 25 + ((yourValue - globalP25) / (globalP75 - globalP25)) * 50;
    } else {
      if (yourValue >= globalP75) percentile = 25;
      else if (yourValue <= globalP25) percentile = 75;
      else percentile = 25 + ((globalP75 - yourValue) / (globalP75 - globalP25)) * 50;
    }

    const diffRounded = Math.round(diff * 10) / 10;
    const label = diffRounded >= 0
      ? `${diffRounded}% above global avg`
      : `${Math.abs(diffRounded)}% below global avg`;

    return {
      globalAvg,
      globalP25,
      globalP75,
      yourValue,
      percentilePct: Math.round(percentile),
      vsBenchmarkPct: diffRounded,
      label,
    };
  }

  async enrichDecisionWithBenchmark(decision: {
    finalMarginPct?: number;
    finalCostEur?: number;
    recommendedCarrier?: string;
    category?: string;
    region?: string;
  }): Promise<{ marginBenchmark?: BenchmarkComparison; costBenchmark?: BenchmarkComparison }> {
    const [marginBenchmark, costBenchmark] = await Promise.all([
      decision.finalMarginPct != null
        ? this.getBenchmarkComparison('decision_margin', decision.finalMarginPct, {
            region: decision.region,
            category: decision.category,
          })
        : Promise.resolve(null),
      decision.finalCostEur != null
        ? this.getBenchmarkComparison('cost_per_unit', decision.finalCostEur)
        : Promise.resolve(null),
    ]);

    return {
      marginBenchmark: marginBenchmark ?? undefined,
      costBenchmark: costBenchmark ?? undefined,
    };
  }

  async getRecentLearningEvents(limit = 30): Promise<any[]> {
    return this.db.networkLearningEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
