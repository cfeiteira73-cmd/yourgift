import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface RecordOutcomeParams {
  decisionCardId: string;
  tenantId?: string;
  actualSavingsEur?: number;
  actualMarginPct?: number;
  actualDeliveryDays?: number;
  actualCostEur?: number;
  outcomeType?: 'success' | 'partial' | 'failure';
  notes?: string;
  supplierCode?: string;
  routeKey?: string;
  category?: string;
  // Predictions (pulled from the decision card if not provided)
  predictedSavingsEur?: number;
  predictedMarginPct?: number;
  predictedDeliveryDays?: number;
  predictedRiskScore?: number;
}

export interface CorrectnessStats {
  correctnessRatePct: number;
  totalDecisions: number;
  correctDecisions: number;
  avgSavingsAccuracyPct: number;
  avgMarginAccuracyPct: number;
  avgDeliveryAccuracyPct: number;
  totalRealizedSavingsEur: number;
  totalPredictedSavingsEur: number;
  savingsCapturePct: number;  // realized / predicted * 100
  trend: 'improving' | 'stable' | 'degrading';
  byCategory: Record<string, { correctness: number; count: number }>;
}

@Injectable()
export class DecisionCorrectnessService {
  private get db(): any { return this.prisma; }

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async recordOutcome(params: RecordOutcomeParams): Promise<any> {
    // Pull predictions from the existing decision card
    const card = await this.db.decisionCard.findUnique({
      where: { id: params.decisionCardId },
    });

    const predictedSavings = params.predictedSavingsEur
      ?? (card ? Number(card.marginImpactEur ?? 0) : 0);
    const predictedMargin = params.predictedMarginPct
      ?? (card ? Number(card.finalMarginPct ?? 0) : 0);
    const predictedDelivery = params.predictedDeliveryDays
      ?? (card ? Number(card.deliveryImpactDays ?? 0) : 0);
    const predictedRisk = params.predictedRiskScore
      ?? (card ? Number(card.riskScore ?? 50) : 50);

    // Compute accuracy percentages
    const savingsAcc = predictedSavings !== 0 && params.actualSavingsEur != null
      ? Math.min(100, Math.max(0, (1 - Math.abs(params.actualSavingsEur - predictedSavings) / Math.abs(predictedSavings)) * 100))
      : null;

    const marginAcc = predictedMargin !== 0 && params.actualMarginPct != null
      ? Math.min(100, Math.max(0, (1 - Math.abs(params.actualMarginPct - predictedMargin) / Math.abs(predictedMargin)) * 100))
      : null;

    const deliveryAcc = predictedDelivery !== 0 && params.actualDeliveryDays != null
      ? Math.min(100, Math.max(0, (1 - Math.abs(params.actualDeliveryDays - predictedDelivery) / Math.max(1, Math.abs(predictedDelivery))) * 100))
      : null;

    // Composite correctness score (weighted: savings 40%, margin 40%, delivery 20%)
    const scores = [
      savingsAcc != null ? { score: savingsAcc, weight: 0.4 } : null,
      marginAcc != null ? { score: marginAcc, weight: 0.4 } : null,
      deliveryAcc != null ? { score: deliveryAcc, weight: 0.2 } : null,
    ].filter(Boolean) as { score: number; weight: number }[];

    const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
    const correctnessScore = totalWeight > 0
      ? scores.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
      : 75;

    const predictionCorrect = params.outcomeType !== 'failure' && correctnessScore >= 75;

    const outcome = await this.db.decisionOutcome.create({
      data: {
        decisionCardId: params.decisionCardId,
        tenantId: params.tenantId ?? 'default',
        predictedSavingsEur: predictedSavings || null,
        predictedMarginPct: predictedMargin || null,
        predictedDeliveryDays: predictedDelivery || null,
        predictedRiskScore: predictedRisk || null,
        actualSavingsEur: params.actualSavingsEur ?? null,
        actualMarginPct: params.actualMarginPct ?? null,
        actualDeliveryDays: params.actualDeliveryDays ?? null,
        actualCostEur: params.actualCostEur ?? null,
        savingsAccuracyPct: savingsAcc != null ? Math.round(savingsAcc * 100) / 100 : null,
        marginAccuracyPct: marginAcc != null ? Math.round(marginAcc * 100) / 100 : null,
        deliveryAccuracyPct: deliveryAcc != null ? Math.round(deliveryAcc * 100) / 100 : null,
        outcomeType: params.outcomeType ?? 'success',
        predictionCorrect,
        correctnessScore: Math.round(correctnessScore * 100) / 100,
        notes: params.notes ?? null,
        supplierCode: params.supplierCode ?? null,
        routeKey: params.routeKey ?? null,
        category: params.category ?? null,
      },
    });

    // Fire and forget — refresh aggregate + trigger trust score update
    this.updateCorrectnessAggregate(params.tenantId ?? 'default').catch(() => {});
    this.eventBus.emit('decision.outcome_recorded', {
      decisionCardId: params.decisionCardId,
      correctnessScore,
      predictionCorrect,
      tenantId: params.tenantId ?? 'default',
    });

    return outcome;
  }

  private async updateCorrectnessAggregate(tenantId: string): Promise<void> {
    const periods: Array<{ period: string; since: Date | null }> = [
      { period: 'all_time', since: null },
      { period: '30d', since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      { period: '7d', since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    ];

    for (const { period, since } of periods) {
      const where = since
        ? { tenantId, recordedAt: { gte: since } }
        : { tenantId };

      const outcomes: any[] = await this.db.decisionOutcome.findMany({ where });
      if (outcomes.length === 0) continue;

      const total = outcomes.length;
      const correct = outcomes.filter((o) => o.predictionCorrect).length;
      const correctnessPct = (correct / total) * 100;

      const savingsAccList = outcomes.filter((o) => o.savingsAccuracyPct != null).map((o) => Number(o.savingsAccuracyPct));
      const marginAccList = outcomes.filter((o) => o.marginAccuracyPct != null).map((o) => Number(o.marginAccuracyPct));
      const deliveryAccList = outcomes.filter((o) => o.deliveryAccuracyPct != null).map((o) => Number(o.deliveryAccuracyPct));

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const totalRealized = outcomes.reduce((s, o) => s + Number(o.actualSavingsEur ?? 0), 0);
      const totalPredicted = outcomes.reduce((s, o) => s + Number(o.predictedSavingsEur ?? 0), 0);

      // Upsert aggregate for this tenant+period
      await this.db.decisionCorrectnessAggregate.upsert({
        where: { tenantId_period: { tenantId, period } },
        update: {
          totalDecisions: total,
          correctDecisions: correct,
          correctnessRatePct: Math.round(correctnessPct * 100) / 100,
          avgSavingsAccuracyPct: Math.round(avg(savingsAccList) * 100) / 100,
          avgMarginAccuracyPct: Math.round(avg(marginAccList) * 100) / 100,
          avgDeliveryAccuracyPct: Math.round(avg(deliveryAccList) * 100) / 100,
          totalRealizedSavingsEur: Math.round(totalRealized * 100) / 100,
          totalPredictedSavingsEur: Math.round(totalPredicted * 100) / 100,
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          period,
          totalDecisions: total,
          correctDecisions: correct,
          correctnessRatePct: Math.round(correctnessPct * 100) / 100,
          avgSavingsAccuracyPct: Math.round(avg(savingsAccList) * 100) / 100,
          avgMarginAccuracyPct: Math.round(avg(marginAccList) * 100) / 100,
          avgDeliveryAccuracyPct: Math.round(avg(deliveryAccList) * 100) / 100,
          totalRealizedSavingsEur: Math.round(totalRealized * 100) / 100,
          totalPredictedSavingsEur: Math.round(totalPredicted * 100) / 100,
        },
      });

      // Also update global (tenantId = null) aggregate
      await this.updateGlobalAggregate(period, since);
    }
  }

  private async updateGlobalAggregate(period: string, since: Date | null): Promise<void> {
    const where = since ? { recordedAt: { gte: since } } : {};
    const outcomes: any[] = await this.db.decisionOutcome.findMany({ where });
    if (outcomes.length === 0) return;

    const total = outcomes.length;
    const correct = outcomes.filter((o) => o.predictionCorrect).length;
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const savingsAccList = outcomes.filter((o) => o.savingsAccuracyPct != null).map((o) => Number(o.savingsAccuracyPct));
    const marginAccList = outcomes.filter((o) => o.marginAccuracyPct != null).map((o) => Number(o.marginAccuracyPct));
    const deliveryAccList = outcomes.filter((o) => o.deliveryAccuracyPct != null).map((o) => Number(o.deliveryAccuracyPct));
    const totalRealized = outcomes.reduce((s, o) => s + Number(o.actualSavingsEur ?? 0), 0);
    const totalPredicted = outcomes.reduce((s, o) => s + Number(o.predictedSavingsEur ?? 0), 0);

    try {
      await this.db.decisionCorrectnessAggregate.upsert({
        where: { tenantId_period: { tenantId: null, period } },
        update: {
          totalDecisions: total,
          correctDecisions: correct,
          correctnessRatePct: Math.round((correct / total) * 10000) / 100,
          avgSavingsAccuracyPct: Math.round(avg(savingsAccList) * 100) / 100,
          avgMarginAccuracyPct: Math.round(avg(marginAccList) * 100) / 100,
          avgDeliveryAccuracyPct: Math.round(avg(deliveryAccList) * 100) / 100,
          totalRealizedSavingsEur: Math.round(totalRealized * 100) / 100,
          totalPredictedSavingsEur: Math.round(totalPredicted * 100) / 100,
          updatedAt: new Date(),
        },
        create: {
          tenantId: null,
          period,
          totalDecisions: total,
          correctDecisions: correct,
          correctnessRatePct: Math.round((correct / total) * 10000) / 100,
          avgSavingsAccuracyPct: Math.round(avg(savingsAccList) * 100) / 100,
          avgMarginAccuracyPct: Math.round(avg(marginAccList) * 100) / 100,
          avgDeliveryAccuracyPct: Math.round(avg(deliveryAccList) * 100) / 100,
          totalRealizedSavingsEur: Math.round(totalRealized * 100) / 100,
          totalPredictedSavingsEur: Math.round(totalPredicted * 100) / 100,
        },
      });
    } catch { /* null tenantId upsert may fail if unique constraint not null-friendly — ignore */ }
  }

  async getCorrectnessStats(tenantId?: string, period = '30d'): Promise<CorrectnessStats> {
    // Try aggregate first
    const agg = await this.db.decisionCorrectnessAggregate.findFirst({
      where: tenantId ? { tenantId, period } : { period },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute trend: compare 7d vs 30d correctness
    const agg7d = await this.db.decisionCorrectnessAggregate.findFirst({
      where: tenantId ? { tenantId, period: '7d' } : { period: '7d' },
    });
    const agg30d = await this.db.decisionCorrectnessAggregate.findFirst({
      where: tenantId ? { tenantId, period: '30d' } : { period: '30d' },
    });

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (agg7d && agg30d) {
      const diff = Number(agg7d.correctnessRatePct) - Number(agg30d.correctnessRatePct);
      if (diff > 2) trend = 'improving';
      else if (diff < -2) trend = 'degrading';
    }

    // Category breakdown from raw outcomes
    const since = period === '7d'
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : period === '30d'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : null;
    const where = { ...(tenantId ? { tenantId } : {}), ...(since ? { recordedAt: { gte: since } } : {}) };
    const outcomes: any[] = await this.db.decisionOutcome.findMany({ where, take: 200 });

    const byCategory: Record<string, { correctness: number; count: number }> = {};
    for (const o of outcomes) {
      const cat = o.category ?? 'Unknown';
      if (!byCategory[cat]) byCategory[cat] = { correctness: 0, count: 0 };
      byCategory[cat].count++;
      if (o.predictionCorrect) byCategory[cat].correctness++;
    }
    for (const cat of Object.keys(byCategory)) {
      const entry = byCategory[cat];
      entry.correctness = Math.round((entry.correctness / entry.count) * 100);
    }

    const totalRealized = Number(agg?.totalRealizedSavingsEur ?? 0);
    const totalPredicted = Number(agg?.totalPredictedSavingsEur ?? 1);

    return {
      correctnessRatePct: Number(agg?.correctnessRatePct ?? 90),
      totalDecisions: Number(agg?.totalDecisions ?? 0),
      correctDecisions: Number(agg?.correctDecisions ?? 0),
      avgSavingsAccuracyPct: Number(agg?.avgSavingsAccuracyPct ?? 0),
      avgMarginAccuracyPct: Number(agg?.avgMarginAccuracyPct ?? 0),
      avgDeliveryAccuracyPct: Number(agg?.avgDeliveryAccuracyPct ?? 0),
      totalRealizedSavingsEur: totalRealized,
      totalPredictedSavingsEur: totalPredicted,
      savingsCapturePct: totalPredicted > 0 ? Math.round((totalRealized / totalPredicted) * 10000) / 100 : 100,
      trend,
      byCategory,
    };
  }

  async getRecentOutcomes(limit = 10): Promise<any[]> {
    return this.db.decisionOutcome.findMany({
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async getDecisionAccuracy(decisionCardId: string): Promise<any | null> {
    return this.db.decisionOutcome.findFirst({
      where: { decisionCardId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
