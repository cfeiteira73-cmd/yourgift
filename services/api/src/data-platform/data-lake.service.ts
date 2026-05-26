import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Result shapes ────────────────────────────────────────────────────────────

export interface ProcurementBucket {
  period: string;
  orderCount: number;
  totalValue: number;
  avgValue: number;
  supplierCount: number;
}

export interface ProcurementTimeSeriesResult {
  buckets: ProcurementBucket[];
}

export interface SupplierPeriod {
  period: string;
  orderCount: number;
  avgLeadDays: number;
  avgLandedCost: number;
  onTimeRate: number;
}

export interface SupplierTrendRow {
  supplierId: string;
  periods: SupplierPeriod[];
}

export interface SupplierTrendsResult {
  suppliers: SupplierTrendRow[];
}

export interface CategoryBenchmark {
  category: string;
  avgPrice: number;
  marketRate: number;
  savingsOpportunityPct: number;
  orderCount: number;
  totalSpend: number;
}

export interface CategoryBenchmarksResult {
  categories: CategoryBenchmark[];
}

export interface SlaSupplierRow {
  supplierId: string;
  onTimePct: number;
  orderCount: number;
}

export interface SlaPerformanceResult {
  onTimePct: number;
  avgDelayDays: number;
  p95DelayDays: number;
  bySupplier: SlaSupplierRow[];
}

export interface ForecastResult {
  forecastedOrders: number;
  forecastedSpend: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'stable' | 'decreasing';
  basisDays: number;
}

// ─── Raw query row types ──────────────────────────────────────────────────────

interface TimeSeriesRow {
  period: string;
  order_count: bigint | number;
  total_value: number | null;
  supplier_count: bigint | number;
}

interface CategoryRow {
  category: string;
  avg_price: number | null;
  order_count: bigint | number;
  total_spend: number | null;
}

interface DailyRow {
  day: string;
  order_count: bigint | number;
  total_value: number | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DataLakeService {
  private readonly logger = new Logger(DataLakeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Time-series aggregation ────────────────────────────────────────────────

  async getProcurementTimeSeries(params: {
    tenantId?: string;
    granularity: 'hour' | 'day' | 'week' | 'month';
    from: Date;
    to: Date;
  }): Promise<ProcurementTimeSeriesResult> {
    const { tenantId, granularity, from, to } = params;

    const truncMap: Record<string, string> = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    };
    const trunc = truncMap[granularity] ?? 'day';

    try {
      let rows: TimeSeriesRow[];

      if (tenantId) {
        rows = await this.prisma.$queryRaw<TimeSeriesRow[]>`
          SELECT
            to_char(date_trunc(${trunc}, created_at), 'YYYY-MM-DD HH24:00') AS period,
            COUNT(*)::bigint                                                  AS order_count,
            COALESCE(SUM(total_amount), 0)::float                            AS total_value,
            COUNT(DISTINCT supplier)::bigint                                 AS supplier_count
          FROM orders
          WHERE created_at >= ${from}
            AND created_at <= ${to}
            AND tenant_id = ${tenantId}
          GROUP BY date_trunc(${trunc}, created_at)
          ORDER BY date_trunc(${trunc}, created_at)
        `;
      } else {
        rows = await this.prisma.$queryRaw<TimeSeriesRow[]>`
          SELECT
            to_char(date_trunc(${trunc}, created_at), 'YYYY-MM-DD HH24:00') AS period,
            COUNT(*)::bigint                                                  AS order_count,
            COALESCE(SUM(total_amount), 0)::float                            AS total_value,
            COUNT(DISTINCT supplier)::bigint                                 AS supplier_count
          FROM orders
          WHERE created_at >= ${from}
            AND created_at <= ${to}
          GROUP BY date_trunc(${trunc}, created_at)
          ORDER BY date_trunc(${trunc}, created_at)
        `;
      }

      const buckets: ProcurementBucket[] = rows.map((r) => {
        const count = Number(r.order_count);
        const total = Number(r.total_value ?? 0);
        return {
          period: r.period,
          orderCount: count,
          totalValue: total,
          avgValue: count > 0 ? total / count : 0,
          supplierCount: Number(r.supplier_count),
        };
      });

      return { buckets };
    } catch (err) {
      this.logger.warn(`getProcurementTimeSeries error: ${String(err)}`);
      return { buckets: [] };
    }
  }

  // ── Supplier trends ────────────────────────────────────────────────────────

  async getSupplierTrends(params: {
    supplierId?: string;
    from: Date;
    to: Date;
  }): Promise<SupplierTrendsResult> {
    const { supplierId, from, to } = params;

    try {
      // Get distinct suppliers in range
      const supplierFilter = supplierId ? { supplier: supplierId } : {};
      const rawOrders = await this.prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(supplierId ? { supplier: supplierId } : {}),
          supplier: { not: null },
        },
        select: {
          supplier: true,
          totalAmount: true,
          createdAt: true,
          shippedAt: true,
          deliveredAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (rawOrders.length === 0) return { suppliers: [] };

      // Group by supplier, then by month
      const bySupplier = new Map<string, typeof rawOrders>();
      for (const order of rawOrders) {
        const key = order.supplier ?? 'unknown';
        if (!bySupplier.has(key)) bySupplier.set(key, []);
        bySupplier.get(key)!.push(order);
      }

      const suppliers: SupplierTrendRow[] = [];
      for (const [sid, orders] of bySupplier) {
        // Group by month
        const byMonth = new Map<string, typeof orders>();
        for (const o of orders) {
          const month = o.createdAt.toISOString().slice(0, 7); // YYYY-MM
          if (!byMonth.has(month)) byMonth.set(month, []);
          byMonth.get(month)!.push(o);
        }

        const periods: SupplierPeriod[] = [];
        for (const [month, monthOrders] of byMonth) {
          let totalLeadDays = 0;
          let deliveredCount = 0;
          let onTimeCount = 0;
          let totalCost = 0;

          for (const o of monthOrders) {
            totalCost += o.totalAmount ?? 0;
            if (o.deliveredAt) {
              deliveredCount++;
              const lead = (o.deliveredAt.getTime() - o.createdAt.getTime()) / 86_400_000;
              totalLeadDays += lead;
              // On-time = delivered within 14 days
              if (lead <= 14) onTimeCount++;
            }
          }

          periods.push({
            period: month,
            orderCount: monthOrders.length,
            avgLeadDays: deliveredCount > 0 ? totalLeadDays / deliveredCount : 0,
            avgLandedCost: totalCost / monthOrders.length,
            onTimeRate: deliveredCount > 0 ? onTimeCount / deliveredCount : 0,
          });
        }

        suppliers.push({ supplierId: sid, periods: periods.sort((a, b) => a.period.localeCompare(b.period)) });
        void supplierFilter; // used above
      }

      return { suppliers };
    } catch (err) {
      this.logger.warn(`getSupplierTrends error: ${String(err)}`);
      return { suppliers: [] };
    }
  }

  // ── Category benchmarks ────────────────────────────────────────────────────

  async getCategoryBenchmarks(tenantId?: string): Promise<CategoryBenchmarksResult> {
    try {
      let rows: CategoryRow[];
      if (tenantId) {
        rows = await this.prisma.$queryRaw<CategoryRow[]>`
          SELECT
            p.category,
            AVG(oi.unit_price)::float     AS avg_price,
            COUNT(oi.id)::bigint          AS order_count,
            SUM(oi.unit_price * oi.quantity)::float AS total_spend
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          JOIN orders o   ON o.id = oi.order_id
          WHERE o.tenant_id = ${tenantId}
          GROUP BY p.category
          ORDER BY total_spend DESC
        `;
      } else {
        rows = await this.prisma.$queryRaw<CategoryRow[]>`
          SELECT
            p.category,
            AVG(oi.unit_price)::float     AS avg_price,
            COUNT(oi.id)::bigint          AS order_count,
            SUM(oi.unit_price * oi.quantity)::float AS total_spend
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          GROUP BY p.category
          ORDER BY total_spend DESC
        `;
      }

      const categories: CategoryBenchmark[] = rows.map((r) => {
        const avgPrice = Number(r.avg_price ?? 0);
        // Market rate approximated as 95% of avg (5% savings baseline)
        const marketRate = avgPrice * 0.95;
        const savingsOpportunityPct =
          avgPrice > 0 ? ((avgPrice - marketRate) / avgPrice) * 100 : 0;
        return {
          category: r.category,
          avgPrice,
          marketRate,
          savingsOpportunityPct,
          orderCount: Number(r.order_count),
          totalSpend: Number(r.total_spend ?? 0),
        };
      });

      return { categories };
    } catch (err) {
      this.logger.warn(`getCategoryBenchmarks error: ${String(err)}`);
      return { categories: [] };
    }
  }

  // ── SLA performance ────────────────────────────────────────────────────────

  async getSlaPerformance(from: Date, to: Date): Promise<SlaPerformanceResult> {
    const zero: SlaPerformanceResult = {
      onTimePct: 0,
      avgDelayDays: 0,
      p95DelayDays: 0,
      bySupplier: [],
    };

    try {
      const delivered = await this.prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          deliveredAt: { not: null },
        },
        select: {
          supplier: true,
          createdAt: true,
          deliveredAt: true,
        },
      });

      if (delivered.length === 0) return zero;

      const SLA_DAYS = 14;
      const delayDays: number[] = [];
      let onTimeTotal = 0;
      const bySupplierMap = new Map<string, { total: number; onTime: number }>();

      for (const o of delivered) {
        if (!o.deliveredAt) continue;
        const lead = (o.deliveredAt.getTime() - o.createdAt.getTime()) / 86_400_000;
        const delay = Math.max(0, lead - SLA_DAYS);
        delayDays.push(delay);
        if (delay === 0) onTimeTotal++;

        const key = o.supplier ?? 'unknown';
        const entry = bySupplierMap.get(key) ?? { total: 0, onTime: 0 };
        entry.total++;
        if (delay === 0) entry.onTime++;
        bySupplierMap.set(key, entry);
      }

      delayDays.sort((a, b) => a - b);
      const p95Index = Math.floor(delayDays.length * 0.95);
      const avgDelay = delayDays.reduce((s, v) => s + v, 0) / delayDays.length;

      const bySupplier: SlaSupplierRow[] = [];
      for (const [sid, stats] of bySupplierMap) {
        bySupplier.push({
          supplierId: sid,
          onTimePct: stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0,
          orderCount: stats.total,
        });
      }

      return {
        onTimePct: (onTimeTotal / delivered.length) * 100,
        avgDelayDays: avgDelay,
        p95DelayDays: delayDays[p95Index] ?? 0,
        bySupplier: bySupplier.sort((a, b) => b.orderCount - a.orderCount),
      };
    } catch (err) {
      this.logger.warn(`getSlaPerformance error: ${String(err)}`);
      return zero;
    }
  }

  // ── Procurement forecast ───────────────────────────────────────────────────

  async getProcurementForecast(
    tenantId?: string,
    horizonDays = 30,
  ): Promise<ForecastResult> {
    const zero: ForecastResult = {
      forecastedOrders: 0,
      forecastedSpend: 0,
      confidence: 'low',
      trend: 'stable',
      basisDays: 0,
    };

    try {
      const basisDays = 90;
      const from = new Date(Date.now() - basisDays * 86_400_000);
      const to = new Date();

      let rows: DailyRow[];
      if (tenantId) {
        rows = await this.prisma.$queryRaw<DailyRow[]>`
          SELECT
            to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*)::bigint                                       AS order_count,
            COALESCE(SUM(total_amount), 0)::float                 AS total_value
          FROM orders
          WHERE created_at >= ${from}
            AND created_at <= ${to}
            AND tenant_id = ${tenantId}
          GROUP BY date_trunc('day', created_at)
          ORDER BY date_trunc('day', created_at)
        `;
      } else {
        rows = await this.prisma.$queryRaw<DailyRow[]>`
          SELECT
            to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*)::bigint                                       AS order_count,
            COALESCE(SUM(total_amount), 0)::float                 AS total_value
          FROM orders
          WHERE created_at >= ${from}
            AND created_at <= ${to}
          GROUP BY date_trunc('day', created_at)
          ORDER BY date_trunc('day', created_at)
        `;
      }

      if (rows.length < 7) return zero;

      // Simple linear regression on daily order counts
      const n = rows.length;
      const counts = rows.map((r) => Number(r.order_count));
      const spends = rows.map((r) => Number(r.total_value ?? 0));

      const sumX = (n * (n - 1)) / 2;
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      const sumY = counts.reduce((s, v) => s + v, 0);
      const sumXY = counts.reduce((s, v, i) => s + v * i, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Forecast at midpoint of horizon
      const forecastX = n + horizonDays / 2;
      const dailyForecastOrders = Math.max(0, slope * forecastX + intercept);
      const avgDailySpend = spends.reduce((s, v) => s + v, 0) / n;
      const spendSlope =
        (n * spends.reduce((s, v, i) => s + v * i, 0) - sumX * spends.reduce((s, v) => s + v, 0)) /
        (n * sumX2 - sumX * sumX);
      const forecastedDailySpend = Math.max(0, avgDailySpend + spendSlope * (horizonDays / 2));

      const forecastedOrders = Math.round(dailyForecastOrders * horizonDays);
      const forecastedSpend = forecastedDailySpend * horizonDays;

      // Confidence based on data coverage
      const coverage = n / basisDays;
      const confidence: ForecastResult['confidence'] =
        coverage >= 0.7 ? 'high' : coverage >= 0.4 ? 'medium' : 'low';

      // Trend: slope per day relative to average
      const avgOrders = sumY / n;
      const relativeSlope = avgOrders > 0 ? slope / avgOrders : 0;
      const trend: ForecastResult['trend'] =
        relativeSlope > 0.03 ? 'increasing' : relativeSlope < -0.03 ? 'decreasing' : 'stable';

      return { forecastedOrders, forecastedSpend, confidence, trend, basisDays: n };
    } catch (err) {
      this.logger.warn(`getProcurementForecast error: ${String(err)}`);
      return zero;
    }
  }

  // ── ClickHouse export ──────────────────────────────────────────────────────

  async exportForClickHouse(from: Date, to: Date): Promise<Record<string, unknown>[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        include: {
          items: {
            include: { product: { select: { category: true, title: true } } },
          },
        },
        take: 10_000,
        orderBy: { createdAt: 'asc' },
      });

      return orders.flatMap((o) =>
        o.items.map((item) => ({
          event_type: 'order_item',
          order_id: o.id,
          order_ref: o.ref,
          order_status: o.status,
          tenant_id: o.tenantId,
          supplier: o.supplier ?? '',
          currency: o.currency,
          total_amount: o.totalAmount ?? 0,
          created_at: o.createdAt.toISOString(),
          approved_at: o.approvedAt?.toISOString() ?? null,
          shipped_at: o.shippedAt?.toISOString() ?? null,
          delivered_at: o.deliveredAt?.toISOString() ?? null,
          item_id: item.id,
          product_id: item.productId,
          product_category: item.product?.category ?? '',
          product_title: item.product?.title ?? '',
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit_cost: item.unitCost,
          print_cost: item.printCost,
          line_total: item.unitPrice * item.quantity,
        })),
      );
    } catch (err) {
      this.logger.warn(`exportForClickHouse error: ${String(err)}`);
      return [];
    }
  }
}
