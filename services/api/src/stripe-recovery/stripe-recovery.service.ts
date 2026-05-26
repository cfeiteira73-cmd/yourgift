// FILE: services/api/src/stripe-recovery/stripe-recovery.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { randomUUID } from 'crypto';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface RecoveryResult {
  recoveryId: string;
  orderId: string;
  method: 'event_replay' | 'state_rebuild' | 'settlement_recovery' | 'timeline_rebuild';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  repairEventsGenerated: string[];
  success: boolean;
  notes: string;
}

export interface FinancialTimeline {
  orderId: string;
  events: Array<{
    timestamp: Date;
    source: 'stripe' | 'db' | 'ledger' | 'event_log';
    event: string;
    amountEur: number | null;
    metadata: Record<string, unknown>;
  }>;
  isConsistent: boolean;
  gaps: string[];
}

export interface LedgerConsistencyResult {
  consistent: boolean;
  driftEur: number;
  issues: string[];
}

// ── Internal raw query result shapes ─────────────────────────────────────────

interface LedgerSumRow {
  total: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class StripeRecoveryService {
  private readonly logger = new Logger(StripeRecoveryService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 30_000,
      maxNetworkRetries: 3,
    });
  }

  // ── 1. Replay a specific Stripe event ────────────────────────────────────────

  async replayEvent(stripeEventId: string): Promise<RecoveryResult> {
    const recoveryId = randomUUID();
    const repairEventsGenerated: string[] = [];

    // Check if already processed
    const alreadyProcessed = await this.prisma.stripeEvent.findUnique({
      where: { id: stripeEventId },
    });

    const before: Record<string, unknown> = {
      stripeEventId,
      alreadyInDb: !!alreadyProcessed,
      processedAt: alreadyProcessed?.processedAt ?? null,
    };

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = await this.stripe.events.retrieve(stripeEventId);
    } catch (err) {
      return {
        recoveryId,
        orderId: 'unknown',
        method: 'event_replay',
        before,
        after: { error: (err as Error).message },
        repairEventsGenerated: [],
        success: false,
        notes: `Failed to retrieve event ${stripeEventId} from Stripe: ${(err as Error).message}`,
      };
    }

    const metadata = (stripeEvent.data.object as Record<string, unknown>)?.['metadata'] as Record<string, unknown> | undefined;
    const orderId = (metadata?.['orderId'] as string | undefined) ?? 'unknown';

    if (alreadyProcessed) {
      return {
        recoveryId,
        orderId,
        method: 'event_replay',
        before,
        after: { skipped: true, reason: 'Event already processed' },
        repairEventsGenerated: [],
        success: true,
        notes: `Event ${stripeEventId} (${stripeEvent.type}) was already processed on ${alreadyProcessed.processedAt?.toISOString() ?? 'unknown'}. No action taken.`,
      };
    }

    // Emit to EventBus so existing handlers pick it up
    const replayTopic = `stripe.replay.${stripeEvent.type}`;
    this.events.emit(replayTopic, { event: stripeEvent, replay: true, recoveryId });
    repairEventsGenerated.push(replayTopic);

    // Mark as processed
    await this.prisma.stripeEvent.upsert({
      where: { id: stripeEventId },
      create: { id: stripeEventId, type: stripeEvent.type },
      update: {},
    });

    this.logger.log(
      `Event replayed: ${stripeEventId} (${stripeEvent.type}) for order ${orderId}`,
    );

    return {
      recoveryId,
      orderId,
      method: 'event_replay',
      before,
      after: { replayed: true, topic: replayTopic },
      repairEventsGenerated,
      success: true,
      notes: `Replayed ${stripeEvent.type} event ${stripeEventId}. Handlers triggered via EventBus topic "${replayTopic}".`,
    };
  }

  // ── 2. Recover order state from Stripe source of truth ───────────────────────

  async recoverOrderState(orderId: string): Promise<RecoveryResult> {
    const recoveryId = randomUUID();
    const repairEventsGenerated: string[] = [];

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const before: Record<string, unknown> = {
      orderId,
      status: order.status,
      stripeSessionId: order.stripeSessionId,
      stripePaymentId: order.stripePaymentId,
      totalAmount: order.totalAmount,
    };

    const repairs: string[] = [];

    // Try to get ground truth from Stripe
    let stripeStatus: string | null = null;
    let stripeAmountEur: number | null = null;

    try {
      if (order.stripePaymentId) {
        const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentId);
        stripeStatus = pi.status;
        stripeAmountEur = pi.amount_received / 100;

        if (pi.status === 'succeeded' && order.status !== 'paid') {
          // DB says not paid, Stripe says paid — repair
          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'paid', stripePaymentId: pi.id },
          });

          this.events.emit('payment.confirmed', {
            orderId,
            paymentIntentId: pi.id,
            amountEur: stripeAmountEur,
            tenantId: order.tenantId,
            source: 'recovery',
          });
          repairEventsGenerated.push('payment.confirmed');
          repairs.push(
            `Updated order status from "${order.status}" to "paid" (Stripe PI ${pi.id} is succeeded).`,
          );
        } else if (
          (pi.status === 'canceled' || pi.status === 'requires_payment_method') &&
          order.status === 'created'
        ) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'payment_failed' },
          });
          repairs.push(`Updated order status from "created" to "payment_failed" (Stripe PI status=${pi.status}).`);
        }
      } else if (order.stripeSessionId) {
        const session = await this.stripe.checkout.sessions.retrieve(order.stripeSessionId);
        stripeStatus = session.payment_status;
        stripeAmountEur = (session.amount_total ?? 0) / 100;

        if (session.payment_status === 'paid' && order.status !== 'paid') {
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? null);

          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'paid', stripePaymentId: paymentIntentId },
          });
          this.events.emit('payment.confirmed', {
            orderId,
            sessionId: order.stripeSessionId,
            paymentIntentId,
            amountEur: stripeAmountEur,
            tenantId: order.tenantId,
            source: 'recovery',
          });
          repairEventsGenerated.push('payment.confirmed');
          repairs.push(
            `Updated order status from "${order.status}" to "paid" via session ${order.stripeSessionId}.`,
          );
        }
      }
    } catch (err) {
      return {
        recoveryId,
        orderId,
        method: 'state_rebuild',
        before,
        after: { stripeError: (err as Error).message },
        repairEventsGenerated,
        success: false,
        notes: `Stripe API error during recovery: ${(err as Error).message}`,
      };
    }

    const updatedOrder = await this.prisma.order.findUnique({ where: { id: orderId } });

    this.logger.log(
      `State recovery for order ${orderId}: ${repairs.length} repair(s) applied.`,
    );

    return {
      recoveryId,
      orderId,
      method: 'state_rebuild',
      before,
      after: {
        status: updatedOrder?.status ?? order.status,
        stripeStatus,
        stripeAmountEur,
        repairsApplied: repairs,
      },
      repairEventsGenerated,
      success: true,
      notes:
        repairs.length > 0
          ? repairs.join(' | ')
          : `No drift detected. DB status "${order.status}" matches Stripe status "${stripeStatus}".`,
    };
  }

  // ── 3. Recover missing settlements in a date range ───────────────────────────

  async recoverMissingSettlement(fromDate: Date, toDate: Date): Promise<RecoveryResult[]> {
    // Find all orders in range that are still in 'created' status but have a Stripe PI
    const stuckOrders = await this.prisma.order.findMany({
      where: {
        status: 'created',
        createdAt: { gte: fromDate, lte: toDate },
        stripePaymentId: { not: null },
      },
      select: { id: true, stripePaymentId: true, tenantId: true, totalAmount: true, createdAt: true },
    });

    this.logger.log(
      `Settlement recovery scan: found ${stuckOrders.length} potentially stuck orders between ${fromDate.toISOString()} and ${toDate.toISOString()}`,
    );

    const results: RecoveryResult[] = [];

    for (const order of stuckOrders) {
      const result = await this.recoverOrderState(order.id).catch((err) => {
        const recoveryId = randomUUID();
        this.logger.error(`Recovery failed for order ${order.id}: ${(err as Error).message}`);
        return {
          recoveryId,
          orderId: order.id,
          method: 'settlement_recovery' as const,
          before: { orderId: order.id, status: 'created' },
          after: { error: (err as Error).message },
          repairEventsGenerated: [],
          success: false,
          notes: `Recovery exception: ${(err as Error).message}`,
        };
      });
      results.push({ ...result, method: 'settlement_recovery' });
    }

    return results;
  }

  // ── 4. Rebuild financial timeline for an order ───────────────────────────────

  async rebuildFinancialTimeline(orderId: string): Promise<FinancialTimeline> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const timelineEvents: FinancialTimeline['events'] = [];
    const gaps: string[] = [];

    // DB: order created
    timelineEvents.push({
      timestamp: order.createdAt,
      source: 'db',
      event: 'order.created',
      amountEur: Number(order.totalAmount),
      metadata: {
        status: order.status,
        tenantId: order.tenantId,
        stripeSessionId: order.stripeSessionId,
      },
    });

    // EventLog entries for this order
    const eventLogs = await this.prisma.eventLog.findMany({
      where: { entityId: orderId },
      orderBy: { createdAt: 'asc' },
    });
    for (const el of eventLogs) {
      const payload = el.payload as Record<string, unknown>;
      const amount = typeof payload?.amountEur === 'number' ? payload.amountEur : null;
      timelineEvents.push({
        timestamp: el.createdAt,
        source: 'event_log',
        event: el.event,
        amountEur: amount,
        metadata: payload,
      });
    }

    // Refunds
    const refunds = await this.prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    for (const refund of refunds) {
      timelineEvents.push({
        timestamp: refund.createdAt,
        source: 'db',
        event: `refund.${refund.status}`,
        amountEur: Number(refund.amount),
        metadata: { refundId: refund.id, stripeRefundId: refund.stripeRefundId, status: refund.status },
      });
    }

    // Ledger entries
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { referenceId: orderId, referenceType: 'order' },
      orderBy: { postedAt: 'asc' },
    });
    for (const entry of ledgerEntries) {
      timelineEvents.push({
        timestamp: entry.postedAt,
        source: 'ledger',
        event: `ledger.${entry.entryType}.${entry.accountCode}`,
        amountEur: Number(entry.amount),
        metadata: {
          ledgerEntryId: entry.id,
          accountCode: entry.accountCode,
          entryType: entry.entryType,
          ledgerTransactionId: entry.transactionId,
        },
      });
    }

    // Sort by timestamp
    timelineEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Gap detection
    const hasPaymentEvent = timelineEvents.some((e) =>
      e.event.includes('payment') || e.event.includes('checkout'),
    );
    const hasLedgerEntry = ledgerEntries.length > 0;

    if (order.status === 'paid' && !hasPaymentEvent) {
      gaps.push('Order is "paid" but no payment event found in EventLog.');
    }
    if (order.status === 'paid' && !hasLedgerEntry) {
      gaps.push('Order is "paid" but no ledger entries found. Double-entry bookkeeping may be missing.');
    }
    if (refunds.length > 0) {
      const refundLedgerEntries = ledgerEntries.filter((e) => e.accountCode.includes('refund'));
      if (refundLedgerEntries.length === 0) {
        gaps.push(`${refunds.length} refund(s) found but no refund ledger entries. Ledger incomplete.`);
      }
    }

    const isConsistent = gaps.length === 0;

    this.logger.log(
      `Timeline rebuilt for order ${orderId}: ${timelineEvents.length} events, consistent=${isConsistent}, gaps=${gaps.length}`,
    );

    return { orderId, events: timelineEvents, isConsistent, gaps };
  }

  // ── 5. Verify ledger consistency for a tenant ────────────────────────────────

  async verifyLedgerConsistency(tenantId: string): Promise<LedgerConsistencyResult> {
    const issues: string[] = [];

    // Sum of all paid orders
    const paidOrdersResult = await this.prisma.order.aggregate({
      where: { tenantId, status: 'paid' },
      _sum: { totalAmount: true },
    });
    const paidOrdersTotal = Number(paidOrdersResult._sum.totalAmount ?? 0);

    // Sum of all revenue ledger entries (credit side for revenue accounts)
    const ledgerRows = await this.prisma.$queryRaw<LedgerSumRow[]>(
      Prisma.sql`
        SELECT SUM(le."amount") as total
        FROM "LedgerEntry" le
        JOIN "LedgerTransaction" lt ON lt.id = le."ledgerTransactionId"
        WHERE lt."tenantId" = ${tenantId}
          AND le."accountCode" LIKE '4%'
          AND le."entryType" = 'credit'
          AND le."referenceType" = 'order'
      `,
    );
    const ledgerRevenueTotal = Number(ledgerRows[0]?.total ?? 0);

    // Sum of refunds
    const refundResult = await this.prisma.$queryRaw<LedgerSumRow[]>(
      Prisma.sql`
        SELECT SUM(r."amount") as total
        FROM "Refund" r
        JOIN "Order" o ON o.id = r."orderId"
        WHERE o."tenantId" = ${tenantId}
          AND r."status" = 'completed'
      `,
    );
    const refundsTotal = Number(refundResult[0]?.total ?? 0);

    const expectedLedgerNet = paidOrdersTotal - refundsTotal;
    const driftEur = Math.round((ledgerRevenueTotal - expectedLedgerNet) * 100) / 100;

    if (Math.abs(driftEur) > 0.01) {
      issues.push(
        `Ledger drift of €${driftEur.toFixed(2)} detected. ` +
          `Paid orders: €${paidOrdersTotal.toFixed(2)}, refunds: €${refundsTotal.toFixed(2)}, ` +
          `expected ledger net: €${expectedLedgerNet.toFixed(2)}, actual ledger revenue: €${ledgerRevenueTotal.toFixed(2)}.`,
      );
    }

    // Check for paid orders with zero ledger entries
    const paidOrdersWithNoLedger = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT o.id
        FROM "Order" o
        WHERE o."tenantId" = ${tenantId}
          AND o."status" = 'paid'
          AND NOT EXISTS (
            SELECT 1 FROM "LedgerEntry" le
            WHERE le."referenceId" = o.id
              AND le."referenceType" = 'order'
          )
        LIMIT 20
      `,
    );

    if (paidOrdersWithNoLedger.length > 0) {
      issues.push(
        `${paidOrdersWithNoLedger.length} paid order(s) have no ledger entries: ${paidOrdersWithNoLedger.map((o) => o.id).join(', ')}`,
      );
    }

    const consistent = issues.length === 0 && Math.abs(driftEur) <= 0.01;

    this.logger.log(
      `Ledger consistency for tenant ${tenantId}: consistent=${consistent}, drift=€${driftEur.toFixed(2)}, issues=${issues.length}`,
    );

    return { consistent, driftEur, issues };
  }

  // ── 6. Repair payment drift for a specific order ──────────────────────────────

  async repairPaymentDrift(orderId: string): Promise<RecoveryResult> {
    const recoveryId = randomUUID();
    const repairEventsGenerated: string[] = [];

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const before: Record<string, unknown> = {
      orderId,
      status: order.status,
      totalAmount: Number(order.totalAmount),
    };

    // Check ledger balance for this order
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { referenceId: orderId, referenceType: 'order' },
    });

    const credits = ledgerEntries
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const debits = ledgerEntries
      .filter((e) => e.entryType === 'debit')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const ledgerBalance = Math.round((credits - debits) * 100) / 100;
    const expectedBalance = order.status === 'paid' ? Number(order.totalAmount) : 0;
    const drift = Math.round((ledgerBalance - expectedBalance) * 100) / 100;

    const repairs: string[] = [];

    if (Math.abs(drift) > 0.01) {
      // Emit repair event so the ledger service can generate correcting entries
      this.events.emit('ledger.repair.required', {
        orderId,
        tenantId: order.tenantId,
        driftEur: drift,
        expectedBalance,
        actualBalance: ledgerBalance,
        source: 'stripe_recovery',
        recoveryId,
      });
      repairEventsGenerated.push('ledger.repair.required');
      repairs.push(
        `Emitted ledger.repair.required for order ${orderId}. Drift: €${drift.toFixed(2)} ` +
          `(expected €${expectedBalance.toFixed(2)}, ledger shows €${ledgerBalance.toFixed(2)}).`,
      );
    }

    // If order is paid but has no payment event log, emit missed event
    if (order.status === 'paid') {
      const paymentEventExists = await this.prisma.eventLog.count({
        where: {
          entityId: orderId,
          event: { in: ['payment.confirmed', 'payment.succeeded'] },
        },
      });
      if (paymentEventExists === 0 && order.stripePaymentId) {
        this.events.emit('payment.confirmed', {
          orderId,
          paymentIntentId: order.stripePaymentId,
          amountEur: Number(order.totalAmount),
          tenantId: order.tenantId,
          source: 'drift_repair',
        });
        repairEventsGenerated.push('payment.confirmed');
        repairs.push(
          `Re-emitted payment.confirmed for order ${orderId} (no payment event found in EventLog).`,
        );
      }
    }

    const success = repairs.length > 0 || Math.abs(drift) <= 0.01;

    this.logger.log(
      `Drift repair for order ${orderId}: drift=€${drift.toFixed(2)}, repairs=${repairs.length}, success=${success}`,
    );

    return {
      recoveryId,
      orderId,
      method: 'state_rebuild',
      before,
      after: {
        ledgerBalance,
        expectedBalance,
        driftEur: drift,
        repairsApplied: repairs,
      },
      repairEventsGenerated,
      success,
      notes:
        repairs.length > 0
          ? repairs.join(' | ')
          : `No ledger drift detected for order ${orderId}. Balance: €${ledgerBalance.toFixed(2)}.`,
    };
  }
}
