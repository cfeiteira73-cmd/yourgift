import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { SystemHealthSnapshot, SystemAlert } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setInterval(() => {
      void this.takeSnapshot();
    }, 5 * 60 * 1000);
  }

  // ── Percentile helper ────────────────────────────────────────────────────────

  private percentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)] ?? 0;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  async takeSnapshot(): Promise<SystemHealthSnapshot> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalEvents,
      eventsLastHour,
      dlqSize,
      consumerOffsets,
      ordersToday,
      ordersInProduction,
      revenueToday,
      activeWorkflows,
      failedWorkflows,
      openAnomalies,
      recentApiLogs,
    ] = await Promise.all([
      this.prisma.procurementEvent.count().catch(() => 0),
      this.prisma.procurementEvent
        .count({ where: { appliedAt: { gte: oneHourAgo } } })
        .catch(() => 0),
      this.prisma.eventDLQ
        .count({ where: { status: 'failed' } })
        .catch(() => 0),
      this.prisma.eventConsumerOffset
        .findMany({ where: { isActive: true } })
        .catch(() => []),
      this.prisma.order
        .count({ where: { createdAt: { gte: todayStart } } })
        .catch(() => 0),
      this.prisma.order
        .count({ where: { status: { in: ['approved', 'producing'] } } })
        .catch(() => 0),
      this.prisma.order
        .aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: todayStart }, status: { not: 'cancelled' } },
        })
        .catch(() => ({ _sum: { totalAmount: null as number | null } })),
      this.prisma.workflowInstance
        .count({ where: { status: 'running' } })
        .catch(() => 0),
      this.prisma.workflowInstance
        .count({ where: { status: 'failed' } })
        .catch(() => 0),
      this.prisma.budgetAnomaly
        .count({ where: { isAcknowledged: false } })
        .catch(() => 0),
      this.prisma.apiRequestLog
        .findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { durationMs: true, statusCode: true },
        })
        .catch(() => []),
    ]);

    // Compute max consumer lag (use already-fetched totalEvents count)
    let maxConsumerLag = 0;
    for (const offset of consumerOffsets) {
      const lag = totalEvents - offset.lastSequenceNum;
      if (lag > maxConsumerLag) maxConsumerLag = lag;
    }

    // Compute percentiles
    const durations = recentApiLogs
      .map((r) => r.durationMs)
      .sort((a, b) => a - b);

    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    // Error rate
    const errorCount = recentApiLogs.filter((r) => r.statusCode >= 400).length;
    const errorRatePct =
      recentApiLogs.length > 0
        ? (errorCount / recentApiLogs.length) * 100
        : 0;

    // Memory
    const memUsage = process.memoryUsage();
    const memoryMb = Math.round(memUsage.rss / 1024 / 1024);

    const revenueSum = (revenueToday._sum.totalAmount ?? 0) as number;

    const snapshot = await this.prisma.systemHealthSnapshot.create({
      data: {
        totalEvents: BigInt(totalEvents),
        eventsLastHour: eventsLastHour,
        dlqSize: dlqSize,
        maxConsumerLag: maxConsumerLag,
        ordersToday: ordersToday,
        ordersInProduction: ordersInProduction,
        revenueToday: revenueSum,
        activeWorkflows: activeWorkflows,
        failedWorkflows: failedWorkflows,
        openAnomalies: openAnomalies,
        apiP50Ms: p50,
        apiP95Ms: p95,
        apiP99Ms: p99,
        errorRatePct: Math.round(errorRatePct * 100) / 100,
        dbPoolSize: 0,
        memoryMb: memoryMb,
      },
    });

    this.logger.log(
      `Health snapshot taken: p95=${p95}ms errRate=${errorRatePct.toFixed(1)}% dlq=${dlqSize}`,
    );

    return snapshot;
  }

  // ── Request logging ───────────────────────────────────────────────────────────

  async logRequest(params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId?: string;
    tenantId?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.prisma.apiRequestLog.create({
      data: {
        method: params.method,
        path: params.path,
        statusCode: params.statusCode,
        durationMs: params.durationMs,
        userId: params.userId ?? null,
        tenantId: params.tenantId ?? null,
        errorMessage: params.errorMessage ?? null,
      },
    });
  }

  // ── Event processing logging ─────────────────────────────────────────────────

  async logEventProcessing(params: {
    eventType: string;
    handler: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
    consumerGroup?: string;
    sequenceNum?: number;
  }): Promise<void> {
    await this.prisma.eventProcessingMetric.create({
      data: {
        eventType: params.eventType,
        handler: params.handler,
        durationMs: params.durationMs,
        success: params.success,
        errorMessage: params.errorMessage ?? null,
        consumerGroup: params.consumerGroup ?? null,
        sequenceNum:
          params.sequenceNum !== undefined
            ? BigInt(params.sequenceNum)
            : null,
      },
    });
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────

  async createAlert(params: {
    severity: 'info' | 'warning' | 'critical';
    category: string;
    title: string;
    description: string;
    metricValue?: number;
    thresholdValue?: number;
  }): Promise<SystemAlert> {
    return this.prisma.systemAlert.create({
      data: {
        severity: params.severity,
        category: params.category,
        title: params.title,
        description: params.description,
        metricValue: params.metricValue ?? null,
        thresholdValue: params.thresholdValue ?? null,
      },
    });
  }

  async resolveAlert(alertId: string): Promise<void> {
    await this.prisma.systemAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getSnapshots(limit = 24): Promise<SystemHealthSnapshot[]> {
    return this.prisma.systemHealthSnapshot.findMany({
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  async getLatencyStats(hours = 1): Promise<{
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    byPath: Array<{
      path: string;
      avgMs: number;
      count: number;
      errorCount: number;
    }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await this.prisma.apiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { durationMs: true, statusCode: true, path: true },
    });

    const durations = logs.map((l) => l.durationMs).sort((a, b) => a - b);
    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    const errorCount = logs.filter((l) => l.statusCode >= 400).length;
    const errorRate =
      logs.length > 0 ? (errorCount / logs.length) * 100 : 0;

    // Aggregate by path
    const pathMap = new Map<
      string,
      { totalMs: number; count: number; errorCount: number }
    >();
    for (const log of logs) {
      const existing = pathMap.get(log.path) ?? {
        totalMs: 0,
        count: 0,
        errorCount: 0,
      };
      existing.totalMs += log.durationMs;
      existing.count += 1;
      if (log.statusCode >= 400) existing.errorCount += 1;
      pathMap.set(log.path, existing);
    }

    const byPath = Array.from(pathMap.entries())
      .map(([path, data]) => ({
        path,
        avgMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
        count: data.count,
        errorCount: data.errorCount,
      }))
      .sort((a, b) => b.count - a.count);

    return { p50, p95, p99, errorRate: Math.round(errorRate * 100) / 100, byPath };
  }

  async getOpenAlerts(): Promise<SystemAlert[]> {
    return this.prisma.systemAlert.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEventProcessingStats(hours = 1): Promise<
    Array<{
      eventType: string;
      count: number;
      avgMs: number;
      errorCount: number;
      successRate: number;
    }>
  > {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await this.prisma.eventProcessingMetric.findMany({
      where: { createdAt: { gte: since } },
      select: { eventType: true, durationMs: true, success: true },
    });

    const typeMap = new Map<
      string,
      { totalMs: number; count: number; errorCount: number }
    >();

    for (const m of metrics) {
      const existing = typeMap.get(m.eventType) ?? {
        totalMs: 0,
        count: 0,
        errorCount: 0,
      };
      existing.totalMs += m.durationMs;
      existing.count += 1;
      if (!m.success) existing.errorCount += 1;
      typeMap.set(m.eventType, existing);
    }

    return Array.from(typeMap.entries()).map(([eventType, data]) => ({
      eventType,
      count: data.count,
      avgMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
      errorCount: data.errorCount,
      successRate:
        data.count > 0
          ? Math.round(((data.count - data.errorCount) / data.count) * 100 * 10) / 10
          : 100,
    }));
  }

  // ── Alert detection ──────────────────────────────────────────────────────────

  async runAlertDetection(): Promise<void> {
    const openAlerts = await this.getOpenAlerts();
    const openCategories = new Set(openAlerts.map((a) => a.category));

    // Get current DLQ size
    const dlqSize = await this.prisma.eventDLQ
      .count({ where: { status: 'failed' } })
      .catch(() => 0);

    if (dlqSize > 50 && !openCategories.has('dlq_spike')) {
      await this.createAlert({
        severity: 'critical',
        category: 'dlq_spike',
        title: 'DLQ Spike Detected',
        description: `Dead letter queue has ${dlqSize} failed events exceeding threshold of 50.`,
        metricValue: dlqSize,
        thresholdValue: 50,
      });
      this.logger.warn(`Alert: DLQ spike at ${dlqSize}`);
    }

    // Max consumer lag
    const totalEvents = await this.prisma.procurementEvent
      .count()
      .catch(() => 0);
    const offsets = await this.prisma.eventConsumerOffset
      .findMany({ where: { isActive: true } })
      .catch(() => []);

    let maxLag = 0;
    for (const o of offsets) {
      const lag = totalEvents - o.lastSequenceNum;
      if (lag > maxLag) maxLag = lag;
    }

    if (maxLag > 1000 && !openCategories.has('event_lag')) {
      await this.createAlert({
        severity: 'warning',
        category: 'event_lag',
        title: 'Consumer Lag Warning',
        description: `Max consumer lag is ${maxLag} events, exceeding threshold of 1000.`,
        metricValue: maxLag,
        thresholdValue: 1000,
      });
      this.logger.warn(`Alert: Consumer lag at ${maxLag}`);
    }

    // Error rate
    const stats = await this.getLatencyStats(1);
    if (stats.errorRate > 5 && !openCategories.has('error_rate')) {
      await this.createAlert({
        severity: 'warning',
        category: 'error_rate',
        title: 'High Error Rate',
        description: `API error rate is ${stats.errorRate.toFixed(1)}% over the last hour, exceeding threshold of 5%.`,
        metricValue: stats.errorRate,
        thresholdValue: 5,
      });
      this.logger.warn(`Alert: Error rate at ${stats.errorRate.toFixed(1)}%`);
    }

    // API p95 latency
    if (stats.p95 > 2000 && !openCategories.has('api_latency')) {
      await this.createAlert({
        severity: 'warning',
        category: 'api_latency',
        title: 'API Latency Degradation',
        description: `API p95 latency is ${stats.p95}ms over the last hour, exceeding threshold of 2000ms.`,
        metricValue: stats.p95,
        thresholdValue: 2000,
      });
      this.logger.warn(`Alert: API p95 at ${stats.p95}ms`);
    }

    this.logger.log('Alert detection complete');
  }
}
