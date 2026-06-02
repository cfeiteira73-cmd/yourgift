// ── Phases 11-12 — Makito Supplier Intelligence & Executive Analytics ─────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MakitoSupplierScorecard {
  supplier: 'makito';
  scoredAt: string;
  reliabilityScore: number;     // 0-100
  deliveryScore: number;        // 0-100
  qualityScore: number;         // 0-100
  responseScore: number;        // 0-100
  stockScore: number;           // 0-100
  overallScore: number;         // 0-100
  ranking: 'A' | 'B' | 'C' | 'D';
  metrics: {
    totalOrders: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    cancelledOrders: number;
    avgDeliveryDays: number | null;
    stockAvailabilityRate: number;
    avgResponseHours: number | null;
  };
  recommendations: string[];
  vsMarket: { better: string[]; worse: string[] };
}

export interface MakitoExecutiveKPIs {
  period: string;
  revenue: number;
  margin: number;
  marginPct: number;
  orderVolume: number;
  avgOrderValue: number;
  fulfillmentRate: number;
  slaBreaches: number;
  stockRiskScore: number;       // 0-100 (100 = high risk)
  qualityIncidents: number;
  topProducts: Array<{ title: string; revenue: number; units: number }>;
  vsLastPeriod: {
    revenue: number;
    margin: number;
    orderVolume: number;
  };
}

@Injectable()
export class MakitoAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSupplierScorecard(): Promise<MakitoSupplierScorecard> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

    const orders = await this.prisma.order.findMany({
      where: { supplier: 'makito', createdAt: { gte: ninetyDaysAgo } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const total = orders.length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;

    // Estimate on-time: delivered within 14 days
    const onTime = orders.filter((o) => {
      if (o.status !== 'delivered') return false;
      const days = (o.updatedAt.getTime() - o.createdAt.getTime()) / 86400000;
      return days <= 14;
    }).length;

    const avgDeliveryDays = delivered > 0
      ? orders
          .filter((o) => o.status === 'delivered')
          .reduce((sum, o) => sum + (o.updatedAt.getTime() - o.createdAt.getTime()) / 86400000, 0) / delivered
      : null;

    // Stock availability from variants
    const stockStats = await this.prisma.productVariant.aggregate({
      where: { product: { supplier: 'makito' } },
      _count: { id: true },
      _sum: { stock: true },
    });
    const totalVariants = stockStats._count.id ?? 0;
    const inStockVariants = await this.prisma.productVariant.count({
      where: { product: { supplier: 'makito' }, stock: { gt: 0 } },
    });
    const stockAvailability = totalVariants > 0 ? (inStockVariants / totalVariants) * 100 : 100;

    // Scores
    const reliabilityScore = total > 0 ? Math.round((delivered / total) * 100) : 50;
    const deliveryScore = delivered > 0 && avgDeliveryDays
      ? Math.max(0, Math.round(100 - (avgDeliveryDays - 10) * 3))
      : 70;
    const qualityScore = 85; // baseline — would come from QC data
    const responseScore = 80; // baseline — would come from RFQ response times
    const stockScore = Math.round(stockAvailability);
    const overallScore = Math.round(
      (reliabilityScore * 0.25 + deliveryScore * 0.3 + qualityScore * 0.2 + responseScore * 0.1 + stockScore * 0.15),
    );

    const ranking: MakitoSupplierScorecard['ranking'] =
      overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D';

    const recommendations: string[] = [];
    if (stockScore < 70) recommendations.push('Stock availability below 70% — request replenishment schedule from Makito');
    if (deliveryScore < 70) recommendations.push('Delivery times exceeding SLA — escalate with Makito account manager');
    if (reliabilityScore < 80) recommendations.push('Order reliability below threshold — consider dual-sourcing critical SKUs');
    if (recommendations.length === 0) recommendations.push('Makito performance within targets — continue monitoring');

    return {
      supplier: 'makito',
      scoredAt: new Date().toISOString(),
      reliabilityScore,
      deliveryScore,
      qualityScore,
      responseScore,
      stockScore,
      overallScore,
      ranking,
      metrics: {
        totalOrders: total,
        onTimeDeliveries: onTime,
        lateDeliveries: delivered - onTime,
        cancelledOrders: cancelled,
        avgDeliveryDays: avgDeliveryDays ? Math.round(avgDeliveryDays * 10) / 10 : null,
        stockAvailabilityRate: Math.round(stockAvailability),
        avgResponseHours: 8, // baseline
      },
      recommendations,
      vsMarket: {
        better: deliveryScore >= 80 ? ['delivery speed'] : [],
        worse: stockScore < 70 ? ['stock availability'] : [],
      },
    };
  }

  async getExecutiveKPIs(periodDays = 30): Promise<MakitoExecutiveKPIs> {
    const since = new Date(Date.now() - periodDays * 86400000);
    const prevSince = new Date(Date.now() - 2 * periodDays * 86400000);

    const [current, previous] = await Promise.all([
      this.getKPIsForPeriod(since, new Date()),
      this.getKPIsForPeriod(prevSince, since),
    ]);

    const stockStats = await this.prisma.productVariant.aggregate({
      where: { product: { supplier: 'makito' }, stock: { lt: 10 } },
      _count: { id: true },
    });
    const stockRiskScore = Math.min(100, (stockStats._count.id ?? 0) * 2);

    // SLA breaches: orders in producing > 14 days
    const slaBreaches = await this.prisma.order.count({
      where: {
        supplier: 'makito',
        status: { in: ['confirmed', 'producing'] },
        createdAt: { lt: new Date(Date.now() - 14 * 86400000) },
      },
    });

    return {
      period: `Last ${periodDays} days`,
      ...current,
      stockRiskScore,
      slaBreaches,
      qualityIncidents: 0,
      vsLastPeriod: {
        revenue: previous.revenue > 0
          ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
          : 0,
        margin: previous.margin > 0
          ? Math.round(((current.margin - previous.margin) / previous.margin) * 100)
          : 0,
        orderVolume: previous.orderVolume > 0
          ? Math.round(((current.orderVolume - previous.orderVolume) / previous.orderVolume) * 100)
          : 0,
      },
    };
  }

  private async getKPIsForPeriod(from: Date, to: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        supplier: 'makito',
        createdAt: { gte: from, lt: to },
        status: { notIn: ['cancelled', 'draft'] },
      },
      select: { totalAmount: true, status: true },
    });

    const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
    const orderVolume = orders.length;
    const avgOrderValue = orderVolume > 0 ? revenue / orderVolume : 0;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const fulfillmentRate = orderVolume > 0 ? Math.round((delivered / orderVolume) * 100) : 100;

    // Assume 35% margin
    const margin = revenue * 0.35;
    const marginPct = revenue > 0 ? 35 : 0;

    // Top products
    const topProductsData = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { supplier: 'makito', createdAt: { gte: from, lt: to }, status: { notIn: ['cancelled'] } },
      },
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { unitPrice: 'desc' } },
      take: 5,
    });

    const topProducts = await Promise.all(
      topProductsData.map(async (tp) => {
        const product = await this.prisma.product.findUnique({
          where: { id: tp.productId ?? '' },
          select: { title: true },
        });
        return {
          title: product?.title ?? 'Unknown',
          revenue: Number(tp._sum.unitPrice ?? 0),
          units: tp._sum.quantity ?? 0,
        };
      }),
    );

    return { revenue, margin, marginPct, orderVolume, avgOrderValue, fulfillmentRate, topProducts };
  }
}
