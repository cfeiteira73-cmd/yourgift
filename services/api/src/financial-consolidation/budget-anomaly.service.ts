import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

type AnomalyType = 'overspend' | 'underspend' | 'spike' | 'unusual_supplier' | 'freq_increase';
type Severity = 'low' | 'medium' | 'high' | 'critical';

@Injectable()
export class BudgetAnomalyService implements OnModuleInit {
  private readonly logger = new Logger(BudgetAnomalyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // Run anomaly detection when an order is paid
    this.events.on(
      'order.paid',
      async ({
        orderId,
        tenantId,
        totalAmount,
      }: {
        orderId?: string;
        tenantId?: string;
        totalAmount?: number;
      }) => {
        try {
          void orderId; // referenced to satisfy linter
          if (tenantId && totalAmount !== undefined) {
            await this.detectOrderAnomalies(tenantId, String(totalAmount));
          }
        } catch (err) {
          this.logger.error(`Anomaly detection failed: ${String(err)}`);
        }
      },
    );
  }

  async detectOrderAnomalies(tenantId: string, orderAmountStr: string): Promise<void> {
    const orderAmount = Number(orderAmountStr);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get this month's spend
    const monthOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: monthStart, lte: monthEnd },
        status: { not: 'cancelled' },
      },
    });
    const monthTotal = monthOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

    // Get last month's spend for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { not: 'cancelled' },
      },
    });
    const lastMonthTotal = lastMonthOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

    // Spike detection: single order > 3x average order value
    const avgOrderValue = monthOrders.length > 0 ? monthTotal / monthOrders.length : 0;
    if (avgOrderValue > 0 && orderAmount > avgOrderValue * 3 && orderAmount > 1000) {
      await this.createAnomaly({
        tenantId,
        anomalyType: 'spike',
        severity: orderAmount > 10000 ? 'critical' : orderAmount > 5000 ? 'high' : 'medium',
        periodStart: monthStart,
        periodEnd: monthEnd,
        expectedValue: avgOrderValue,
        actualValue: orderAmount,
        description: `Single order €${orderAmount.toFixed(0)} is ${(orderAmount / avgOrderValue).toFixed(1)}x above average order value of €${avgOrderValue.toFixed(0)}`,
      });
    }

    // MoM spend increase > 50%
    if (lastMonthTotal > 0 && monthTotal > lastMonthTotal * 1.5) {
      const deviationPct = ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      await this.createAnomaly({
        tenantId,
        anomalyType: 'freq_increase',
        severity: deviationPct > 100 ? 'high' : 'medium',
        periodStart: monthStart,
        periodEnd: monthEnd,
        expectedValue: lastMonthTotal,
        actualValue: monthTotal,
        description: `Month-over-month spend increased ${deviationPct.toFixed(0)}% (€${lastMonthTotal.toFixed(0)} → €${monthTotal.toFixed(0)})`,
      });
    }
  }

  async createAnomaly(params: {
    tenantId: string;
    companyId?: string;
    department?: string;
    anomalyType: AnomalyType;
    severity: Severity;
    periodStart: Date;
    periodEnd: Date;
    expectedValue?: number;
    actualValue: number;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const deviationPct =
      params.expectedValue !== undefined && params.expectedValue > 0
        ? ((params.actualValue - params.expectedValue) / params.expectedValue) * 100
        : null;

    const anomaly = await this.prisma.budgetAnomaly.create({
      data: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        department: params.department,
        anomalyType: params.anomalyType,
        severity: params.severity,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        expectedValue: params.expectedValue,
        actualValue: params.actualValue,
        deviationPct:
          deviationPct !== null ? Math.round(deviationPct * 100) / 100 : null,
        description: params.description,
        metadata: (params.metadata ?? {}) as object,
      },
    });

    this.events.emit('budget.anomaly_detected', {
      anomalyId: anomaly.id,
      tenantId: params.tenantId,
      severity: params.severity,
      type: params.anomalyType,
    });
    this.logger.warn(`Budget anomaly [${params.severity}]: ${params.description}`);
    return anomaly.id;
  }

  async acknowledge(anomalyId: string, acknowledgedBy: string) {
    return this.prisma.budgetAnomaly.update({
      where: { id: anomalyId },
      data: { isAcknowledged: true, acknowledgedBy, acknowledgedAt: new Date() },
    });
  }

  async getAnomalies(filters: {
    tenantId?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
  }) {
    return this.prisma.budgetAnomaly.findMany({
      where: {
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.acknowledged !== undefined
          ? { isAcknowledged: filters.acknowledged }
          : {}),
      },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      take: filters.limit ?? 50,
    });
  }

  async getStats() {
    const [total, unacknowledged, bySeverity, byType] = await Promise.all([
      this.prisma.budgetAnomaly.count(),
      this.prisma.budgetAnomaly.count({ where: { isAcknowledged: false } }),
      this.prisma.budgetAnomaly.groupBy({ by: ['severity'], _count: { id: true } }),
      this.prisma.budgetAnomaly.groupBy({ by: ['anomalyType'], _count: { id: true } }),
    ]);
    return {
      total,
      unacknowledged,
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count.id])),
      byType: Object.fromEntries(byType.map((t) => [t.anomalyType, t._count.id])),
    };
  }
}
