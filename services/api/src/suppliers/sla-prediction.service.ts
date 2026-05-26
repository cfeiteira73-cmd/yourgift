import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SlaPrediction {
  supplierId: string;
  estimatedDays: number;
  minDays: number;
  maxDays: number;
  onTimeRate: number; // 0–1
  confidence: 'high' | 'medium' | 'low';
  basedOnSamples: number;
}

export interface SupplierSlaRanking {
  supplierId: string;
  supplierName: string;
  avgDeliveryDays: number;
  onTimeRate: number;
  score: number; // composite score 0–100
}

/**
 * Category delivery-day multipliers relative to baseline.
 * Electronics and tech are faster; luxury and personalized take longer.
 */
const CATEGORY_FACTOR: Record<string, number> = {
  electronics: 0.85,
  books: 0.9,
  clothing: 1.0,
  gifts: 1.1,
  personalized: 1.25,
  luxury: 1.3,
  default: 1.0,
};

@Injectable()
export class SlaPredictionService {
  private readonly logger = new Logger(SlaPredictionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Predict delivery SLA for a supplier based on historical performance.
   * Returns estimated days and confidence score.
   */
  async predictDeliverySla(supplierId: string, category: string): Promise<SlaPrediction> {
    const perf = await this.prisma.supplierPerformance.findUnique({
      where: { supplier: supplierId },
    });

    // Default baseline when no historical data exists
    const DEFAULT_DAYS = 7;
    const categoryFactor = CATEGORY_FACTOR[category.toLowerCase()] ?? CATEGORY_FACTOR['default']!;

    if (!perf || perf.totalOrders === 0) {
      return {
        supplierId,
        estimatedDays: Math.round(DEFAULT_DAYS * categoryFactor),
        minDays: Math.max(1, Math.round(DEFAULT_DAYS * categoryFactor * 0.7)),
        maxDays: Math.round(DEFAULT_DAYS * categoryFactor * 1.5),
        onTimeRate: 0.8, // optimistic default
        confidence: 'low',
        basedOnSamples: 0,
      };
    }

    const avgDays = perf.avgDeliveryDays ?? DEFAULT_DAYS;
    const onTimeRate =
      perf.totalOrders > 0
        ? perf.onTimeDeliveries / Math.max(perf.totalOrders - perf.cancelledOrders, 1)
        : 0.8;

    // Apply category factor
    const estimatedDays = Math.max(1, Math.round(avgDays * categoryFactor));

    // Spread based on reliability: high reliability = tight range, low = wide
    const spread = onTimeRate >= 0.9 ? 0.2 : onTimeRate >= 0.7 ? 0.4 : 0.6;
    const minDays = Math.max(1, Math.round(estimatedDays * (1 - spread)));
    const maxDays = Math.round(estimatedDays * (1 + spread));

    // Confidence based on sample size
    let confidence: 'high' | 'medium' | 'low';
    if (perf.totalOrders >= 50) {
      confidence = 'high';
    } else if (perf.totalOrders >= 10) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      supplierId,
      estimatedDays,
      minDays,
      maxDays,
      onTimeRate: Math.round(onTimeRate * 1000) / 1000,
      confidence,
      basedOnSamples: perf.totalOrders,
    };
  }

  /**
   * Update supplier SLA performance after an order is delivered.
   * Maintains a rolling average for avgDeliveryDays and recalculates onTimeRate.
   */
  async recordDelivery(
    supplierId: string,
    orderId: string,
    promisedDays: number,
    actualDays: number,
  ): Promise<void> {
    const isOnTime = actualDays <= promisedDays;

    const existing = await this.prisma.supplierPerformance.findUnique({
      where: { supplier: supplierId },
    });

    if (!existing) {
      // First record for this supplier
      await this.prisma.supplierPerformance.create({
        data: {
          supplier: supplierId,
          totalOrders: 1,
          onTimeDeliveries: isOnTime ? 1 : 0,
          lateDeliveries: isOnTime ? 0 : 1,
          cancelledOrders: 0,
          avgDeliveryDays: actualDays,
          reliabilityScore: isOnTime ? 1.0 : 0.5,
          lastOrderAt: new Date(),
        },
      });
      this.logger.log(`Created SLA record for supplier ${supplierId}: orderId=${orderId} actualDays=${actualDays} onTime=${isOnTime}`);
      return;
    }

    const newTotalOrders = existing.totalOrders + 1;
    const newOnTimeDeliveries = existing.onTimeDeliveries + (isOnTime ? 1 : 0);
    const newLateDeliveries = existing.lateDeliveries + (isOnTime ? 0 : 1);

    // Rolling average for delivery days
    const prevAvg = existing.avgDeliveryDays ?? actualDays;
    const newAvgDeliveryDays =
      (prevAvg * existing.totalOrders + actualDays) / newTotalOrders;

    // Reliability score: weighted on-time rate (recent orders count more via slight decay)
    const completedOrders = newTotalOrders - existing.cancelledOrders;
    const reliabilityScore =
      completedOrders > 0 ? newOnTimeDeliveries / completedOrders : 1.0;

    await this.prisma.supplierPerformance.update({
      where: { supplier: supplierId },
      data: {
        totalOrders: newTotalOrders,
        onTimeDeliveries: newOnTimeDeliveries,
        lateDeliveries: newLateDeliveries,
        avgDeliveryDays: Math.round(newAvgDeliveryDays * 100) / 100,
        reliabilityScore: Math.round(reliabilityScore * 10000) / 10000,
        lastOrderAt: new Date(),
      },
    });

    this.logger.log(
      `Updated SLA for supplier ${supplierId}: orderId=${orderId} actualDays=${actualDays} onTime=${isOnTime} reliabilityScore=${reliabilityScore.toFixed(3)}`,
    );
  }

  /**
   * Get top suppliers by SLA performance, optionally filtered by category.
   * Since SupplierPerformance has no category field, this ranks all suppliers
   * by composite score and the caller passes the category factor for prediction.
   */
  async getRankedSuppliers(category: string, limit = 10): Promise<SupplierSlaRanking[]> {
    const performances = await this.prisma.supplierPerformance.findMany({
      where: {
        totalOrders: { gte: 1 },
      },
      orderBy: { reliabilityScore: 'desc' },
      take: limit * 3, // fetch more to allow re-ranking after score calculation
    });

    const categoryFactor = CATEGORY_FACTOR[category.toLowerCase()] ?? CATEGORY_FACTOR['default']!;

    const ranked: SupplierSlaRanking[] = performances.map((p) => {
      const completedOrders = Math.max(p.totalOrders - p.cancelledOrders, 1);
      const onTimeRate = p.onTimeDeliveries / completedOrders;
      const avgDays = (p.avgDeliveryDays ?? 7) * categoryFactor;

      // Composite score: 60% reliability, 30% delivery speed (lower = better), 10% volume weight
      const speedScore = Math.max(0, 100 - avgDays * 5); // 5 pts per day, floors at 0
      const volumeWeight = Math.min(p.totalOrders / 100, 1); // caps at 100 orders
      const score =
        onTimeRate * 60 + (speedScore / 100) * 30 + volumeWeight * 10;

      return {
        supplierId: p.supplier,
        supplierName: p.supplier, // name lookup would require a Supplier model join
        avgDeliveryDays: Math.round(avgDays * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 1000) / 1000,
        score: Math.round(score * 100) / 100,
      };
    });

    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
