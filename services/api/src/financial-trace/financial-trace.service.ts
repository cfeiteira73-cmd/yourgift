// FILE: services/api/src/financial-trace/financial-trace.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Exported interfaces ─────────────────────────────────────────────────────

export interface CausalStep {
  step: number;
  event: string;
  timestamp: Date | null;
  amountEur: number | null;
  notes: string;
}

export type FinancialVerdict = 'profitable' | 'break_even' | 'loss';

export interface FinancialTrace {
  orderId: string;
  tenantId: string;
  computedAt: Date;
  // Revenue
  grossRevenue: number;
  vatAmount: number;
  netRevenue: number;
  // Costs
  supplierCost: number;
  printCost: number;
  stripeFeeEur: number;
  infraCostEur: number;
  // Margin
  grossMargin: number;
  netMargin: number;
  netMarginPct: number;
  // Refunds
  refundAmount: number;
  disputeAmount: number;
  // Causal chain
  causalChain: CausalStep[];
  // Verdict
  verdict: FinancialVerdict;
  lossReasons: string[];
}

export interface DailyMargin {
  date: string;
  margin: number;
  orders: number;
}

export interface TenantProfitGraph {
  tenantId: string;
  orders: number;
  totalRevenue: number;
  totalNetMargin: number;
  avgMarginPct: number;
  profitableOrders: number;
  lossOrders: number;
  topLossReasons: string[];
  dailyMargins: DailyMargin[];
}

// ── Internal raw query result types ────────────────────────────────────────

interface InfraCostRow {
  totalcosteur: unknown;
}

// ── Constants ───────────────────────────────────────────────────────────────

const VAT_RATE = 0.23; // Portugal IVA 23%
const STRIPE_PCT = 0.015; // 1.5%
const STRIPE_FIXED = 0.25; // €0.25 per transaction

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class FinancialTraceService {
  private readonly logger = new Logger(FinancialTraceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Per-order causality ─────────────────────────────────────────────────

  async explainOrder(orderId: string): Promise<FinancialTrace> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        refunds: true,
        eventLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const grossRevenue = parseFloat(((order.totalAmount ?? 0) as number).toFixed(2));

    // VAT calculation — Portuguese IVA included in price
    const netRevenue = parseFloat((grossRevenue / (1 + VAT_RATE)).toFixed(2));
    const vatAmount = parseFloat((grossRevenue - netRevenue).toFixed(2));

    // Supplier & print costs from order items
    const supplierCost = parseFloat(
      order.items
        .reduce((sum, item) => sum + item.unitCost * item.quantity, 0)
        .toFixed(2),
    );
    const printCost = parseFloat(
      order.items.reduce((sum, item) => sum + item.printCost * item.quantity, 0).toFixed(2),
    );

    // Stripe fee
    const stripeFeeEur = parseFloat(
      (STRIPE_PCT * grossRevenue + STRIPE_FIXED).toFixed(2),
    );

    // Infra cost from event_log: event = 'cost.request_attributed' AND payload->>'entityId' = orderId
    let infraCostEur = 0;
    try {
      const rows = await this.prisma.$queryRaw<InfraCostRow[]>`
        SELECT COALESCE(SUM((payload->>'totalCostEur')::numeric), 0) AS totalCostEur
        FROM event_logs
        WHERE event = 'cost.request_attributed'
          AND payload->>'entityId' = ${orderId}
      `;
      const raw = rows[0]?.totalcosteur;
      infraCostEur = parseFloat(String(raw ?? '0'));
    } catch (err) {
      this.logger.warn(`Failed to fetch infra cost for order ${orderId}: ${(err as Error).message}`);
    }

    // Refunds
    const refundAmount = parseFloat(
      order.refunds
        .reduce((sum, r) => sum + Number(r.amount), 0)
        .toFixed(2),
    );
    const disputeAmount = 0; // extend with dispute table later

    // Margins
    const grossMargin = parseFloat((netRevenue - supplierCost - printCost).toFixed(2));
    const netMargin = parseFloat((grossMargin - stripeFeeEur - infraCostEur).toFixed(2));
    const netMarginPct =
      grossRevenue > 0
        ? parseFloat(((netMargin / grossRevenue) * 100).toFixed(2))
        : 0;

    // Causal chain construction
    const causalChain = this.buildCausalChain(order, grossRevenue, supplierCost, printCost, stripeFeeEur, infraCostEur, refundAmount);

    // Verdict & loss reasons
    const { verdict, lossReasons } = this.computeVerdict(
      netMargin,
      netMarginPct,
      supplierCost,
      netRevenue,
      refundAmount,
      grossRevenue,
      stripeFeeEur,
    );

    return {
      orderId,
      tenantId: order.tenantId,
      computedAt: new Date(),
      grossRevenue,
      vatAmount,
      netRevenue,
      supplierCost,
      printCost,
      stripeFeeEur,
      infraCostEur,
      grossMargin,
      netMargin,
      netMarginPct,
      refundAmount,
      disputeAmount,
      causalChain,
      verdict,
      lossReasons,
    };
  }

  // ── Causal chain builder ────────────────────────────────────────────────

  private buildCausalChain(
    order: {
      createdAt: Date;
      updatedAt: Date;
      status: string;
      approvedAt: Date | null;
      shippedAt: Date | null;
      deliveredAt: Date | null;
      eventLogs: Array<{ event: string; createdAt: Date; payload: unknown }>;
    },
    grossRevenue: number,
    supplierCost: number,
    printCost: number,
    stripeFeeEur: number,
    infraCostEur: number,
    refundAmount: number,
  ): CausalStep[] {
    const steps: CausalStep[] = [];
    let stepNum = 1;

    // Step 1: Order created
    steps.push({
      step: stepNum++,
      event: 'checkout.created',
      timestamp: order.createdAt,
      amountEur: grossRevenue,
      notes: `Order placed, gross revenue €${grossRevenue.toFixed(2)}`,
    });

    // Step 2: Payment confirmed (look in event logs)
    const paymentEvent = order.eventLogs.find(
      (e) =>
        e.event === 'order.paid' ||
        e.event === 'payment.confirmed' ||
        e.event === 'checkout.session.completed',
    );
    if (paymentEvent || order.status === 'paid') {
      steps.push({
        step: stepNum++,
        event: 'payment.confirmed',
        timestamp: paymentEvent?.createdAt ?? null,
        amountEur: grossRevenue,
        notes: `Payment received via Stripe. Stripe fee: €${stripeFeeEur.toFixed(2)}`,
      });
    }

    // Step 3: Supplier cost allocated
    if (supplierCost > 0 || printCost > 0) {
      steps.push({
        step: stepNum++,
        event: 'cost.supplier_allocated',
        timestamp: order.createdAt,
        amountEur: -(supplierCost + printCost),
        notes: `Supplier cost €${supplierCost.toFixed(2)} + print cost €${printCost.toFixed(2)}`,
      });
    }

    // Step 4: Infra cost if any
    if (infraCostEur > 0) {
      steps.push({
        step: stepNum++,
        event: 'cost.infra_attributed',
        timestamp: order.createdAt,
        amountEur: -infraCostEur,
        notes: `Infrastructure cost attributed: €${infraCostEur.toFixed(4)}`,
      });
    }

    // Step 5: Approved
    if (order.approvedAt) {
      steps.push({
        step: stepNum++,
        event: 'order.approved',
        timestamp: order.approvedAt,
        amountEur: null,
        notes: 'Order approved for production',
      });
    }

    // Step 6: Invoice generated
    const invoiceEvent = order.eventLogs.find((e) => e.event === 'invoice.generated');
    if (invoiceEvent) {
      steps.push({
        step: stepNum++,
        event: 'invoice.generated',
        timestamp: invoiceEvent.createdAt,
        amountEur: null,
        notes: 'Invoice issued to client',
      });
    }

    // Step 7: Shipped
    if (order.shippedAt) {
      steps.push({
        step: stepNum++,
        event: 'order.shipped',
        timestamp: order.shippedAt,
        amountEur: null,
        notes: 'Order dispatched to client',
      });
    }

    // Step 8: Delivered
    if (order.deliveredAt) {
      steps.push({
        step: stepNum++,
        event: 'order.delivered',
        timestamp: order.deliveredAt,
        amountEur: null,
        notes: 'Order delivered',
      });
    }

    // Step 9: Refund (if any)
    if (refundAmount > 0) {
      steps.push({
        step: stepNum++,
        event: 'refund.processed',
        timestamp: null,
        amountEur: -refundAmount,
        notes: `Refund of €${refundAmount.toFixed(2)} processed`,
      });
    }

    return steps;
  }

  // ── Verdict logic ───────────────────────────────────────────────────────

  private computeVerdict(
    netMargin: number,
    netMarginPct: number,
    supplierCost: number,
    netRevenue: number,
    refundAmount: number,
    grossRevenue: number,
    stripeFeeEur: number,
  ): { verdict: FinancialVerdict; lossReasons: string[] } {
    const lossReasons: string[] = [];

    if (supplierCost > netRevenue * 0.7) {
      lossReasons.push('high_supplier_cost');
    }
    if (refundAmount > 0) {
      lossReasons.push('refunded');
    }
    if (stripeFeeEur > netRevenue * 0.05) {
      lossReasons.push('stripe_fee_ate_margin');
    }
    if (netMargin < 0) {
      lossReasons.push('net_loss');
    }

    let verdict: FinancialVerdict;
    if (netMargin > 0 && netMarginPct > 5) {
      verdict = 'profitable';
    } else if (netMargin >= 0) {
      verdict = 'break_even';
    } else {
      verdict = 'loss';
    }

    return { verdict, lossReasons };
  }

  // ── Tenant-level profitability graph ────────────────────────────────────

  async tenantProfitabilityGraph(tenantId: string): Promise<TenantProfitGraph> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'paid',
        updatedAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const traces: FinancialTrace[] = [];

    for (const { id } of orders) {
      try {
        const trace = await this.explainOrder(id);
        traces.push(trace);
      } catch (err) {
        this.logger.warn(
          `tenantProfitabilityGraph: failed to trace order ${id}: ${(err as Error).message}`,
        );
      }
    }

    const totalRevenue = parseFloat(traces.reduce((s, t) => s + t.grossRevenue, 0).toFixed(2));
    const totalNetMargin = parseFloat(traces.reduce((s, t) => s + t.netMargin, 0).toFixed(2));
    const profitableOrders = traces.filter((t) => t.verdict === 'profitable').length;
    const lossOrders = traces.filter((t) => t.verdict === 'loss').length;
    const avgMarginPct =
      traces.length > 0
        ? parseFloat(
            (traces.reduce((s, t) => s + t.netMarginPct, 0) / traces.length).toFixed(2),
          )
        : 0;

    // Aggregate loss reasons
    const reasonFreq = new Map<string, number>();
    for (const t of traces) {
      for (const r of t.lossReasons) {
        reasonFreq.set(r, (reasonFreq.get(r) ?? 0) + 1);
      }
    }
    const topLossReasons = [...reasonFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    // Daily margins — group traces by date using createdAt proxy
    const ordersWithDate = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'paid',
        updatedAt: { gte: since },
      },
      select: { id: true, createdAt: true },
    });
    const dateMap = new Map<string, string>(
      ordersWithDate.map((o) => [o.id, o.createdAt.toISOString().slice(0, 10)]),
    );

    const dailyAgg = new Map<string, { margin: number; orders: number }>();
    for (const trace of traces) {
      const date = dateMap.get(trace.orderId) ?? 'unknown';
      const existing = dailyAgg.get(date) ?? { margin: 0, orders: 0 };
      dailyAgg.set(date, {
        margin: parseFloat((existing.margin + trace.netMargin).toFixed(2)),
        orders: existing.orders + 1,
      });
    }

    const dailyMargins: DailyMargin[] = [...dailyAgg.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { margin, orders }]) => ({ date, margin, orders }));

    return {
      tenantId,
      orders: traces.length,
      totalRevenue,
      totalNetMargin,
      avgMarginPct,
      profitableOrders,
      lossOrders,
      topLossReasons,
      dailyMargins,
    };
  }
}
