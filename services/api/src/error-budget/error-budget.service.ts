// FILE: services/api/src/error-budget/error-budget.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SLO {
  name: string;
  targetPct: number;
  windowDays: number;
  currentPct: number;
  errorBudgetMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  burnRate: number;
  exhaustionEta: Date | null;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
}

export interface ErrorBudgetReport {
  computedAt: Date;
  slos: SLO[];
  deploymentsFrozen: boolean;
  degradedModeActive: boolean;
  recommendations: string[];
}

// ── Internal raw query row types ──────────────────────────────────────────────

interface CountRow {
  total: string;
  succeeded: string;
}

interface HourBucketRow {
  hour_bucket: Date;
  has_recon: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ErrorBudgetService {
  private readonly logger = new Logger(ErrorBudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReport(): Promise<ErrorBudgetReport> {
    const computedAt = new Date();

    const [paymentSlo, webhookSlo, jobSlo, reconciliationSlo] = await Promise.all([
      this.computePaymentSuccessSlo(computedAt),
      this.computeWebhookDeliverySlo(computedAt),
      this.computeJobSuccessSlo(computedAt),
      this.computeReconciliationFreshnessSlo(computedAt),
    ]);

    const slos = [paymentSlo, webhookSlo, jobSlo, reconciliationSlo];

    const deploymentsFrozen =
      slos.some((s) => s.status === 'exhausted') ||
      slos.some((s) => s.burnRate > 3);

    const degradedModeActive =
      paymentSlo.status === 'critical' || paymentSlo.status === 'exhausted';

    const recommendations = this.buildRecommendations(slos, deploymentsFrozen, degradedModeActive);

    this.logger.log(
      `Error budget report computed: deploymentsFrozen=${deploymentsFrozen} degradedMode=${degradedModeActive} ` +
        slos.map((s) => `${s.name}=${s.status}(${s.currentPct.toFixed(2)}%)`).join(', '),
    );

    return { computedAt, slos, deploymentsFrozen, degradedModeActive, recommendations };
  }

  async shouldBlockDeploy(): Promise<boolean> {
    const report = await this.getReport();
    return report.deploymentsFrozen;
  }

  // ── SLO 1: Payment success rate — 99.5%, 30d window ──────────────────────────

  private async computePaymentSuccessSlo(now: Date): Promise<SLO> {
    const windowDays = 30;
    const targetPct = 99.5;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE event = 'payment.confirmed')::text AS succeeded
        FROM "EventLog"
        WHERE event IN ('payment.confirmed', 'payment.failed', 'payment.attempted')
          AND "createdAt" >= ${since}
      `,
    );

    const total = parseInt(rows[0]?.total ?? '0', 10);
    const succeeded = parseInt(rows[0]?.succeeded ?? '0', 10);
    const currentPct = total > 0 ? (succeeded / total) * 100 : 100;

    return this.buildSlo('payment_success_rate', targetPct, windowDays, currentPct, now);
  }

  // ── SLO 2: Webhook delivery rate — 99%, 7d window ────────────────────────────

  private async computeWebhookDeliverySlo(now: Date): Promise<SLO> {
    const windowDays = 7;
    const targetPct = 99;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE success = true)::text AS succeeded
        FROM "WebhookDelivery"
        WHERE "createdAt" >= ${since}
      `,
    );

    const total = parseInt(rows[0]?.total ?? '0', 10);
    const succeeded = parseInt(rows[0]?.succeeded ?? '0', 10);
    const currentPct = total > 0 ? (succeeded / total) * 100 : 100;

    return this.buildSlo('webhook_delivery_rate', targetPct, windowDays, currentPct, now);
  }

  // ── SLO 3: Job success rate — 99%, 7d window ─────────────────────────────────

  private async computeJobSuccessSlo(now: Date): Promise<SLO> {
    const windowDays = 7;
    const targetPct = 99;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'completed')::text AS succeeded
        FROM "Job"
        WHERE "createdAt" >= ${since}
          AND status IN ('completed', 'failed')
      `,
    );

    const total = parseInt(rows[0]?.total ?? '0', 10);
    const succeeded = parseInt(rows[0]?.succeeded ?? '0', 10);
    const currentPct = total > 0 ? (succeeded / total) * 100 : 100;

    return this.buildSlo('job_success_rate', targetPct, windowDays, currentPct, now);
  }

  // ── SLO 4: Reconciliation freshness — 99%, 1d window ─────────────────────────
  // Measure: fraction of clock hours in the window that had at least 1 reconciliation run

  private async computeReconciliationFreshnessSlo(now: Date): Promise<SLO> {
    const windowDays = 1;
    const targetPct = 99;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    // Total hours in the window
    const totalHours = windowDays * 24;

    // Hours that had a reconciliation event
    const rows = await this.prisma.$queryRaw<HourBucketRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC('hour', "createdAt") AS hour_bucket,
          COUNT(*)::text AS has_recon
        FROM "EventLog"
        WHERE event IN ('reconciliation.completed', 'reconciliation.clean', 'reconciliation.drift_detected')
          AND "createdAt" >= ${since}
        GROUP BY DATE_TRUNC('hour', "createdAt")
      `,
    );

    const hoursWithRecon = rows.length;
    const currentPct = totalHours > 0 ? (hoursWithRecon / totalHours) * 100 : 100;

    return this.buildSlo('reconciliation_freshness', targetPct, windowDays, currentPct, now);
  }

  // ── SLO builder ───────────────────────────────────────────────────────────────

  private buildSlo(
    name: string,
    targetPct: number,
    windowDays: number,
    currentPct: number,
    now: Date,
  ): SLO {
    const windowMinutes = windowDays * 24 * 60;

    // Total error budget = (1 - target) * window
    const errorBudgetMinutes = Math.round(((100 - targetPct) / 100) * windowMinutes);

    // Consumed = (1 - current) * window
    const consumedMinutes = Math.round(((100 - Math.min(currentPct, 100)) / 100) * windowMinutes);
    const remainingMinutes = Math.max(0, errorBudgetMinutes - consumedMinutes);

    // Burn rate: consumed / budget, normalized to the window
    // burn rate of 1.0 = consuming exactly on pace to exhaust by window end
    // burn rate of 3.0 = consuming 3x faster than allowed
    const burnRate =
      errorBudgetMinutes > 0
        ? Math.round((consumedMinutes / errorBudgetMinutes) * 100) / 100
        : consumedMinutes > 0
          ? 99
          : 0;

    // Exhaustion ETA: if burning faster than 1x, project when budget runs out
    let exhaustionEta: Date | null = null;
    if (burnRate > 1 && remainingMinutes > 0) {
      // At current burn rate, how many real minutes until exhaustion?
      const minutesUntilExhaustion = remainingMinutes / burnRate;
      exhaustionEta = new Date(now.getTime() + minutesUntilExhaustion * 60 * 1000);
    }

    // Status thresholds
    let status: SLO['status'];
    if (remainingMinutes <= 0 || consumedMinutes >= errorBudgetMinutes) {
      status = 'exhausted';
    } else if (burnRate >= 3 || remainingMinutes < errorBudgetMinutes * 0.1) {
      status = 'critical';
    } else if (burnRate >= 1.5 || remainingMinutes < errorBudgetMinutes * 0.25) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name,
      targetPct,
      windowDays,
      currentPct: Math.round(currentPct * 100) / 100,
      errorBudgetMinutes,
      consumedMinutes,
      remainingMinutes,
      burnRate,
      exhaustionEta,
      status,
    };
  }

  // ── Recommendations ───────────────────────────────────────────────────────────

  private buildRecommendations(
    slos: SLO[],
    deploymentsFrozen: boolean,
    degradedModeActive: boolean,
  ): string[] {
    const recs: string[] = [];

    if (deploymentsFrozen) {
      recs.push('FREEZE DEPLOYMENTS: One or more SLOs are exhausted or burning at >3x rate. No deploys until error budget is restored.');
    }

    if (degradedModeActive) {
      recs.push('DEGRADED MODE: Payment success SLO is critical or exhausted. Enable circuit breakers and notify customers.');
    }

    for (const slo of slos) {
      if (slo.status === 'exhausted') {
        recs.push(
          `${slo.name}: Budget EXHAUSTED. Currently at ${slo.currentPct.toFixed(2)}% vs target ${slo.targetPct}%. Immediate incident response required.`,
        );
      } else if (slo.status === 'critical') {
        recs.push(
          `${slo.name}: CRITICAL burn rate (${slo.burnRate.toFixed(1)}x). ${slo.remainingMinutes} minutes remaining. ` +
            (slo.exhaustionEta ? `ETA exhaustion: ${slo.exhaustionEta.toISOString()}.` : ''),
        );
      } else if (slo.status === 'warning') {
        recs.push(
          `${slo.name}: WARNING — burning at ${slo.burnRate.toFixed(1)}x. Monitor closely. ${slo.remainingMinutes} minutes of budget remaining.`,
        );
      }
    }

    if (recs.length === 0) {
      recs.push('All SLOs healthy. System operating within error budgets. Safe to deploy.');
    }

    return recs;
  }
}
