import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReliabilityTrendPoint {
  snapshotAt: Date;
  overallScore: number;
}

@Injectable()
export class ReliabilityService {
  private readonly logger = new Logger(ReliabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeSnapshot(): Promise<unknown> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      apiLogs,
      workflowInstances,
      supplierPerformances,
      latestReconciliation,
      openIncidents,
      openReconciliationIssues,
      openCircuitBreakers,
      authLogs,
    ] = await Promise.all([
      this.prisma.apiRequestLog.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        select: { statusCode: true, durationMs: true },
      }),
      this.prisma.workflowInstance.findMany({
        where: { startedAt: { gte: oneDayAgo } },
        select: { status: true },
      }),
      this.prisma.supplierPerformance.findMany({
        select: { reliabilityScore: true },
      }),
      this.prisma.reconciliationRun.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { integrityScore: true },
      }),
      this.prisma.incident.count({
        where: { status: { in: ['open', 'investigating', 'mitigating'] } },
      }),
      this.prisma.reconciliationIssue.count({ where: { status: 'open' } }),
      this.prisma.circuitBreakerState.count({ where: { state: { not: 'closed' } } }),
      this.prisma.apiRequestLog.findMany({
        where: {
          path: { contains: '/auth/' },
          createdAt: { gte: oneHourAgo },
        },
        select: { statusCode: true },
      }),
    ]);

    // API Reliability: penalise 5xx
    const apiReliability = this.computeErrorRate(apiLogs.map((l) => l.statusCode));

    // Queue reliability: use DLQ from API logs tagged as queue paths
    const queueReliability = 100; // placeholder — would query BullMQ stats

    // Procurement correctness: orders with matching LedgerEntry
    const paidOrders = await this.prisma.order.count({ where: { status: 'paid' } });
    const matchedOrders = paidOrders > 0
      ? await this.prisma.ledgerTransaction.count({
          where: { referenceType: 'order' },
        })
      : 0;
    const procurementCorrectness = paidOrders > 0
      ? Math.min(100, (matchedOrders / paidOrders) * 100)
      : 100;

    // Supplier stability: average reliabilityScore (0–1 scale → 0–100)
    const supplierStability =
      supplierPerformances.length > 0
        ? (supplierPerformances.reduce((s, p) => s + p.reliabilityScore, 0) /
            supplierPerformances.length) * 100
        : 100;

    // Workflow health: % completed in last 24h
    const workflowHealth =
      workflowInstances.length > 0
        ? (workflowInstances.filter((w) => w.status === 'completed').length /
            workflowInstances.length) * 100
        : 100;

    // Financial integrity: latest reconciliation score
    const financialIntegrity = latestReconciliation
      ? Number(latestReconciliation.integrityScore)
      : 100;

    // Auth reliability
    const authReliability = this.computeErrorRate(authLogs.map((l) => l.statusCode));

    // Latency percentiles from API logs
    const durations = apiLogs
      .map((l) => l.durationMs)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b);

    const percentile = (pct: number): number => {
      if (durations.length === 0) return 0;
      const idx = Math.ceil(durations.length * pct) - 1;
      return durations[Math.max(0, idx)];
    };

    // Error rate
    const errorRatePct =
      apiLogs.length > 0
        ? (apiLogs.filter((l) => l.statusCode >= 500).length / apiLogs.length) * 100
        : 0;

    // Weighted overall score
    const weights = {
      apiReliability: 0.25,
      queueReliability: 0.1,
      procurementCorrectness: 0.15,
      supplierStability: 0.1,
      workflowHealth: 0.1,
      financialIntegrity: 0.15,
      authReliability: 0.15,
    };

    const overallScore =
      apiReliability * weights.apiReliability +
      queueReliability * weights.queueReliability +
      procurementCorrectness * weights.procurementCorrectness +
      supplierStability * weights.supplierStability +
      workflowHealth * weights.workflowHealth +
      financialIntegrity * weights.financialIntegrity +
      authReliability * weights.authReliability;

    const snapshot = await this.prisma.reliabilitySnapshot.create({
      data: {
        overallScore: Math.round(overallScore * 100) / 100,
        apiReliability: Math.round(apiReliability * 100) / 100,
        queueReliability: Math.round(queueReliability * 100) / 100,
        procurementCorrectness: Math.round(procurementCorrectness * 100) / 100,
        supplierStability: Math.round(supplierStability * 100) / 100,
        workflowHealth: Math.round(workflowHealth * 100) / 100,
        financialIntegrity: Math.round(financialIntegrity * 100) / 100,
        authReliability: Math.round(authReliability * 100) / 100,
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
        errorRatePct: Math.round(errorRatePct * 100) / 100,
        openIncidents,
        openReconciliationIssues,
        circuitBreakersOpen: openCircuitBreakers,
        metadata: {
          apiLogCount: apiLogs.length,
          workflowCount: workflowInstances.length,
        } as object,
      },
    });

    this.logger.log(
      `Reliability snapshot computed: overall=${snapshot.overallScore} incidents=${openIncidents}`,
    );
    return snapshot;
  }

  private computeErrorRate(statusCodes: number[]): number {
    if (statusCodes.length === 0) return 100;
    const errors = statusCodes.filter((c) => c >= 500).length;
    return Math.max(0, 100 - (errors / statusCodes.length) * 100);
  }

  async getHistory(limit = 48): Promise<unknown[]> {
    return this.prisma.reliabilitySnapshot.findMany({
      orderBy: { snapshotAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async getLatest(): Promise<unknown | null> {
    return this.prisma.reliabilitySnapshot.findFirst({
      orderBy: { snapshotAt: 'desc' },
    });
  }

  async computeTrend(hours = 24): Promise<ReliabilityTrendPoint[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const snapshots = await this.prisma.reliabilitySnapshot.findMany({
      where: { snapshotAt: { gte: since } },
      select: { snapshotAt: true, overallScore: true },
      orderBy: { snapshotAt: 'asc' },
    });

    return snapshots.map((s) => ({
      snapshotAt: s.snapshotAt,
      overallScore: Number(s.overallScore),
    }));
  }
}
