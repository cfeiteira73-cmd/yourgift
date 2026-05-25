// FILE: services/api/src/reconciliation/stripe-reconciliation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Exported interfaces ─────────────────────────────────────────────────────

export interface StripeReconciliationReport {
  totalStripePayments: number;
  totalStripeAmountEur: number;
  matchedOrders: number;
  unmappedStripePayments: string[];
  orderNotMarkedPaid: Array<{
    orderId: string;
    stripePaymentIntentId: string;
    amountEur: number;
  }>;
  ghostPayments: Array<{
    orderId: string;
    markedPaidAt: Date;
  }>;
  paymentIdMismatch: Array<{
    orderId: string;
    dbPaymentId: string;
    stripePaymentId: string;
  }>;
  driftEur: number;
  isClean: boolean;
  checkedAt: Date;
}

export interface RepairEvent {
  type: 'order.payment_confirmed_repair';
  orderId: string;
  stripePaymentIntentId: string;
  amountEur: number;
  reason: 'stripe_cross_check';
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class StripeReconciliationService {
  private readonly logger = new Logger(StripeReconciliationService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 30_000,
      maxNetworkRetries: 3,
    });
  }

  // ── Cross-check ─────────────────────────────────────────────────────────

  async crossCheckWithStripe(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<StripeReconciliationReport> {
    const checkedAt = new Date();

    // 1. Fetch all succeeded PaymentIntents in range from Stripe
    const allPIs = await this.stripe.paymentIntents.list(
      {
        limit: 100,
        created: {
          gte: Math.floor(fromDate.getTime() / 1000),
          lte: Math.floor(toDate.getTime() / 1000),
        },
      },
      { timeout: 30_000 },
    ).autoPagingToArray({ limit: 500 });

    const succeededPIs = allPIs.filter((pi) => pi.status === 'succeeded');

    let totalStripeAmountEur = 0;
    let matchedOrders = 0;

    const unmappedStripePayments: string[] = [];
    const orderNotMarkedPaid: StripeReconciliationReport['orderNotMarkedPaid'] = [];
    const paymentIdMismatch: StripeReconciliationReport['paymentIdMismatch'] = [];

    // Track which DB order IDs are matched by Stripe PIs
    const stripeMatchedOrderIds = new Set<string>();

    for (const pi of succeededPIs) {
      const amountEur = pi.amount / 100; // Stripe amounts are in cents
      totalStripeAmountEur += amountEur;

      // Try to find orderId: first from PI metadata, then from checkout session
      let orderId: string | null = null;

      if (pi.metadata?.orderId) {
        orderId = pi.metadata.orderId;
      } else {
        // Look up the checkout session linked to this PI
        try {
          const sessions = await this.stripe.checkout.sessions.list(
            { payment_intent: pi.id, limit: 1 },
            { timeout: 15_000 },
          );
          const session = sessions.data[0];
          if (session?.metadata?.orderId) {
            orderId = session.metadata.orderId;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to fetch session for PI ${pi.id}: ${(err as Error).message}`,
          );
        }
      }

      if (!orderId) {
        unmappedStripePayments.push(pi.id);
        continue;
      }

      stripeMatchedOrderIds.add(orderId);

      // Check DB order state
      const dbOrder = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          tenantId,
        },
        select: {
          id: true,
          status: true,
          stripePaymentId: true,
          totalAmount: true,
          updatedAt: true,
        },
      });

      if (!dbOrder) {
        // Order not found in our DB at all — treat as unmapped
        unmappedStripePayments.push(pi.id);
        continue;
      }

      if (dbOrder.status !== 'paid') {
        // Money received from Stripe but order not marked paid — CRITICAL
        orderNotMarkedPaid.push({
          orderId: dbOrder.id,
          stripePaymentIntentId: pi.id,
          amountEur,
        });
        continue;
      }

      // Check for payment ID mismatch
      if (dbOrder.stripePaymentId && dbOrder.stripePaymentId !== pi.id) {
        paymentIdMismatch.push({
          orderId: dbOrder.id,
          dbPaymentId: dbOrder.stripePaymentId,
          stripePaymentId: pi.id,
        });
        // Still count as matched (the order IS paid, just with a different PI recorded)
      }

      matchedOrders++;
    }

    // 2. Ghost payment detection: paid orders in DB with NO matching Stripe PI
    const dbPaidOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'paid',
        updatedAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        stripePaymentId: true,
        updatedAt: true,
        totalAmount: true,
      },
    });

    const stripePI_IDs = new Set(succeededPIs.map((pi) => pi.id));

    const ghostPayments: StripeReconciliationReport['ghostPayments'] = [];

    for (const order of dbPaidOrders) {
      // If there's no stripePaymentId recorded OR the recorded ID doesn't appear in Stripe results
      if (!order.stripePaymentId || !stripePI_IDs.has(order.stripePaymentId)) {
        // Only flag if we didn't already match it via metadata
        if (!stripeMatchedOrderIds.has(order.id)) {
          ghostPayments.push({
            orderId: order.id,
            markedPaidAt: order.updatedAt,
          });
        }
      }
    }

    // 3. Compute drift
    const dbPaidTotal = dbPaidOrders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const driftEur = parseFloat((totalStripeAmountEur - dbPaidTotal).toFixed(2));

    const isClean =
      unmappedStripePayments.length === 0 &&
      orderNotMarkedPaid.length === 0 &&
      ghostPayments.length === 0 &&
      paymentIdMismatch.length === 0 &&
      Math.abs(driftEur) < 0.02;

    const report: StripeReconciliationReport = {
      totalStripePayments: succeededPIs.length,
      totalStripeAmountEur: parseFloat(totalStripeAmountEur.toFixed(2)),
      matchedOrders,
      unmappedStripePayments,
      orderNotMarkedPaid,
      ghostPayments,
      paymentIdMismatch,
      driftEur,
      isClean,
      checkedAt,
    };

    this.logger.log(
      `Stripe cross-check complete — tenant=${tenantId} ` +
        `PIs=${succeededPIs.length} matched=${matchedOrders} ` +
        `unmapped=${unmappedStripePayments.length} ghost=${ghostPayments.length} ` +
        `drift=${driftEur}€ clean=${isClean}`,
    );

    return report;
  }

  // ── Repair event generation ─────────────────────────────────────────────

  generateRepairEvents(report: StripeReconciliationReport): RepairEvent[] {
    // Read-only: generate events for caller to replay. Never mutate DB here.
    return report.orderNotMarkedPaid.map((item) => ({
      type: 'order.payment_confirmed_repair' as const,
      orderId: item.orderId,
      stripePaymentIntentId: item.stripePaymentIntentId,
      amountEur: item.amountEur,
      reason: 'stripe_cross_check' as const,
    }));
  }

  // ── Scheduled reconciliation ────────────────────────────────────────────

  async scheduleStripeReconciliation(): Promise<void> {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

    // Discover all tenantIds from orders table
    const tenants = await this.prisma.order.groupBy({
      by: ['tenantId'],
      _count: { id: true },
    });

    const allReports: StripeReconciliationReport[] = [];

    for (const { tenantId } of tenants) {
      try {
        const report = await this.crossCheckWithStripe(tenantId, fromDate, toDate);
        allReports.push(report);

        if (!report.isClean) {
          const repairEvents = this.generateRepairEvents(report);
          this.logger.warn(
            `Stripe reconciliation found issues for tenant ${tenantId}. ` +
              `Repair events generated: ${repairEvents.length}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `scheduleStripeReconciliation failed for tenant ${tenantId}`,
          (err as Error).stack,
        );
      }
    }

    this.eventBus.emit('reconciliation.stripe.completed', {
      reports: allReports,
      triggeredAt: new Date().toISOString(),
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    });
  }
}
