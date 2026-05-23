import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpansionService {
  private readonly logger = new Logger(ExpansionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async detectExpansionOpportunities(companyId: string, tenantId = 'default'): Promise<number> {
    const signals: Array<{
      signalType: string;
      opportunityValue: number | null;
      confidence: number;
      description: string;
      recommendedAction: string;
    }> = [];

    const now = new Date();
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);

    // 1. Volume increase signal: orders growing >30% MoM
    const [recent30, prev30] = await Promise.all([
      this.prisma.order.count({ where: { companyId, createdAt: { gte: d30 } } }),
      this.prisma.order.count({ where: { companyId, createdAt: { gte: d90, lt: d30 } } }),
    ]);
    if (prev30 > 0 && recent30 > prev30 * 1.3) {
      signals.push({
        signalType: 'volume_increase',
        opportunityValue: null,
        confidence: 0.8,
        description: `Order volume up ${Math.round((recent30 / prev30 - 1) * 100)}% MoM — procurement is scaling`,
        recommendedAction: 'Propose dedicated account pricing or enterprise tier upgrade',
      });
    }

    // 2. New category opportunity: orders concentrated in 1-2 categories
    const items = await this.prisma.orderItem.findMany({
      where: { order: { companyId, createdAt: { gte: d90 } } },
      include: { product: { select: { category: true } } },
    });
    const categories = new Set(items.map(i => i.product?.category ?? 'unknown'));
    if (categories.size === 1) {
      signals.push({
        signalType: 'new_category',
        opportunityValue: null,
        confidence: 0.7,
        description: `All orders concentrated in "${[...categories][0]}" — no cross-category procurement`,
        recommendedAction: 'Introduce adjacent product categories: apparel, tech accessories, or premium gifts',
      });
    }

    // 3. Health score-based upsell
    const health = await this.prisma.cSHealthScore.findUnique({ where: { companyId_tenantId: { companyId, tenantId } } });
    if (health && Number(health.healthScore) > 80 && Number(health.expansionProbability) > 0.7) {
      const avgSpend = Number(health.avgMonthlySpend);
      signals.push({
        signalType: 'upsell',
        opportunityValue: avgSpend * 0.3,
        confidence: Number(health.expansionProbability),
        description: `High-health company (score ${health.healthScore}) with strong spending pattern`,
        recommendedAction: 'Offer premium tier, dedicated CSM, or campaign management service',
      });
    }

    // 4. Onboarding gap: active but no design jobs
    const designJobs = await this.prisma.aIDesignJob.count({ where: { companyId } });
    if (designJobs === 0 && recent30 > 0) {
      signals.push({
        signalType: 'onboarding_gap',
        opportunityValue: null,
        confidence: 0.9,
        description: 'Company is ordering but has never used AI Design Studio',
        recommendedAction: 'Schedule AI Design onboarding session — demonstrate 60% design time reduction',
      });
    }

    // Persist signals (expire in 30 days)
    const expiresAt = new Date(now); expiresAt.setDate(expiresAt.getDate() + 30);
    for (const signal of signals) {
      await this.prisma.expansionSignal.create({
        data: {
          companyId,
          tenantId,
          signalType: signal.signalType,
          opportunityValue: signal.opportunityValue,
          confidence: signal.confidence,
          description: signal.description,
          recommendedAction: signal.recommendedAction,
          expiresAt,
        },
      });
    }

    this.logger.debug(`Expansion signals for ${companyId}: ${signals.length} detected`);
    return signals.length;
  }

  async getSignals(companyId?: string, limit = 20) {
    return this.prisma.expansionSignal.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        isActioned: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async actionSignal(signalId: string, actionedBy: string) {
    return this.prisma.expansionSignal.update({
      where: { id: signalId },
      data: { isActioned: true, actionedBy, actionedAt: new Date() },
    });
  }

  async getSignalStats() {
    const [total, unactioned, byType] = await Promise.all([
      this.prisma.expansionSignal.count(),
      this.prisma.expansionSignal.count({ where: { isActioned: false } }),
      this.prisma.expansionSignal.groupBy({ by: ['signalType'], _count: { id: true }, where: { isActioned: false } }),
    ]);
    return {
      total,
      unactioned,
      byType: Object.fromEntries(byType.map(t => [t.signalType, t._count.id])),
    };
  }
}
