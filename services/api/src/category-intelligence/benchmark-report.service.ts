import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BenchmarkReport {
  generatedAt: string;
  networkStats: {
    totalLearningEvents: number;
    activeTenants: number;
    suppliersCovered: number;
    routesMapped: number;
    categoriesTracked: number;
    avgGlobalReliability: number;
  };
  topSuppliers: Array<{
    rank: number;
    supplierCode: string;
    supplierName: string;
    globalReliabilityScore: number;
    failureProbabilityPct: number;
    avgLeadTimeDays: number;
    avgMarginContributionPct: number;
    totalEvents: number;
    tier: 'platinum' | 'gold' | 'silver' | 'standard';
  }>;
  routeIntelligence: Array<{
    route: string;
    carrier: string;
    onTimeDeliveryPct: number;
    avgTransitDays: number;
    costVolatilityPct: number;
    riskLevel: 'low' | 'medium' | 'high';
    totalShipments: number;
  }>;
  categoryBenchmarks: Array<{
    category: string;
    region: string;
    avgMarginPct: number;
    demandTrend: string;
    riskScore: number;
    totalOrders: number;
    marginBand: 'premium' | 'standard' | 'low';
  }>;
  proofSummary: {
    totalValueEurAllTime: number;
    totalSavedEurAllTime: number;
    totalAvoidedEurAllTime: number;
    avgValuePerDecision: number;
    proofROI: number;
    monthlyTrend: Array<{ period: string; totalValueEur: number }>;
  };
  globalBenchmarks: Array<{
    benchmarkType: string;
    globalAvgValue: number;
    globalP75Value: number;
    sampleCount: number;
  }>;
  networkHealthScore: number;
  categoryDefinition: string;
}

@Injectable()
export class BenchmarkReportService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async generateReport(): Promise<BenchmarkReport> {
    const [
      learningEvents,
      suppliers,
      routes,
      categories,
      proofRecords,
      benchmarks,
      trustScores,
    ] = await Promise.all([
      this.db.networkLearningEvent.count(),
      this.db.supplierGlobalScore.findMany({ orderBy: { globalReliabilityScore: 'desc' } }),
      this.db.routeIntelligence.findMany({ orderBy: { onTimeDeliveryRatePct: 'desc' } }),
      this.db.categoryIntelligence.findMany({ orderBy: { avgMarginPct: 'desc' } }),
      this.db.proofRecord.findMany(),
      this.db.networkBenchmark.findMany(),
      this.db.trustScore.findMany(),
    ]);

    // Network stats
    const avgReliability = suppliers.length > 0
      ? suppliers.reduce((s: number, r: any) => s + Number(r.globalReliabilityScore), 0) / suppliers.length
      : 85;

    const activeTenants = Array.from(new Set(proofRecords.map((r: any) => r.tenantHash))).length;

    // Top suppliers with tiers
    const topSuppliers = suppliers.map((s: any, i: number) => {
      const score = Number(s.globalReliabilityScore);
      const tier = score >= 90 ? 'platinum' : score >= 85 ? 'gold' : score >= 75 ? 'silver' : 'standard';
      return {
        rank: i + 1,
        supplierCode: s.supplierCode,
        supplierName: s.supplierName,
        globalReliabilityScore: Number(s.globalReliabilityScore),
        failureProbabilityPct: Number(s.failureProbabilityPct),
        avgLeadTimeDays: Number(s.avgLeadTimeDays),
        avgMarginContributionPct: Number(s.avgMarginContributionPct),
        totalEvents: s.totalEvents,
        tier,
      };
    });

    // Route intelligence
    const routeIntelligence = routes.map((r: any) => {
      const otd = Number(r.onTimeDeliveryRatePct);
      const vol = Number(r.costVolatilityPct);
      const riskLevel = vol > 12 || otd < 85 ? 'high' : vol > 6 || otd < 92 ? 'medium' : 'low';
      return {
        route: `${r.originCountry} → ${r.destinationCountry}`,
        carrier: r.carrierCode.toUpperCase(),
        onTimeDeliveryPct: otd,
        avgTransitDays: Number(r.avgTransitDays),
        costVolatilityPct: vol,
        riskLevel,
        totalShipments: r.totalShipments,
      };
    });

    // Category benchmarks
    const categoryBenchmarks = categories.map((c: any) => {
      const margin = Number(c.avgMarginPct);
      const marginBand = margin >= 30 ? 'premium' : margin >= 22 ? 'standard' : 'low';
      return {
        category: c.category,
        region: c.region,
        avgMarginPct: margin,
        demandTrend: c.demandTrend,
        riskScore: Number(c.riskScore),
        totalOrders: c.totalOrders,
        marginBand,
      };
    });

    // Proof summary
    const totalValueEurAllTime = proofRecords.reduce((s: number, r: any) => s + Number(r.totalValueEur), 0);
    const totalSavedEurAllTime = proofRecords.reduce((s: number, r: any) => s + Number(r.savedCostEur), 0);
    const totalAvoidedEurAllTime = proofRecords.reduce((s: number, r: any) => s + Number(r.avoidedCostEur), 0);

    // Monthly trend
    const monthlyMap = new Map<string, number>();
    for (const r of proofRecords) {
      monthlyMap.set(r.period, (monthlyMap.get(r.period) ?? 0) + Number(r.totalValueEur));
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, totalValueEur]) => ({ period, totalValueEur: Math.round(totalValueEur * 100) / 100 }));

    const platformCost = 6000;
    const proofROI = platformCost > 0 ? Math.round((totalValueEurAllTime / platformCost) * 100) / 100 : 0;
    const avgValuePerDecision = proofRecords.length > 0 ? Math.round((totalValueEurAllTime / proofRecords.length) * 100) / 100 : 0;

    // Global benchmarks
    const globalBenchmarks = benchmarks.map((b: any) => ({
      benchmarkType: b.benchmarkType,
      globalAvgValue: Number(b.globalAvgValue),
      globalP75Value: Number(b.globalP75Value),
      sampleCount: b.sampleCount,
    }));

    // Network health score
    const avgTrust = trustScores.length > 0
      ? trustScores.reduce((s: number, t: any) => s + Number(t.compositeScore), 0) / trustScores.length
      : 80;
    const networkHealthScore = Math.min(100, Math.round(
      avgReliability * 0.35 +
      Math.min(suppliers.length / 20, 1) * 25 +
      Math.min(learningEvents / 1000, 1) * 20 +
      avgTrust * 0.20
    ));

    return {
      generatedAt: new Date().toISOString(),
      networkStats: {
        totalLearningEvents: learningEvents,
        activeTenants,
        suppliersCovered: suppliers.length,
        routesMapped: routes.length,
        categoriesTracked: categories.length,
        avgGlobalReliability: Math.round(avgReliability * 10) / 10,
      },
      topSuppliers,
      routeIntelligence,
      categoryBenchmarks,
      proofSummary: {
        totalValueEurAllTime: Math.round(totalValueEurAllTime * 100) / 100,
        totalSavedEurAllTime: Math.round(totalSavedEurAllTime * 100) / 100,
        totalAvoidedEurAllTime: Math.round(totalAvoidedEurAllTime * 100) / 100,
        avgValuePerDecision,
        proofROI,
        monthlyTrend,
      },
      globalBenchmarks,
      networkHealthScore,
      categoryDefinition: 'Autonomous Procurement Intelligence Platform',
    };
  }

  async getSupplierLeaderboard(): Promise<any[]> {
    const suppliers = await this.db.supplierGlobalScore.findMany({
      orderBy: { globalReliabilityScore: 'desc' },
    });
    return suppliers.map((s: any, i: number) => ({
      rank: i + 1,
      ...s,
      globalReliabilityScore: Number(s.globalReliabilityScore),
      failureProbabilityPct: Number(s.failureProbabilityPct),
      avgLeadTimeDays: Number(s.avgLeadTimeDays),
      avgMarginContributionPct: Number(s.avgMarginContributionPct),
    }));
  }

  async getCategoryLeaderboard(): Promise<any[]> {
    return this.db.categoryIntelligence.findMany({
      orderBy: { avgMarginPct: 'desc' },
    });
  }
}
