// FILE: services/api/src/customer-ops/customer-ops.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CustomerTimeline {
  clientId: string;
  email: string;
  createdAt: Date;
  events: Array<{
    timestamp: Date;
    type:
      | 'order_created'
      | 'payment_attempted'
      | 'payment_succeeded'
      | 'payment_failed'
      | 'refund'
      | 'dispute'
      | 'webhook_delivered';
    description: string;
    amountEur: number | null;
    metadata: Record<string, unknown>;
  }>;
  summary: {
    totalOrders: number;
    successfulPayments: number;
    failedPayments: number;
    refundsIssued: number;
    totalSpentEur: number;
    totalRefundedEur: number;
    netRevenueEur: number;
    firstOrderDate: Date | null;
    lastOrderDate: Date | null;
  };
}

export interface OrderForensics {
  orderId: string;
  status: string;
  timeline: Array<{ timestamp: Date; event: string; source: string; details: string }>;
  financialSummary: {
    chargedEur: number;
    refundedEur: number;
    netEur: number;
    stripeFeesEur: number;
    supplierCostEur: number;
    marginEur: number;
  };
  issues: string[];
  stripeStatus: string | null;
  ledgerStatus: 'balanced' | 'missing' | 'imbalanced';
  recommendation: string;
}

// ── Internal raw query row types ──────────────────────────────────────────────

interface EventLogRow {
  id: string;
  event: string;
  createdat: Date;
  payload: unknown;
  entityid: string | null;
}

interface LedgerSumRow {
  entry_type: string;
  total: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerOpsService {
  private readonly logger = new Logger(CustomerOpsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 20_000,
      maxNetworkRetries: 2,
    });
  }

  // ── 1. Full customer timeline ─────────────────────────────────────────────────

  async getCustomerTimeline(clientId: string): Promise<CustomerTimeline> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    // All orders for this client
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const events: CustomerTimeline['events'] = [];

    // Order created events
    for (const order of orders) {
      events.push({
        timestamp: order.createdAt,
        type: 'order_created',
        description: `Order ${order.id} created — €${Number(order.totalAmount).toFixed(2)} (${order.status})`,
        amountEur: Number(order.totalAmount),
        metadata: {
          orderId: order.id,
          status: order.status,
          tenantId: order.tenantId,
          stripeSessionId: order.stripeSessionId,
        },
      });
    }

    // Payment events from EventLog
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const paymentEvents = await this.prisma.$queryRaw<EventLogRow[]>(
        Prisma.sql`
          SELECT id, event, "createdAt" as createdat, payload, "entityId" as entityid
          FROM "EventLog"
          WHERE "entityId" = ANY(${orderIds}::text[])
            AND event IN (
              'payment.confirmed', 'payment.succeeded', 'payment.failed',
              'payment.attempted', 'payment.disputed'
            )
          ORDER BY "createdAt" ASC
        `,
      );

      for (const ev of paymentEvents) {
        const payload = ev.payload as Record<string, unknown>;
        const amountEur =
          typeof payload?.amountEur === 'number' ? payload.amountEur : null;

        let type: CustomerTimeline['events'][0]['type'] = 'payment_attempted';
        if (ev.event === 'payment.confirmed' || ev.event === 'payment.succeeded') {
          type = 'payment_succeeded';
        } else if (ev.event === 'payment.failed') {
          type = 'payment_failed';
        } else if (ev.event === 'payment.disputed') {
          type = 'dispute';
        }

        events.push({
          timestamp: ev.createdat,
          type,
          description: `${ev.event} on order ${ev.entityid ?? 'unknown'}${amountEur !== null ? ` — €${amountEur.toFixed(2)}` : ''}`,
          amountEur,
          metadata: { ...payload, eventId: ev.id, orderId: ev.entityid },
        });
      }

      // Refunds
      const refunds = await this.prisma.refund.findMany({
        where: { orderId: { in: orderIds } },
        orderBy: { createdAt: 'asc' },
      });
      for (const refund of refunds) {
        events.push({
          timestamp: refund.createdAt,
          type: 'refund',
          description: `Refund of €${Number(refund.amount).toFixed(2)} on order ${refund.orderId} (${refund.status})`,
          amountEur: Number(refund.amount),
          metadata: {
            refundId: refund.id,
            orderId: refund.orderId,
            status: refund.status,
            stripeRefundId: refund.stripeRefundId,
          },
        });
      }

      // Webhook delivery events tied to orders
      const webhookEvents = await this.prisma.$queryRaw<EventLogRow[]>(
        Prisma.sql`
          SELECT el.id, el.event, el."createdAt" as createdat, el.payload, el."entityId" as entityid
          FROM "EventLog" el
          WHERE el."entityId" = ANY(${orderIds}::text[])
            AND el.event LIKE 'webhook.%'
          ORDER BY el."createdAt" ASC
          LIMIT 50
        `,
      );
      for (const ev of webhookEvents) {
        const payload = ev.payload as Record<string, unknown>;
        events.push({
          timestamp: ev.createdat,
          type: 'webhook_delivered',
          description: `${ev.event} for order ${ev.entityid ?? 'unknown'}`,
          amountEur: null,
          metadata: { ...payload, eventId: ev.id },
        });
      }
    }

    // Sort all events chronologically
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Build summary
    const paidOrders = orders.filter((o) => o.status === 'paid');
    const failedOrders = orders.filter((o) =>
      ['payment_failed', 'payment_expired'].includes(o.status),
    );
    const totalSpentEur = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const allRefunds = await this.prisma.refund.findMany({
      where: { orderId: { in: orderIds }, status: { in: ['completed', 'refunded'] } },
    });
    const totalRefundedEur = allRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

    const firstOrder = orders[0] ?? null;
    const lastOrder = orders[orders.length - 1] ?? null;

    const summary: CustomerTimeline['summary'] = {
      totalOrders: orders.length,
      successfulPayments: paidOrders.length,
      failedPayments: failedOrders.length,
      refundsIssued: allRefunds.length,
      totalSpentEur: Math.round(totalSpentEur * 100) / 100,
      totalRefundedEur: Math.round(totalRefundedEur * 100) / 100,
      netRevenueEur: Math.round((totalSpentEur - totalRefundedEur) * 100) / 100,
      firstOrderDate: firstOrder?.createdAt ?? null,
      lastOrderDate: lastOrder?.createdAt ?? null,
    };

    this.logger.log(
      `Customer timeline built for client ${clientId}: ${events.length} events, ${orders.length} orders, netRevenue=€${summary.netRevenueEur}`,
    );

    return {
      clientId,
      email: client.email,
      createdAt: client.createdAt,
      events,
      summary,
    };
  }

  // ── 2. Order forensics ────────────────────────────────────────────────────────

  async getOrderForensics(orderId: string): Promise<OrderForensics> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const issues: string[] = [];
    const timeline: OrderForensics['timeline'] = [];

    // DB: creation
    timeline.push({
      timestamp: order.createdAt,
      event: 'order.created',
      source: 'database',
      details: `Order created with status="${order.status}" totalAmount=€${Number(order.totalAmount).toFixed(2)} tenantId=${order.tenantId}`,
    });

    // EventLog entries
    const eventLogs = await this.prisma.eventLog.findMany({
      where: { entityId: orderId },
      orderBy: { createdAt: 'asc' },
    });
    for (const el of eventLogs) {
      const payload = el.payload as Record<string, unknown>;
      timeline.push({
        timestamp: el.createdAt,
        event: el.event,
        source: 'event_log',
        details: JSON.stringify(payload).slice(0, 400),
      });
    }

    // Refunds
    const refunds = await this.prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    for (const refund of refunds) {
      timeline.push({
        timestamp: refund.createdAt,
        event: `refund.${refund.status}`,
        source: 'database',
        details: `Refund ${refund.id}: €${Number(refund.amount).toFixed(2)} stripeRefundId=${refund.stripeRefundId ?? 'none'}`,
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Financial summary from DB
    const totalRefundedEur = refunds
      .filter((r) => r.status === 'completed' || r.status === 'refunded')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const supplierCostEur = order.items.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantity + Number(item.printCost ?? 0),
      0,
    );

    const chargedEur = order.status === 'paid' ? Number(order.totalAmount) : 0;
    const netEur = Math.round((chargedEur - totalRefundedEur) * 100) / 100;
    const marginEur = Math.round((Number(order.marginAmount ?? 0)) * 100) / 100;

    // Stripe fees: estimate 1.4% + €0.25 for EU cards if unknown
    // Cross-reference with actual Stripe balance transaction if PI exists
    let stripeFeesEur = 0;
    let stripeStatus: string | null = null;

    if (order.stripePaymentId) {
      try {
        const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentId, {
          expand: ['latest_charge.balance_transaction'],
        });
        stripeStatus = pi.status;

        // Type-safe expansion extraction
        const charge = pi.latest_charge;
        if (charge && typeof charge === 'object' && 'balance_transaction' in charge) {
          const bt = charge.balance_transaction;
          if (bt && typeof bt === 'object' && 'fee' in bt && typeof bt.fee === 'number') {
            stripeFeesEur = Math.round((bt.fee / 100) * 100) / 100;
          }
        }

        // Cross-check Stripe vs DB status
        if (pi.status === 'succeeded' && order.status !== 'paid') {
          issues.push(
            `DRIFT: Stripe PI ${pi.id} is "succeeded" but order status is "${order.status}". DB needs recovery.`,
          );
        }
        if (pi.status !== 'succeeded' && order.status === 'paid') {
          issues.push(
            `DRIFT: Order is "paid" but Stripe PI ${pi.id} status is "${pi.status}". Manual investigation required.`,
          );
        }

        // Add Stripe event to timeline
        timeline.push({
          timestamp: new Date(pi.created * 1000),
          event: `stripe.payment_intent.${pi.status}`,
          source: 'stripe',
          details: `PI ${pi.id} status=${pi.status} amount=€${(pi.amount / 100).toFixed(2)} currency=${pi.currency}`,
        });
        timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } catch (err) {
        issues.push(`Could not retrieve Stripe PI ${order.stripePaymentId}: ${(err as Error).message}`);
      }
    } else if (order.status === 'paid') {
      issues.push('Order is "paid" but has no stripePaymentId stored. Cannot verify with Stripe.');
    }

    // Stripe fee fallback estimate
    if (stripeFeesEur === 0 && chargedEur > 0) {
      stripeFeesEur = Math.round((chargedEur * 0.014 + 0.25) * 100) / 100;
    }

    // Ledger check
    const ledgerRows = await this.prisma.$queryRaw<LedgerSumRow[]>(
      Prisma.sql`
        SELECT "entryType" as entry_type, SUM(amount)::text AS total
        FROM "LedgerEntry"
        WHERE "referenceId" = ${orderId} AND "referenceType" = 'order'
        GROUP BY "entryType"
      `,
    );

    let ledgerStatus: OrderForensics['ledgerStatus'] = 'missing';
    if (ledgerRows.length > 0) {
      const credits = parseFloat(
        ledgerRows.find((r) => r.entry_type === 'credit')?.total ?? '0',
      );
      const debits = parseFloat(
        ledgerRows.find((r) => r.entry_type === 'debit')?.total ?? '0',
      );
      const balance = Math.round((credits - debits) * 100) / 100;
      const expectedBalance = order.status === 'paid' ? chargedEur : 0;

      if (Math.abs(balance - expectedBalance) <= 0.01) {
        ledgerStatus = 'balanced';
      } else {
        ledgerStatus = 'imbalanced';
        issues.push(
          `LEDGER IMBALANCE: expected €${expectedBalance.toFixed(2)}, ledger net is €${balance.toFixed(2)} (drift €${(balance - expectedBalance).toFixed(2)}).`,
        );
      }
    } else if (order.status === 'paid') {
      issues.push('No ledger entries found for a paid order. Double-entry bookkeeping is missing.');
    }

    // Additional issue detection
    if (order.status === 'created' && !order.stripeSessionId) {
      issues.push('Order has no stripeSessionId — checkout was never initiated.');
    }
    if (refunds.some((r) => r.status === 'pending')) {
      issues.push(`${refunds.filter((r) => r.status === 'pending').length} refund(s) stuck in "pending" status.`);
    }

    // Build recommendation
    const recommendation = this.buildRecommendation(order.status, issues, stripeStatus, ledgerStatus);

    this.logger.log(
      `Order forensics for ${orderId}: issues=${issues.length} stripeStatus=${stripeStatus} ledger=${ledgerStatus}`,
    );

    return {
      orderId,
      status: order.status,
      timeline,
      financialSummary: {
        chargedEur: Math.round(chargedEur * 100) / 100,
        refundedEur: Math.round(totalRefundedEur * 100) / 100,
        netEur,
        stripeFeesEur,
        supplierCostEur: Math.round(supplierCostEur * 100) / 100,
        marginEur,
      },
      issues,
      stripeStatus,
      ledgerStatus,
      recommendation,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private buildRecommendation(
    orderStatus: string,
    issues: string[],
    stripeStatus: string | null,
    ledgerStatus: string,
  ): string {
    if (issues.length === 0) {
      return 'Order is in a clean state. No action required.';
    }

    const hasDrift = issues.some((i) => i.startsWith('DRIFT'));
    const hasLedgerIssue = ledgerStatus !== 'balanced';
    const hasPendingRefund = issues.some((i) => i.includes('pending'));

    if (hasDrift && stripeStatus === 'succeeded' && orderStatus !== 'paid') {
      return 'Run stripe-recovery recoverOrderState to sync DB status with Stripe. Order should be marked "paid".';
    }
    if (hasPendingRefund) {
      return 'Investigate stuck refund(s) in Stripe Dashboard. If Stripe shows refund as completed, trigger manual reconciliation.';
    }
    if (hasLedgerIssue) {
      return 'Trigger ledger repair via stripe-recovery repairPaymentDrift to generate correcting ledger entries.';
    }
    return `${issues.length} issue(s) detected. Review issues array and escalate to engineering if drift persists after recovery attempt.`;
  }
}

// ── Local raw query type ──────────────────────────────────────────────────────

interface LedgerSumRow {
  entry_type: string;
  total: string;
}
