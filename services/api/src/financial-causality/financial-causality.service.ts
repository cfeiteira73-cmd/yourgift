import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STRIPE_FEE_PCT = 0.015;
const STRIPE_FEE_FIXED = 0.25;

export interface LossDriver {
  driver: string;
  impact: number;
  description: string;
}

export interface WhyLossReportItem {
  productId: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  printCost: number;
  itemMargin: number;
}

export interface WhyLossReport {
  orderId: string;
  orderRef: string;
  status: string;
  isLoss: boolean;
  grossRevenue: number;
  cogsProductCost: number;
  cogsPrintCost: number;
  cogsTotal: number;
  stripeFee: number;
  totalRefunded: number;
  netRevenue: number;
  computedMargin: number;
  marginPct: number;
  storedMargin: number | null;
  lossDrivers: LossDriver[];
  recommendation: string;
  items: WhyLossReportItem[];
  analyzedAt: Date;
}

export interface MarginExplainerItem {
  productId: string;
  quantity: number;
  revenue: number;
  cogs: number;
  rawMargin: number;
  stripeFeeShare: number;
  refundShare: number;
  netMarginAfterFees: number;
  marginPct: number;
  contributionPct: number;
}

export interface MarginExplainerReport {
  orderId: string;
  orderRef: string;
  totalRevenue: number;
  totalCogs: number;
  totalStripeFee: number;
  totalRefunded: number;
  computedGrossMargin: number;
  computedNetMargin: number;
  grossMarginPct: number;
  netMarginPct: number;
  ledger: {
    credits: number;
    debits: number;
    balance: number;
    reconciled: boolean;
  };
  items: MarginExplainerItem[];
  narrative: string;
  explainedAt: Date;
}

@Injectable()
export class FinancialCausalityService {
  constructor(private readonly prisma: PrismaService) {}

  async getWhyLoss(orderId: string): Promise<WhyLossReport> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        refunds: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const grossRevenue = Number(order.totalAmount);
    const isPaid = order.status === 'paid';

    const stripeFee = isPaid
      ? grossRevenue * STRIPE_FEE_PCT + STRIPE_FEE_FIXED
      : 0;

    let cogsProductCost = 0;
    let cogsPrintCost = 0;
    for (const item of order.items) {
      cogsProductCost += Number(item.unitCost) * item.quantity;
      cogsPrintCost += Number(item.printCost) * item.quantity;
    }
    const cogsTotal = cogsProductCost + cogsPrintCost;

    const totalRefunded = order.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    const netRevenue = grossRevenue - totalRefunded;
    const netAfterFees = netRevenue - stripeFee;
    const computedMargin = netAfterFees - cogsTotal;
    const marginPct =
      grossRevenue > 0 ? (computedMargin / grossRevenue) * 100 : 0;

    const storedMargin =
      order.marginAmount !== null ? Number(order.marginAmount) : null;

    const isLoss = computedMargin < 0;

    const lossDrivers: LossDriver[] = [];
    if (isLoss) {
      if (totalRefunded > 0) {
        lossDrivers.push({
          driver: 'refund',
          impact: -totalRefunded,
          description: `Refund of €${totalRefunded.toFixed(2)}`,
        });
      }
      if (grossRevenue > 0 && stripeFee > grossRevenue * 0.03) {
        lossDrivers.push({
          driver: 'stripe_fee_disproportionate',
          impact: -stripeFee,
          description: `Stripe fee (${((stripeFee / grossRevenue) * 100).toFixed(1)}% of revenue)`,
        });
      }
      if (cogsTotal > netRevenue) {
        lossDrivers.push({
          driver: 'cogs_exceeds_revenue',
          impact: -(cogsTotal - netRevenue),
          description: `COGS €${cogsTotal.toFixed(2)} > net revenue €${netRevenue.toFixed(2)}`,
        });
      }
      if (
        cogsTotal === 0 &&
        order.marginAmount !== null &&
        Number(order.marginAmount) < 0
      ) {
        lossDrivers.push({
          driver: 'margin_recorded_negative',
          impact: Number(order.marginAmount),
          description: 'Margin was recorded negative at time of order',
        });
      }
    }

    let recommendation: string;
    if (isLoss && totalRefunded > cogsTotal) {
      recommendation =
        'Refund is the primary loss driver. Review refund policy.';
    } else if (isLoss && cogsTotal > grossRevenue * 0.85) {
      recommendation =
        'COGS too high relative to price. Review pricing for these products.';
    } else if (isLoss) {
      recommendation =
        'Margin squeezed below break-even. Review pricing strategy.';
    } else {
      recommendation = 'Order is profitable. No action required.';
    }

    const items: WhyLossReportItem[] = order.items.map((item) => {
      const unitCost = Number(item.unitCost);
      const unitPrice = Number(item.unitPrice);
      const printCost = Number(item.printCost);
      const itemMargin =
        (unitPrice - unitCost - printCost) * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        unitPrice,
        printCost,
        itemMargin,
      };
    });

    return {
      orderId: order.id,
      orderRef: order.ref,
      status: order.status,
      isLoss,
      grossRevenue,
      cogsProductCost,
      cogsPrintCost,
      cogsTotal,
      stripeFee,
      totalRefunded,
      netRevenue,
      computedMargin,
      marginPct,
      storedMargin,
      lossDrivers,
      recommendation,
      items,
      analyzedAt: new Date(),
    };
  }

  async getMarginExplainer(orderId: string): Promise<MarginExplainerReport> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        refunds: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { referenceId: orderId },
    });

    const totalRevenue = Number(order.totalAmount);
    const totalRefunded = order.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    const totalStripeFee =
      order.status === 'paid'
        ? totalRevenue * STRIPE_FEE_PCT + STRIPE_FEE_FIXED
        : 0;

    let totalCogs = 0;
    for (const item of order.items) {
      totalCogs +=
        (Number(item.unitCost) + Number(item.printCost)) * item.quantity;
    }

    const computedGrossMargin = totalRevenue - totalCogs;
    const computedNetMargin =
      computedGrossMargin - totalStripeFee - totalRefunded;
    const grossMarginPct =
      totalRevenue > 0 ? (computedGrossMargin / totalRevenue) * 100 : 0;
    const netMarginPct =
      totalRevenue > 0 ? (computedNetMargin / totalRevenue) * 100 : 0;

    const ledgerCredits = ledgerEntries
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const ledgerDebits = ledgerEntries
      .filter((e) => e.entryType === 'debit')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const ledgerBalance = ledgerCredits - ledgerDebits;
    const reconciled =
      Math.abs(ledgerBalance - computedNetMargin) < 0.01;

    const items: MarginExplainerItem[] = order.items.map((item) => {
      const revenue = Number(item.unitPrice) * item.quantity;
      const cogs =
        (Number(item.unitCost) + Number(item.printCost)) * item.quantity;
      const rawMargin = revenue - cogs;
      const marginPct = revenue > 0 ? (rawMargin / revenue) * 100 : 0;
      const contributionPct =
        totalRevenue > 0 ? (rawMargin / totalRevenue) * 100 : 0;

      const itemStripeFeeShare =
        totalRevenue > 0 ? (revenue / totalRevenue) * totalStripeFee : 0;
      const refundShare =
        totalRevenue > 0 ? (revenue / totalRevenue) * totalRefunded : 0;
      const netMarginAfterFees = rawMargin - itemStripeFeeShare;

      return {
        productId: item.productId,
        quantity: item.quantity,
        revenue,
        cogs,
        rawMargin,
        stripeFeeShare: itemStripeFeeShare,
        refundShare,
        netMarginAfterFees,
        marginPct,
        contributionPct,
      };
    });

    // Build narrative
    const bestItem =
      items.length > 0
        ? items.reduce((a, b) => (a.rawMargin >= b.rawMargin ? a : b))
        : null;
    const worstItem =
      items.length > 0
        ? items.reduce((a, b) => (a.rawMargin <= b.rawMargin ? a : b))
        : null;

    let verdict: string;
    if (computedNetMargin >= 0) {
      verdict = 'Overall order is profitable.';
    } else {
      verdict = 'Overall order is at a loss.';
    }

    let narrative =
      `Order generated €${totalRevenue.toFixed(2)} gross. ` +
      `After COGS (€${totalCogs.toFixed(2)}), Stripe fees (€${totalStripeFee.toFixed(2)}), ` +
      `and refunds (€${totalRefunded.toFixed(2)}), net margin is ` +
      `€${computedNetMargin.toFixed(2)} (${netMarginPct.toFixed(1)}%). `;

    if (bestItem) {
      narrative += `Best performer: product ${bestItem.productId} at €${bestItem.rawMargin.toFixed(2)} margin. `;
    }
    if (worstItem && worstItem.rawMargin < 0) {
      narrative += `Worst performer: product ${worstItem.productId} at €${worstItem.rawMargin.toFixed(2)} (loss). `;
    }
    narrative += verdict;

    return {
      orderId: order.id,
      orderRef: order.ref,
      totalRevenue,
      totalCogs,
      totalStripeFee,
      totalRefunded,
      computedGrossMargin,
      computedNetMargin,
      grossMarginPct,
      netMarginPct,
      ledger: {
        credits: ledgerCredits,
        debits: ledgerDebits,
        balance: ledgerBalance,
        reconciled,
      },
      items,
      narrative,
      explainedAt: new Date(),
    };
  }
}
