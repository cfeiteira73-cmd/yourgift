import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// Chart of Accounts constants
const ACCOUNTS = {
  AR: '1100',            // Accounts Receivable
  CASH: '1200',          // Cash / Platform Clearing
  AP: '2100',            // Accounts Payable
  REVENUE: '4000',       // Revenue
  COGS: '5000',          // Cost of Goods Sold
  PLATFORM_COST: '5100', // Platform Operating Cost
  FULFILLMENT: '5200',   // Fulfillment Cost
  SUSPENSE: '9000',      // Suspense
} as const;

@Injectable()
export class LedgerService implements OnModuleInit {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // When an order is paid: Debit AR, Credit Revenue + COGS
    this.events.on('order.paid', async ({ orderId }: { orderId: string }) => {
      try {
        await this.recordOrderPayment(orderId);
      } catch (err) {
        this.logger.error(`Ledger: failed to record payment for order ${orderId}: ${err}`);
      }
    });

    // When an order is delivered: settle AP (payable to supplier)
    this.events.on('order.delivered', async ({ orderId }: { orderId: string }) => {
      try {
        await this.recordSupplierPayable(orderId);
      } catch (err) {
        this.logger.error(`Ledger: failed to record supplier payable for order ${orderId}: ${err}`);
      }
    });

    // When an order is cancelled: reverse the revenue entries
    this.events.on('order.cancelled', async ({ orderId }: { orderId: string }) => {
      try {
        await this.recordReversal(orderId);
      } catch (err) {
        this.logger.error(`Ledger: failed to record reversal for order ${orderId}: ${err}`);
      }
    });
  }

  /**
   * Core double-entry posting: creates a balanced transaction with debit+credit legs.
   * debits and credits MUST balance (sum equal).
   */
  async postTransaction(params: {
    description: string;
    referenceType?: string;
    referenceId?: string;
    currency?: string;
    tenantId?: string;
    entries: Array<{
      accountCode: string;
      entryType: 'debit' | 'credit';
      amount: number;
      description: string;
    }>;
  }): Promise<string> {
    const currency = params.currency ?? 'EUR';
    const tenantId = params.tenantId ?? 'default';

    // Validate balance
    const totalDebits = params.entries
      .filter(e => e.entryType === 'debit')
      .reduce((s, e) => s + e.amount, 0);
    const totalCredits = params.entries
      .filter(e => e.entryType === 'credit')
      .reduce((s, e) => s + e.amount, 0);
    const diff = Math.abs(totalDebits - totalCredits);
    if (diff > 0.01) {
      throw new Error(
        `Ledger imbalance: debits=${totalDebits.toFixed(2)} credits=${totalCredits.toFixed(2)} diff=${diff.toFixed(4)}`,
      );
    }

    const tx = await this.prisma.ledgerTransaction.create({
      data: {
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        totalAmount: totalDebits,
        currency,
        tenantId,
        entries: {
          create: params.entries.map(e => ({
            accountCode: e.accountCode,
            entryType: e.entryType,
            amount: e.amount,
            currency,
            description: e.description,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
            tenantId,
          })),
        },
      },
    });

    this.logger.debug(
      `Ledger TX posted: ${tx.id} — ${params.description} (${totalDebits.toFixed(2)} ${currency})`,
    );
    return tx.id;
  }

  /** Record order payment: Dr AR / Cr Revenue + Dr COGS / Cr AP */
  async recordOrderPayment(orderId: string): Promise<void> {
    // Check idempotency — don't double-post
    const existing = await this.prisma.ledgerTransaction.findFirst({
      where: { referenceType: 'order_payment', referenceId: orderId },
    });
    if (existing) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    const revenue = order.totalAmount ?? 0;
    const cogs = order.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
    const margin = revenue - cogs;

    if (revenue <= 0) return;

    // Transaction 1: Revenue recognition
    // Dr Accounts Receivable (client owes us revenue)
    // Cr Revenue (we earned it)
    await this.postTransaction({
      description: `Revenue: Order ${order.ref}`,
      referenceType: 'order_payment',
      referenceId: orderId,
      currency: order.currency,
      entries: [
        { accountCode: ACCOUNTS.AR, entryType: 'debit', amount: revenue, description: `AR — Order ${order.ref}` },
        { accountCode: ACCOUNTS.REVENUE, entryType: 'credit', amount: revenue, description: `Revenue — Order ${order.ref}` },
      ],
    });

    // Transaction 2: COGS recognition (if we know the cost)
    if (cogs > 0) {
      await this.postTransaction({
        description: `COGS: Order ${order.ref}`,
        referenceType: 'order_cogs',
        referenceId: orderId,
        currency: order.currency,
        entries: [
          { accountCode: ACCOUNTS.COGS, entryType: 'debit', amount: cogs, description: `COGS — Order ${order.ref}` },
          { accountCode: ACCOUNTS.AP, entryType: 'credit', amount: cogs, description: `AP Supplier — Order ${order.ref}` },
        ],
      });
    }

    this.logger.log(
      `Ledger: Order ${order.ref} — revenue €${revenue.toFixed(2)}, COGS €${cogs.toFixed(2)}, margin €${margin.toFixed(2)}`,
    );
  }

  /** Record supplier payable settlement on delivery */
  async recordSupplierPayable(orderId: string): Promise<void> {
    const existing = await this.prisma.ledgerTransaction.findFirst({
      where: { referenceType: 'supplier_settlement', referenceId: orderId },
    });
    if (existing) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    // Cash settles AR (we received payment)
    const revenue = order.totalAmount ?? 0;
    if (revenue <= 0) return;

    await this.postTransaction({
      description: `Cash Settlement: Order ${order.ref}`,
      referenceType: 'supplier_settlement',
      referenceId: orderId,
      currency: order.currency,
      entries: [
        { accountCode: ACCOUNTS.CASH, entryType: 'debit', amount: revenue, description: `Cash received — Order ${order.ref}` },
        { accountCode: ACCOUNTS.AR, entryType: 'credit', amount: revenue, description: `AR cleared — Order ${order.ref}` },
      ],
    });
  }

  /** Record a reversal for cancelled order */
  async recordReversal(orderId: string): Promise<void> {
    const existing = await this.prisma.ledgerTransaction.findFirst({
      where: { referenceType: 'order_reversal', referenceId: orderId },
    });
    if (existing) return;

    const paymentTx = await this.prisma.ledgerTransaction.findFirst({
      where: { referenceType: 'order_payment', referenceId: orderId },
    });
    if (!paymentTx) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const revenue = order.totalAmount ?? 0;
    if (revenue <= 0) return;

    // Reversal: Cr AR / Dr Revenue (undo the sale)
    await this.postTransaction({
      description: `Reversal: Order ${order.ref} cancelled`,
      referenceType: 'order_reversal',
      referenceId: orderId,
      currency: order.currency,
      entries: [
        { accountCode: ACCOUNTS.REVENUE, entryType: 'debit', amount: revenue, description: `Revenue reversed — Order ${order.ref}` },
        { accountCode: ACCOUNTS.AR, entryType: 'credit', amount: revenue, description: `AR reversed — Order ${order.ref}` },
      ],
    });
  }

  /** Get account balance (sum of normal-balance entries) */
  async getAccountBalance(
    accountCode: string,
  ): Promise<{ balance: number; debits: number; credits: number }> {
    const entries = await this.prisma.ledgerEntry.findMany({ where: { accountCode } });
    const debits = entries
      .filter(e => e.entryType === 'debit')
      .reduce((s, e) => s + e.amount, 0);
    const credits = entries
      .filter(e => e.entryType === 'credit')
      .reduce((s, e) => s + e.amount, 0);
    const account = await this.prisma.ledgerAccount.findUnique({ where: { code: accountCode } });
    const balance = account?.normalBalance === 'debit' ? debits - credits : credits - debits;
    return { balance, debits, credits };
  }

  /** Get all account balances (trial balance) */
  async getTrialBalance() {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const balances = await Promise.all(
      accounts.map(async acc => {
        const { balance, debits, credits } = await this.getAccountBalance(acc.code);
        return {
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          normalBalance: acc.normalBalance,
          balance,
          debits,
          credits,
        };
      }),
    );

    const totalDebits = balances.reduce((s, b) => s + b.debits, 0);
    const totalCredits = balances.reduce((s, b) => s + b.credits, 0);

    return {
      accounts: balances,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  /** Get P&L summary */
  async getPnL() {
    const [revenue, cogs, platformCost, fulfillment] = await Promise.all([
      this.getAccountBalance(ACCOUNTS.REVENUE),
      this.getAccountBalance(ACCOUNTS.COGS),
      this.getAccountBalance(ACCOUNTS.PLATFORM_COST),
      this.getAccountBalance(ACCOUNTS.FULFILLMENT),
    ]);

    const grossProfit = revenue.balance - cogs.balance;
    const totalExpenses = platformCost.balance + fulfillment.balance;
    const netIncome = grossProfit - totalExpenses;
    const grossMarginPct = revenue.balance > 0 ? (grossProfit / revenue.balance) * 100 : 0;

    return {
      revenue: revenue.balance,
      cogs: cogs.balance,
      grossProfit,
      grossMarginPct,
      totalExpenses,
      netIncome,
    };
  }

  /** Get recent ledger transactions */
  async getTransactions(limit = 50, referenceType?: string) {
    return this.prisma.ledgerTransaction.findMany({
      where: referenceType ? { referenceType } : undefined,
      orderBy: { postedAt: 'desc' },
      take: limit,
      include: { entries: true },
    });
  }

  /** Get ledger entries for a specific reference */
  async getEntriesForReference(referenceType: string, referenceId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { referenceType, referenceId },
      orderBy: { postedAt: 'asc' },
    });
  }
}
