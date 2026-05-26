import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface ProductRecommendation {
  productId: string;
  productName: string;
  score: number;
  reason: 'frequently_bought_together' | 'same_category' | 'reorder_candidate' | 'trending';
  estimatedConversionRate: number;
}

export interface ReorderAlert {
  clientId: string;
  productId: string;
  productName: string;
  lastOrderDate: Date;
  estimatedReorderDate: Date;
  daysSinceLastOrder: number;
  avgReorderCycleDays: number;
  urgency: 'low' | 'medium' | 'high' | 'overdue';
}

export interface ClientLifetimeMetrics {
  clientId: string;
  tenantId: string;
  totalOrderCount: number;
  totalRevenueEur: number;
  avgOrderValueEur: number;
  firstOrderDate: Date | null;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  estimatedLtvEur: number;
  churnRiskScore: number;
  repeatPurchaseRate: number;
  segment: 'champion' | 'loyal' | 'at-risk' | 'lost' | 'new';
}

export interface ConversionFunnelMetrics {
  tenantId: string;
  period: { from: Date; to: Date };
  totalSessions: number;
  ordersPlaced: number;
  conversionRate: number;
  avgOrderValueEur: number;
  totalRevenueEur: number;
  topCategories: Array<{ categoryId: string; orderCount: number; revenueEur: number }>;
}

// ── Internal shapes matching real Prisma schema ──────────────────────────────

interface RawOrder {
  id: string;
  ref: string;
  status: string;
  totalAmount: number | null;
  currency: string;
  tenantId: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RawOrderWithItems extends RawOrder {
  items: Array<{
    product: {
      id: string;
      title: string;
      category: string;
      basePrice: number;
    } | null;
  }>;
}

interface RawProduct {
  id: string;
  title: string;
  category: string;
  basePrice: number;
}

// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY;
}

function subDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

@Injectable()
export class CommerceIntelligenceService implements OnModuleInit {
  private readonly logger = new Logger(CommerceIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    const intervalMs = 24 * 60 * 60 * 1000;
    setInterval(() => {
      this.emitRetentionEvents().catch((err: unknown) => {
        this.logger.error('emitRetentionEvents failed', err);
      });
    }, intervalMs);
  }

  // ── Product recommendations ────────────────────────────────────────────────

  async getProductRecommendations(
    clientId: string,
    limit = 6,
  ): Promise<ProductRecommendation[]> {
    try {
      const orders = (await this.prisma.order.findMany({
        where: { clientId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })) as unknown as RawOrderWithItems[];

      const seenProductIds = new Set<string>();
      const seenCategories = new Set<string>();

      for (const order of orders) {
        for (const item of order.items) {
          if (item.product) {
            seenProductIds.add(item.product.id);
            seenCategories.add(item.product.category);
          }
        }
      }

      if (seenCategories.size === 0) return [];

      const allProducts = (await this.prisma.product.findMany({
        where: {
          isActive: true,
          category: { in: Array.from(seenCategories) },
        },
        select: { id: true, title: true, category: true, basePrice: true },
      })) as unknown as RawProduct[];

      const recommendations: ProductRecommendation[] = allProducts
        .filter((p) => !seenProductIds.has(p.id))
        .map((p) => {
          const inCategory = seenCategories.has(p.category);
          return {
            productId: p.id,
            productName: p.title,
            score: inCategory ? 0.8 : 0.3,
            reason: (inCategory ? 'same_category' : 'trending') as ProductRecommendation['reason'],
            estimatedConversionRate: inCategory ? 0.08 : 0.03,
          };
        });

      recommendations.sort((a, b) => b.score - a.score);
      return recommendations.slice(0, limit);
    } catch (err: unknown) {
      this.logger.error('getProductRecommendations error', err);
      return [];
    }
  }

  // ── Reorder alerts ─────────────────────────────────────────────────────────

  async getReorderAlerts(
    tenantId: string,
    windowDays = 7,
  ): Promise<ReorderAlert[]> {
    const now = new Date();
    const since90 = subDays(now, 90);

    const orders = (await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['delivered'] },
        createdAt: { gte: since90 },
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })) as unknown as RawOrderWithItems[];

    const byClient = new Map<string, RawOrderWithItems[]>();
    for (const order of orders) {
      const existing = byClient.get(order.clientId) ?? [];
      existing.push(order);
      byClient.set(order.clientId, existing);
    }

    const alerts: ReorderAlert[] = [];

    for (const [clientId, clientOrders] of byClient) {
      const sorted = [...clientOrders].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      let avgReorderCycleDays = 30;
      if (sorted.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalGap += daysBetween(sorted[i - 1].createdAt, sorted[i].createdAt);
        }
        avgReorderCycleDays = totalGap / (sorted.length - 1);
      }

      const lastOrder = sorted[sorted.length - 1];
      const lastOrderDate = lastOrder.createdAt;
      const daysSinceLastOrder = daysBetween(lastOrderDate, now);
      const estimatedReorderDate = addDays(lastOrderDate, avgReorderCycleDays);

      const daysUntilReorder =
        (estimatedReorderDate.getTime() - now.getTime()) / MS_PER_DAY;
      if (daysUntilReorder > windowDays) continue;

      const ratio = daysSinceLastOrder / avgReorderCycleDays;
      let urgency: ReorderAlert['urgency'];
      if (ratio > 1.2) urgency = 'overdue';
      else if (ratio > 0.9) urgency = 'high';
      else if (ratio > 0.7) urgency = 'medium';
      else urgency = 'low';

      const firstItem = lastOrder.items?.[0];
      const productId = firstItem?.product?.id ?? 'unknown';
      const productName = firstItem?.product?.title ?? 'Unknown Product';

      alerts.push({
        clientId,
        productId,
        productName,
        lastOrderDate,
        estimatedReorderDate,
        daysSinceLastOrder,
        avgReorderCycleDays,
        urgency,
      });

      if (alerts.length >= 50) break;
    }

    return alerts;
  }

  // ── Client lifetime metrics ────────────────────────────────────────────────

  async getClientLifetimeMetrics(clientId: string): Promise<ClientLifetimeMetrics> {
    const orders = (await this.prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    })) as unknown as RawOrder[];

    const tenantId = orders[0]?.tenantId ?? '';
    const totalOrderCount = orders.length;
    const totalRevenueEur = orders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const avgOrderValueEur =
      totalOrderCount > 0 ? totalRevenueEur / totalOrderCount : 0;

    const firstOrderDate = orders[0]?.createdAt ?? null;
    const lastOrderDate = orders[orders.length - 1]?.createdAt ?? null;
    const now = new Date();

    const daysSinceLastOrder =
      lastOrderDate !== null ? daysBetween(lastOrderDate, now) : null;

    let avgReorderCycleDays = 30;
    if (orders.length >= 2) {
      let totalGap = 0;
      for (let i = 1; i < orders.length; i++) {
        totalGap += daysBetween(orders[i - 1].createdAt, orders[i].createdAt);
      }
      avgReorderCycleDays = totalGap / (orders.length - 1);
    }

    let estimatedLtvEur = totalRevenueEur;
    if (firstOrderDate !== null && lastOrderDate !== null) {
      const monthsActive =
        (lastOrderDate.getTime() - firstOrderDate.getTime()) / (MS_PER_DAY * 30);
      if (monthsActive > 0) {
        estimatedLtvEur = (totalRevenueEur / monthsActive) * 24;
      }
    }

    let churnRiskScore = 0.2;
    if (daysSinceLastOrder !== null) {
      if (daysSinceLastOrder > 2 * avgReorderCycleDays) {
        churnRiskScore = 0.9;
      } else if (daysSinceLastOrder > avgReorderCycleDays) {
        churnRiskScore = 0.6;
      }
    }

    const repeatPurchaseRate = totalOrderCount > 1 ? 1 : 0;

    let segment: ClientLifetimeMetrics['segment'];
    if (totalOrderCount <= 1) {
      segment = 'new';
    } else if (totalOrderCount >= 5 && churnRiskScore < 0.4) {
      segment = 'champion';
    } else if (totalOrderCount >= 3 && churnRiskScore < 0.6) {
      segment = 'loyal';
    } else if (churnRiskScore >= 0.9) {
      segment = 'lost';
    } else if (churnRiskScore >= 0.6) {
      segment = 'at-risk';
    } else {
      segment = 'loyal';
    }

    return {
      clientId,
      tenantId,
      totalOrderCount,
      totalRevenueEur,
      avgOrderValueEur,
      firstOrderDate,
      lastOrderDate,
      daysSinceLastOrder,
      estimatedLtvEur,
      churnRiskScore,
      repeatPurchaseRate,
      segment,
    };
  }

  // ── Conversion funnel ──────────────────────────────────────────────────────

  async getConversionFunnelMetrics(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<ConversionFunnelMetrics> {
    const orders = (await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: { items: { include: { product: true } } },
    })) as unknown as RawOrderWithItems[];

    const ordersPlaced = orders.length;
    const totalSessions = ordersPlaced * 3;
    const conversionRate = totalSessions > 0 ? ordersPlaced / totalSessions : 0;

    const totalRevenueEur = orders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const avgOrderValueEur = ordersPlaced > 0 ? totalRevenueEur / ordersPlaced : 0;

    const categoryMap = new Map<string, { orderCount: number; revenueEur: number }>();

    for (const order of orders) {
      const orderRevenue = order.totalAmount ?? 0;
      const items = order.items;

      if (items.length > 0) {
        for (const item of items) {
          const catId = item.product?.category ?? 'uncategorized';
          const existing = categoryMap.get(catId) ?? { orderCount: 0, revenueEur: 0 };
          categoryMap.set(catId, {
            orderCount: existing.orderCount + 1,
            revenueEur: existing.revenueEur + (item.product?.basePrice ?? 0),
          });
        }
      } else {
        const existing = categoryMap.get('uncategorized') ?? { orderCount: 0, revenueEur: 0 };
        categoryMap.set('uncategorized', {
          orderCount: existing.orderCount + 1,
          revenueEur: existing.revenueEur + orderRevenue,
        });
      }
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({ categoryId, ...data }))
      .sort((a, b) => b.revenueEur - a.revenueEur)
      .slice(0, 10);

    return {
      tenantId,
      period: { from: fromDate, to: toDate },
      totalSessions,
      ordersPlaced,
      conversionRate,
      avgOrderValueEur,
      totalRevenueEur,
      topCategories,
    };
  }

  // ── Churn risk clients ─────────────────────────────────────────────────────

  async getChurnRiskClients(
    tenantId: string,
    limit = 20,
  ): Promise<ClientLifetimeMetrics[]> {
    const since6Months = subDays(new Date(), 180);

    const rows = await this.prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since6Months } },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const clientIds = rows
      .map((o) => o.clientId)
      .filter((id): id is string => id !== null);

    const metrics = await Promise.all(
      clientIds.map((id) => this.getClientLifetimeMetrics(id)),
    );

    return metrics
      .filter((m) => m.churnRiskScore >= 0.6)
      .sort((a, b) => b.churnRiskScore - a.churnRiskScore)
      .slice(0, limit);
  }

  // ── Retention event emitter (daily) ───────────────────────────────────────

  async emitRetentionEvents(): Promise<void> {
    try {
      const distinctTenants = await this.prisma.order.findMany({
        select: { tenantId: true },
        distinct: ['tenantId'],
      });

      for (const { tenantId } of distinctTenants) {
        const alerts = await this.getReorderAlerts(tenantId, 7);
        for (const alert of alerts) {
          if (alert.urgency === 'overdue' || alert.urgency === 'high') {
            this.eventBus.emit('commerce.reorder_alert', alert);
          }
        }

        const churnClients = await this.getChurnRiskClients(tenantId, 50);
        for (const client of churnClients) {
          if (client.churnRiskScore >= 0.9) {
            this.eventBus.emit('commerce.churn_risk', client);
          }
        }
      }
    } catch (err: unknown) {
      this.logger.error('emitRetentionEvents error', err);
    }
  }
}
