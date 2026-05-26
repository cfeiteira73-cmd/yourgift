import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export type ValidationStatus = 'ok' | 'warning' | 'alert';

export interface ValidationScenario {
  scenario: string;
  count: number;
  lastSeen: Date | null;
  status: ValidationStatus;
  detail: string;
}

export interface LiveValidationReport {
  validatedAt: Date;
  scenarios: ValidationScenario[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
  alertCount: number;
  warningCount: number;
}

export interface HistoryEntry {
  date: string;
  payments: number;
  refunds: number;
  disputes: number;
  failures: number;
}

@Injectable()
export class RealTransactionValidationService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2023-10-16' as const });
  }

  async getCurrentValidation(): Promise<LiveValidationReport> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const since30min = new Date(now.getTime() - 30 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      successfulChargesResult,
      failedCardsResult,
      outOfOrderResult,
      delayedSettlementsResult,
      refundsResult,
      expiredSessionsResult,
      abandonedCartsResult,
      partialRefundsResult,
      duplicateWebhooksResult,
    ] = await Promise.all([
      // 1. successful_charges: paid orders in last 24h
      this.prisma.order.findMany({
        where: { status: 'paid', createdAt: { gte: since24h } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }).then(async (latest) => ({
        count: await this.prisma.order.count({ where: { status: 'paid', createdAt: { gte: since24h } } }),
        lastSeen: latest[0]?.createdAt ?? null,
      })),

      // 2. failed_cards: payment.failed events in last 24h
      this.prisma.eventLog.findMany({
        where: { event: 'payment.failed', createdAt: { gte: since24h } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }).then(async (latest) => ({
        count: await this.prisma.eventLog.count({ where: { event: 'payment.failed', createdAt: { gte: since24h } } }),
        lastSeen: latest[0]?.createdAt ?? null,
      })),

      // 4. out_of_order_webhooks: payment.confirmed exists but order still 'created'
      (async () => {
        const confirmedOrderIds = await this.prisma.eventLog.findMany({
          where: { event: 'payment.confirmed' },
          select: { orderId: true },
          distinct: ['orderId'],
        });
        const ids = confirmedOrderIds.map((e) => e.orderId).filter(Boolean) as string[];
        if (ids.length === 0) return { count: 0, lastSeen: null };
        const [count, latest] = await Promise.all([
          this.prisma.order.count({ where: { id: { in: ids }, status: 'created' } }),
          this.prisma.order.findFirst({
            where: { id: { in: ids }, status: 'created' },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);
        return { count, lastSeen: latest?.createdAt ?? null };
      })(),

      // 5. delayed_settlements: stripePaymentId set but status='created' and > 30min old
      this.prisma.order.findMany({
        where: {
          stripePaymentId: { not: null },
          status: 'created',
          createdAt: { lte: since30min },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }).then(async (latest) => ({
        count: await this.prisma.order.count({
          where: { stripePaymentId: { not: null }, status: 'created', createdAt: { lte: since30min } },
        }),
        lastSeen: latest[0]?.createdAt ?? null,
      })),

      // 6. refunds: last 7 days count + sum
      (async () => {
        const refunds = await this.prisma.refund.findMany({
          where: { createdAt: { gte: since7d } },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const count = refunds.length;
        const totalAmount = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
        const lastSeen = refunds[0]?.createdAt ?? null;
        return { count, totalAmount, lastSeen };
      })(),

      // 9. expired_sessions: checkout.expired events last 7d
      this.prisma.eventLog.findMany({
        where: { event: 'checkout.expired', createdAt: { gte: since7d } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }).then(async (latest) => ({
        count: await this.prisma.eventLog.count({ where: { event: 'checkout.expired', createdAt: { gte: since7d } } }),
        lastSeen: latest[0]?.createdAt ?? null,
      })),

      // 10. abandoned_carts: status='created', > 2h old, stripeSessionId set
      this.prisma.order.findMany({
        where: { status: 'created', stripeSessionId: { not: null }, createdAt: { lte: since2h } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }).then(async (latest) => ({
        count: await this.prisma.order.count({
          where: { status: 'created', stripeSessionId: { not: null }, createdAt: { lte: since2h } },
        }),
        lastSeen: latest[0]?.createdAt ?? null,
      })),

      // 7. partial_refunds: refund.amount < order.totalAmount (raw SQL)
      (async () => {
        const results = await this.prisma.$queryRaw<Array<{ count: bigint; last_seen: Date | null }>>`
          SELECT COUNT(*)::bigint AS count, MAX(r."createdAt") AS last_seen
          FROM "Refund" r
          INNER JOIN "Order" o ON r."orderId" = o.id
          WHERE r.amount < o."totalAmount"
            AND r."createdAt" >= ${since7d}
        `;
        return {
          count: Number(results[0]?.count ?? 0),
          lastSeen: results[0]?.last_seen ?? null,
        };
      })(),

      // 3. duplicate_webhooks: StripeEvent processed more than once (raw SQL groupBy)
      (async () => {
        const results = await this.prisma.$queryRaw<Array<{ type: string; cnt: bigint }>>`
          SELECT type, COUNT(*)::bigint AS cnt
          FROM "StripeEvent"
          GROUP BY type
          HAVING COUNT(*) > 1
        `;
        const count = results.length;
        // Get most recent processedAt for duplicated types
        let lastSeen: Date | null = null;
        if (count > 0) {
          const types = results.map((r) => r.type);
          const latest = await this.prisma.stripeEvent.findFirst({
            where: { type: { in: types } },
            orderBy: { processedAt: 'desc' },
            select: { processedAt: true },
          });
          lastSeen = latest?.processedAt ?? null;
        }
        return { count, lastSeen };
      })(),
    ]);

    // 8. disputes: Stripe API call
    const disputesResponse = await this.stripe.disputes.list({
      limit: 10,
      created: { gte: Math.floor(Date.now() / 1000) - 86400 * 7 },
    });
    const disputeCount = disputesResponse.data.length;
    const latestDispute =
      disputesResponse.data.length > 0
        ? new Date(disputesResponse.data[0].created * 1000)
        : null;

    const scenarios: ValidationScenario[] = [
      {
        scenario: 'successful_charges',
        count: successfulChargesResult.count,
        lastSeen: successfulChargesResult.lastSeen,
        status: successfulChargesResult.count > 0 ? 'ok' : 'warning',
        detail:
          successfulChargesResult.count > 0
            ? `${successfulChargesResult.count} paid orders in the last 24h`
            : 'No successful charges in the last 24h — check payment flow',
      },
      {
        scenario: 'failed_cards',
        count: failedCardsResult.count,
        lastSeen: failedCardsResult.lastSeen,
        status:
          failedCardsResult.count === 0
            ? 'ok'
            : failedCardsResult.count < 10
            ? 'warning'
            : 'alert',
        detail:
          failedCardsResult.count === 0
            ? 'No card failures in last 24h'
            : `${failedCardsResult.count} card failures in the last 24h`,
      },
      {
        scenario: 'duplicate_webhooks',
        count: duplicateWebhooksResult.count,
        lastSeen: duplicateWebhooksResult.lastSeen,
        status: duplicateWebhooksResult.count === 0 ? 'ok' : 'alert',
        detail:
          duplicateWebhooksResult.count === 0
            ? 'No duplicate webhook types detected'
            : `${duplicateWebhooksResult.count} webhook event type(s) processed multiple times — check idempotency`,
      },
      {
        scenario: 'out_of_order_webhooks',
        count: outOfOrderResult.count,
        lastSeen: outOfOrderResult.lastSeen,
        status: outOfOrderResult.count === 0 ? 'ok' : 'alert',
        detail:
          outOfOrderResult.count === 0
            ? 'No out-of-order webhook events detected'
            : `${outOfOrderResult.count} orders have payment.confirmed event but are still in "created" status`,
      },
      {
        scenario: 'delayed_settlements',
        count: delayedSettlementsResult.count,
        lastSeen: delayedSettlementsResult.lastSeen,
        status:
          delayedSettlementsResult.count === 0
            ? 'ok'
            : delayedSettlementsResult.count < 3
            ? 'warning'
            : 'alert',
        detail:
          delayedSettlementsResult.count === 0
            ? 'No delayed settlements detected'
            : `${delayedSettlementsResult.count} orders have a Stripe payment ID but remain in "created" status after 30+ minutes`,
      },
      {
        scenario: 'refunds',
        count: refundsResult.count,
        lastSeen: refundsResult.lastSeen,
        status: refundsResult.count === 0 ? 'ok' : refundsResult.count < 5 ? 'warning' : 'alert',
        detail:
          refundsResult.count === 0
            ? 'No refunds in the last 7 days'
            : `${refundsResult.count} refunds in the last 7 days — total amount: ${(refundsResult.totalAmount / 100).toFixed(2)}`,
      },
      {
        scenario: 'partial_refunds',
        count: partialRefundsResult.count,
        lastSeen: partialRefundsResult.lastSeen,
        status:
          partialRefundsResult.count === 0
            ? 'ok'
            : partialRefundsResult.count < 3
            ? 'warning'
            : 'alert',
        detail:
          partialRefundsResult.count === 0
            ? 'No partial refunds in the last 7 days'
            : `${partialRefundsResult.count} partial refunds issued in the last 7 days`,
      },
      {
        scenario: 'disputes',
        count: disputeCount,
        lastSeen: latestDispute,
        status: disputeCount === 0 ? 'ok' : disputeCount < 3 ? 'warning' : 'alert',
        detail:
          disputeCount === 0
            ? 'No disputes in the last 7 days'
            : `${disputeCount} dispute(s) opened in the last 7 days — action required`,
      },
      {
        scenario: 'expired_sessions',
        count: expiredSessionsResult.count,
        lastSeen: expiredSessionsResult.lastSeen,
        status:
          expiredSessionsResult.count === 0
            ? 'ok'
            : expiredSessionsResult.count < 20
            ? 'warning'
            : 'alert',
        detail:
          expiredSessionsResult.count === 0
            ? 'No expired checkout sessions in the last 7 days'
            : `${expiredSessionsResult.count} checkout sessions expired in the last 7 days`,
      },
      {
        scenario: 'abandoned_carts',
        count: abandonedCartsResult.count,
        lastSeen: abandonedCartsResult.lastSeen,
        status:
          abandonedCartsResult.count === 0
            ? 'ok'
            : abandonedCartsResult.count < 10
            ? 'warning'
            : 'alert',
        detail:
          abandonedCartsResult.count === 0
            ? 'No abandoned carts with Stripe sessions older than 2h'
            : `${abandonedCartsResult.count} orders created > 2h ago with a Stripe session ID still in "created" status`,
      },
    ];

    const alertCount = scenarios.filter((s) => s.status === 'alert').length;
    const warningCount = scenarios.filter((s) => s.status === 'warning').length;

    let overallHealth: 'healthy' | 'degraded' | 'critical';
    if (alertCount >= 2) {
      overallHealth = 'critical';
    } else if (alertCount === 1 || warningCount >= 3) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    return {
      validatedAt: now,
      scenarios,
      overallHealth,
      alertCount,
      warningCount,
    };
  }

  async getHistory(days: number = 7): Promise<HistoryEntry[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await this.prisma.eventLog.findMany({
      where: {
        event: {
          in: [
            'payment.confirmed',
            'payment.failed',
            'refund.created',
            'dispute.created',
            'checkout.expired',
          ],
        },
        createdAt: { gte: since },
      },
      select: { event: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = new Map<string, { payments: number; refunds: number; disputes: number; failures: number }>();

    for (const ev of events) {
      const dateKey = ev.createdAt.toISOString().split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { payments: 0, refunds: 0, disputes: 0, failures: 0 });
      }
      const bucket = byDate.get(dateKey)!;
      switch (ev.event) {
        case 'payment.confirmed':
          bucket.payments++;
          break;
        case 'payment.failed':
          bucket.failures++;
          break;
        case 'refund.created':
          bucket.refunds++;
          break;
        case 'dispute.created':
          bucket.disputes++;
          break;
        case 'checkout.expired':
          // not tracked in the returned buckets but counted as failure signal
          bucket.failures++;
          break;
      }
    }

    // Fill in days with zero-counts so the chart has a continuous series
    const entries: HistoryEntry[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().split('T')[0];
      const bucket = byDate.get(dateKey) ?? { payments: 0, refunds: 0, disputes: 0, failures: 0 };
      entries.push({ date: dateKey, ...bucket });
    }

    return entries;
  }
}
