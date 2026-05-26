import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type SystemStateName = 'READY' | 'LIVE' | 'OPERATIONAL' | 'RELIABLE' | 'SCALED' | 'ENTERPRISE';

interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
  critical: boolean;
}

interface StateGate {
  state: SystemStateName;
  description: string;
  checks: GateCheck[];
  allCriticalPass: boolean;
  passRate: number;
}

export interface SystemStateReport {
  evaluatedAt: Date;
  currentState: SystemStateName;
  gates: StateGate[];
  nextState: SystemStateName | null;
  nextStateBlockers: string[];
  safeModeActive: boolean;
  progressSummary: string;
}

const STATE_ORDER: SystemStateName[] = [
  'READY',
  'LIVE',
  'OPERATIONAL',
  'RELIABLE',
  'SCALED',
  'ENTERPRISE',
];

@Injectable()
export class SystemStateService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_KEY!, {
      apiVersion: '2023-10-16' as const,
    });
  }

  // ─── Gate Evaluators ────────────────────────────────────────────────────────

  private async evaluateReadyGate(): Promise<StateGate> {
    const [dbConnected] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false),
    ]);

    const stripeConfigured = !!process.env.STRIPE_KEY;

    const checks: GateCheck[] = [
      {
        id: 'api_running',
        name: 'API Running',
        passed: true,
        detail: 'API is responding to requests',
        critical: true,
      },
      {
        id: 'database_connected',
        name: 'Database Connected',
        passed: dbConnected as boolean,
        detail: dbConnected
          ? 'Prisma connected — SELECT 1 succeeded'
          : 'Prisma connection failed',
        critical: true,
      },
      {
        id: 'stripe_configured',
        name: 'Stripe Configured',
        passed: stripeConfigured,
        detail: stripeConfigured
          ? 'STRIPE_KEY env var is set'
          : 'STRIPE_KEY env var is missing',
        critical: true,
      },
    ];

    return this.buildGate('READY', 'API, database, and Stripe are configured', checks);
  }

  private async evaluateLiveGate(): Promise<StateGate> {
    const stripeLiveMode = process.env.STRIPE_KEY?.startsWith('sk_live_') ?? false;

    const [firstPaidOrderCount, webhookEndpoints, stripeEventCount] = await Promise.all([
      this.prisma.order.count({ where: { status: 'paid' } }).catch(() => 0),
      this.stripe.webhookEndpoints
        .list({ limit: 5 })
        .then((res) => res.data)
        .catch(() => [] as Stripe.WebhookEndpoint[]),
      this.prisma.stripeEvent.count().catch(() => 0),
    ]);

    const webhookEndpointActive =
      webhookEndpoints.length > 0 &&
      webhookEndpoints.some((ep) => ep.status === 'enabled');

    const checks: GateCheck[] = [
      {
        id: 'stripe_live_mode',
        name: 'Stripe Live Mode',
        passed: stripeLiveMode,
        detail: stripeLiveMode
          ? 'STRIPE_KEY is a live key (sk_live_...)'
          : 'STRIPE_KEY is not a live key — still in test mode',
        critical: true,
      },
      {
        id: 'first_paid_order',
        name: 'First Paid Order',
        passed: firstPaidOrderCount >= 1,
        detail: `${firstPaidOrderCount} paid order(s) in database`,
        critical: true,
      },
      {
        id: 'webhook_endpoint_active',
        name: 'Webhook Endpoint Active',
        passed: webhookEndpointActive,
        detail: webhookEndpointActive
          ? `${webhookEndpoints.length} webhook endpoint(s) found, at least one enabled`
          : 'No active Stripe webhook endpoints found',
        critical: true,
      },
      {
        id: 'live_event_processed',
        name: 'Live Stripe Event Processed',
        passed: stripeEventCount >= 1,
        detail: `${stripeEventCount} Stripe event(s) recorded in database`,
        critical: true,
      },
    ];

    return this.buildGate('LIVE', 'Real money is flowing through Stripe in live mode', checks);
  }

  private async evaluateOperationalGate(): Promise<StateGate> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [reconciledResult, recentDeliveries, stuckJobCount, paidWithStripe] =
      await Promise.all([
        this.prisma
          .$queryRaw<{ count: bigint }[]>(
            Prisma.sql`SELECT COUNT(DISTINCT o.id)::bigint AS count
                       FROM orders o
                       INNER JOIN ledger_entries le ON le.reference_id = o.id
                       WHERE o.status = 'paid'
                       LIMIT 1`,
          )
          .catch(() => [{ count: BigInt(0) }]),

        this.prisma.webhookDelivery
          .findMany({
            where: { createdAt: { gte: twentyFourHoursAgo } },
            select: { success: true },
          })
          .catch(() => [] as { success: boolean }[]),

        this.prisma.job
          .count({
            where: {
              status: 'processing',
              startedAt: { lt: thirtyMinutesAgo },
            },
          })
          .catch(() => 0),

        this.prisma.order
          .count({
            where: { status: 'paid', stripePaymentId: { not: null } },
          })
          .catch(() => 0),
      ]);

    const ordersReconciled = Number((reconciledResult[0]?.count ?? BigInt(0))) >= 1;

    let webhookHealthy = true;
    if (recentDeliveries.length > 0) {
      const successCount = recentDeliveries.filter((d) => d.success).length;
      const successRate = successCount / recentDeliveries.length;
      webhookHealthy = successRate >= 0.9;
    }

    const noStuckJobs = stuckJobCount === 0;
    const firstRealTransaction = paidWithStripe >= 1;

    const webhookDetail =
      recentDeliveries.length === 0
        ? 'No webhook deliveries in last 24h — check passes by default'
        : `${recentDeliveries.filter((d) => d.success).length}/${recentDeliveries.length} successful (${Math.round((recentDeliveries.filter((d) => d.success).length / recentDeliveries.length) * 100)}%)`;

    const checks: GateCheck[] = [
      {
        id: 'orders_reconciled',
        name: 'Orders Reconciled in Ledger',
        passed: ordersReconciled,
        detail: ordersReconciled
          ? 'At least 1 paid order has a matching ledger entry'
          : 'No paid orders have corresponding ledger entries',
        critical: true,
      },
      {
        id: 'webhook_healthy',
        name: 'Webhook Health (24h)',
        passed: webhookHealthy,
        detail: webhookDetail,
        critical: true,
      },
      {
        id: 'no_stuck_jobs',
        name: 'No Stuck Jobs',
        passed: noStuckJobs,
        detail: noStuckJobs
          ? 'No jobs stuck in processing state > 30 minutes'
          : `${stuckJobCount} job(s) stuck in processing state for > 30 minutes`,
        critical: true,
      },
      {
        id: 'first_real_transaction',
        name: 'First Real Stripe Transaction',
        passed: firstRealTransaction,
        detail: `${paidWithStripe} paid order(s) with a Stripe Payment ID`,
        critical: true,
      },
    ];

    return this.buildGate(
      'OPERATIONAL',
      'Orders are flowing with ledger reconciliation and healthy webhooks',
      checks,
    );
  }

  private async evaluateReliableGate(): Promise<StateGate> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [firstPaidOrder, deliveries30d, financialGapLogs, paidCount] = await Promise.all([
      this.prisma.order
        .findFirst({ where: { status: 'paid' }, orderBy: { createdAt: 'asc' } })
        .catch(() => null),

      this.prisma.webhookDelivery
        .findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { success: true },
        })
        .catch(() => [] as { success: boolean }[]),

      this.prisma.eventLog
        .count({
          where: {
            event: 'financial.truth.gap.detected',
            createdAt: { gte: sevenDaysAgo },
          },
        })
        .catch(() => 0),

      this.prisma.order.count({ where: { status: 'paid' } }).catch(() => 0),
    ]);

    const uptime30Days =
      firstPaidOrder !== null &&
      firstPaidOrder.createdAt.getTime() <= thirtyDaysAgo.getTime();

    let webhookReliability30d = true;
    let webhookDetail30d = 'Fewer than 10 deliveries in 30 days — check passes by default';
    if (deliveries30d.length >= 10) {
      const failCount = deliveries30d.filter((d) => !d.success).length;
      const failRate = failCount / deliveries30d.length;
      webhookReliability30d = failRate < 0.001;
      webhookDetail30d = `Failure rate: ${(failRate * 100).toFixed(3)}% over ${deliveries30d.length} deliveries (threshold < 0.1%)`;
    }

    const ledgerClean7d = financialGapLogs === 0;
    const paidOrders10 = paidCount >= 10;

    const uptimeDetail = firstPaidOrder
      ? `First paid order: ${firstPaidOrder.createdAt.toISOString()} — ${uptime30Days ? '>= 30 days ago' : '< 30 days ago'}`
      : 'No paid orders found';

    const checks: GateCheck[] = [
      {
        id: 'uptime_30_days',
        name: '30 Days of Live Operation',
        passed: uptime30Days,
        detail: uptimeDetail,
        critical: true,
      },
      {
        id: 'webhook_reliability_30d',
        name: 'Webhook Reliability (30d < 0.1% failure)',
        passed: webhookReliability30d,
        detail: webhookDetail30d,
        critical: true,
      },
      {
        id: 'ledger_clean_7d',
        name: 'No Financial Truth Gaps (7 days)',
        passed: ledgerClean7d,
        detail: ledgerClean7d
          ? 'No financial.truth.gap.detected events in last 7 days'
          : `${financialGapLogs} financial truth gap event(s) detected in last 7 days`,
        critical: true,
      },
      {
        id: 'paid_orders_count_10',
        name: 'At Least 10 Paid Orders',
        passed: paidOrders10,
        detail: `${paidCount} paid orders total (threshold: 10)`,
        critical: true,
      },
    ];

    return this.buildGate(
      'RELIABLE',
      '30 days of stable operation with clean financials',
      checks,
    );
  }

  private async evaluateScaledGate(): Promise<StateGate> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const ordersLast30d = await this.prisma.order
      .count({ where: { status: 'paid', createdAt: { gte: thirtyDaysAgo } } })
      .catch(() => 0);

    const ordersPerMonth1000 = ordersLast30d >= 1000;

    const checks: GateCheck[] = [
      {
        id: 'orders_per_month_1000',
        name: '1,000 Paid Orders / Month',
        passed: ordersPerMonth1000,
        detail: `${ordersLast30d} paid orders in last 30 days (threshold: 1,000)`,
        critical: true,
      },
      {
        id: 'infra_cost_threshold',
        name: 'AWS Multi-Region Infrastructure',
        passed: false,
        detail: 'Requires AWS multi-region activation (manual)',
        critical: false,
      },
      {
        id: 'uptime_99_9',
        name: '99.9% Uptime',
        passed: false,
        detail: 'Requires external uptime monitor — not auto-checkable',
        critical: false,
      },
    ];

    return this.buildGate(
      'SCALED',
      'High-volume operation with multi-region infrastructure',
      checks,
    );
  }

  private async evaluateEnterpriseGate(): Promise<StateGate> {
    const checks: GateCheck[] = [
      {
        id: 'soc2_audit',
        name: 'SOC2 Audit Completed',
        passed: false,
        detail: 'Requires external SOC2 audit (manual, €15k–€80k)',
        critical: false,
      },
      {
        id: 'multi_region',
        name: 'Multi-Region Active',
        passed: false,
        detail: 'Requires Terraform multi-region apply',
        critical: false,
      },
      {
        id: 'pen_test',
        name: 'Penetration Test Completed',
        passed: false,
        detail: 'Requires external pen test (€2k–€5k)',
        critical: false,
      },
    ];

    return this.buildGate(
      'ENTERPRISE',
      'Enterprise-grade compliance, security, and global infrastructure',
      checks,
    );
  }

  // ─── Safe Mode ──────────────────────────────────────────────────────────────

  private async isSafeModeActive(): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activatedLog = await this.prisma.eventLog
      .findFirst({
        where: {
          event: 'system.safe_mode.activated',
          createdAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    if (!activatedLog) return false;

    const deactivatedLog = await this.prisma.eventLog
      .findFirst({
        where: {
          event: 'system.safe_mode.deactivated',
          createdAt: { gt: activatedLog.createdAt },
        },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    return deactivatedLog === null;
  }

  async activateSafeMode(reason: string): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        entity: 'system',
        entityId: 'system',
        event: 'system.safe_mode.activated',
        payload: { reason },
      },
    });
  }

  async deactivateSafeMode(): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        entity: 'system',
        entityId: 'system',
        event: 'system.safe_mode.deactivated',
        payload: {},
      },
    });
  }

  // ─── Core Logic ─────────────────────────────────────────────────────────────

  private buildGate(
    state: SystemStateName,
    description: string,
    checks: GateCheck[],
  ): StateGate {
    const criticalChecks = checks.filter((c) => c.critical);
    const allCriticalPass = criticalChecks.every((c) => c.passed);
    const passedCount = checks.filter((c) => c.passed).length;
    const passRate = checks.length > 0 ? passedCount / checks.length : 1;

    return { state, description, checks, allCriticalPass, passRate };
  }

  async evaluateState(): Promise<SystemStateReport> {
    const evaluatedAt = new Date();

    const [
      readyGate,
      liveGate,
      operationalGate,
      reliableGate,
      scaledGate,
      enterpriseGate,
      safeModeActive,
    ] = await Promise.all([
      this.evaluateReadyGate(),
      this.evaluateLiveGate(),
      this.evaluateOperationalGate(),
      this.evaluateReliableGate(),
      this.evaluateScaledGate(),
      this.evaluateEnterpriseGate(),
      this.isSafeModeActive(),
    ]);

    const gates: StateGate[] = [
      readyGate,
      liveGate,
      operationalGate,
      reliableGate,
      scaledGate,
      enterpriseGate,
    ];

    const gateByState = new Map<SystemStateName, StateGate>(
      gates.map((g) => [g.state, g]),
    );

    // Determine current state: highest state where ALL critical checks pass.
    // Walk down from ENTERPRISE.
    let currentState: SystemStateName = 'READY';
    for (let i = STATE_ORDER.length - 1; i >= 0; i--) {
      const stateName = STATE_ORDER[i];
      const gate = gateByState.get(stateName)!;
      if (gate.allCriticalPass) {
        currentState = stateName;
        break;
      }
    }

    const currentIdx = STATE_ORDER.indexOf(currentState);
    const nextState: SystemStateName | null =
      currentIdx < STATE_ORDER.length - 1 ? STATE_ORDER[currentIdx + 1] : null;

    let nextStateBlockers: string[] = [];
    if (nextState) {
      const nextGate = gateByState.get(nextState)!;
      nextStateBlockers = nextGate.checks
        .filter((c) => c.critical && !c.passed)
        .map((c) => `[${c.id}] ${c.name}: ${c.detail}`);
    }

    const passedGates = gates.filter((g) => g.allCriticalPass).length;
    const progressSummary = `System is ${currentState} (${passedGates}/${gates.length} gates passed). ${
      nextState
        ? `Next: ${nextState} — ${nextStateBlockers.length} blocker(s).`
        : 'Maximum state reached.'
    }${safeModeActive ? ' ⚠ SAFE MODE ACTIVE.' : ''}`;

    return {
      evaluatedAt,
      currentState,
      gates,
      nextState,
      nextStateBlockers,
      safeModeActive,
      progressSummary,
    };
  }
}
