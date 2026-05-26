import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface FinancialTruthReport {
  reportedAt: Date;
  overallStatus: 'clean' | 'warnings' | 'critical';
  orphanPayments: { count: number; orders: { id: string; amount: number }[] };
  ghostOrders: { count: number; orderIds: string[] };
  duplicateRefunds: { count: number; orderIds: string[] };
  ledgerBalance: { debits: number; credits: number; imbalance: number; balanced: boolean };
  settlementDrift: { count: number };
  marginInconsistency: { count: number; orders: { id: string; margin: number }[] };
  criticalIssues: string[];
  recommendations: string[];
}

export interface ReconcileResult {
  orderId: string | null;
  gapsFound: number;
  gapsFixed: number;
  auditTrail: string[];
  orders?: { orderId: string; gapsFound: number; auditTrail: string[] }[];
}

@Injectable()
export class FinancialTruthService {
  private readonly logger = new Logger(FinancialTruthService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2023-10-16' as const });
  }

  async getReport(): Promise<FinancialTruthReport> {
    const [
      orphanRows,
      ghostOrdersRaw,
      duplicateRefundRows,
      ledgerRows,
      settlementDriftCount,
      marginOrders,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; stripe_payment_id: string; total_amount: number }[]>(
        Prisma.sql`
          SELECT o.id, o."stripe_payment_id", o."total_amount"
          FROM orders o
          LEFT JOIN ledger_entries le ON le."reference_id" = o.id AND le."account_code" = '4000'
          WHERE o."stripe_payment_id" IS NOT NULL
            AND le.id IS NULL
            AND o.status != 'cancelled'
        `,
      ),

      this.prisma.order.findMany({
        where: { status: 'paid', stripePaymentId: null },
        select: { id: true },
      }),

      this.prisma.$queryRaw<{ order_id: string; refund_count: bigint }[]>(
        Prisma.sql`
          SELECT "order_id", COUNT(*) as refund_count
          FROM refunds
          GROUP BY "order_id"
          HAVING COUNT(*) > 1
        `,
      ),

      this.prisma.$queryRaw<{ entry_type: string; total: number }[]>(
        Prisma.sql`
          SELECT "entry_type", SUM(amount) as total
          FROM ledger_entries
          WHERE "posted_at" > NOW() - INTERVAL '30 days'
          GROUP BY "entry_type"
        `,
      ),

      this.prisma.order.count({
        where: {
          status: 'paid',
          createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
      }),

      this.prisma.order.findMany({
        where: {
          marginAmount: { lt: 0 },
          status: { not: 'cancelled' },
        },
        take: 10,
        select: { id: true, marginAmount: true },
      }),
    ]);

    // Process orphan payments
    const orphanPayments = {
      count: orphanRows.length,
      orders: orphanRows.map((r) => ({ id: r.id, amount: Number(r.total_amount) })),
    };

    // Process ghost orders
    const ghostOrders = {
      count: ghostOrdersRaw.length,
      orderIds: ghostOrdersRaw.map((o) => o.id),
    };

    // Process duplicate refunds
    const duplicateRefunds = {
      count: duplicateRefundRows.length,
      orderIds: duplicateRefundRows.map((r) => r.order_id),
    };

    // Process ledger balance
    let debits = 0;
    let credits = 0;
    for (const row of ledgerRows) {
      const total = Number(row.total);
      if (row.entry_type === 'debit') debits = total;
      else if (row.entry_type === 'credit') credits = total;
    }
    const imbalance = Math.abs(credits - debits);
    const balanced = imbalance <= 0.01;

    const ledgerBalance = { debits, credits, imbalance, balanced };

    // Process settlement drift
    const settlementDrift = { count: settlementDriftCount };

    // Process margin inconsistency
    const marginInconsistency = {
      count: marginOrders.length,
      orders: marginOrders.map((o) => ({ id: o.id, margin: Number(o.marginAmount) })),
    };

    // Build critical issues and recommendations
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    if (orphanPayments.count > 0) {
      criticalIssues.push(
        `${orphanPayments.count} order(s) have Stripe payment IDs but no corresponding ledger entry (account 4000). Revenue may be unrecorded.`,
      );
      recommendations.push(
        'Run /reconcile for each orphan order to post missing ledger entries.',
      );
    }

    if (ghostOrders.count > 0) {
      criticalIssues.push(
        `${ghostOrders.count} order(s) have status "paid" but no Stripe payment ID. Possible data corruption or manual status override.`,
      );
      recommendations.push(
        'Investigate ghost orders manually and revert status or attach correct Stripe payment IDs.',
      );
    }

    if (duplicateRefunds.count > 0) {
      criticalIssues.push(
        `${duplicateRefunds.count} order(s) have been refunded more than once. Risk of over-refunding.`,
      );
      recommendations.push(
        'Audit duplicate refund orders immediately and verify against Stripe dashboard.',
      );
    }

    if (!balanced) {
      criticalIssues.push(
        `Ledger imbalance detected: €${imbalance.toFixed(2)} difference between debits (€${debits.toFixed(2)}) and credits (€${credits.toFixed(2)}) in the last 30 days.`,
      );
      recommendations.push(
        'Review recent ledger transactions for missing double-entry postings.',
      );
    }

    if (marginInconsistency.count > 0) {
      criticalIssues.push(
        `${marginInconsistency.count} active order(s) have negative margins — selling below cost.`,
      );
      recommendations.push(
        'Check pricing rules and supplier cost data for products in negative-margin orders.',
      );
    }

    if (settlementDrift.count > 0) {
      recommendations.push(
        `${settlementDrift.count} order(s) paid over 48h ago are still in "paid" status. Trigger fulfillment or update statuses.`,
      );
    }

    const overallStatus: 'clean' | 'warnings' | 'critical' =
      criticalIssues.length === 0
        ? 'clean'
        : criticalIssues.length <= 2 && !duplicateRefunds.count && balanced
        ? 'warnings'
        : 'critical';

    return {
      reportedAt: new Date(),
      overallStatus,
      orphanPayments,
      ghostOrders,
      duplicateRefunds,
      ledgerBalance,
      settlementDrift,
      marginInconsistency,
      criticalIssues,
      recommendations,
    };
  }

  async reconcile(orderId?: string): Promise<ReconcileResult> {
    if (orderId) {
      return this.reconcileSingleOrder(orderId);
    }

    // Bulk reconcile last 100 paid orders
    const orders = await this.prisma.order.findMany({
      where: { status: 'paid' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true },
    });

    const results = await Promise.all(orders.map((o) => this.reconcileSingleOrder(o.id)));

    const totalGaps = results.reduce((sum, r) => sum + r.gapsFound, 0);

    return {
      orderId: null,
      gapsFound: totalGaps,
      gapsFixed: 0,
      auditTrail: [`Bulk reconcile completed. Checked ${orders.length} orders. Total gaps: ${totalGaps}.`],
      orders: results.map((r) => ({
        orderId: r.orderId!,
        gapsFound: r.gapsFound,
        auditTrail: r.auditTrail,
      })),
    };
  }

  private async reconcileSingleOrder(orderId: string): Promise<ReconcileResult> {
    const auditTrail: string[] = [];
    const gaps: string[] = [];

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { orderId, gapsFound: 1, gapsFixed: 0, auditTrail: [`Order ${orderId} not found.`] };
    }

    const [refunds, ledgerEntries] = await Promise.all([
      this.prisma.refund.findMany({ where: { orderId } }),
      this.prisma.ledgerEntry.findMany({ where: { referenceId: orderId } }),
    ]);

    auditTrail.push(`Order ${orderId}: status=${order.status}, stripePaymentId=${order.stripePaymentId ?? 'none'}`);
    auditTrail.push(`Found ${refunds.length} refund(s) and ${ledgerEntries.length} ledger entry/entries.`);

    // Gap: paid order with no Stripe payment ID
    if (order.status === 'paid' && !order.stripePaymentId) {
      const gap = `Gap: order ${orderId} has status "paid" but no stripePaymentId.`;
      gaps.push(gap);
      auditTrail.push(gap);
      await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'missing_stripe_payment_id' });
    }

    // Gap: Stripe PI verification
    if (order.stripePaymentId) {
      try {
        const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentId);
        auditTrail.push(`Stripe PI ${pi.id}: status=${pi.status}`);

        if (pi.status === 'succeeded' && order.status !== 'paid' && order.status !== 'delivered' && order.status !== 'shipped') {
          const gap = `Gap: Stripe PI ${pi.id} succeeded but order status is "${order.status}".`;
          gaps.push(gap);
          auditTrail.push(gap);
          await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'stripe_succeeded_order_not_paid', stripeStatus: pi.status, orderStatus: order.status });
        }

        if (pi.status === 'canceled' && order.status === 'paid') {
          const gap = `Gap: Stripe PI ${pi.id} is canceled but order status is "paid".`;
          gaps.push(gap);
          auditTrail.push(gap);
          await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'stripe_canceled_order_paid' });
        }
      } catch (err) {
        const gap = `Gap: could not retrieve Stripe PI ${order.stripePaymentId}: ${(err as Error).message}`;
        gaps.push(gap);
        auditTrail.push(gap);
        await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'stripe_pi_retrieval_failed', error: (err as Error).message });
      }
    }

    // Gap: missing ledger entry for paid order
    const has4000Entry = ledgerEntries.some((le) => le.accountCode === '4000');
    if (order.status === 'paid' && !has4000Entry) {
      const gap = `Gap: order ${orderId} is paid but has no ledger entry with accountCode=4000.`;
      gaps.push(gap);
      auditTrail.push(gap);
      await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'missing_ledger_entry_4000' });
    }

    // Gap: refunds not reflected in ledger
    for (const refund of refunds) {
      const refundEntry = ledgerEntries.find(
        (le) => le.referenceType === 'refund' && le.referenceId === refund.id,
      );
      if (!refundEntry) {
        const gap = `Gap: refund ${refund.id} (€${Number(refund.amount).toFixed(2)}) has no corresponding ledger entry.`;
        gaps.push(gap);
        auditTrail.push(gap);
        await this.eventBus.emit('financial.truth.gap.detected', { orderId, gap: 'refund_missing_ledger_entry', refundId: refund.id });
      }
    }

    auditTrail.push(`Reconciliation complete. ${gaps.length} gap(s) found.`);

    return {
      orderId,
      gapsFound: gaps.length,
      gapsFixed: 0,
      auditTrail,
    };
  }
}
