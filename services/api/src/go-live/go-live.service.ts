import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface LiveMoneyStatus {
  liveKeysActive: boolean;
  account: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  };
  webhooks: {
    requiredEventsConfigured: boolean;
    configuredEvents: string[];
    missingEvents: string[];
  };
  webhookHealth: {
    successRate: number;
    successfulLast24h: number;
    totalLast24h: number;
  };
  pendingReconciliation: number;
  stuckJobCount: number;
  checkedAt: Date;
}

export interface GoLiveChecklist {
  id: string;
  name: string;
  category: 'stripe' | 'webhooks' | 'database' | 'infrastructure';
  passed: boolean;
  detail: string;
  critical: boolean;
}

export interface GoLiveActivationResult {
  success: boolean;
  activatedAt?: Date;
  blockers?: Array<{ id: string; name: string; detail: string }>;
}

const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'payment_intent.payment_failed',
  'charge.dispute.created',
  'charge.refunded',
];

@Injectable()
export class LiveMoneyGateService {
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2023-10-16' as const });
  }

  async getStatus(): Promise<LiveMoneyStatus> {
    const liveKeysActive = (process.env.STRIPE_KEY ?? '').startsWith('sk_live_');

    const accountData = await this.stripe.accounts.retrieve();

    const endpointsList = await this.stripe.webhookEndpoints.list({ limit: 10 });
    const allConfiguredEvents = endpointsList.data.flatMap((ep) => ep.enabled_events ?? []);
    const uniqueConfigured = [...new Set(allConfiguredEvents)];
    const missingEvents = REQUIRED_WEBHOOK_EVENTS.filter(
      (evt) => !uniqueConfigured.includes(evt) && !uniqueConfigured.includes('*'),
    );
    const requiredEventsConfigured = missingEvents.length === 0;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [successfulLast24h, totalLast24h] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { success: true, createdAt: { gte: since24h } },
      }),
      this.prisma.webhookDelivery.count({
        where: { createdAt: { gte: since24h } },
      }),
    ]);

    const successRate = totalLast24h > 0 ? (successfulLast24h / totalLast24h) * 100 : 100;

    const pendingReconciliation = await this.prisma.order.count({
      where: {
        status: 'created',
        createdAt: { gte: since24h },
      },
    });

    const sinceLastHour = new Date(Date.now() - 60 * 60 * 1000);
    const stuckJobCount = await this.prisma.job.count({
      where: {
        status: 'failed',
        createdAt: { gte: sinceLastHour },
      },
    });

    return {
      liveKeysActive,
      account: {
        chargesEnabled: accountData.charges_enabled,
        payoutsEnabled: accountData.payouts_enabled,
        detailsSubmitted: accountData.details_submitted,
      },
      webhooks: {
        requiredEventsConfigured,
        configuredEvents: uniqueConfigured,
        missingEvents,
      },
      webhookHealth: {
        successRate: Math.round(successRate * 100) / 100,
        successfulLast24h,
        totalLast24h,
      },
      pendingReconciliation,
      stuckJobCount,
      checkedAt: new Date(),
    };
  }

  async getChecklist(): Promise<GoLiveChecklist[]> {
    const liveKeysActive = (process.env.STRIPE_KEY ?? '').startsWith('sk_live_');

    const accountData = await this.stripe.accounts.retrieve();

    const endpointsList = await this.stripe.webhookEndpoints.list({ limit: 10 });
    const allConfiguredEvents = endpointsList.data.flatMap((ep) => ep.enabled_events ?? []);
    const uniqueConfigured = [...new Set(allConfiguredEvents)];
    const missingEvents = REQUIRED_WEBHOOK_EVENTS.filter(
      (evt) => !uniqueConfigured.includes(evt) && !uniqueConfigured.includes('*'),
    );
    const webhookEventsConfigured = missingEvents.length === 0;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [successfulLast24h, totalLast24h] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { success: true, createdAt: { gte: since24h } },
      }),
      this.prisma.webhookDelivery.count({
        where: { createdAt: { gte: since24h } },
      }),
    ]);

    const successRate = totalLast24h > 0 ? (successfulLast24h / totalLast24h) * 100 : 100;

    const sinceOneHour = new Date(Date.now() - 60 * 60 * 1000);

    const [pendingReconciliation, failedJobsLastHour] = await Promise.all([
      this.prisma.order.count({
        where: { status: 'created', createdAt: { gte: since24h } },
      }),
      this.prisma.job.count({
        where: { status: 'failed', createdAt: { gte: sinceOneHour } },
      }),
    ]);

    const checks: GoLiveChecklist[] = [
      {
        id: 'stripe_live_keys',
        name: 'Stripe Live Keys Active',
        category: 'stripe',
        passed: liveKeysActive,
        detail: liveKeysActive
          ? 'STRIPE_KEY starts with sk_live_ — live mode active'
          : 'STRIPE_KEY starts with sk_test_ — test mode, payments will NOT be real',
        critical: true,
      },
      {
        id: 'stripe_charges_enabled',
        name: 'Stripe Charges Enabled',
        category: 'stripe',
        passed: accountData.charges_enabled,
        detail: accountData.charges_enabled
          ? 'Account can accept charges'
          : 'Account cannot accept charges — complete Stripe onboarding',
        critical: true,
      },
      {
        id: 'stripe_payouts_enabled',
        name: 'Stripe Payouts Enabled',
        category: 'stripe',
        passed: accountData.payouts_enabled,
        detail: accountData.payouts_enabled
          ? 'Account can receive payouts'
          : 'Payouts are blocked — verify bank account details in Stripe dashboard',
        critical: true,
      },
      {
        id: 'webhook_events_configured',
        name: 'Required Webhook Events Configured',
        category: 'webhooks',
        passed: webhookEventsConfigured,
        detail: webhookEventsConfigured
          ? `All required events configured: ${REQUIRED_WEBHOOK_EVENTS.join(', ')}`
          : `Missing events: ${missingEvents.join(', ')}`,
        critical: true,
      },
      {
        id: 'webhook_delivery_health',
        name: 'Webhook Delivery Health',
        category: 'webhooks',
        passed: successRate >= 95,
        detail:
          totalLast24h === 0
            ? 'No webhook deliveries in last 24h — system may not be receiving events'
            : `Success rate: ${successRate.toFixed(1)}% (${successfulLast24h}/${totalLast24h} in last 24h)`,
        critical: false,
      },
      {
        id: 'reconciliation_healthy',
        name: 'Reconciliation Healthy',
        category: 'database',
        passed: pendingReconciliation === 0,
        detail:
          pendingReconciliation === 0
            ? 'No unreconciled orders from last 24h'
            : `${pendingReconciliation} orders created in last 24h still in "created" status`,
        critical: false,
      },
      {
        id: 'jobs_healthy',
        name: 'Background Jobs Healthy',
        category: 'database',
        passed: failedJobsLastHour < 5,
        detail:
          failedJobsLastHour < 5
            ? `Only ${failedJobsLastHour} failed jobs in the last hour — within threshold`
            : `${failedJobsLastHour} failed jobs in last hour — investigate job queue`,
        critical: false,
      },
      {
        id: 'https_enforced',
        name: 'HTTPS / Production Environment',
        category: 'infrastructure',
        passed: process.env.NODE_ENV === 'production',
        detail:
          process.env.NODE_ENV === 'production'
            ? 'NODE_ENV=production — production mode active'
            : `NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} — not in production mode`,
        critical: true,
      },
    ];

    // Sort: critical failures first, then non-critical failures, then passing checks
    return checks.sort((a, b) => {
      const aFail = !a.passed;
      const bFail = !b.passed;
      const aCritFail = a.critical && !a.passed;
      const bCritFail = b.critical && !b.passed;

      if (aCritFail && !bCritFail) return -1;
      if (!aCritFail && bCritFail) return 1;
      if (aFail && !bFail) return -1;
      if (!aFail && bFail) return 1;
      return 0;
    });
  }

  async activate(): Promise<GoLiveActivationResult> {
    const checklist = await this.getChecklist();

    const criticalFailures = checklist.filter((c) => c.critical && !c.passed);

    if (criticalFailures.length > 0) {
      return {
        success: false,
        blockers: criticalFailures.map((c) => ({
          id: c.id,
          name: c.name,
          detail: c.detail,
        })),
      };
    }

    const activatedAt = new Date();

    await this.eventBus.emit('system.go_live.activated', { activatedAt });

    return {
      success: true,
      activatedAt,
    };
  }
}
