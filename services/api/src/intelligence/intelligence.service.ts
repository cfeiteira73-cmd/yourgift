import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class IntelligenceService implements OnModuleInit {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // Update supplier score on every order delivery
    this.events.on('order.delivered', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.supplier) {
          await this.recordDelivery(order.supplier, order.createdAt, order.deliveredAt ?? new Date(), false);
        }
      } catch (err) {
        this.logger.error(`Failed to update supplier performance on delivery: ${err}`);
      }
    });

    // Update supplier score on order cancellation
    this.events.on('order.cancelled', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.supplier) {
          await this.recordCancellation(order.supplier);
        }
      } catch (err) {
        this.logger.error(`Failed to update supplier performance on cancellation: ${err}`);
      }
    });

    // Recompute procurement intelligence on every paid order
    this.events.on('order.paid', async ({ orderId: _orderId }: { orderId: string }) => {
      try {
        await this.recomputeIntelligence();
      } catch (err) {
        this.logger.error(`Failed to recompute intelligence: ${err}`);
      }
    });
  }

  /** Record a successful delivery and update supplier reliability score */
  async recordDelivery(
    supplier: string,
    orderedAt: Date,
    deliveredAt: Date,
    isLate: boolean,
  ): Promise<void> {
    const deliveryDays = Math.floor((deliveredAt.getTime() - orderedAt.getTime()) / (1000 * 60 * 60 * 24));

    const existing = await this.prisma.supplierPerformance.findUnique({ where: { supplier } });

    const totalOrders = (existing?.totalOrders ?? 0) + 1;
    const onTimeDeliveries = (existing?.onTimeDeliveries ?? 0) + (isLate ? 0 : 1);
    const lateDeliveries = (existing?.lateDeliveries ?? 0) + (isLate ? 1 : 0);

    // Weighted avg delivery days
    const prevAvg = existing?.avgDeliveryDays ?? deliveryDays;
    const avgDeliveryDays = existing
      ? (prevAvg * existing.totalOrders + deliveryDays) / totalOrders
      : deliveryDays;

    // Reliability score: on-time rate weighted by recency
    const onTimeRate = onTimeDeliveries / totalOrders;
    const cancellationPenalty = Math.min(0.3, (existing?.cancelledOrders ?? 0) / Math.max(totalOrders, 1) * 0.5);
    const reliabilityScore = Math.max(0, Math.min(1.0, onTimeRate - cancellationPenalty));

    await this.prisma.supplierPerformance.upsert({
      where: { supplier },
      create: {
        supplier,
        totalOrders,
        onTimeDeliveries,
        lateDeliveries,
        avgDeliveryDays,
        reliabilityScore,
        lastOrderAt: deliveredAt,
      },
      update: {
        totalOrders,
        onTimeDeliveries,
        lateDeliveries,
        avgDeliveryDays,
        reliabilityScore,
        lastOrderAt: deliveredAt,
      },
    });

    this.logger.log(`Supplier ${supplier} score updated: ${(reliabilityScore * 100).toFixed(0)}% reliability (${totalOrders} orders)`);
  }

  /** Record a supplier-side cancellation */
  async recordCancellation(supplier: string): Promise<void> {
    const existing = await this.prisma.supplierPerformance.findUnique({ where: { supplier } });
    const totalOrders = (existing?.totalOrders ?? 0) + 1;
    const cancelledOrders = (existing?.cancelledOrders ?? 0) + 1;

    const onTimeRate = (existing?.onTimeDeliveries ?? 0) / totalOrders;
    const cancellationPenalty = Math.min(0.3, cancelledOrders / totalOrders * 0.5);
    const reliabilityScore = Math.max(0, Math.min(1.0, onTimeRate - cancellationPenalty));

    await this.prisma.supplierPerformance.upsert({
      where: { supplier },
      create: { supplier, totalOrders, cancelledOrders, reliabilityScore },
      update: { totalOrders, cancelledOrders, reliabilityScore },
    });
  }

  /** Get all supplier performance records */
  async getSupplierScores() {
    return this.prisma.supplierPerformance.findMany({
      orderBy: { reliabilityScore: 'desc' },
    });
  }

  /** Recompute procurement intelligence signals for top products/categories */
  async recomputeIntelligence(): Promise<{ computed: number }> {
    const now = new Date();
    const day30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get top products by order volume in last 30 days
    const productItems30d = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: day30ago },
          status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] },
        },
      },
      include: { product: true, order: true },
    });

    // Aggregate by product
    const productMap = new Map<string, { qty30d: number; revenue30d: number; qty7d: number; category: string }>();

    for (const item of productItems30d) {
      const pid = item.productId;
      const existing = productMap.get(pid) ?? { qty30d: 0, revenue30d: 0, qty7d: 0, category: item.product.category };
      existing.qty30d += item.quantity;
      existing.revenue30d += item.unitPrice * item.quantity;
      if (item.order && (item as unknown as { order: { createdAt: Date } }).order.createdAt >= day7ago) {
        existing.qty7d += item.quantity;
      }
      productMap.set(pid, existing);
    }

    let computed = 0;

    for (const [productId, data] of productMap.entries()) {
      // Signal type based on 7d vs 30d ratio
      const weeklyRate = data.qty7d / 7;
      const monthlyRate = data.qty30d / 30;
      const trend = weeklyRate / Math.max(monthlyRate, 0.01);

      const signalType = trend > 1.5 ? 'trending_up' : trend < 0.5 ? 'trending_down' : 'popular';
      const score = data.revenue30d * (0.5 + trend * 0.5);

      await this.prisma.procurementIntelligence.upsert({
        where: { entityType_entityId: { entityType: 'product', entityId: productId } },
        create: {
          entityType: 'product',
          entityId: productId,
          signalType,
          score,
          orderCount30d: data.qty30d,
          orderCount7d: data.qty7d,
          revenue30d: data.revenue30d,
        },
        update: {
          signalType,
          score,
          orderCount30d: data.qty30d,
          orderCount7d: data.qty7d,
          revenue30d: data.revenue30d,
          computedAt: new Date(),
        },
      });
      computed++;
    }

    // Aggregate by category
    const categoryMap = new Map<string, { qty30d: number; revenue30d: number; qty7d: number }>();
    for (const [, data] of productMap.entries()) {
      const cat = data.category;
      const existing = categoryMap.get(cat) ?? { qty30d: 0, revenue30d: 0, qty7d: 0 };
      existing.qty30d += data.qty30d;
      existing.revenue30d += data.revenue30d;
      existing.qty7d += data.qty7d;
      categoryMap.set(cat, existing);
    }

    for (const [category, data] of categoryMap.entries()) {
      const weeklyRate = data.qty7d / 7;
      const monthlyRate = data.qty30d / 30;
      const trend = weeklyRate / Math.max(monthlyRate, 0.01);
      const signalType = trend > 1.5 ? 'trending_up' : trend < 0.5 ? 'trending_down' : 'popular';

      await this.prisma.procurementIntelligence.upsert({
        where: { entityType_entityId: { entityType: 'category', entityId: category } },
        create: {
          entityType: 'category',
          entityId: category,
          signalType,
          score: data.revenue30d,
          orderCount30d: data.qty30d,
          orderCount7d: data.qty7d,
          revenue30d: data.revenue30d,
        },
        update: {
          signalType,
          score: data.revenue30d,
          orderCount30d: data.qty30d,
          orderCount7d: data.qty7d,
          revenue30d: data.revenue30d,
          computedAt: new Date(),
        },
      });
      computed++;
    }

    this.logger.log(`Procurement intelligence recomputed: ${computed} signals`);
    return { computed };
  }

  /** Get top intelligence signals */
  async getSignals(entityType?: string, limit = 50) {
    return this.prisma.procurementIntelligence.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { score: 'desc' },
      take: limit,
    });
  }

  /** Get system health summary */
  async getSystemHealth() {
    const [
      totalOrders,
      eventCount,
      supplierScores,
      signals,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.procurementEvent.count(),
      this.prisma.supplierPerformance.findMany(),
      this.prisma.procurementIntelligence.count(),
    ]);

    const avgReliability = supplierScores.length > 0
      ? supplierScores.reduce((s: number, r: { reliabilityScore: number }) => s + r.reliabilityScore, 0) / supplierScores.length
      : 1.0;

    return {
      totalOrders,
      eventStreamSize: eventCount,
      supplierCount: supplierScores.length,
      avgSupplierReliability: avgReliability,
      intelligenceSignals: signals,
      supplierScores,
    };
  }
}
