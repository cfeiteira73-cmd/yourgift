// FILE: services/api/src/deployment-safety/deployment-safety.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorBudgetService } from '../error-budget/error-budget.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DeploymentGate {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
  blocking: boolean;
}

export interface DeploymentSafetyReport {
  safe: boolean;
  checkedAt: Date;
  gates: DeploymentGate[];
  blockedBy: string[];
  warnings: string[];
}

// ── Internal raw query row types ──────────────────────────────────────────────

interface CountRow {
  count: string;
}

interface ReconciliationRow {
  createdat: Date;
  payload: unknown;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class DeploymentSafetyService {
  private readonly logger = new Logger(DeploymentSafetyService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly errorBudgetService: ErrorBudgetService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 10_000,
      maxNetworkRetries: 1,
    });
  }

  async runGates(): Promise<DeploymentSafetyReport> {
    const checkedAt = new Date();

    // Run all gates in parallel — each gate is fully self-contained
    const gateResults = await Promise.all([
      this.gateReconciliationClean(),
      this.gateNoStuckJobs(),
      this.gateNoOpenSev0(),
      this.gateWebhookHealthy(),
      this.gateStripeAccessible(),
      this.gateDbResponsive(),
      this.gateNoCriticalDrift(),
      this.gateErrorBudget(),
      this.gateQueueNotOverloaded(),
    ]);

    const blockedBy = gateResults
      .filter((g) => g.blocking && g.status === 'fail')
      .map((g) => g.name);

    const warnings = gateResults
      .filter((g) => g.status === 'warn' || (!g.blocking && g.status === 'fail'))
      .map((g) => `${g.name}: ${g.details}`);

    const safe = blockedBy.length === 0;

    this.logger.log(
      `Deployment safety check: safe=${safe} blockedBy=[${blockedBy.join(', ')}] warnings=${warnings.length}`,
    );

    return {
      safe,
      checkedAt,
      gates: gateResults,
      blockedBy,
      warnings,
    };
  }

  async shouldBlockDeploy(): Promise<boolean> {
    const report = await this.runGates();
    return !report.safe;
  }

  // ── Gate 1: reconciliation_clean (blocking) ───────────────────────────────────

  private async gateReconciliationClean(): Promise<DeploymentGate> {
    const id = 'reconciliation_clean';

    try {
      const rows = await this.prisma.$queryRaw<ReconciliationRow[]>(
        Prisma.sql`
          SELECT "createdAt" as createdat, payload FROM "EventLog"
          WHERE event IN ('reconciliation.completed', 'reconciliation.clean', 'reconciliation.drift_detected')
          ORDER BY "createdAt" DESC
          LIMIT 1
        `,
      );

      if (rows.length === 0) {
        return {
          id,
          name: 'Reconciliation Clean',
          status: 'fail',
          details: 'No reconciliation run found. Cannot verify financial integrity before deploy.',
          blocking: true,
        };
      }

      const row = rows[0];
      const payload = row.payload as Record<string, unknown>;
      const driftEur = typeof payload?.driftEur === 'number' ? payload.driftEur : null;
      const isClean = row.createdat > new Date(Date.now() - 2 * 60 * 60 * 1000) &&
        (driftEur === null || Math.abs(driftEur) <= 0.01);

      if (!isClean) {
        const reason = driftEur !== null && Math.abs(driftEur) > 0.01
          ? `Reconciliation drift of €${driftEur.toFixed(2)} detected at ${row.createdat.toISOString()}.`
          : `Last reconciliation run was at ${row.createdat.toISOString()} (>2h ago). Run is stale.`;
        return { id, name: 'Reconciliation Clean', status: 'fail', details: reason, blocking: true };
      }

      return {
        id,
        name: 'Reconciliation Clean',
        status: 'pass',
        details: `Last reconciliation at ${row.createdat.toISOString()} — no drift detected.`,
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'Reconciliation Clean',
        status: 'fail',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 2: no_stuck_jobs (blocking) ─────────────────────────────────────────

  private async gateNoStuckJobs(): Promise<DeploymentGate> {
    const id = 'no_stuck_jobs';

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(*)::text as count FROM "Job"
          WHERE status = 'failed' AND "createdAt" <= ${oneHourAgo}
        `,
      );
      const count = parseInt(rows[0]?.count ?? '0', 10);

      if (count > 0) {
        return {
          id,
          name: 'No Stuck Jobs',
          status: 'fail',
          details: `${count} job(s) have been in "failed" state for over 1 hour. Resolve before deploying.`,
          blocking: true,
        };
      }

      return {
        id,
        name: 'No Stuck Jobs',
        status: 'pass',
        details: 'No stuck jobs detected.',
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'No Stuck Jobs',
        status: 'fail',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 3: no_open_sev0 (blocking) ──────────────────────────────────────────

  private async gateNoOpenSev0(): Promise<DeploymentGate> {
    const id = 'no_open_sev0';

    try {
      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(*)::text as count FROM "EventLog"
          WHERE event IN ('incident.sev0.opened', 'incident.sev0.created', 'sev0.open')
            AND NOT EXISTS (
              SELECT 1 FROM "EventLog" el2
              WHERE el2.event IN ('incident.sev0.resolved', 'incident.sev0.closed')
                AND el2."entityId" = "EventLog"."entityId"
                AND el2."createdAt" > "EventLog"."createdAt"
            )
        `,
      );
      const count = parseInt(rows[0]?.count ?? '0', 10);

      if (count > 0) {
        return {
          id,
          name: 'No Open SEV0 Incidents',
          status: 'fail',
          details: `${count} open SEV0 incident(s) found. Resolve all SEV0 incidents before deploying.`,
          blocking: true,
        };
      }

      return {
        id,
        name: 'No Open SEV0 Incidents',
        status: 'pass',
        details: 'No open SEV0 incidents.',
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'No Open SEV0 Incidents',
        status: 'fail',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 4: webhook_healthy (blocking) ────────────────────────────────────────

  private async gateWebhookHealthy(): Promise<DeploymentGate> {
    const id = 'webhook_healthy';

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const rows = await this.prisma.$queryRaw<Array<{ total: string; failed: string }>>(
        Prisma.sql`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE success = false)::text AS failed
          FROM "WebhookDelivery"
          WHERE "createdAt" >= ${oneHourAgo}
        `,
      );

      const total = parseInt(rows[0]?.total ?? '0', 10);
      const failed = parseInt(rows[0]?.failed ?? '0', 10);

      if (total === 0) {
        return {
          id,
          name: 'Webhook Healthy',
          status: 'pass',
          details: 'No webhook deliveries in the last hour (nothing to measure).',
          blocking: true,
        };
      }

      const failureRate = (failed / total) * 100;
      if (failureRate >= 10) {
        return {
          id,
          name: 'Webhook Healthy',
          status: 'fail',
          details: `Webhook failure rate is ${failureRate.toFixed(1)}% in the last hour (${failed}/${total}). Threshold: <10%.`,
          blocking: true,
        };
      }

      return {
        id,
        name: 'Webhook Healthy',
        status: 'pass',
        details: `Webhook failure rate: ${failureRate.toFixed(1)}% in the last hour (${failed}/${total} failed).`,
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'Webhook Healthy',
        status: 'fail',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 5: stripe_accessible (blocking) ─────────────────────────────────────

  private async gateStripeAccessible(): Promise<DeploymentGate> {
    const id = 'stripe_accessible';

    try {
      await this.stripe.balance.retrieve();
      return {
        id,
        name: 'Stripe Accessible',
        status: 'pass',
        details: 'Stripe API responded successfully to balance.retrieve().',
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'Stripe Accessible',
        status: 'fail',
        details: `Stripe API unreachable: ${(err as Error).message}. Do not deploy while payment provider is down.`,
        blocking: true,
      };
    }
  }

  // ── Gate 6: db_responsive (blocking) ─────────────────────────────────────────

  private async gateDbResponsive(): Promise<DeploymentGate> {
    const id = 'db_responsive';
    const timeoutMs = 2000;

    try {
      const start = Date.now();
      await Promise.race([
        this.prisma.$queryRaw(Prisma.sql`SELECT 1`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`DB did not respond within ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      const elapsed = Date.now() - start;

      return {
        id,
        name: 'DB Responsive',
        status: 'pass',
        details: `Database responded in ${elapsed}ms.`,
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'DB Responsive',
        status: 'fail',
        details: `Database not responsive: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 7: no_critical_drift (blocking) ─────────────────────────────────────

  private async gateNoCriticalDrift(): Promise<DeploymentGate> {
    const id = 'no_critical_drift';

    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(*)::text as count FROM "EventLog"
          WHERE event = 'reconciliation.drift_detected'
            AND "createdAt" >= ${since24h}
            AND (payload->>'driftEur')::float > 1.0
        `,
      );
      const criticalDriftCount = parseInt(rows[0]?.count ?? '0', 10);

      if (criticalDriftCount > 0) {
        return {
          id,
          name: 'No Critical Drift',
          status: 'fail',
          details: `${criticalDriftCount} critical reconciliation drift event(s) (>€1.00) in the last 24h. Resolve before deploying.`,
          blocking: true,
        };
      }

      return {
        id,
        name: 'No Critical Drift',
        status: 'pass',
        details: 'No critical financial drift events in the last 24 hours.',
        blocking: true,
      };
    } catch (err) {
      return {
        id,
        name: 'No Critical Drift',
        status: 'fail',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: true,
      };
    }
  }

  // ── Gate 8: error_budget_not_exhausted (warn-only) ───────────────────────────

  private async gateErrorBudget(): Promise<DeploymentGate> {
    const id = 'error_budget_not_exhausted';

    try {
      const report = await this.errorBudgetService.getReport();
      const exhaustedSlos = report.slos.filter((s) => s.status === 'exhausted');

      if (exhaustedSlos.length > 0) {
        return {
          id,
          name: 'Error Budget Not Exhausted',
          status: 'warn',
          details: `${exhaustedSlos.length} SLO(s) exhausted: ${exhaustedSlos.map((s) => s.name).join(', ')}. Consider freezing deployments.`,
          blocking: false,
        };
      }

      const criticalSlos = report.slos.filter((s) => s.status === 'critical');
      if (criticalSlos.length > 0) {
        return {
          id,
          name: 'Error Budget Not Exhausted',
          status: 'warn',
          details: `${criticalSlos.length} SLO(s) in critical state: ${criticalSlos.map((s) => s.name).join(', ')}.`,
          blocking: false,
        };
      }

      return {
        id,
        name: 'Error Budget Not Exhausted',
        status: 'pass',
        details: `All ${report.slos.length} SLOs within error budget. Deployments unblocked by error budget.`,
        blocking: false,
      };
    } catch (err) {
      return {
        id,
        name: 'Error Budget Not Exhausted',
        status: 'warn',
        details: `Could not compute error budget: ${(err as Error).message}`,
        blocking: false,
      };
    }
  }

  // ── Gate 9: queue_not_overloaded (warn-only) ──────────────────────────────────

  private async gateQueueNotOverloaded(): Promise<DeploymentGate> {
    const id = 'queue_not_overloaded';

    try {
      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Job" WHERE status = 'pending'`,
      );
      const pendingJobs = parseInt(rows[0]?.count ?? '0', 10);

      if (pendingJobs >= 100) {
        return {
          id,
          name: 'Queue Not Overloaded',
          status: 'warn',
          details: `${pendingJobs} pending jobs in queue (threshold: 100). Deploy may increase queue backlog.`,
          blocking: false,
        };
      }

      return {
        id,
        name: 'Queue Not Overloaded',
        status: 'pass',
        details: `${pendingJobs} pending jobs in queue — within acceptable limit.`,
        blocking: false,
      };
    } catch (err) {
      return {
        id,
        name: 'Queue Not Overloaded',
        status: 'warn',
        details: `DB query failed: ${(err as Error).message}`,
        blocking: false,
      };
    }
  }
}
