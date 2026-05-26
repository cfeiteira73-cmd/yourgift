import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerSuccessService {
  private readonly logger = new Logger(CustomerSuccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeHealthScore(companyId: string, tenantId = 'default'): Promise<number> {
    const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

    const [orders30, orders90, allOrders] = await Promise.all([
      this.prisma.order.findMany({ where: { companyId, createdAt: { gte: d30 }, status: { not: 'cancelled' } } }),
      this.prisma.order.findMany({ where: { companyId, createdAt: { gte: d90 }, status: { not: 'cancelled' } } }),
      this.prisma.order.findMany({ where: { companyId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } }),
    ]);

    const totalSpend = allOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const spend30 = orders30.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const spend90Prev = orders90.slice(orders30.length).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

    const lastOrder = allOrders[0];
    const lastOrderDaysAgo = lastOrder
      ? Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 3600 * 24))
      : null;

    // Score components (0-100 each)
    const recencyScore = lastOrderDaysAgo === null ? 0
      : lastOrderDaysAgo <= 30 ? 100
      : lastOrderDaysAgo <= 60 ? 70
      : lastOrderDaysAgo <= 90 ? 40
      : 10;

    const frequencyScore = Math.min(100, orders30.length * 20); // 5+ orders/month = 100

    const spendTrendRatio = spend90Prev > 0 ? spend30 / (spend90Prev / 2) : 1;
    const spendTrendScore = spendTrendRatio >= 1.2 ? 100
      : spendTrendRatio >= 0.9 ? 70
      : spendTrendRatio >= 0.7 ? 40
      : 10;

    const spendTrend: string = spendTrendRatio >= 1.1 ? 'growing' : spendTrendRatio >= 0.9 ? 'stable' : 'declining';

    // Weighted composite: recency 40%, frequency 35%, spend trend 25%
    const healthScore = recencyScore * 0.40 + frequencyScore * 0.35 + spendTrendScore * 0.25;

    const churnRisk: string = healthScore >= 75 ? 'low'
      : healthScore >= 50 ? 'medium'
      : healthScore >= 25 ? 'high'
      : 'critical';

    const engagementScore = (recencyScore + frequencyScore) / 2;
    const expansionProbability = Math.min(1, Math.max(0, (healthScore / 100) * (spendTrendRatio > 1 ? 1.3 : 1)));

    const avgMonthlySpend = allOrders.length > 0
      ? totalSpend / Math.max(1, Math.ceil((now.getTime() - (allOrders[allOrders.length - 1]?.createdAt.getTime() ?? now.getTime())) / (1000 * 3600 * 24 * 30)))
      : 0;

    const healthFactors = { recencyScore, frequencyScore, spendTrendScore, lastOrderDaysAgo, spendTrendRatio: Math.round(spendTrendRatio * 100) / 100 };

    await this.prisma.cSHealthScore.upsert({
      where: { companyId_tenantId: { companyId, tenantId } },
      create: {
        companyId,
        tenantId,
        healthScore: Math.round(healthScore * 10) / 10,
        churnRisk,
        engagementScore: Math.round(engagementScore * 10) / 10,
        spendTrend,
        lastOrderDaysAgo,
        ordersLast30d: orders30.length,
        ordersLast90d: orders90.length,
        totalLifetimeSpend: Math.round(totalSpend * 100) / 100,
        avgMonthlySpend: Math.round(avgMonthlySpend * 100) / 100,
        expansionProbability: Math.round(expansionProbability * 1000) / 1000,
        healthFactors: healthFactors as object,
      },
      update: {
        healthScore: Math.round(healthScore * 10) / 10,
        churnRisk,
        engagementScore: Math.round(engagementScore * 10) / 10,
        spendTrend,
        lastOrderDaysAgo,
        ordersLast30d: orders30.length,
        ordersLast90d: orders90.length,
        totalLifetimeSpend: Math.round(totalSpend * 100) / 100,
        avgMonthlySpend: Math.round(avgMonthlySpend * 100) / 100,
        expansionProbability: Math.round(expansionProbability * 1000) / 1000,
        healthFactors: healthFactors as object,
        computedAt: now,
      },
    });

    this.logger.debug(`Health score for company ${companyId}: ${Math.round(healthScore * 10) / 10} (${churnRisk} churn risk)`);
    return Math.round(healthScore * 10) / 10;
  }

  async refreshAllHealthScores(): Promise<{ processed: number }> {
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    let processed = 0;
    for (const company of companies) {
      try {
        await this.computeHealthScore(company.id);
        processed++;
      } catch (err) {
        this.logger.error(`Health score failed for ${company.id}: ${err}`);
      }
    }
    return { processed };
  }

  async getHealthScoreboard(limit = 20) {
    return this.prisma.cSHealthScore.findMany({
      orderBy: { healthScore: 'asc' }, // worst first
      take: limit,
    });
  }

  async getChurnRiskCohorts() {
    const byCohort = await this.prisma.cSHealthScore.groupBy({
      by: ['churnRisk'],
      _count: { id: true },
      _avg: { healthScore: true, totalLifetimeSpend: true },
    });
    return Object.fromEntries(byCohort.map(c => [c.churnRisk, {
      count: c._count.id,
      avgHealthScore: Math.round(Number(c._avg.healthScore ?? 0) * 10) / 10,
      avgLtv: Math.round(Number(c._avg.totalLifetimeSpend ?? 0) * 100) / 100,
    }]));
  }

  async getPlatformHealthSummary() {
    const [total, avgScore, byRisk, declining] = await Promise.all([
      this.prisma.cSHealthScore.count(),
      this.prisma.cSHealthScore.aggregate({ _avg: { healthScore: true, expansionProbability: true } }),
      this.prisma.cSHealthScore.groupBy({ by: ['churnRisk'], _count: { id: true } }),
      this.prisma.cSHealthScore.count({ where: { spendTrend: 'declining' } }),
    ]);
    return {
      totalCompanies: total,
      avgHealthScore: Math.round(Number(avgScore._avg.healthScore ?? 0) * 10) / 10,
      avgExpansionProb: Math.round(Number(avgScore._avg.expansionProbability ?? 0) * 1000) / 10,
      byRisk: Object.fromEntries(byRisk.map(r => [r.churnRisk, r._count.id])),
      decliningSpend: declining,
    };
  }
}
