import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

interface OrderDeliveredPayload {
  orderId?: string;
  supplierId?: string;
  deliveryDays?: number;
}

@Injectable()
export class LearningLoopService implements OnModuleInit {
  private readonly logger = new Logger(LearningLoopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // When order is delivered: record delivery outcome and update supplier scores
    this.events.on('order.delivered', async (payload: OrderDeliveredPayload) => {
      try {
        if (payload.orderId) {
          await this.recordDeliveryOutcome(
            payload.orderId,
            payload.supplierId ?? 'unknown',
            payload.deliveryDays ?? 7,
          );
        }
      } catch (err) {
        this.logger.error(`Learning loop failed for ${payload.orderId}: ${err}`);
      }
    });

    this.logger.log('Learning loop initialized — autonomous supplier scoring active');
  }

  async recordDeliveryOutcome(orderId: string, supplierId: string, actualDeliveryDays: number, expectedDays = 7) {
    const delta = actualDeliveryDays - expectedDays;

    const outcome = await this.prisma.learningOutcome.create({
      data: {
        outcomeType: 'supplier_delivery',
        referenceType: 'order',
        referenceId: orderId,
        supplierId,
        metricName: 'delivery_time_days',
        actualValue: actualDeliveryDays,
        expectedValue: expectedDays,
        delta,
        weight: 1.0,
      },
    });

    // Update supplier routing matrix scores based on outcome
    await this.updateSupplierScore(supplierId, delta);
    await this.prisma.learningOutcome.update({
      where: { id: outcome.id },
      data: { incorporatedAt: new Date() },
    });

    return outcome;
  }

  /**
   * Bayesian-like score update: adjust reliability score based on delivery delta.
   * delta < 0 = delivered early (bonus), delta > 0 = late (penalty)
   */
  private async updateSupplierScore(supplierId: string, deliveryDelta: number): Promise<void> {
    const suppliers = await this.prisma.supplierRoutingMatrix.findMany({ where: { supplierId, isActive: true } });
    if (!suppliers.length) return;

    for (const supplier of suppliers) {
      const current = Number(supplier.reliabilityScore);
      // Adjustment: -2 per day late, +1 per day early, bounded 0-100
      const adjustment = deliveryDelta > 0 ? -Math.min(deliveryDelta * 2, 10) : Math.min(Math.abs(deliveryDelta), 5);
      const newScore = Math.min(100, Math.max(0, current + adjustment));

      await this.prisma.supplierRoutingMatrix.update({
        where: { id: supplier.id },
        data: { reliabilityScore: newScore, lastUpdated: new Date() },
      });

      this.logger.debug(`Supplier ${supplierId} reliability: ${current} → ${newScore} (delta=${deliveryDelta}d)`);
    }
  }

  async recordSatisfactionScore(orderId: string, supplierId: string, score: number) {
    // score: 1-5
    const expected = 4.0;
    const delta = score - expected;

    await this.prisma.learningOutcome.create({
      data: {
        outcomeType: 'supplier_satisfaction',
        referenceType: 'order',
        referenceId: orderId,
        supplierId,
        metricName: 'satisfaction_score',
        actualValue: score,
        expectedValue: expected,
        delta,
        weight: 1.5,  // satisfaction weighted higher
        incorporatedAt: new Date(),
      },
    });

    // Adjust price score (satisfaction proxy for quality)
    const suppliers = await this.prisma.supplierRoutingMatrix.findMany({ where: { supplierId, isActive: true } });
    for (const supplier of suppliers) {
      const current = Number(supplier.priceScore);
      const adjustment = delta * 3; // ±3 per score point delta
      const newScore = Math.min(100, Math.max(0, current + adjustment));
      await this.prisma.supplierRoutingMatrix.update({
        where: { id: supplier.id },
        data: { priceScore: newScore, lastUpdated: new Date() },
      });
    }
  }

  async getSupplierLearningReport(supplierId: string) {
    const outcomes = await this.prisma.learningOutcome.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const byMetric: Record<string, { count: number; avgDelta: number; avgActual: number }> = {};
    for (const o of outcomes) {
      const m = o.metricName;
      if (!byMetric[m]) byMetric[m] = { count: 0, avgDelta: 0, avgActual: 0 };
      byMetric[m].count++;
      byMetric[m].avgDelta += Number(o.delta ?? 0);
      byMetric[m].avgActual += Number(o.actualValue);
    }
    for (const m of Object.keys(byMetric)) {
      const b = byMetric[m];
      b.avgDelta = Math.round((b.avgDelta / b.count) * 100) / 100;
      b.avgActual = Math.round((b.avgActual / b.count) * 100) / 100;
    }

    const currentScores = await this.prisma.supplierRoutingMatrix.findMany({ where: { supplierId, isActive: true } });

    return {
      supplierId,
      totalOutcomes: outcomes.length,
      byMetric,
      currentScores: currentScores.map(s => ({
        category: s.category,
        reliabilityScore: Number(s.reliabilityScore),
        priceScore: Number(s.priceScore),
        baseScore: Number(s.baseScore),
      })),
      learningHistory: outcomes.slice(0, 10),
    };
  }

  async getPlatformLearningStats() {
    const [total, incorporated, byType] = await Promise.all([
      this.prisma.learningOutcome.count(),
      this.prisma.learningOutcome.count({ where: { incorporatedAt: { not: null } } }),
      this.prisma.learningOutcome.groupBy({ by: ['outcomeType'], _count: { id: true }, _avg: { delta: true } }),
    ]);

    return {
      totalOutcomes: total,
      incorporated,
      incorporationRate: total > 0 ? Math.round((incorporated / total) * 100) : 0,
      byType: Object.fromEntries(byType.map(t => [t.outcomeType, { count: t._count.id, avgDelta: Number(t._avg.delta ?? 0) }])),
    };
  }
}
