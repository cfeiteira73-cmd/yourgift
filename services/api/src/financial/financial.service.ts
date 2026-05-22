import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

function toYYYYMM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class FinancialService implements OnModuleInit {
  private readonly logger = new Logger(FinancialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    this.events.on('order.delivered', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.clientId) await this.computeClientSnapshot(order.clientId);
        if (order?.companyId) await this.computeCompanyCohort(order.companyId);
      } catch (err) {
        this.logger.error(`Failed to update financial snapshot after delivery: ${String(err)}`);
      }
    });

    this.events.on('order.paid', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.clientId) await this.computeClientSnapshot(order.clientId);
      } catch (err) {
        this.logger.error(`Failed to update financial snapshot after payment: ${String(err)}`);
      }
    });
  }

  /** Compute & upsert financial snapshot for a single client for the current month */
  async computeClientSnapshot(clientId: string): Promise<void> {
    const now = new Date();
    const periodMonth = toYYYYMM(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const validStatuses = ['paid', 'approved', 'producing', 'shipped', 'delivered'];

    // Orders in this period
    const orders = await this.prisma.order.findMany({
      where: {
        clientId,
        status: { in: validStatuses },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      include: { items: true },
    });

    // All-time orders for LTV + cohort month
    const allOrders = await this.prisma.order.findMany({
      where: {
        clientId,
        status: { in: validStatuses },
      },
      orderBy: { createdAt: 'asc' },
      select: { totalAmount: true, createdAt: true },
    });

    const firstOrder = allOrders[0];
    const cohortMonth = firstOrder
      ? toYYYYMM(firstOrder.createdAt)
      : periodMonth;

    let totalRevenue = 0;
    let totalCost = 0;
    for (const order of orders) {
      totalRevenue += order.totalAmount ?? 0;
      totalCost += order.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
    }
    const grossMargin = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // LTV = sum of all revenue ever
    const ltvCumulative = allOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { companyId: true },
    });

    await this.prisma.clientFinancialSnapshot.upsert({
      where: { clientId_periodMonth: { clientId, periodMonth } },
      create: {
        clientId,
        companyId: client?.companyId ?? null,
        periodMonth,
        totalRevenue,
        totalCost,
        grossMargin,
        grossMarginPct,
        orderCount,
        avgOrderValue,
        ltvCumulative,
        cacProxy: 0,
        cohortMonth,
      },
      update: {
        totalRevenue,
        totalCost,
        grossMargin,
        grossMarginPct,
        orderCount,
        avgOrderValue,
        ltvCumulative,
        computedAt: new Date(),
      },
    });

    this.logger.debug(
      `Financial snapshot updated: client=${clientId} period=${periodMonth} revenue=€${totalRevenue.toFixed(2)} margin=${grossMarginPct.toFixed(1)}%`,
    );
  }

  /** Compute cohort analysis for a company */
  async computeCompanyCohort(companyId: string): Promise<void> {
    const now = new Date();
    const periodMonth = toYYYYMM(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const validStatuses = ['paid', 'approved', 'producing', 'shipped', 'delivered'];

    const clients = await this.prisma.client.findMany({
      where: { companyId },
      select: { id: true },
    });

    const cohortMap = new Map<
      string,
      { clientIds: string[]; activeThisPeriod: string[]; revenue: number; orders: number }
    >();

    for (const client of clients) {
      const firstOrder = await this.prisma.order.findFirst({
        where: { clientId: client.id, status: { in: validStatuses } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      if (!firstOrder) continue;

      const cohortMonth = toYYYYMM(firstOrder.createdAt);

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, { clientIds: [], activeThisPeriod: [], revenue: 0, orders: 0 });
      }
      const cohort = cohortMap.get(cohortMonth)!;
      cohort.clientIds.push(client.id);

      const periodOrders = await this.prisma.order.findMany({
        where: {
          clientId: client.id,
          status: { in: validStatuses },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { totalAmount: true },
      });

      if (periodOrders.length > 0) {
        cohort.activeThisPeriod.push(client.id);
        cohort.orders += periodOrders.length;
        cohort.revenue += periodOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      }
    }

    for (const [cohortMonth, data] of cohortMap.entries()) {
      const activeClients = data.activeThisPeriod.length;
      await this.prisma.companyCohortAnalysis.upsert({
        where: { companyId_cohortMonth_periodMonth: { companyId, cohortMonth, periodMonth } },
        create: {
          companyId,
          cohortMonth,
          periodMonth,
          activeClients,
          totalOrders: data.orders,
          totalRevenue: data.revenue,
          avgRevenuePerClient: activeClients > 0 ? data.revenue / activeClients : 0,
        },
        update: {
          activeClients,
          totalOrders: data.orders,
          totalRevenue: data.revenue,
          avgRevenuePerClient: activeClients > 0 ? data.revenue / activeClients : 0,
          computedAt: new Date(),
        },
      });
    }

    this.logger.debug(`Cohort analysis updated: company=${companyId} period=${periodMonth}`);
  }

  /** Get top clients by LTV for a company */
  async getTopClientsByLtv(companyId: string, limit = 10) {
    const currentMonth = toYYYYMM(new Date());
    return this.prisma.clientFinancialSnapshot.findMany({
      where: { companyId, periodMonth: currentMonth },
      orderBy: { ltvCumulative: 'desc' },
      take: limit,
    });
  }

  /** Get overall platform unit economics */
  async getPlatformMetrics() {
    const now = new Date();
    const currentMonth = toYYYYMM(now);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = toYYYYMM(lastMonthDate);

    const [currentSnaps, lastSnaps, allTime] = await Promise.all([
      this.prisma.clientFinancialSnapshot.aggregate({
        where: { periodMonth: currentMonth },
        _sum: { totalRevenue: true, grossMargin: true, orderCount: true },
        _avg: { grossMarginPct: true, avgOrderValue: true },
        _count: { clientId: true },
      }),
      this.prisma.clientFinancialSnapshot.aggregate({
        where: { periodMonth: lastMonth },
        _sum: { totalRevenue: true, grossMargin: true },
        _avg: { grossMarginPct: true },
      }),
      this.prisma.clientFinancialSnapshot.aggregate({
        _avg: { ltvCumulative: true },
        _sum: { ltvCumulative: true },
        _count: { clientId: true },
      }),
    ]);

    const lastRevenue = lastSnaps._sum.totalRevenue ?? 0;
    const currentRevenue = currentSnaps._sum.totalRevenue ?? 0;
    const revGrowth =
      lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

    return {
      currentMonth: {
        revenue: currentRevenue,
        grossMargin: currentSnaps._sum.grossMargin ?? 0,
        avgMarginPct: currentSnaps._avg.grossMarginPct ?? 0,
        activeClients: currentSnaps._count.clientId,
        orders: currentSnaps._sum.orderCount ?? 0,
        avgOrderValue: currentSnaps._avg.avgOrderValue ?? 0,
      },
      lastMonth: {
        revenue: lastSnaps._sum.totalRevenue ?? 0,
        grossMargin: lastSnaps._sum.grossMargin ?? 0,
        avgMarginPct: lastSnaps._avg.grossMarginPct ?? 0,
      },
      revenueGrowthPct: revGrowth,
      allTime: {
        avgLtv: allTime._avg.ltvCumulative ?? 0,
        totalLtv: allTime._sum.ltvCumulative ?? 0,
        uniqueClients: allTime._count.clientId,
      },
    };
  }

  /** Get cohort retention grid for a company */
  async getCohortGrid(companyId: string) {
    return this.prisma.companyCohortAnalysis.findMany({
      where: { companyId },
      orderBy: [{ cohortMonth: 'asc' }, { periodMonth: 'asc' }],
    });
  }

  /** Batch recompute snapshots for all clients with orders this month */
  async recomputeAll(): Promise<{ computed: number }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeClients = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: monthStart },
        status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] },
      },
      distinct: ['clientId'],
      select: { clientId: true },
    });

    let computed = 0;
    for (const { clientId } of activeClients) {
      await this.computeClientSnapshot(clientId);
      computed++;
    }

    this.logger.log(`Financial snapshots recomputed: ${computed} clients`);
    return { computed };
  }
}
