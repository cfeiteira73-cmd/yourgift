import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GovernanceCriterion {
  id: string;
  name: string;
  passed: boolean;
  value: string;
  target: string;
  detail: string;
}

export interface StabilityReport {
  reportedAt: Date;
  validatedLive: boolean;
  overallStatus: 'VALIDATED_LIVE' | 'IN_PROGRESS' | 'FAILED';
  criteria: GovernanceCriterion[];
  daysUntilValidated: number | null;
  firstTransactionAt: Date | null;
  daysSinceFirstTransaction: number | null;
  failures: string[];
  nextMilestone: string;
}

export interface StabilityHistoryEntry {
  date: string;
  gapsDetected: number;
  manualCorrections: number;
  safeModeEvents: number;
  labRuns: number;
}

@Injectable()
export class StabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getGovernanceReport(): Promise<StabilityReport> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      orphanPaymentsResult,
      ledgerDriftCount,
      webhookTotal,
      webhookFailures,
      manualCorrectionCount,
      paidOrderCount,
      firstOrder,
    ] = await Promise.all([
      // 1. Orphan payments: orders with stripePaymentId but no ledger entry at account 4000
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) as count
        FROM orders o
        LEFT JOIN ledger_entries le
          ON le.reference_id = o.id
          AND le.account_code = '4000'
        WHERE o.stripe_payment_id IS NOT NULL
          AND le.id IS NULL
          AND o.status != 'cancelled'
      `),

      // 2. Ledger drift events in last 30 days
      this.prisma.eventLog.count({
        where: {
          event: 'financial.truth.gap.detected',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // 3a. Total webhook deliveries in last 30 days
      this.prisma.webhookDelivery.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // 3b. Failed webhook deliveries in last 30 days
      this.prisma.webhookDelivery.count({
        where: { success: false, createdAt: { gte: thirtyDaysAgo } },
      }),

      // 4. Manual corrections in last 30 days
      this.prisma.eventLog.count({
        where: {
          event: 'manual.financial.correction',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // 5. Total paid orders
      this.prisma.order.count({ where: { status: 'paid' } }),

      // 6. First paid order (for age calculation)
      this.prisma.order.findFirst({
        where: { status: 'paid' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const orphanCount = Number(orphanPaymentsResult[0]?.count ?? 0);
    const daysSinceFirst = firstOrder
      ? Math.floor(
          (Date.now() - firstOrder.createdAt.getTime()) / 86_400_000,
        )
      : null;

    const criteria: GovernanceCriterion[] = [];

    // 1. all_payments_reconciled
    const reconPassed = orphanCount === 0;
    criteria.push({
      id: 'all_payments_reconciled',
      name: 'All Payments Reconciled',
      passed: reconPassed,
      value: `${orphanCount} orphan payments`,
      target: '0 orphan payments',
      detail: reconPassed
        ? 'All stripe payments have matching ledger entries.'
        : `${orphanCount} order(s) have a Stripe payment but no ledger entry at account 4000.`,
    });

    // 2. no_ledger_drift_30d
    const driftPassed = ledgerDriftCount === 0;
    criteria.push({
      id: 'no_ledger_drift_30d',
      name: 'No Ledger Drift (30 days)',
      passed: driftPassed,
      value: `${ledgerDriftCount} gaps detected`,
      target: '0 gaps in 30 days',
      detail: driftPassed
        ? 'No financial truth gaps detected in the last 30 days.'
        : `${ledgerDriftCount} financial truth gap event(s) detected in the last 30 days.`,
    });

    // 3. webhook_failure_rate_30d
    let webhookPassed: boolean;
    let webhookValue: string;
    let webhookDetail: string;
    if (webhookTotal < 10) {
      webhookPassed = true;
      webhookValue = 'insufficient_data';
      webhookDetail = 'Less than 10 webhooks in 30 days';
    } else {
      const webhookRate = webhookFailures / webhookTotal;
      webhookPassed = webhookRate < 0.001;
      webhookValue = `${(webhookRate * 100).toFixed(3)}%`;
      webhookDetail = webhookPassed
        ? `Failure rate ${(webhookRate * 100).toFixed(3)}% is within acceptable range.`
        : `Failure rate ${(webhookRate * 100).toFixed(3)}% exceeds 0.1% threshold (${webhookFailures}/${webhookTotal} failed).`;
    }
    criteria.push({
      id: 'webhook_failure_rate_30d',
      name: 'Webhook Failure Rate (30 days)',
      passed: webhookPassed,
      value: webhookValue,
      target: '< 0.1%',
      detail: webhookDetail,
    });

    // 4. no_manual_corrections_30d
    const correctionPassed = manualCorrectionCount === 0;
    criteria.push({
      id: 'no_manual_corrections_30d',
      name: 'No Manual Corrections (30 days)',
      passed: correctionPassed,
      value: `${manualCorrectionCount} manual corrections`,
      target: '0 in 30 days',
      detail: correctionPassed
        ? 'No manual financial corrections recorded in the last 30 days.'
        : `${manualCorrectionCount} manual correction(s) recorded in the last 30 days.`,
    });

    // 5. min_paid_orders
    const minOrdersPassed = paidOrderCount >= 1;
    criteria.push({
      id: 'min_paid_orders',
      name: 'Minimum Paid Orders',
      passed: minOrdersPassed,
      value: `${paidOrderCount} paid orders`,
      target: '≥ 1 paid order',
      detail: minOrdersPassed
        ? `${paidOrderCount} paid order(s) processed.`
        : 'No paid orders have been processed yet.',
    });

    // 6. first_transaction_age (informational)
    const agePassed = daysSinceFirst !== null && daysSinceFirst >= 1;
    criteria.push({
      id: 'first_transaction_age',
      name: 'First Transaction Age',
      passed: agePassed,
      value:
        daysSinceFirst !== null
          ? `${daysSinceFirst} days`
          : 'no transactions',
      target: '≥ 1 day since first paid order',
      detail:
        daysSinceFirst !== null
          ? `First paid order was ${daysSinceFirst} day(s) ago.`
          : 'No paid orders found.',
    });

    // Gate criteria: 1-5 (not the informational age check)
    const gateCriteria = criteria.slice(0, 5);
    const failures = gateCriteria
      .filter((c) => !c.passed)
      .map((c) => c.name);

    const validatedLive = failures.length === 0;

    let overallStatus: 'VALIDATED_LIVE' | 'IN_PROGRESS' | 'FAILED';
    if (validatedLive) {
      overallStatus = 'VALIDATED_LIVE';
    } else if (reconPassed && driftPassed) {
      overallStatus = 'IN_PROGRESS';
    } else {
      overallStatus = 'FAILED';
    }

    const daysUntilValidated =
      firstOrder !== null && daysSinceFirst !== null
        ? Math.max(0, 30 - daysSinceFirst)
        : null;

    let nextMilestone: string;
    if (!firstOrder) {
      nextMilestone = 'Process your first real paid order';
    } else if (daysSinceFirst !== null && daysSinceFirst < 30) {
      nextMilestone = `${30 - daysSinceFirst} days remaining for 30-day stability validation`;
    } else if (failures.length > 0) {
      nextMilestone = `Fix: ${failures[0]}`;
    } else {
      nextMilestone = 'System is VALIDATED LIVE';
    }

    return {
      reportedAt: new Date(),
      validatedLive,
      overallStatus,
      criteria,
      daysUntilValidated,
      firstTransactionAt: firstOrder?.createdAt ?? null,
      daysSinceFirstTransaction: daysSinceFirst,
      failures,
      nextMilestone,
    };
  }

  async getStabilityHistory(): Promise<StabilityHistoryEntry[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const events = await this.prisma.eventLog.findMany({
      where: {
        event: {
          in: [
            'financial.truth.gap.detected',
            'manual.financial.correction',
            'system.safe_mode.activated',
            'failure.lab.completed',
          ],
        },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { event: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = new Map<
      string,
      {
        gapsDetected: number;
        manualCorrections: number;
        safeModeEvents: number;
        labRuns: number;
      }
    >();

    for (const e of events) {
      const date = e.createdAt.toISOString().slice(0, 10);
      if (!byDate.has(date)) {
        byDate.set(date, {
          gapsDetected: 0,
          manualCorrections: 0,
          safeModeEvents: 0,
          labRuns: 0,
        });
      }
      const entry = byDate.get(date)!;
      if (e.event === 'financial.truth.gap.detected') entry.gapsDetected++;
      if (e.event === 'manual.financial.correction') entry.manualCorrections++;
      if (e.event === 'system.safe_mode.activated') entry.safeModeEvents++;
      if (e.event === 'failure.lab.completed') entry.labRuns++;
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }
}
