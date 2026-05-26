import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialIntelligenceService {
  private readonly logger = new Logger(FinancialIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Margin per client: revenue - COGS - allocated costs */
  async getClientMargin(clientId: string) {
    const orders = await this.prisma.order.findMany({
      where: { clientId, status: { in: ['delivered', 'completed'] } },
    });
    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const orderIds = orders.map(o => o.id);

    const costs = await this.prisma.costAllocation.findMany({
      where: { orderId: { in: orderIds } },
    });
    const totalCost = costs.reduce((s, c) => s + Number(c.allocatedAmount), 0);

    // COGS estimate: 60% of revenue (supplier cost)
    const cogs = revenue * 0.60;
    const grossProfit = revenue - cogs;
    const netMargin = revenue - cogs - totalCost;
    const marginPct = revenue > 0 ? (netMargin / revenue) * 100 : 0;

    return {
      clientId,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      totalAllocatedCosts: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      netMargin: Math.round(netMargin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      orderCount: orders.length,
    };
  }

  /** LTV per tenant: total revenue over lifetime */
  async computeLTV(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId, status: { in: ['delivered', 'completed', 'paid'] } },
      orderBy: { createdAt: 'asc' },
    });

    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const firstOrder = orders[0]?.createdAt;
    const lastOrder = orders[orders.length - 1]?.createdAt;

    // Average order value
    const aov = orders.length > 0 ? revenue / orders.length : 0;
    // Monthly frequency (orders/month)
    const monthsActive = firstOrder && lastOrder
      ? Math.max(1, (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 1;
    const frequency = orders.length / monthsActive;
    // Projected 24-month LTV
    const projectedLtv = aov * frequency * 24;

    return {
      tenantId,
      totalRevenue: Math.round(revenue * 100) / 100,
      orderCount: orders.length,
      aov: Math.round(aov * 100) / 100,
      monthsActive: Math.round(monthsActive * 10) / 10,
      ordersPerMonth: Math.round(frequency * 10) / 10,
      projectedLtv24m: Math.round(projectedLtv * 100) / 100,
    };
  }

  /** CAC payback: how many months to recover acquisition cost */
  async computeCACPayback(tenantId: string, acquisitionCost = 2000) {
    const ltv = await this.computeLTV(tenantId);
    const monthlyRevenue = ltv.aov * ltv.ordersPerMonth;
    const monthlyMargin = monthlyRevenue * 0.30; // 30% net margin assumption
    const paybackMonths = monthlyMargin > 0 ? acquisitionCost / monthlyMargin : Infinity;

    return {
      tenantId,
      acquisitionCost,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      monthlyMargin: Math.round(monthlyMargin * 100) / 100,
      paybackMonths: paybackMonths === Infinity ? null : Math.round(paybackMonths * 10) / 10,
      isPaybackAchieved: paybackMonths <= 12,
    };
  }

  /** Cost-to-serve per order for a tenant */
  async costToServe(tenantId: string) {
    const [orderCount, totalCost] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.costAllocation.aggregate({
        where: { tenantId },
        _sum: { allocatedAmount: true },
      }),
    ]);

    const total = Number(totalCost._sum.allocatedAmount ?? 0);
    return {
      tenantId,
      orderCount,
      totalAllocatedCosts: Math.round(total * 100) / 100,
      costPerOrder: orderCount > 0 ? Math.round((total / orderCount) * 100) / 100 : 0,
    };
  }

  /** Platform-wide margin ranking (top clients by margin) */
  async getPlatformMarginRanking(limit = 10) {
    const clients = await this.prisma.client.findMany({ take: limit * 2 });
    const margins = await Promise.all(clients.map(c => this.getClientMargin(c.id)));
    return margins
      .filter(m => m.orderCount > 0)
      .sort((a, b) => b.netMargin - a.netMargin)
      .slice(0, limit);
  }

  /** Full P&L summary for a tenant over a period */
  async getPLSummary(tenantId: string, from: Date, to: Date) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to }, status: { not: 'cancelled' } },
    });

    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const cogs = revenue * 0.60;
    const grossProfit = revenue - cogs;

    const costs = await this.prisma.costAllocation.findMany({
      where: { tenantId, periodStart: { gte: from }, periodEnd: { lte: to } },
    });
    const totalOpex = costs.reduce((s, c) => s + Number(c.allocatedAmount), 0);
    const ebitda = grossProfit - totalOpex;

    return {
      tenantId,
      period: { from, to },
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
      totalOpex: Math.round(totalOpex * 100) / 100,
      ebitda: Math.round(ebitda * 100) / 100,
      ebitdaMarginPct: revenue > 0 ? Math.round((ebitda / revenue) * 1000) / 10 : 0,
      orderCount: orders.length,
    };
  }
}
