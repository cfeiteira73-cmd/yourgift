import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface SupplierScore {
  supplierId: string;           // maps to SupplierPerformance.supplier
  onTimeRate: number;           // 0–1
  avgDeliveryDays: number;
  defectRate: number;           // 0–1 (derived from lateDeliveries / totalOrders)
  ratingAvg: number;            // 0–5 (derived from reliabilityScore * 5)
  refundRate: number;           // 0–1
  sampleCount: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  lastUpdated: Date;
  compositeScore: number;
}

export interface RoutingOptimization {
  category: string;
  recommendedSupplierIds: string[];
  avgLeadDays: number;
  avgCostEur: number;
  updatedAt: Date;
}

export interface LearningCycle {
  cycleId: string;
  startedAt: Date;
  completedAt: Date;
  suppliersUpdated: number;
  routingsUpdated: number;
  insightsGenerated: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class ProductionLearningLoopService {
  private readonly logger = new Logger(ProductionLearningLoopService.name);
  private readonly supplierScores = new Map<string, SupplierScore>();
  private readonly routingOptimizations = new Map<string, RoutingOptimization>();
  private readonly cycles: LearningCycle[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private computeConfidenceLevel(sampleCount: number): SupplierScore['confidenceLevel'] {
    if (sampleCount >= 50) return 'high';
    if (sampleCount >= 10) return 'medium';
    return 'low';
  }

  private computeCompositeScore(
    onTimeRate: number,
    ratingAvg: number,
    defectRate: number,
    avgDeliveryDays: number,
  ): number {
    const speedFactor = 1 - this.clamp(avgDeliveryDays / 30, 0, 1);
    return (
      0.4 * onTimeRate +
      0.3 * (ratingAvg / 5) +
      0.2 * (1 - defectRate) +
      0.1 * speedFactor
    );
  }

  // -------------------------------------------------------------------------
  // runLearningCycle
  // -------------------------------------------------------------------------
  async runLearningCycle(): Promise<LearningCycle> {
    const cycleId = randomUUID();
    const startedAt = new Date();
    this.logger.log(`Learning cycle ${cycleId} started`);

    // Fetch all SupplierPerformance records (they aggregate data already)
    const performances = await this.prisma.supplierPerformance.findMany();

    // Compute refund counts per supplier via Order refunds
    // Orders have a `supplier` field (String?) matching SupplierPerformance.supplier
    const refundedOrders = await this.prisma.order.findMany({
      where: { refunds: { some: {} } },
      select: { supplier: true },
    });

    const supplierRefundCount = new Map<string, number>();
    for (const order of refundedOrders) {
      if (order.supplier) {
        supplierRefundCount.set(
          order.supplier,
          (supplierRefundCount.get(order.supplier) ?? 0) + 1,
        );
      }
    }

    let suppliersUpdated = 0;
    const now = new Date();

    for (const perf of performances) {
      const supplierId = perf.supplier;
      const totalOrders = perf.totalOrders;

      // onTimeRate derived from on_time_deliveries / total_orders
      const onTimeRate =
        totalOrders === 0 ? 0 : perf.onTimeDeliveries / totalOrders;

      // defectRate derived from late_deliveries / total_orders (proxy)
      const defectRate =
        totalOrders === 0 ? 0 : perf.lateDeliveries / totalOrders;

      // ratingAvg derived from reliabilityScore (0–1 → 0–5 scale)
      const ratingAvg = perf.reliabilityScore * 5;

      const avgDeliveryDays = perf.avgDeliveryDays ?? 0;

      const refundCount = supplierRefundCount.get(supplierId) ?? 0;
      const refundRate = totalOrders === 0 ? 0 : refundCount / totalOrders;

      const compositeScore = this.computeCompositeScore(
        onTimeRate,
        ratingAvg,
        defectRate,
        avgDeliveryDays,
      );

      const score: SupplierScore = {
        supplierId,
        onTimeRate,
        avgDeliveryDays,
        defectRate,
        ratingAvg,
        refundRate,
        sampleCount: totalOrders,
        confidenceLevel: this.computeConfidenceLevel(totalOrders),
        lastUpdated: now,
        compositeScore,
      };

      this.supplierScores.set(supplierId, score);
      suppliersUpdated += 1;
    }

    // Build routing optimizations
    // Use SupplierRoutingMatrix to get category groupings
    const routingMatrixRows = await this.prisma.supplierRoutingMatrix.findMany({
      where: { isActive: true },
      select: {
        supplierId: true,
        category: true,
        leadTimeDays: true,
        minOrderValue: true,
      },
    });

    // Group by category
    const categoryMap = new Map<
      string,
      Array<{ supplierId: string; leadTimeDays: number; minOrderValue: number }>
    >();
    for (const row of routingMatrixRows) {
      if (!categoryMap.has(row.category)) {
        categoryMap.set(row.category, []);
      }
      categoryMap.get(row.category)!.push({
        supplierId: row.supplierId,
        leadTimeDays: row.leadTimeDays,
        minOrderValue: Number(row.minOrderValue),
      });
    }

    let routingsUpdated = 0;

    for (const [category, suppliers] of categoryMap.entries()) {
      const rankedIds = suppliers
        .map((s) => ({
          supplierId: s.supplierId,
          score: this.supplierScores.get(s.supplierId)?.compositeScore ?? 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((s) => s.supplierId);

      const avgLeadDays =
        suppliers.length === 0
          ? 0
          : suppliers.reduce((s, r) => s + r.leadTimeDays, 0) / suppliers.length;

      const avgCostEur =
        suppliers.length === 0
          ? 0
          : suppliers.reduce((s, r) => s + r.minOrderValue, 0) / suppliers.length;

      this.routingOptimizations.set(category, {
        category,
        recommendedSupplierIds: rankedIds,
        avgLeadDays,
        avgCostEur,
        updatedAt: now,
      });
      routingsUpdated += 1;
    }

    // Also build a "default" routing from all suppliers
    const allScores = Array.from(this.supplierScores.values());
    const defaultRanked = allScores
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((s) => s.supplierId);
    const defaultAvgLead =
      allScores.length === 0
        ? 0
        : allScores.reduce((s, sc) => s + sc.avgDeliveryDays, 0) / allScores.length;

    this.routingOptimizations.set('default', {
      category: 'default',
      recommendedSupplierIds: defaultRanked,
      avgLeadDays: defaultAvgLead,
      avgCostEur: 0,
      updatedAt: now,
    });
    routingsUpdated += 1;

    const completedAt = new Date();
    const cycle: LearningCycle = {
      cycleId,
      startedAt,
      completedAt,
      suppliersUpdated,
      routingsUpdated,
      insightsGenerated: 0,
    };

    this.cycles.push(cycle);
    this.eventBus.emit('learning.cycle_completed', cycle);
    this.logger.log(
      `Learning cycle ${cycleId} completed: ${suppliersUpdated} suppliers, ${routingsUpdated} routings`,
    );
    return cycle;
  }

  // -------------------------------------------------------------------------
  // getSupplierScore
  // -------------------------------------------------------------------------
  getSupplierScore(supplierId: string): SupplierScore | null {
    return this.supplierScores.get(supplierId) ?? null;
  }

  // -------------------------------------------------------------------------
  // getRankedSuppliers
  // -------------------------------------------------------------------------
  getRankedSuppliers(category?: string, limit = 10): SupplierScore[] {
    let suppliers: SupplierScore[];

    if (category) {
      const routing = this.routingOptimizations.get(category);
      if (routing) {
        suppliers = routing.recommendedSupplierIds
          .map((id) => this.supplierScores.get(id))
          .filter((s): s is SupplierScore => s !== undefined);
      } else {
        suppliers = Array.from(this.supplierScores.values());
      }
    } else {
      suppliers = Array.from(this.supplierScores.values());
    }

    return suppliers
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // getRoutingOptimization
  // -------------------------------------------------------------------------
  getRoutingOptimization(category: string): RoutingOptimization | null {
    return this.routingOptimizations.get(category) ?? null;
  }

  // -------------------------------------------------------------------------
  // generateProcurementInsights
  // -------------------------------------------------------------------------
  async generateProcurementInsights(
    tenantId: string,
  ): Promise<
    Array<{
      type: string;
      message: string;
      impact: 'high' | 'medium' | 'low';
      supplierId?: string;
    }>
  > {
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ProcurementRequest has no supplierId, but orders have a supplier field
    // Use orders created by this tenant in the last 30 days
    const tenantOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: since30Days },
        supplier: { not: null },
      },
      select: { supplier: true },
      distinct: ['supplier'],
    });

    const supplierIds = tenantOrders
      .map((o) => o.supplier)
      .filter((s): s is string => s !== null);

    const insights: Array<{
      type: string;
      message: string;
      impact: 'high' | 'medium' | 'low';
      supplierId?: string;
    }> = [];

    for (const supplierId of supplierIds) {
      if (insights.length >= 10) break;

      const score = this.supplierScores.get(supplierId);
      if (!score) continue;

      if (score.onTimeRate < 0.8) {
        insights.push({
          type: 'supplier_risk',
          message: `Supplier ${supplierId} has ${(score.onTimeRate * 100).toFixed(1)}% on-time delivery rate (below 80% threshold)`,
          impact: 'high',
          supplierId,
        });
      } else if (score.compositeScore > 0.9) {
        insights.push({
          type: 'top_performer',
          message: `Supplier ${supplierId} is a top performer with composite score ${score.compositeScore.toFixed(3)}`,
          impact: 'low',
          supplierId,
        });
      }
    }

    return insights;
  }

  // -------------------------------------------------------------------------
  // getLastCycles
  // -------------------------------------------------------------------------
  getLastCycles(limit = 10): LearningCycle[] {
    return this.cycles.slice(-limit);
  }
}
