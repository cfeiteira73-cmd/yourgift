import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface WasteReport {
  generatedAt: Date;
  totalWasteEur: number;
  noisyTenants: Array<{
    tenantId: string;
    costEur: number;
    requestCount: number;
    avgCostPerRequest: number;
    recommendation: 'throttle' | 'upsize-plan' | 'investigate';
  }>;
  underutilizedSlots: Array<{
    resource: string;
    utilizationPct: number;
    potentialSavingEur: number;
    action: string;
  }>;
  overbudgetWorkflows: Array<{
    workflowType: string;
    avgCostEur: number;
    budgetEur: number;
    overagePct: number;
  }>;
}

interface RequestAttributedPayload {
  tenantId?: unknown;
  totalCostEur?: unknown;
  [key: string]: unknown;
}

interface QueueEventPayload {
  queueWorkerUtilizationPct?: unknown;
  dbConnectionUtilizationPct?: unknown;
  redisMemoryUtilizationPct?: unknown;
  workflowType?: unknown;
  totalCostEur?: unknown;
  budgetEur?: unknown;
  [key: string]: unknown;
}

function safeNumber(val: unknown): number {
  return typeof val === 'number' && isFinite(val) ? val : 0;
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

@Injectable()
export class InfraCostOptimizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async detectNoisyTenants(windowHours = 24): Promise<WasteReport['noisyTenants']> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const logs = await this.prisma.eventLog.findMany({
      where: {
        event: 'cost.request_attributed',
        createdAt: { gte: since },
      },
      select: { payload: true },
    });

    const tenantMap = new Map<string, { costEur: number; requestCount: number }>();

    for (const log of logs) {
      const p = log.payload as RequestAttributedPayload;
      const tenantId = safeString(p.tenantId);
      if (!tenantId) continue;
      const cost = safeNumber(p.totalCostEur);
      const existing = tenantMap.get(tenantId) ?? { costEur: 0, requestCount: 0 };
      existing.costEur += cost;
      existing.requestCount += 1;
      tenantMap.set(tenantId, existing);
    }

    if (tenantMap.size === 0) return [];

    const allCosts = Array.from(tenantMap.values()).map((v) =>
      v.requestCount > 0 ? v.costEur / v.requestCount : 0,
    );
    allCosts.sort((a, b) => a - b);
    const mid = Math.floor(allCosts.length / 2);
    const median =
      allCosts.length % 2 === 0
        ? ((allCosts[mid - 1] ?? 0) + (allCosts[mid] ?? 0)) / 2
        : (allCosts[mid] ?? 0);
    const threshold = median * 3;

    const noisyTenants: WasteReport['noisyTenants'] = [];

    for (const [tenantId, stats] of tenantMap.entries()) {
      const avgCostPerRequest =
        stats.requestCount > 0 ? stats.costEur / stats.requestCount : 0;
      if (avgCostPerRequest <= threshold) continue;

      let recommendation: 'throttle' | 'upsize-plan' | 'investigate';
      if (avgCostPerRequest > threshold * 5) {
        recommendation = 'throttle';
      } else if (stats.requestCount > 1000) {
        recommendation = 'upsize-plan';
      } else {
        recommendation = 'investigate';
      }

      noisyTenants.push({
        tenantId,
        costEur: stats.costEur,
        requestCount: stats.requestCount,
        avgCostPerRequest,
        recommendation,
      });
    }

    return noisyTenants.sort((a, b) => b.avgCostPerRequest - a.avgCostPerRequest);
  }

  async suggestScaling(): Promise<WasteReport['underutilizedSlots']> {
    const since = new Date(Date.now() - 60 * 60 * 1000); // last hour

    const recentQueueLogs = await this.prisma.eventLog.findMany({
      where: {
        event: { startsWith: 'queue.' },
        createdAt: { gte: since },
      },
      select: { payload: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate utilization hints from queue event payloads
    let workerUtilSum = 0;
    let workerCount = 0;
    let dbUtilSum = 0;
    let dbCount = 0;
    let redisUtilSum = 0;
    let redisCount = 0;

    for (const log of recentQueueLogs) {
      const p = log.payload as QueueEventPayload;
      if (typeof p.queueWorkerUtilizationPct === 'number') {
        workerUtilSum += p.queueWorkerUtilizationPct;
        workerCount += 1;
      }
      if (typeof p.dbConnectionUtilizationPct === 'number') {
        dbUtilSum += p.dbConnectionUtilizationPct;
        dbCount += 1;
      }
      if (typeof p.redisMemoryUtilizationPct === 'number') {
        redisUtilSum += p.redisMemoryUtilizationPct;
        redisCount += 1;
      }
    }

    const workerUtil = workerCount > 0 ? workerUtilSum / workerCount : 20;
    const dbUtil = dbCount > 0 ? dbUtilSum / dbCount : 30;
    const redisUtil = redisCount > 0 ? redisUtilSum / redisCount : 15;

    const slots: WasteReport['underutilizedSlots'] = [];

    if (workerUtil < 50) {
      slots.push({
        resource: 'queue-workers',
        utilizationPct: workerUtil,
        potentialSavingEur: ((50 - workerUtil) / 100) * 0.05,
        action: `Reduce queue worker replicas from current to ${Math.max(1, Math.ceil(workerUtil / 25))} — utilization is only ${workerUtil.toFixed(1)}%`,
      });
    }

    if (dbUtil < 40) {
      slots.push({
        resource: 'db-connections',
        utilizationPct: dbUtil,
        potentialSavingEur: ((40 - dbUtil) / 100) * 0.02,
        action: `Lower DB connection pool max — utilization is ${dbUtil.toFixed(1)}%; consider connection pooling via PgBouncer`,
      });
    }

    if (redisUtil < 30) {
      slots.push({
        resource: 'redis-memory',
        utilizationPct: redisUtil,
        potentialSavingEur: ((30 - redisUtil) / 100) * 0.01,
        action: `Downsize Redis instance — memory utilization is ${redisUtil.toFixed(1)}%`,
      });
    }

    return slots;
  }

  async getWasteReport(windowHours = 24): Promise<WasteReport> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [noisyTenants, underutilizedSlots, workflowLogs] = await Promise.all([
      this.detectNoisyTenants(windowHours),
      this.suggestScaling(),
      this.prisma.eventLog.findMany({
        where: {
          event: 'cost.request_attributed',
          createdAt: { gte: since },
        },
        select: { payload: true },
      }),
    ]);

    // Compute overbudget workflows
    const workflowCostMap = new Map<string, { total: number; count: number; budget: number }>();

    const WORKFLOW_BUDGETS: Record<string, number> = {
      procurement_routing: 0.01,
      risk_assessment: 0.005,
      recommendation: 0.002,
      classification: 0.001,
    };

    for (const log of workflowLogs) {
      const p = log.payload as QueueEventPayload;
      const wfType = safeString(p.workflowType);
      if (!wfType) continue;
      const cost = safeNumber(p.totalCostEur);
      const budget = safeNumber(p.budgetEur) || (WORKFLOW_BUDGETS[wfType] ?? 0.01);
      const existing = workflowCostMap.get(wfType) ?? { total: 0, count: 0, budget };
      existing.total += cost;
      existing.count += 1;
      workflowCostMap.set(wfType, existing);
    }

    const overbudgetWorkflows: WasteReport['overbudgetWorkflows'] = [];
    for (const [workflowType, stats] of workflowCostMap.entries()) {
      const avgCostEur = stats.count > 0 ? stats.total / stats.count : 0;
      const budgetEur = stats.budget;
      if (avgCostEur > budgetEur) {
        const overagePct = ((avgCostEur - budgetEur) / budgetEur) * 100;
        overbudgetWorkflows.push({ workflowType, avgCostEur, budgetEur, overagePct });
      }
    }

    const noisyWaste = noisyTenants.reduce((s, t) => s + t.costEur, 0);
    const infraWaste = underutilizedSlots.reduce((s, u) => s + u.potentialSavingEur, 0);
    const totalWasteEur = noisyWaste + infraWaste;

    return {
      generatedAt: new Date(),
      totalWasteEur,
      noisyTenants,
      underutilizedSlots,
      overbudgetWorkflows,
    };
  }

  async autoThrottleNoisyTenants(): Promise<void> {
    const noisyTenants = await this.detectNoisyTenants(24);
    const throttleCandidates = noisyTenants.filter(
      (t) => t.recommendation === 'throttle',
    );

    for (const tenant of throttleCandidates) {
      const payload = {
        tenantId: tenant.tenantId,
        reason: 'cost_anomaly',
        avgCostPerRequest: tenant.avgCostPerRequest,
        requestCount: tenant.requestCount,
        totalCostEur: tenant.costEur,
        throttledAt: new Date().toISOString(),
      };

      this.eventBus.emit('cost.throttle_applied', payload);

      // Persist throttle event non-blocking
      this.prisma.eventLog
        .create({
          data: {
            event: 'cost.throttle_applied',
            entity: 'tenant',
            entityId: tenant.tenantId,
            actorType: 'system',
            payload,
          },
        })
        .catch(() => {
          // Silent — throttle emission is best-effort
        });
    }
  }
}
