import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ReportType =
  | 'live_money'
  | 'operations'
  | 'financial_truth'
  | 'customer_reality'
  | 'business_reality'
  | 'error_budget'
  | 'replay_recovery'
  | 'maturity';

export interface GeneratedReport {
  type: ReportType;
  generatedAt: Date;
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface ReportDescriptor {
  type: ReportType;
  description: string;
}

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  listAvailableReports(): ReportDescriptor[] {
    return [
      {
        type: 'live_money',
        description: 'Real-time payment summary: orders paid, refunds, disputes, and webhook success rate for the last 24h.',
      },
      {
        type: 'operations',
        description: 'Production operations snapshot: job throughput, event processing, and webhook delivery stats for the last 24h.',
      },
      {
        type: 'financial_truth',
        description: 'Ledger integrity audit: credit/debit balance, orphan payments, ghost orders, and duplicate refunds over 30 days.',
      },
      {
        type: 'customer_reality',
        description: 'Customer health report: churn risk distribution and procurement cycle analysis across all tracked clients.',
      },
      {
        type: 'business_reality',
        description: 'Revenue and margin performance over the last 30 days: gross revenue, margin %, AOV, and refund ratio.',
      },
      {
        type: 'error_budget',
        description: 'SLO compliance report: webhook delivery rate, job success rate, and payment success rate vs. targets over 7 days.',
      },
      {
        type: 'replay_recovery',
        description: 'Stripe event replay and recovery health: all-time event processing totals and replay job success over 7 days.',
      },
      {
        type: 'maturity',
        description: 'Operational maturity assessment: evaluates live money, operations, and economics gates to determine current maturity level.',
      },
    ];
  }

  async generateReport(type: ReportType): Promise<GeneratedReport> {
    switch (type) {
      case 'live_money':
        return this.generateLiveMoneyReport();
      case 'operations':
        return this.generateOperationsReport();
      case 'financial_truth':
        return this.generateFinancialTruthReport();
      case 'customer_reality':
        return this.generateCustomerRealityReport();
      case 'business_reality':
        return this.generateBusinessRealityReport();
      case 'error_budget':
        return this.generateErrorBudgetReport();
      case 'replay_recovery':
        return this.generateReplayRecoveryReport();
      case 'maturity':
        return this.generateMaturityReport();
    }
  }

  // ── Live Money ───────────────────────────────────────────────────────────────
  private async generateLiveMoneyReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [paidOrders, refundCount, disputeCount, webhookTotal, webhookSuccess] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { status: 'paid', createdAt: { gte: oneDayAgo } },
          select: { totalAmount: true },
        }),
        this.prisma.refund.count({ where: { createdAt: { gte: oneDayAgo } } }),
        this.prisma.eventLog.count({
          where: { event: 'dispute.created', createdAt: { gte: oneDayAgo } },
        }),
        this.prisma.webhookDelivery.count({ where: { createdAt: { gte: oneHourAgo } } }),
        this.prisma.webhookDelivery.count({
          where: { success: true, createdAt: { gte: oneHourAgo } },
        }),
      ]);

    const orderCount = paidOrders.length;
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const webhookSuccessRate =
      webhookTotal > 0 ? ((webhookSuccess / webhookTotal) * 100).toFixed(1) : '100.0';

    const status =
      disputeCount > 5 || webhookTotal > 0 && webhookSuccess / webhookTotal < 0.9
        ? 'CRITICAL'
        : disputeCount > 0 || (webhookTotal > 0 && webhookSuccess / webhookTotal < 0.99)
        ? 'DEGRADED'
        : 'HEALTHY';

    const markdown = `# LIVE MONEY REPORT
Generated: ${generatedAt.toISOString()}

## Payment Summary (Last 24h)
- Orders paid: ${orderCount}
- Revenue: €${revenue.toFixed(2)}
- Refunds processed: ${refundCount}
- Disputes opened: ${disputeCount}
- Webhook success rate: ${webhookSuccessRate}%

## Status: ${status}
`;

    return {
      type: 'live_money',
      generatedAt,
      markdown,
      metadata: { orderCount, revenue, refundCount, disputeCount, webhookSuccessRate, status },
    };
  }

  // ── Operations ───────────────────────────────────────────────────────────────
  private async generateOperationsReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [
      jobsCompleted,
      jobsFailed,
      eventsProcessed,
      webhooksDelivered,
      webhookFailures,
      jobsPending,
      jobsFailedLastHour,
    ] = await Promise.all([
      this.prisma.job.count({ where: { status: 'completed', completedAt: { gte: oneDayAgo } } }),
      this.prisma.job.count({ where: { status: 'failed', createdAt: { gte: oneDayAgo } } }),
      this.prisma.eventLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.prisma.webhookDelivery.count({
        where: { success: true, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.webhookDelivery.count({
        where: { success: false, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.job.count({ where: { status: 'pending' } }),
      this.prisma.job.count({ where: { status: 'failed', createdAt: { gte: oneHourAgo } } }),
    ]);

    const markdown = `# PRODUCTION OPERATIONS REPORT
Generated: ${generatedAt.toISOString()}

## System Activity (Last 24h)
- Jobs completed: ${jobsCompleted}
- Jobs failed: ${jobsFailed}
- Events processed: ${eventsProcessed}
- Webhooks delivered: ${webhooksDelivered}
- Webhook failures: ${webhookFailures}

## Queue Status
- Pending jobs: ${jobsPending}
- Failed jobs (last 1h): ${jobsFailedLastHour}
`;

    return {
      type: 'operations',
      generatedAt,
      markdown,
      metadata: {
        jobsCompleted,
        jobsFailed,
        eventsProcessed,
        webhooksDelivered,
        webhookFailures,
        jobsPending,
        jobsFailedLastHour,
      },
    };
  }

  // ── Financial Truth ──────────────────────────────────────────────────────────
  private async generateFinancialTruthReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [ledgerRows, orphanRows, ghostOrders, duplicateRefundRows] = await Promise.all([
      this.prisma.$queryRaw<{ total_credits: number; total_debits: number }[]>(
        Prisma.sql`
          SELECT
            SUM(CASE WHEN "entry_type" = 'credit' THEN amount ELSE 0 END) AS total_credits,
            SUM(CASE WHEN "entry_type" = 'debit'  THEN amount ELSE 0 END) AS total_debits
          FROM ledger_entries
          WHERE "posted_at" >= ${thirtyDaysAgo}
        `,
      ),
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`
          SELECT COUNT(*) AS count
          FROM orders o
          LEFT JOIN ledger_entries le ON le."reference_id" = o.id
          WHERE o."stripe_payment_id" IS NOT NULL
            AND le.id IS NULL
        `,
      ),
      this.prisma.order.count({
        where: {
          status: 'paid',
          stripePaymentId: null,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`
          SELECT COUNT(*) AS count
          FROM (
            SELECT "order_id"
            FROM refunds
            GROUP BY "order_id"
            HAVING COUNT(*) > 1
          ) dupes
        `,
      ),
    ]);

    const totalCredits = Number(ledgerRows[0]?.total_credits ?? 0);
    const totalDebits = Number(ledgerRows[0]?.total_debits ?? 0);
    const balance = Math.abs(totalCredits - totalDebits) <= 1.0 ? 'balanced' : 'IMBALANCED';
    const orphanCount = Number(orphanRows[0]?.count ?? 0);
    const duplicateRefunds = Number(duplicateRefundRows[0]?.count ?? 0);

    const markdown = `# FINANCIAL TRUTH REPORT
Generated: ${generatedAt.toISOString()}

## Ledger Integrity (Last 30 Days)
- Total credits: €${totalCredits.toFixed(2)}
- Total debits: €${totalDebits.toFixed(2)}
- Balance: ${balance}

## Anomalies
- Orders without ledger entries: ${orphanCount}
- Orders paid with no Stripe ID: ${ghostOrders}
- Duplicate refunds: ${duplicateRefunds}
`;

    return {
      type: 'financial_truth',
      generatedAt,
      markdown,
      metadata: { totalCredits, totalDebits, balance, orphanCount, ghostOrders, duplicateRefunds },
    };
  }

  // ── Customer Reality ─────────────────────────────────────────────────────────
  private async generateCustomerRealityReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();

    const cycles = await this.prisma.clientProcurementCycle.findMany({
      select: { churnRiskLevel: true, churnRiskScore: true, lastOrderAt: true, orderCount: true },
    });

    const total = cycles.length;
    const high = cycles.filter((c) => c.churnRiskLevel === 'high').length;
    const medium = cycles.filter((c) => c.churnRiskLevel === 'medium').length;
    const low = cycles.filter((c) => c.churnRiskLevel === 'low').length;
    const highPct = total > 0 ? ((high / total) * 100).toFixed(1) : '0.0';

    // Avg days between orders (approximate from orderCount and lastOrderAt age)
    let avgDaysBetweenOrders = 0;
    if (total > 0) {
      const ordersWithHistory = cycles.filter(
        (c) => c.lastOrderAt && Number(c.orderCount) > 1,
      );
      if (ordersWithHistory.length > 0) {
        const avgIntervals = ordersWithHistory.map((c) => {
          const ageMs = Date.now() - new Date(c.lastOrderAt!).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          return ageDays / (Number(c.orderCount) - 1);
        });
        avgDaysBetweenOrders = Math.round(
          avgIntervals.reduce((a, b) => a + b, 0) / avgIntervals.length,
        );
      }
    }

    const markdown = `# CUSTOMER REALITY REPORT
Generated: ${generatedAt.toISOString()}

## Customer Health
- Total tracked: ${total}
- High churn risk: ${high} (${highPct}%)
- Medium churn risk: ${medium}
- Low churn risk: ${low}
- Avg days between orders: ${avgDaysBetweenOrders}
`;

    return {
      type: 'customer_reality',
      generatedAt,
      markdown,
      metadata: { total, high, medium, low, highPct, avgDaysBetweenOrders },
    };
  }

  // ── Business Reality ─────────────────────────────────────────────────────────
  private async generateBusinessRealityReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [orders, refundCount] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'paid', createdAt: { gte: thirtyDaysAgo } },
        select: { totalAmount: true, marginAmount: true },
      }),
      this.prisma.refund.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const orderCount = orders.length;
    const grossRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const grossMargin = orders.reduce((sum, o) => sum + Number(o.marginAmount ?? 0), 0);
    const marginPct = grossRevenue > 0 ? ((grossMargin / grossRevenue) * 100).toFixed(1) : '0.0';
    const aov = orderCount > 0 ? (grossRevenue / orderCount).toFixed(2) : '0.00';
    const refundRatio = orderCount > 0 ? ((refundCount / orderCount) * 100).toFixed(1) : '0.0';

    const markdown = `# BUSINESS REALITY REPORT
Generated: ${generatedAt.toISOString()}

## Revenue (Last 30 Days)
- Gross revenue: €${grossRevenue.toFixed(2)}
- Gross margin: €${grossMargin.toFixed(2)} (${marginPct}%)
- Orders: ${orderCount}
- Avg order value: €${aov}
- Refund ratio: ${refundRatio}%
`;

    return {
      type: 'business_reality',
      generatedAt,
      markdown,
      metadata: { grossRevenue, grossMargin, marginPct, orderCount, aov, refundRatio },
    };
  }

  // ── Error Budget ─────────────────────────────────────────────────────────────
  private async generateErrorBudgetReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      webhookTotal,
      webhookSuccess,
      jobTotal,
      jobSuccess,
      paidOrders,
      totalOrders,
    ] = await Promise.all([
      this.prisma.webhookDelivery.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.webhookDelivery.count({
        where: { success: true, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.job.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.job.count({
        where: { status: 'completed', createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.order.count({
        where: { status: 'paid', createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.order.count({
        where: {
          status: { in: ['paid', 'failed', 'cancelled'] },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const webhookRate = webhookTotal > 0 ? (webhookSuccess / webhookTotal) * 100 : 100;
    const jobRate = jobTotal > 0 ? (jobSuccess / jobTotal) * 100 : 100;
    const paymentRate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 100;

    const SLO_WEBHOOK = 99.0;
    const SLO_JOB = 99.0;
    const SLO_PAYMENT = 99.5;

    const budgetStatus =
      webhookRate < SLO_WEBHOOK - 1 || jobRate < SLO_JOB - 1 || paymentRate < SLO_PAYMENT - 1
        ? 'EXHAUSTED'
        : webhookRate < SLO_WEBHOOK || jobRate < SLO_JOB || paymentRate < SLO_PAYMENT
        ? 'BURNING'
        : 'HEALTHY';

    const markdown = `# ERROR BUDGET REPORT
Generated: ${generatedAt.toISOString()}

## SLO Status (Last 7 Days)
- Webhook delivery rate: ${webhookRate.toFixed(2)}% (SLO: 99%)
- Job success rate: ${jobRate.toFixed(2)}% (SLO: 99%)
- Payment success rate: ${paymentRate.toFixed(2)}% (SLO: 99.5%)

## Budget Status: ${budgetStatus}
`;

    return {
      type: 'error_budget',
      generatedAt,
      markdown,
      metadata: {
        webhookRate: webhookRate.toFixed(2),
        jobRate: jobRate.toFixed(2),
        paymentRate: paymentRate.toFixed(2),
        budgetStatus,
      },
    };
  }

  // ── Replay & Recovery ────────────────────────────────────────────────────────
  private async generateReplayRecoveryReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [stripeEventTotal, replayCompleted, replayFailed] = await Promise.all([
      this.prisma.stripeEvent.count(),
      this.prisma.job.count({
        where: {
          type: { contains: 'replay' },
          status: 'completed',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.job.count({
        where: {
          type: { contains: 'replay' },
          status: 'failed',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const recoveryHealth = replayFailed > 0 ? 'DEGRADED' : 'HEALTHY';

    const markdown = `# REPLAY & RECOVERY REPORT
Generated: ${generatedAt.toISOString()}

## Event Processing
- Stripe events processed (all time): ${stripeEventTotal}
- Replay jobs completed (last 7d): ${replayCompleted}
- Replay jobs failed (last 7d): ${replayFailed}

## Recovery Health: ${recoveryHealth}
`;

    return {
      type: 'replay_recovery',
      generatedAt,
      markdown,
      metadata: { stripeEventTotal, replayCompleted, replayFailed, recoveryHealth },
    };
  }

  // ── Maturity ─────────────────────────────────────────────────────────────────
  private async generateMaturityReport(): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [paidOrdersTotal, lastRecon, positiveMarginOrders, allOrders30d] = await Promise.all([
      this.prisma.order.count({ where: { status: 'paid' } }),
      this.prisma.eventLog.findFirst({
        where: { event: 'reconciliation.completed' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({
        where: {
          status: 'paid',
          marginAmount: { gt: 0 },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.order.count({
        where: { status: 'paid', createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const isLiveModeActive = paidOrdersTotal > 0;
    const isReconActive =
      lastRecon !== null &&
      new Date(lastRecon.createdAt).getTime() > Date.now() - 60 * 60 * 1000;

    const positiveMarginPct =
      allOrders30d > 0 ? ((positiveMarginOrders / allOrders30d) * 100).toFixed(1) : '0.0';

    // Maturity level: 0=pre-launch, 1=live, 2=operating, 3=optimised
    let maturityLevel: string;
    if (!isLiveModeActive) {
      maturityLevel = 'PRE-LAUNCH';
    } else if (!isReconActive) {
      maturityLevel = 'LIVE — OPERATIONS GATE INCOMPLETE';
    } else if (parseFloat(positiveMarginPct) < 80) {
      maturityLevel = 'OPERATING — ECONOMICS GATE INCOMPLETE';
    } else {
      maturityLevel = 'OPTIMISED';
    }

    const markdown = `# OPERATIONAL MATURITY REPORT
Generated: ${generatedAt.toISOString()}

## Live Money Gate
- Stripe live mode: ${isLiveModeActive ? 'YES' : 'NO'}
- Paid orders total: ${paidOrdersTotal}

## Operations Gate
- Reconciliation active: ${isReconActive ? 'YES' : 'NO'}

## Economics Gate
- Positive margin orders: ${positiveMarginPct}%

## Current Maturity: ${maturityLevel}
`;

    return {
      type: 'maturity',
      generatedAt,
      markdown,
      metadata: {
        isLiveModeActive,
        paidOrdersTotal,
        isReconActive,
        positiveMarginPct,
        maturityLevel,
      },
    };
  }
}
