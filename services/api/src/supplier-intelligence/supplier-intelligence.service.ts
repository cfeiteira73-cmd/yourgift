import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface SupplierScorecard {
  supplier: string;
  totalOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  failureRate: number;
  avgDeliveryDays: number | null;
  reliabilityScore: number;
  autoDowngraded: boolean;
  routingAllowed: boolean;
  recommendations: string[];
}

export interface BusinessFeedbackLoop {
  evaluatedAt: Date;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  actionItems: string[];
  supplierScores: { supplier: string; reliabilityScore: number }[];
  totalActiveJobs: number;
  failedJobsLast24h: number;
  refundAmountLast7d: number;
}

@Injectable()
export class SupplierIntelligenceService {
  private readonly logger = new Logger(SupplierIntelligenceService.name);
  private readonly DOWNGRADE_THRESHOLD = 0.7;
  private readonly ROUTING_BLOCK_THRESHOLD = 0.5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async getScorecard(supplier: string): Promise<SupplierScorecard> {
    const perf = await this.prisma.supplierPerformance.findFirst({
      where: { supplier },
    });

    if (!perf) {
      return {
        supplier,
        totalOrders: 0,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        failureRate: 0,
        avgDeliveryDays: null,
        reliabilityScore: 1.0,
        autoDowngraded: false,
        routingAllowed: true,
        recommendations: ['No performance data yet — operating in trial mode'],
      };
    }

    const reliabilityScore = Number(perf.reliabilityScore);
    const failureRate = perf.totalOrders > 0 ? (perf.lateDeliveries + perf.cancelledOrders) / perf.totalOrders : 0;
    const autoDowngraded = reliabilityScore < this.DOWNGRADE_THRESHOLD;
    const routingAllowed = reliabilityScore >= this.ROUTING_BLOCK_THRESHOLD;

    const recommendations: string[] = [];
    if (failureRate > 0.3) recommendations.push('Failure rate >30% — investigate root cause');
    if (autoDowngraded) recommendations.push('Reliability below 70% — deprioritised in routing');
    if (!routingAllowed) recommendations.push('BLOCKED: Reliability below 50% — manual only');
    if ((perf.avgDeliveryDays ?? 0) > 10) recommendations.push('Avg delivery >10 days — review SLA');
    if (recommendations.length === 0) recommendations.push('Performing within acceptable parameters');

    return {
      supplier,
      totalOrders: perf.totalOrders,
      onTimeDeliveries: perf.onTimeDeliveries,
      lateDeliveries: perf.lateDeliveries,
      failureRate,
      avgDeliveryDays: perf.avgDeliveryDays,
      reliabilityScore,
      autoDowngraded,
      routingAllowed,
      recommendations,
    };
  }

  async getRoutingRecommendation(
    supplier: string,
  ): Promise<{ recommended: string; reason: string; fallback: string }> {
    const scorecard = await this.getScorecard(supplier);

    if (!scorecard.routingAllowed) {
      return { recommended: 'manual', reason: `${supplier} reliability blocked (<50%)`, fallback: 'manual' };
    }
    if (scorecard.autoDowngraded) {
      return { recommended: 'manual', reason: `${supplier} auto-downgraded (<70% reliability)`, fallback: 'manual' };
    }
    return { recommended: supplier, reason: `${supplier} meets reliability threshold`, fallback: 'manual' };
  }

  async applyAutoDowngrade(supplier: string): Promise<{ applied: boolean; newScore: number }> {
    const perf = await this.prisma.supplierPerformance.findFirst({ where: { supplier } });
    if (!perf) return { applied: false, newScore: 1.0 };

    const currentScore = Number(perf.reliabilityScore);
    const newScore = Math.max(0, currentScore - 0.1);

    await this.prisma.supplierPerformance.update({
      where: { id: perf.id },
      data: { reliabilityScore: newScore },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'supplier_performance',
        entityId: perf.id,
        event: 'supplier.auto_downgrade.applied',
        payload: { supplier, previousScore: currentScore, newScore, penalty: -0.1 },
      },
    });

    this.eventBus.emit('supplier.auto_downgrade', { supplier, previousScore: currentScore, newScore });
    this.logger.warn(`Auto-downgrade applied to ${supplier}: ${currentScore} → ${newScore}`);

    return { applied: true, newScore };
  }

  async recordRepurchaseBonus(supplier: string): Promise<{ newScore: number }> {
    const perf = await this.prisma.supplierPerformance.findFirst({ where: { supplier } });
    if (!perf) return { newScore: 1.0 };

    const currentScore = Number(perf.reliabilityScore);
    const newScore = Math.min(1.0, currentScore + 0.02);

    await this.prisma.supplierPerformance.update({
      where: { id: perf.id },
      data: { reliabilityScore: newScore },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'supplier_performance',
        entityId: perf.id,
        event: 'supplier.repurchase_bonus.applied',
        payload: { supplier, previousScore: currentScore, newScore, bonus: 0.02 },
      },
    });

    return { newScore };
  }

  async getBusinessFeedbackLoop(): Promise<BusinessFeedbackLoop> {
    const cutoff24h = new Date(Date.now() - 86_400_000);
    const cutoff7d = new Date(Date.now() - 7 * 86_400_000);

    const [supplierPerfs, activeJobs, failedJobs24h, refunds7d] = await Promise.all([
      this.prisma.supplierPerformance.findMany({ orderBy: { reliabilityScore: 'desc' }, take: 10 }),
      this.prisma.productionJob.count({ where: { status: { in: ['queued', 'requeued', 'in_production'] } } }),
      this.prisma.productionJob.count({ where: { status: 'failed', failedAt: { gte: cutoff24h } } }),
      this.prisma.refund.findMany({ where: { createdAt: { gte: cutoff7d } }, select: { amount: true } }),
    ]);

    const refundAmountLast7d = refunds7d.reduce((sum, r) => sum + Number(r.amount), 0);
    const supplierScores = supplierPerfs.map((p) => ({
      supplier: p.supplier,
      reliabilityScore: Number(p.reliabilityScore),
    }));

    const actionItems: string[] = [];
    if (failedJobs24h > 5) actionItems.push(`${failedJobs24h} production jobs failed in last 24h — investigate`);
    if (refundAmountLast7d > 500) actionItems.push(`€${refundAmountLast7d.toFixed(2)} in refunds last 7 days`);
    if (activeJobs > 50) actionItems.push(`${activeJobs} active jobs in queue — check capacity`);
    supplierScores.forEach((s) => {
      if (s.reliabilityScore < 0.7) actionItems.push(`Supplier ${s.supplier} below threshold (${(s.reliabilityScore * 100).toFixed(0)}%)`);
    });

    const systemHealth: 'healthy' | 'degraded' | 'critical' =
      failedJobs24h > 20 || refundAmountLast7d > 2000
        ? 'critical'
        : failedJobs24h > 5 || refundAmountLast7d > 500
        ? 'degraded'
        : 'healthy';

    return {
      evaluatedAt: new Date(),
      systemHealth,
      actionItems: actionItems.length > 0 ? actionItems : ['All systems operating normally'],
      supplierScores,
      totalActiveJobs: activeJobs,
      failedJobsLast24h: failedJobs24h,
      refundAmountLast7d,
    };
  }
}
