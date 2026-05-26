import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomerSupportView {
  client: {
    id: string;
    email: string;
    name: string;
    company: string | null;
    tier: string;
    tenantId: string;
    createdAt: Date;
  };
  financials: {
    totalSpend: number;
    totalRefunded: number;
    netRevenue: number;
    orderCount: number;
    refundCount: number;
    refundRate: number;
    lifetimeValue: number | null;
  };
  churnRisk: {
    churnRiskLevel: string | null;
    churnRiskScore: number | null;
    daysSinceLastOrder: number | null;
    predictedNextOrderAt: Date | null;
  } | null;
  orders: Array<{
    id: string;
    ref: string;
    status: string;
    totalAmount: number;
    marginAmount: number;
    stripePaymentId: string | null;
    createdAt: Date;
    itemCount: number;
    refunds: Array<{
      id: string;
      amount: number;
      currency: string;
      reason: string | null;
      status: string;
      createdAt: Date;
    }>;
  }>;
  refunds: Array<{
    id: string;
    orderId: string;
    stripeRefundId: string | null;
    amount: number;
    currency: string;
    reason: string | null;
    status: string;
    createdAt: Date;
  }>;
  recentEvents: Array<{
    id: string;
    orderId: string | null;
    entity: string;
    entityId: string;
    event: string;
    payload: unknown;
    createdAt: Date;
  }>;
}

export interface OrderSupportView {
  order: {
    id: string;
    ref: string;
    clientId: string;
    companyId: string | null;
    status: string;
    totalAmount: number;
    marginAmount: number;
    stripePaymentId: string | null;
    stripeSessionId: string | null;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    printCost: number;
  }>;
  refunds: Array<{
    id: string;
    stripeRefundId: string | null;
    amount: number;
    currency: string;
    reason: string | null;
    status: string;
    createdAt: Date;
  }>;
  ledgerEntries: Array<{
    id: string;
    accountCode: string;
    entryType: string;
    amount: number;
    referenceType: string | null;
    postedAt: Date;
  }>;
  stripe: {
    found: boolean;
    status: string | null;
    amount: number | null;
    currency: string | null;
    error: string | null;
  };
  analysis: {
    totalRefunded: number;
    ledgerRevenue: number;
    dbVsStripeAmountMatch: boolean | null;
    statusConsistent: boolean | null;
    issues: string[];
    recommendations: string[];
  };
  eventTimeline: Array<{
    id: string;
    event: string;
    entity: string;
    payload: unknown;
    createdAt: Date;
  }>;
}

export interface RefundInvestigationResult {
  orderId: string;
  orderStatus: string;
  originalAmount: number;
  alreadyRefunded: number;
  remainingRefundable: number;
  requestedAmount: number;
  canProceed: boolean;
  blockers: string[];
  recommendation: string;
  stripePaymentIntentId: string | null;
}

@Injectable()
export class SupportOperationsService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_KEY!, {
      apiVersion: '2023-10-16' as const,
    });
  }

  async getCustomerSupportView(clientId: string): Promise<CustomerSupportView> {
    const [client, orders, refunds, events, procurementCycle, latestSnapshot] =
      await Promise.all([
        this.prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
        this.prisma.order.findMany({
          where: { clientId },
          include: { items: true, refunds: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.refund.findMany({
          where: { order: { clientId } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.eventLog.findMany({
          where: {
            entity: 'order',
            payload: { path: ['clientId'], equals: clientId },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.clientProcurementCycle.findFirst({
          where: { clientId },
          orderBy: { lastOrderAt: 'desc' },
        }),
        this.prisma.clientFinancialSnapshot.findFirst({
          where: { clientId },
          orderBy: { computedAt: 'desc' },
        }),
      ]);

    const paidOrders = orders.filter((o) => o.status === 'paid');
    const totalSpend = paidOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalRefunded = refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    const netRevenue = totalSpend - totalRefunded;
    const orderCount = orders.length;
    const refundCount = refunds.length;
    const refundRate = orderCount > 0 ? refundCount / orderCount : 0;
    const lifetimeValue = latestSnapshot
      ? Number(latestSnapshot.ltvCumulative)
      : null;

    return {
      client: {
        id: client.id,
        email: client.email,
        name: client.name,
        company: client.company,
        tier: client.tier,
        tenantId: client.tenantId,
        createdAt: client.createdAt,
      },
      financials: {
        totalSpend,
        totalRefunded,
        netRevenue,
        orderCount,
        refundCount,
        refundRate,
        lifetimeValue,
      },
      churnRisk: procurementCycle
        ? {
            churnRiskLevel: procurementCycle.churnRiskLevel,
            churnRiskScore: procurementCycle.churnRiskScore
              ? Number(procurementCycle.churnRiskScore)
              : null,
            daysSinceLastOrder: procurementCycle.daysSinceLastOrder,
            predictedNextOrderAt: procurementCycle.predictedNextOrderAt,
          }
        : null,
      orders: orders.map((o) => ({
        id: o.id,
        ref: o.ref,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        marginAmount: Number(o.marginAmount),
        stripePaymentId: o.stripePaymentId,
        createdAt: o.createdAt,
        itemCount: o.items.length,
        refunds: o.refunds.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          currency: r.currency,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        })),
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        stripeRefundId: r.stripeRefundId,
        amount: Number(r.amount),
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      })),
      recentEvents: events.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        entity: e.entity,
        entityId: e.entityId,
        event: e.event,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    };
  }

  async getOrderSupportView(orderId: string): Promise<OrderSupportView> {
    const [order, ledgerEntries] = await Promise.all([
      this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          refunds: true,
          eventLogs: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.ledgerEntry.findMany({ where: { referenceId: orderId } }),
    ]);

    // Stripe check
    let piStatus: string | null = null;
    let piAmount: number | null = null;
    let piCurrency: string | null = null;
    let piError: string | null = null;
    let piFound = false;

    if (order.stripePaymentId) {
      try {
        const pi = await this.stripe.paymentIntents.retrieve(
          order.stripePaymentId,
        );
        piStatus = pi.status;
        piAmount = pi.amount / 100;
        piCurrency = pi.currency;
        piFound = true;
      } catch (err: unknown) {
        piError = err instanceof Error ? err.message : String(err);
      }
    }

    const totalRefunded = order.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    const ledgerRevenue = ledgerEntries
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const orderTotal = Number(order.totalAmount);
    const dbVsStripeAmountMatch =
      piFound && piAmount !== null
        ? Math.abs(piAmount - orderTotal) < 0.01
        : null;

    const statusConsistent =
      piFound && piStatus !== null
        ? (order.status === 'paid' && piStatus === 'succeeded') ||
          (order.status === 'pending' &&
            ['requires_payment_method', 'requires_confirmation', 'processing'].includes(piStatus)) ||
          (order.status === 'cancelled' && piStatus === 'canceled')
        : null;

    const issues: string[] = [];
    if (!order.stripePaymentId && order.status === 'paid') {
      issues.push('Payment ID missing for paid order');
    }
    if (dbVsStripeAmountMatch === false) {
      issues.push(
        `Amount mismatch: DB=${orderTotal} EUR vs Stripe=${piAmount} EUR`,
      );
    }
    if (ledgerRevenue === 0 && order.status === 'paid') {
      issues.push('No ledger entries found for paid order');
    }
    if (statusConsistent === false) {
      issues.push(
        `Status inconsistency: DB status="${order.status}" vs Stripe PI status="${piStatus}"`,
      );
    }

    const recommendations: string[] = [];
    if (issues.length === 0) {
      recommendations.push('Order appears consistent across all systems');
    } else {
      if (!order.stripePaymentId && order.status === 'paid') {
        recommendations.push(
          'Manually link the Stripe payment intent to this order or investigate payment processor logs',
        );
      }
      if (dbVsStripeAmountMatch === false) {
        recommendations.push(
          'Review order edit history; a price adjustment may have occurred after payment capture',
        );
      }
      if (ledgerRevenue === 0 && order.status === 'paid') {
        recommendations.push(
          'Trigger ledger reconciliation job for this order to create missing entries',
        );
      }
      if (statusConsistent === false) {
        recommendations.push(
          'Sync order status from Stripe webhook or manually update DB to match Stripe',
        );
      }
    }

    return {
      order: {
        id: order.id,
        ref: order.ref,
        clientId: order.clientId,
        companyId: order.companyId,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        marginAmount: Number(order.marginAmount),
        stripePaymentId: order.stripePaymentId,
        stripeSessionId: order.stripeSessionId,
        tenantId: order.tenantId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        unitCost: Number(i.unitCost),
        unitPrice: Number(i.unitPrice),
        printCost: Number(i.printCost),
      })),
      refunds: order.refunds.map((r) => ({
        id: r.id,
        stripeRefundId: r.stripeRefundId,
        amount: Number(r.amount),
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ledgerEntries: ledgerEntries.map((e) => ({
        id: e.id,
        accountCode: e.accountCode,
        entryType: e.entryType,
        amount: Number(e.amount),
        referenceType: e.referenceType,
        postedAt: e.postedAt,
      })),
      stripe: {
        found: piFound,
        status: piStatus,
        amount: piAmount,
        currency: piCurrency,
        error: piError,
      },
      analysis: {
        totalRefunded,
        ledgerRevenue,
        dbVsStripeAmountMatch,
        statusConsistent,
        issues,
        recommendations,
      },
      eventTimeline: order.eventLogs.map((e) => ({
        id: e.id,
        event: e.event,
        entity: e.entity,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    };
  }

  async investigateRefund(
    orderId: string,
    requestedAmountEur: number,
  ): Promise<RefundInvestigationResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refunds: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const originalAmount = Number(order.totalAmount);
    const alreadyRefunded = order.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    const remainingRefundable = Math.max(0, originalAmount - alreadyRefunded);

    const blockers: string[] = [];

    if (!['paid', 'completed'].includes(order.status)) {
      blockers.push(
        `Order status "${order.status}" does not allow refunds — only paid/completed orders are eligible`,
      );
    }

    if (requestedAmountEur > remainingRefundable) {
      blockers.push(
        `Requested amount €${requestedAmountEur.toFixed(2)} exceeds remaining refundable amount €${remainingRefundable.toFixed(2)}`,
      );
    }

    if (requestedAmountEur <= 0) {
      blockers.push('Requested refund amount must be greater than zero');
    }

    if (!order.stripePaymentId) {
      blockers.push(
        'No Stripe payment intent linked to this order — cannot process refund via Stripe',
      );
    }

    const canProceed = blockers.length === 0;

    let recommendation: string;
    if (canProceed) {
      recommendation =
        `Refund of €${requestedAmountEur.toFixed(2)} is eligible. ` +
        `Use Stripe PI ${order.stripePaymentId} to issue the refund. ` +
        `After processing, create a Refund record and post a ledger debit entry.`;
    } else {
      recommendation =
        `Refund cannot proceed automatically. Blockers: ${blockers.join('; ')}. ` +
        `Escalate to finance team if override is required.`;
    }

    return {
      orderId,
      orderStatus: order.status,
      originalAmount,
      alreadyRefunded,
      remainingRefundable,
      requestedAmount: requestedAmountEur,
      canProceed,
      blockers,
      recommendation,
      stripePaymentIntentId: order.stripePaymentId,
    };
  }
}
