import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class RetentionService implements OnModuleInit {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // Update procurement cycle on every delivered order
    this.events.on('order.delivered', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.clientId) {
          await this.updateProcurementCycle(order.clientId);
        }
      } catch (err) {
        this.logger.error(`Failed to update procurement cycle: ${err}`);
      }
    });

    // Mark onboarding completed on first delivered order
    this.events.on('order.paid', async ({ orderId }: { orderId: string }) => {
      try {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order?.clientId) {
          await this.checkOnboardingCompletion(order.clientId);
        }
      } catch (err) {
        this.logger.error(`Failed to check onboarding completion: ${err}`);
      }
    });
  }

  /** Update procurement cycle metrics for a client */
  async updateProcurementCycle(clientId: string): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        clientId,
        status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) return;

    const firstOrder = orders[0];
    const lastOrder = orders[orders.length - 1];
    const orderCount = orders.length;

    // Calculate avg days between orders
    let avgDaysBetweenOrders: number | null = null;
    let predictedNextOrderAt: Date | null = null;

    if (orders.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < orders.length; i++) {
        const diff = orders[i].createdAt.getTime() - orders[i - 1].createdAt.getTime();
        intervals.push(diff / (1000 * 60 * 60 * 24)); // days
      }
      avgDaysBetweenOrders = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Predict next order
      const predicted = new Date(lastOrder.createdAt);
      predicted.setDate(predicted.getDate() + Math.round(avgDaysBetweenOrders));
      predictedNextOrderAt = predicted;
    }

    // Churn risk: based on days since last order vs avg cycle
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    let churnRiskScore = 0;
    let churnRiskLevel = 'low';

    if (avgDaysBetweenOrders !== null) {
      const overduePct = daysSince / avgDaysBetweenOrders;
      if (overduePct < 1.2) {
        churnRiskScore = overduePct * 0.2;
        churnRiskLevel = 'low';
      } else if (overduePct < 2.0) {
        churnRiskScore = 0.2 + (overduePct - 1.2) * 0.5;
        churnRiskLevel = 'medium';
      } else {
        churnRiskScore = Math.min(1.0, 0.6 + (overduePct - 2.0) * 0.2);
        churnRiskLevel = 'high';
      }
    } else {
      // Only 1 order: churn risk rises after 60 days
      if (daysSince > 90) { churnRiskScore = 0.7; churnRiskLevel = 'high'; }
      else if (daysSince > 60) { churnRiskScore = 0.4; churnRiskLevel = 'medium'; }
      else { churnRiskScore = 0.1; churnRiskLevel = 'low'; }
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });

    await this.prisma.clientProcurementCycle.upsert({
      where: { clientId },
      create: {
        clientId,
        companyId: client?.companyId ?? null,
        firstOrderAt: firstOrder.createdAt,
        lastOrderAt: lastOrder.createdAt,
        orderCount,
        avgDaysBetweenOrders,
        predictedNextOrderAt,
        churnRiskScore: Math.round(churnRiskScore * 100) / 100,
        churnRiskLevel,
        daysSinceLastOrder: daysSince,
        onboardingCompleted: orderCount >= 1,
      },
      update: {
        lastOrderAt: lastOrder.createdAt,
        orderCount,
        avgDaysBetweenOrders,
        predictedNextOrderAt,
        churnRiskScore: Math.round(churnRiskScore * 100) / 100,
        churnRiskLevel,
        daysSinceLastOrder: daysSince,
        onboardingCompleted: orderCount >= 1,
      },
    });

    // Emit churn risk event if high
    if (churnRiskLevel === 'high') {
      this.events.emit('client.churn_risk_high', { clientId, churnRiskScore, daysSince });
    }

    this.logger.debug(`Procurement cycle updated: client=${clientId} orders=${orderCount} churn=${churnRiskLevel}`);
  }

  /** Mark onboarding as completed when first order paid */
  private async checkOnboardingCompletion(clientId: string): Promise<void> {
    const existing = await this.prisma.clientProcurementCycle.findUnique({ where: { clientId } });
    if (!existing || existing.onboardingCompleted) return;

    const orderCount = await this.prisma.order.count({
      where: { clientId, status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] } },
    });

    if (orderCount >= 1) {
      await this.prisma.clientProcurementCycle.update({
        where: { clientId },
        data: { onboardingCompleted: true },
      });
      this.events.emit('client.onboarding_completed', { clientId });
    }
  }

  /** Compute demand forecast for a product */
  async computeDemandForecast(entityType: string, entityId: string): Promise<void> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const forecastMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    // Look at last 3 months of order data
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    let historicalOrders = 0;
    let totalQty = 0;
    let totalRevenue = 0;

    if (entityType === 'product') {
      const items = await this.prisma.orderItem.findMany({
        where: {
          productId: entityId,
          order: {
            createdAt: { gte: threeMonthsAgo },
            status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] },
          },
        },
      });
      historicalOrders = items.length;
      totalQty = items.reduce((s, i) => s + i.quantity, 0);
      totalRevenue = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    } else if (entityType === 'category') {
      const items = await this.prisma.orderItem.findMany({
        where: {
          product: { category: entityId },
          order: {
            createdAt: { gte: threeMonthsAgo },
            status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] },
          },
        },
        include: { product: true },
      });
      historicalOrders = items.length;
      totalQty = items.reduce((s, i) => s + i.quantity, 0);
      totalRevenue = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    }

    // Predict next month = avg monthly quantity
    const avgMonthlyQty = Math.round(totalQty / 3);
    const avgMonthlyRevenue = totalRevenue / 3;
    const confidence = historicalOrders >= 10 ? 0.8 : historicalOrders >= 3 ? 0.6 : 0.3;

    await this.prisma.demandForecast.upsert({
      where: { entityType_entityId_forecastMonth: { entityType, entityId, forecastMonth } },
      create: {
        entityType,
        entityId,
        forecastMonth,
        predictedQty: avgMonthlyQty,
        predictedRevenue: avgMonthlyRevenue,
        confidenceScore: confidence,
        historicalOrders,
      },
      update: {
        predictedQty: avgMonthlyQty,
        predictedRevenue: avgMonthlyRevenue,
        confidenceScore: confidence,
        historicalOrders,
        computedAt: new Date(),
      },
    });
  }

  /** Get all high-churn-risk clients */
  async getChurnRisks(level?: string) {
    return this.prisma.clientProcurementCycle.findMany({
      where: level ? { churnRiskLevel: level } : { churnRiskLevel: { in: ['high', 'medium'] } },
      orderBy: { churnRiskScore: 'desc' },
    });
  }

  /** Get demand forecasts for next month */
  async getForecasts(entityType?: string) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const forecastMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    return this.prisma.demandForecast.findMany({
      where: {
        forecastMonth,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { predictedRevenue: 'desc' },
      take: 50,
    });
  }

  /** Batch refresh all procurement cycles */
  async refreshAllCycles(): Promise<{ updated: number }> {
    const clients = await this.prisma.order.findMany({
      distinct: ['clientId'],
      select: { clientId: true },
      where: { status: { in: ['paid', 'approved', 'producing', 'shipped', 'delivered'] } },
    });

    let updated = 0;
    for (const { clientId } of clients) {
      await this.updateProcurementCycle(clientId);
      updated++;
    }

    this.logger.log(`Procurement cycles refreshed: ${updated} clients`);
    return { updated };
  }
}
