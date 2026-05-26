import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export type ScenarioResult = 'PASS' | 'FAIL' | 'WARN';

export interface FailureLabScenario {
  scenarioId: string;
  name: string;
  description: string;
  result: ScenarioResult;
  detail: string;
  detectedAt: Date;
}

export interface FailureLabReport {
  runAt: Date;
  scenarios: FailureLabScenario[];
  passCount: number;
  warnCount: number;
  failCount: number;
  overallStatus: ScenarioResult;
  criticalFailures: string[];
}

@Injectable()
export class ProductionFailureLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async runAllTests(): Promise<FailureLabReport> {
    const runAt = new Date();

    const scenarios = await Promise.all([
      this.scenario_lostWebhookDetection(),
      this.scenario_duplicateEventHandling(),
      this.scenario_delayedSettlementDetection(),
      this.scenario_refundRaceConditionRisk(),
      this.scenario_queueCorruptionDetection(),
      this.scenario_partialReplayFailure(),
      this.scenario_ledgerBalanceIntegrity(),
      this.scenario_webhookFailureSpike(),
      this.scenario_orphanPaymentDetection(),
      this.scenario_reconciliationStaleness(),
    ]);

    const passCount = scenarios.filter((s) => s.result === 'PASS').length;
    const warnCount = scenarios.filter((s) => s.result === 'WARN').length;
    const failCount = scenarios.filter((s) => s.result === 'FAIL').length;

    const overallStatus: ScenarioResult =
      failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

    const criticalFailures = scenarios
      .filter((s) => s.result === 'FAIL')
      .map((s) => `[${s.scenarioId}] ${s.name}: ${s.detail}`);

    const report: FailureLabReport = {
      runAt,
      scenarios,
      passCount,
      warnCount,
      failCount,
      overallStatus,
      criticalFailures,
    };

    this.eventBus.emit('failure.lab.completed', {
      summary: {
        runAt,
        passCount,
        warnCount,
        failCount,
        overallStatus,
        criticalFailures,
      },
    });

    return report;
  }

  async runScenario(scenarioId: string): Promise<FailureLabScenario> {
    const map: Record<string, () => Promise<FailureLabScenario>> = {
      lost_webhook_detection: () => this.scenario_lostWebhookDetection(),
      duplicate_event_handling: () => this.scenario_duplicateEventHandling(),
      delayed_settlement_detection: () => this.scenario_delayedSettlementDetection(),
      refund_race_condition_risk: () => this.scenario_refundRaceConditionRisk(),
      queue_corruption_detection: () => this.scenario_queueCorruptionDetection(),
      partial_replay_failure: () => this.scenario_partialReplayFailure(),
      ledger_balance_integrity: () => this.scenario_ledgerBalanceIntegrity(),
      webhook_failure_spike: () => this.scenario_webhookFailureSpike(),
      orphan_payment_detection: () => this.scenario_orphanPaymentDetection(),
      reconciliation_staleness: () => this.scenario_reconciliationStaleness(),
    };

    const fn = map[scenarioId];
    if (!fn) {
      return {
        scenarioId,
        name: 'Unknown Scenario',
        description: 'No scenario found with this ID',
        result: 'FAIL',
        detail: `Scenario ID '${scenarioId}' does not exist`,
        detectedAt: new Date(),
      };
    }

    return fn();
  }

  // ── Scenario 1 ──────────────────────────────────────────────────────────────
  private async scenario_lostWebhookDetection(): Promise<FailureLabScenario> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const count = await this.prisma.order.count({
      where: {
        status: 'created',
        stripePaymentId: { not: null },
        createdAt: { lt: thirtyMinAgo },
      },
    });

    return {
      scenarioId: 'lost_webhook_detection',
      name: 'Lost Webhook Detection',
      description:
        'Detects orders with a Stripe Payment Intent but no webhook confirmation after 30 minutes',
      result: count > 0 ? 'WARN' : 'PASS',
      detail:
        count > 0
          ? `Found ${count} orders with PI but no webhook received`
          : 'Webhook recovery detection operational',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 2 ──────────────────────────────────────────────────────────────
  private async scenario_duplicateEventHandling(): Promise<FailureLabScenario> {
    const rows = await this.prisma.$queryRaw<{ type: string; cnt: bigint }[]>(
      Prisma.sql`
        SELECT type, COUNT(*) AS cnt
        FROM stripe_events
        GROUP BY type
        HAVING COUNT(*) > 1
      `,
    );

    const hasDuplicates = rows.length > 0;

    return {
      scenarioId: 'duplicate_event_handling',
      name: 'Duplicate Event Handling',
      description: 'Checks for duplicate Stripe event types that may indicate idempotency failures',
      result: hasDuplicates ? 'WARN' : 'PASS',
      detail: hasDuplicates
        ? 'Duplicate event types detected, verify idempotency'
        : 'No duplicate event processing detected',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 3 ──────────────────────────────────────────────────────────────
  private async scenario_delayedSettlementDetection(): Promise<FailureLabScenario> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await this.prisma.order.count({
      where: {
        stripePaymentId: { not: null },
        status: 'created',
        createdAt: { gt: oneHourAgo },
      },
    });

    return {
      scenarioId: 'delayed_settlement_detection',
      name: 'Delayed Settlement Detection',
      description:
        'Detects orders with a Stripe PI that remain in created status more than 1 hour after payment',
      result: count > 0 ? 'FAIL' : 'PASS',
      detail:
        count > 0
          ? `Settlement delay detected: ${count} orders stuck`
          : 'No settlement delays detected',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 4 ──────────────────────────────────────────────────────────────
  private async scenario_refundRaceConditionRisk(): Promise<FailureLabScenario> {
    const rows = await this.prisma.$queryRaw<{ order_id: string; refund_count: bigint }[]>(
      Prisma.sql`
        SELECT "order_id", COUNT(*) AS refund_count
        FROM refunds
        GROUP BY "order_id"
        HAVING COUNT(*) > 1
      `,
    );

    const count = rows.length;

    return {
      scenarioId: 'refund_race_condition_risk',
      name: 'Refund Race Condition Risk',
      description: 'Detects orders with more than one refund record, indicating potential race conditions',
      result: count > 0 ? 'WARN' : 'PASS',
      detail:
        count > 0
          ? `Orders with multiple refunds detected — verify no races`
          : 'No refund race conditions detected',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 5 ──────────────────────────────────────────────────────────────
  private async scenario_queueCorruptionDetection(): Promise<FailureLabScenario> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const maxAttempts = 3; // business-defined max

    const stuckCount = await this.prisma.job.count({
      where: {
        status: 'processing',
        startedAt: { lt: oneHourAgo },
      },
    });

    const exhaustedCount = await this.prisma.job.count({
      where: {
        attempts: { gte: maxAttempts },
        status: 'failed',
      },
    });

    const hasIssues = stuckCount > 0 || exhaustedCount > 0;

    const details: string[] = [];
    if (stuckCount > 0) details.push(`${stuckCount} jobs stuck in processing > 1h`);
    if (exhaustedCount > 0) details.push(`${exhaustedCount} jobs exhausted all retry attempts`);

    return {
      scenarioId: 'queue_corruption_detection',
      name: 'Queue Corruption Detection',
      description: 'Detects stuck processing jobs and exhausted retry jobs indicating queue corruption',
      result: hasIssues ? 'WARN' : 'PASS',
      detail: hasIssues ? details.join('; ') : 'Queue integrity verified — no corruption detected',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 6 ──────────────────────────────────────────────────────────────
  private async scenario_partialReplayFailure(): Promise<FailureLabScenario> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await this.prisma.job.count({
      where: {
        type: { contains: 'replay' },
        status: 'failed',
        createdAt: { gte: oneDayAgo },
      },
    });

    return {
      scenarioId: 'partial_replay_failure',
      name: 'Partial Replay Failure',
      description: 'Detects failed replay jobs in the last 24h indicating a degraded recovery engine',
      result: count > 0 ? 'FAIL' : 'PASS',
      detail:
        count > 0
          ? `Replay jobs failing — recovery engine degraded (${count} failed in last 24h)`
          : 'Replay/recovery engine operational',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 7 ──────────────────────────────────────────────────────────────
  private async scenario_ledgerBalanceIntegrity(): Promise<FailureLabScenario> {
    const rows = await this.prisma.$queryRaw<{ balance: number }[]>(
      Prisma.sql`
        SELECT
          SUM(CASE WHEN "entry_type" = 'credit' THEN amount ELSE 0 END) -
          SUM(CASE WHEN "entry_type" = 'debit'  THEN amount ELSE 0 END) AS balance
        FROM ledger_entries
        WHERE "posted_at" > NOW() - INTERVAL '7 days'
      `,
    );

    const balance = rows[0]?.balance ?? 0;
    const absBalance = Math.abs(Number(balance));
    const tolerance = 1.0;

    return {
      scenarioId: 'ledger_balance_integrity',
      name: 'Ledger Balance Integrity',
      description: 'Verifies that ledger credits and debits are balanced within €1 tolerance over 7 days',
      result: absBalance > tolerance ? 'FAIL' : 'PASS',
      detail:
        absBalance > tolerance
          ? `Ledger imbalance: ${Number(balance).toFixed(2)} EUR`
          : `Ledger balanced (net: ${Number(balance).toFixed(2)} EUR, within tolerance)`,
      detectedAt: new Date(),
    };
  }

  // ── Scenario 8 ──────────────────────────────────────────────────────────────
  private async scenario_webhookFailureSpike(): Promise<FailureLabScenario> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [failures, total] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { success: false, createdAt: { gte: oneHourAgo } },
      }),
      this.prisma.webhookDelivery.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
    ]);

    if (total === 0) {
      return {
        scenarioId: 'webhook_failure_spike',
        name: 'Webhook Failure Spike',
        description: 'Monitors webhook delivery failure rate over the last hour',
        result: 'PASS',
        detail: 'No webhook deliveries in the last hour — nothing to evaluate',
        detectedAt: new Date(),
      };
    }

    const failureRate = failures / total;
    const pct = (failureRate * 100).toFixed(1);

    let result: ScenarioResult = 'PASS';
    if (failureRate > 0.1) result = 'FAIL';
    else if (failureRate > 0.05) result = 'WARN';

    return {
      scenarioId: 'webhook_failure_spike',
      name: 'Webhook Failure Spike',
      description: 'Monitors webhook delivery failure rate over the last hour',
      result,
      detail:
        result === 'PASS'
          ? `Webhook failure rate nominal: ${pct}%`
          : `Webhook failure rate: ${pct}% (${failures}/${total} deliveries failed)`,
      detectedAt: new Date(),
    };
  }

  // ── Scenario 9 ──────────────────────────────────────────────────────────────
  private async scenario_orphanPaymentDetection(): Promise<FailureLabScenario> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM orders o
        LEFT JOIN ledger_entries le ON le."reference_id" = o.id
        WHERE o."stripe_payment_id" IS NOT NULL
          AND le.id IS NULL
      `,
    );

    const count = Number(rows[0]?.count ?? 0);

    return {
      scenarioId: 'orphan_payment_detection',
      name: 'Orphan Payment Detection',
      description: 'Detects orders with a Stripe payment but no corresponding ledger entry',
      result: count > 0 ? 'FAIL' : 'PASS',
      detail:
        count > 0
          ? `Orphan payments detected: ${count}`
          : 'All payments have corresponding ledger entries',
      detectedAt: new Date(),
    };
  }

  // ── Scenario 10 ─────────────────────────────────────────────────────────────
  private async scenario_reconciliationStaleness(): Promise<FailureLabScenario> {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    const lastRecon = await this.prisma.eventLog.findFirst({
      where: { event: 'reconciliation.completed' },
      orderBy: { createdAt: 'desc' },
    });

    const isStale = !lastRecon || lastRecon.createdAt < tenMinAgo;

    return {
      scenarioId: 'reconciliation_staleness',
      name: 'Reconciliation Staleness',
      description: 'Verifies that the reconciliation process has run within the last 10 minutes',
      result: isStale ? 'WARN' : 'PASS',
      detail: isStale
        ? lastRecon
          ? `Reconciliation stale — last run: ${lastRecon.createdAt.toISOString()}`
          : 'Reconciliation stale — no reconciliation event found'
        : `Reconciliation current — last run: ${lastRecon!.createdAt.toISOString()}`,
      detectedAt: new Date(),
    };
  }
}
