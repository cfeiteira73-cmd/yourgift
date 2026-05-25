import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ---------------------------------------------------------------------------
// Cost rates
// ---------------------------------------------------------------------------
const COMPUTE_RATE_EUR_PER_MS = 0.000_000_1;
const AI_TOKEN_RATE_EUR = 0.000_002;
const QUEUE_JOB_RATE_EUR = 0.000_05;
const INFRA_RATE_EUR_PER_DAY = 45;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface WorkflowCost {
  workflowId: string;
  workflowType: 'rfq' | 'order' | 'subscription' | 'reconciliation' | 'queue-job' | 'ai-inference';
  tenantId: string;
  startedAt: Date;
  completedAt: Date | null;
  computeMs: number;
  computeCostEur: number;
  aiTokens: number;
  aiCostEur: number;
  queueJobs: number;
  queueCostEur: number;
  totalCostEur: number;
  revenueEur: number;
  marginEur: number;
  marginPct: number;
}

export interface TenantCostSummary {
  tenantId: string;
  period: { from: Date; to: Date };
  totalCostEur: number;
  totalRevenueEur: number;
  totalMarginEur: number;
  marginPct: number;
  breakdown: {
    compute: number;
    ai: number;
    queue: number;
    infra: number;
  };
  workflowCount: number;
  avgCostPerWorkflow: number;
  isNoisy: boolean;
  isUnprofitable: boolean;
}

export interface CostAnomaly {
  tenantId: string;
  detectedAt: Date;
  type: 'noisy-neighbor' | 'runaway-ai' | 'queue-amplification' | 'unprofitable';
  severity: 'warning' | 'critical';
  description: string;
  costImpactEur: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class CostIntelligenceService {
  private readonly logger = new Logger(CostIntelligenceService.name);
  private readonly workflows = new Map<string, WorkflowCost>();
  private readonly anomalies: CostAnomaly[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  private recalcTotals(wf: WorkflowCost): void {
    wf.totalCostEur = wf.computeCostEur + wf.aiCostEur + wf.queueCostEur;
    wf.marginEur = wf.revenueEur - wf.totalCostEur;
    wf.marginPct =
      wf.revenueEur === 0 ? 0 : (wf.marginEur / wf.revenueEur) * 100;
  }

  private getWorkflowsInRange(fromDate: Date, toDate: Date): WorkflowCost[] {
    return Array.from(this.workflows.values()).filter(
      (wf) =>
        wf.startedAt >= fromDate &&
        wf.startedAt <= toDate &&
        wf.completedAt !== null,
    );
  }

  private msToDay(ms: number): number {
    return ms / 1000 / 60 / 60 / 24;
  }

  // -------------------------------------------------------------------------
  // Public methods
  // -------------------------------------------------------------------------

  startWorkflow(
    workflowId: string,
    workflowType: WorkflowCost['workflowType'],
    tenantId: string,
  ): void {
    const wf: WorkflowCost = {
      workflowId,
      workflowType,
      tenantId,
      startedAt: new Date(),
      completedAt: null,
      computeMs: 0,
      computeCostEur: 0,
      aiTokens: 0,
      aiCostEur: 0,
      queueJobs: 0,
      queueCostEur: 0,
      totalCostEur: 0,
      revenueEur: 0,
      marginEur: 0,
      marginPct: 0,
    };
    this.workflows.set(workflowId, wf);
    this.logger.debug(`Workflow started: ${workflowId} [${workflowType}] tenant=${tenantId}`);
  }

  recordAiTokens(workflowId: string, tokens: number): void {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      this.logger.warn(`recordAiTokens: unknown workflowId=${workflowId}`);
      return;
    }
    wf.aiTokens += tokens;
    wf.aiCostEur = wf.aiTokens * AI_TOKEN_RATE_EUR;
    this.recalcTotals(wf);
  }

  recordQueueJobs(workflowId: string, jobCount: number): void {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      this.logger.warn(`recordQueueJobs: unknown workflowId=${workflowId}`);
      return;
    }
    wf.queueJobs += jobCount;
    wf.queueCostEur = wf.queueJobs * QUEUE_JOB_RATE_EUR;
    this.recalcTotals(wf);
  }

  completeWorkflow(workflowId: string, revenueEur = 0): WorkflowCost | null {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      this.logger.warn(`completeWorkflow: unknown workflowId=${workflowId}`);
      return null;
    }
    const now = new Date();
    wf.completedAt = now;
    wf.computeMs = now.getTime() - wf.startedAt.getTime();
    wf.computeCostEur = wf.computeMs * COMPUTE_RATE_EUR_PER_MS;
    wf.revenueEur = revenueEur;
    this.recalcTotals(wf);

    this.eventBus.emit('cost.workflow_completed', wf);
    this.logger.debug(
      `Workflow completed: ${workflowId} cost=€${wf.totalCostEur.toFixed(6)} margin=€${wf.marginEur.toFixed(6)}`,
    );
    return wf;
  }

  async getTenantCostSummary(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<TenantCostSummary> {
    const tenantWorkflows = this.getWorkflowsInRange(fromDate, toDate).filter(
      (wf) => wf.tenantId === tenantId,
    );

    const allWorkflows = this.getWorkflowsInRange(fromDate, toDate);
    const totalWorkflowCount = allWorkflows.length;

    const compute = tenantWorkflows.reduce((s, w) => s + w.computeCostEur, 0);
    const ai = tenantWorkflows.reduce((s, w) => s + w.aiCostEur, 0);
    const queue = tenantWorkflows.reduce((s, w) => s + w.queueCostEur, 0);

    const days = Math.max(1, this.msToDay(toDate.getTime() - fromDate.getTime()));
    const tenantShare =
      totalWorkflowCount === 0
        ? 0
        : tenantWorkflows.length / totalWorkflowCount;
    const infra = INFRA_RATE_EUR_PER_DAY * days * tenantShare;

    // Real revenue from DB
    const orderAgg = await this.prisma.order.aggregate({
      where: {
        tenantId,
        status: { in: ['paid', 'delivered'] },
        createdAt: { gte: fromDate, lte: toDate },
      },
      _sum: { totalAmount: true },
    });
    const totalRevenueEur = Number(orderAgg._sum.totalAmount ?? 0);

    const totalCostEur = compute + ai + queue + infra;
    const totalMarginEur = totalRevenueEur - totalCostEur;
    const marginPct =
      totalRevenueEur === 0 ? 0 : (totalMarginEur / totalRevenueEur) * 100;

    const workflowCount = tenantWorkflows.length;
    const avgCostPerWorkflow = workflowCount === 0 ? 0 : totalCostEur / workflowCount;

    // Noisy neighbor: compare against global average cost per workflow
    const globalAvgCostPerWorkflow =
      totalWorkflowCount === 0
        ? 0
        : allWorkflows.reduce((s, w) => s + w.totalCostEur, 0) / totalWorkflowCount;
    const isNoisy =
      globalAvgCostPerWorkflow > 0 &&
      avgCostPerWorkflow > 3 * globalAvgCostPerWorkflow;

    const isUnprofitable = marginPct < 0;

    return {
      tenantId,
      period: { from: fromDate, to: toDate },
      totalCostEur,
      totalRevenueEur,
      totalMarginEur,
      marginPct,
      breakdown: { compute, ai, queue, infra },
      workflowCount,
      avgCostPerWorkflow,
      isNoisy,
      isUnprofitable,
    };
  }

  detectAnomalies(): CostAnomaly[] {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const recent24h = this.getWorkflowsInRange(last24h, now);
    const recentHour = this.getWorkflowsInRange(lastHour, now);

    // Group by tenantId for 24h window
    const tenantCostMap24h = new Map<string, number>();
    for (const wf of recent24h) {
      tenantCostMap24h.set(
        wf.tenantId,
        (tenantCostMap24h.get(wf.tenantId) ?? 0) + wf.totalCostEur,
      );
    }

    const tenantIds = Array.from(tenantCostMap24h.keys());
    const allCosts = Array.from(tenantCostMap24h.values());
    const meanCost =
      allCosts.length === 0
        ? 0
        : allCosts.reduce((s, c) => s + c, 0) / allCosts.length;

    // Group by tenantId for last-hour window
    const tenantAiCostHour = new Map<string, number>();
    const tenantQueueJobsHour = new Map<string, number>();
    for (const wf of recentHour) {
      tenantAiCostHour.set(
        wf.tenantId,
        (tenantAiCostHour.get(wf.tenantId) ?? 0) + wf.aiCostEur,
      );
      tenantQueueJobsHour.set(
        wf.tenantId,
        (tenantQueueJobsHour.get(wf.tenantId) ?? 0) + wf.queueJobs,
      );
    }

    // Overall margin across all tenants last 24h
    const totalRevenue24h = recent24h.reduce((s, w) => s + w.revenueEur, 0);
    const totalCost24h = recent24h.reduce((s, w) => s + w.totalCostEur, 0);
    const overallMarginPct =
      totalRevenue24h === 0
        ? 0
        : ((totalRevenue24h - totalCost24h) / totalRevenue24h) * 100;

    const newAnomalies: CostAnomaly[] = [];

    for (const tenantId of tenantIds) {
      const tenantCost = tenantCostMap24h.get(tenantId) ?? 0;

      // Noisy neighbor
      if (meanCost > 0 && tenantCost > 3 * meanCost) {
        const anomaly: CostAnomaly = {
          tenantId,
          detectedAt: now,
          type: 'noisy-neighbor',
          severity: 'critical',
          description: `Tenant cost €${tenantCost.toFixed(4)} exceeds 3x mean (€${(3 * meanCost).toFixed(4)}) in last 24h`,
          costImpactEur: tenantCost - 3 * meanCost,
        };
        newAnomalies.push(anomaly);
        this.eventBus.emit('cost.anomaly_detected', anomaly);
      }

      // Runaway AI
      const aiCostHour = tenantAiCostHour.get(tenantId) ?? 0;
      if (aiCostHour > 10) {
        const anomaly: CostAnomaly = {
          tenantId,
          detectedAt: now,
          type: 'runaway-ai',
          severity: 'critical',
          description: `Tenant AI cost €${aiCostHour.toFixed(4)} exceeded €10 in the last hour`,
          costImpactEur: aiCostHour,
        };
        newAnomalies.push(anomaly);
        this.eventBus.emit('cost.anomaly_detected', anomaly);
      }

      // Queue amplification
      const queueJobsHour = tenantQueueJobsHour.get(tenantId) ?? 0;
      if (queueJobsHour > 10_000) {
        const anomaly: CostAnomaly = {
          tenantId,
          detectedAt: now,
          type: 'queue-amplification',
          severity: 'warning',
          description: `Tenant enqueued ${queueJobsHour} jobs in the last hour (threshold: 10,000)`,
          costImpactEur: queueJobsHour * QUEUE_JOB_RATE_EUR,
        };
        newAnomalies.push(anomaly);
        this.eventBus.emit('cost.anomaly_detected', anomaly);
      }
    }

    // Unprofitable overall
    if (overallMarginPct < -5) {
      const anomaly: CostAnomaly = {
        tenantId: '__platform__',
        detectedAt: now,
        type: 'unprofitable',
        severity: 'warning',
        description: `Platform margin is ${overallMarginPct.toFixed(2)}% (threshold: -5%)`,
        costImpactEur: totalCost24h - totalRevenue24h,
      };
      newAnomalies.push(anomaly);
      this.eventBus.emit('cost.anomaly_detected', anomaly);
    }

    this.anomalies.push(...newAnomalies);
    if (this.anomalies.length > 1000) {
      this.anomalies.splice(0, this.anomalies.length - 1000);
    }

    this.logger.log(`Anomaly detection run: ${newAnomalies.length} new anomalies`);
    return newAnomalies;
  }

  getRecentAnomalies(limit = 50): CostAnomaly[] {
    return this.anomalies.slice(-limit);
  }

  getGlobalCostDashboard(): {
    totalWorkflows: number;
    totalCostEur: number;
    totalRevenueEur: number;
    avgMarginPct: number;
    topCostTenants: Array<{ tenantId: string; costEur: number }>;
    anomalyCount: number;
  } {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent = this.getWorkflowsInRange(last24h, now);

    const totalCostEur = recent.reduce((s, w) => s + w.totalCostEur, 0);
    const totalRevenueEur = recent.reduce((s, w) => s + w.revenueEur, 0);
    const totalMarginEur = totalRevenueEur - totalCostEur;
    const avgMarginPct =
      totalRevenueEur === 0 ? 0 : (totalMarginEur / totalRevenueEur) * 100;

    const tenantCostMap = new Map<string, number>();
    for (const wf of recent) {
      tenantCostMap.set(
        wf.tenantId,
        (tenantCostMap.get(wf.tenantId) ?? 0) + wf.totalCostEur,
      );
    }

    const topCostTenants = Array.from(tenantCostMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tenantId, costEur]) => ({ tenantId, costEur }));

    return {
      totalWorkflows: recent.length,
      totalCostEur,
      totalRevenueEur,
      avgMarginPct,
      topCostTenants,
      anomalyCount: this.anomalies.length,
    };
  }
}
