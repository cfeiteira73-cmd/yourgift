import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ─── Public Interfaces ──────────────────────────────────────────────────────

export interface ReplaySnapshot {
  snapshotId: string;
  tenantId: string;
  asOf: Date;
  ledgerBalance: Record<string, number>; // accountCode → net balance
  orderCount: number;
  totalRevenue: number;
  totalRefunds: number;
  drift: number; // Math.abs(ledgerRevenue - orderRevenue)
  issues: string[];
}

export interface ReplayResult {
  replayId: string;
  tenantId: string;
  fromDate: Date;
  toDate: Date;
  transactionsReplayed: number;
  anomaliesDetected: string[];
  driftBefore: number;
  driftAfter: number;
  isConsistent: boolean;
  durationMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REVENUE_ACCOUNT = '4000';
const DOUBLE_ENTRY_TOLERANCE = 0.01; // EUR
const REVENUE_STATUSES = ['paid', 'delivered', 'refunded', 'partially_refunded'];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class FinancialReplayService {
  private readonly logger = new Logger(FinancialReplayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ── 1. createSnapshot ────────────────────────────────────────────────────

  /**
   * Computes a point-in-time financial snapshot for a tenant.
   * Queries all LedgerEntries up to `asOf`, computes per-account balances
   * (debit adds, credit subtracts), then reconciles against Order + Refund totals.
   */
  async createSnapshot(tenantId: string, asOf?: Date): Promise<ReplaySnapshot> {
    const snapshotId = crypto.randomUUID();
    const cutoff = asOf ?? new Date();

    // ── Ledger balances ──────────────────────────────────────────────────
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        tenantId,
        postedAt: { lte: cutoff },
      },
      select: {
        accountCode: true,
        entryType: true,
        amount: true,
      },
    });

    const ledgerBalance: Record<string, number> = {};
    for (const entry of entries) {
      const prev = ledgerBalance[entry.accountCode] ?? 0;
      ledgerBalance[entry.accountCode] =
        entry.entryType === 'debit' ? prev + entry.amount : prev - entry.amount;
    }

    const ledgerRevenue = Math.abs(ledgerBalance[REVENUE_ACCOUNT] ?? 0);

    // ── Order totals ─────────────────────────────────────────────────────
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { in: REVENUE_STATUSES },
        createdAt: { lte: cutoff },
      },
      select: { id: true, totalAmount: true },
    });

    const orderRevenue = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const orderIds = orders.map(o => o.id);

    // ── Refund totals ────────────────────────────────────────────────────
    const refunds = await this.prisma.refund.findMany({
      where: {
        orderId: { in: orderIds },
        createdAt: { lte: cutoff },
      },
      select: { amount: true },
    });

    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    // ── Drift & issue detection ──────────────────────────────────────────
    const drift = Math.abs(ledgerRevenue - orderRevenue);
    const issues: string[] = [];

    if (drift > DOUBLE_ENTRY_TOLERANCE) {
      issues.push(
        `Revenue drift detected: ledger=${ledgerRevenue.toFixed(2)} orders=${orderRevenue.toFixed(2)} diff=${drift.toFixed(2)} EUR`,
      );
    }

    const negativeAccounts = Object.entries(ledgerBalance).filter(
      ([, bal]) => bal < -DOUBLE_ENTRY_TOLERANCE,
    );
    for (const [code, bal] of negativeAccounts) {
      issues.push(
        `Account ${code} has unexpected negative balance: ${bal.toFixed(2)} EUR`,
      );
    }

    const snapshot: ReplaySnapshot = {
      snapshotId,
      tenantId,
      asOf: cutoff,
      ledgerBalance,
      orderCount: orders.length,
      totalRevenue: orderRevenue,
      totalRefunds,
      drift,
      issues,
    };

    this.logger.log(
      `Snapshot ${snapshotId}: tenant=${tenantId} orders=${orders.length} ` +
        `revenue=${orderRevenue.toFixed(2)} drift=${drift.toFixed(2)} issues=${issues.length}`,
    );

    this.events.emit('financial-replay.snapshot.created', {
      snapshotId,
      tenantId,
      drift,
      issueCount: issues.length,
    });

    return snapshot;
  }

  // ── 2. replayLedger ──────────────────────────────────────────────────────

  /**
   * Replays all LedgerTransactions in a date range and verifies:
   * - Double-entry invariant (debits == credits per transaction)
   * - Order linkage (referenceType='order' transactions reference existing orders)
   * - Orphan detection (referenceId points to nothing)
   * - Duplicate detection (same referenceId+referenceType appears twice)
   */
  async replayLedger(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<ReplayResult> {
    const startMs = Date.now();
    const replayId = crypto.randomUUID();
    const anomaliesDetected: string[] = [];

    // Snapshot drift before replay
    const snapshotBefore = await this.createSnapshot(tenantId, fromDate);
    const driftBefore = snapshotBefore.drift;

    // Fetch all transactions in range
    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: {
        tenantId,
        postedAt: { gte: fromDate, lte: toDate },
      },
      include: { entries: true },
      orderBy: { postedAt: 'asc' },
    });

    // Track seen referenceId+referenceType pairs to detect duplicates
    const seenRefs = new Map<string, number>();

    for (const tx of transactions) {
      // ── Double-entry check ──────────────────────────────────────────
      const debitSum = tx.entries
        .filter(e => e.entryType === 'debit')
        .reduce((s, e) => s + e.amount, 0);
      const creditSum = tx.entries
        .filter(e => e.entryType === 'credit')
        .reduce((s, e) => s + e.amount, 0);
      const diff = Math.abs(debitSum - creditSum);

      if (diff > DOUBLE_ENTRY_TOLERANCE) {
        anomaliesDetected.push(
          `TX ${tx.id}: double-entry imbalance debit=${debitSum.toFixed(2)} credit=${creditSum.toFixed(2)} diff=${diff.toFixed(4)}`,
        );
      }

      // ── Order linkage check ─────────────────────────────────────────
      if (tx.referenceType === 'order' && tx.referenceId) {
        const order = await this.prisma.order.findUnique({
          where: { id: tx.referenceId },
          select: { id: true, totalAmount: true, tenantId: true },
        });

        if (!order) {
          anomaliesDetected.push(
            `TX ${tx.id}: orphan — order ${tx.referenceId} does not exist`,
          );
        } else if (order.tenantId !== tenantId) {
          anomaliesDetected.push(
            `TX ${tx.id}: tenant mismatch — order ${tx.referenceId} belongs to tenant ${order.tenantId}`,
          );
        } else if (
          order.totalAmount !== null &&
          Math.abs(debitSum - order.totalAmount) > DOUBLE_ENTRY_TOLERANCE
        ) {
          anomaliesDetected.push(
            `TX ${tx.id}: amount mismatch — ledger debit=${debitSum.toFixed(2)} order.totalAmount=${order.totalAmount.toFixed(2)}`,
          );
        }
      }

      // ── Duplicate detection ─────────────────────────────────────────
      if (tx.referenceType && tx.referenceId) {
        const key = `${tx.referenceType}::${tx.referenceId}`;
        seenRefs.set(key, (seenRefs.get(key) ?? 0) + 1);
        if (seenRefs.get(key)! > 1) {
          anomaliesDetected.push(
            `Duplicate TX: referenceType=${tx.referenceType} referenceId=${tx.referenceId} (seen ${seenRefs.get(key)} times)`,
          );
        }
      }
    }

    // Snapshot drift after replay period
    const snapshotAfter = await this.createSnapshot(tenantId, toDate);
    const driftAfter = snapshotAfter.drift;

    const durationMs = Date.now() - startMs;

    const result: ReplayResult = {
      replayId,
      tenantId,
      fromDate,
      toDate,
      transactionsReplayed: transactions.length,
      anomaliesDetected,
      driftBefore,
      driftAfter,
      isConsistent: anomaliesDetected.length === 0 && driftAfter <= DOUBLE_ENTRY_TOLERANCE,
      durationMs,
    };

    this.logger.log(
      `Replay ${replayId}: tenant=${tenantId} txs=${transactions.length} ` +
        `anomalies=${anomaliesDetected.length} consistent=${result.isConsistent} (${durationMs}ms)`,
    );

    this.events.emit('financial-replay.replay.completed', {
      replayId,
      tenantId,
      anomalyCount: anomaliesDetected.length,
      isConsistent: result.isConsistent,
    });

    return result;
  }

  // ── 3. verifyDoubleEntry ─────────────────────────────────────────────────

  /**
   * Verifies the double-entry invariant for a single LedgerTransaction.
   * Tolerance: 0.01 EUR.
   */
  async verifyDoubleEntry(
    txId: string,
  ): Promise<{ valid: boolean; debitSum: number; creditSum: number; diff: number }> {
    const tx = await this.prisma.ledgerTransaction.findUnique({
      where: { id: txId },
      include: { entries: true },
    });

    if (!tx) {
      return { valid: false, debitSum: 0, creditSum: 0, diff: 0 };
    }

    const debitSum = tx.entries
      .filter(e => e.entryType === 'debit')
      .reduce((s, e) => s + e.amount, 0);
    const creditSum = tx.entries
      .filter(e => e.entryType === 'credit')
      .reduce((s, e) => s + e.amount, 0);
    const diff = Math.abs(debitSum - creditSum);
    const valid = diff <= DOUBLE_ENTRY_TOLERANCE;

    this.logger.debug(
      `verifyDoubleEntry ${txId}: debit=${debitSum.toFixed(4)} credit=${creditSum.toFixed(4)} valid=${valid}`,
    );

    return { valid, debitSum, creditSum, diff };
  }

  // ── 4. detectOrphanPayments ──────────────────────────────────────────────

  /**
   * Finds LedgerEntries with referenceType='order' where the referenced order
   * does not exist in the database. Returns the orphan LedgerEntry IDs.
   */
  async detectOrphanPayments(tenantId: string): Promise<string[]> {
    const candidates = await this.prisma.ledgerEntry.findMany({
      where: {
        tenantId,
        referenceType: 'order',
        referenceId: { not: null },
      },
      select: { id: true, referenceId: true },
    });

    const orphanIds: string[] = [];

    for (const entry of candidates) {
      if (!entry.referenceId) continue;

      const order = await this.prisma.order.findUnique({
        where: { id: entry.referenceId },
        select: { id: true },
      });

      if (!order) {
        orphanIds.push(entry.id);
        this.logger.warn(
          `Orphan ledger entry ${entry.id}: references non-existent order ${entry.referenceId}`,
        );
      }
    }

    return orphanIds;
  }

  // ── 5. detectDuplicateCharges ────────────────────────────────────────────

  /**
   * Finds orders for a tenant that appear more than once in LedgerTransactions
   * with referenceType='order'. Returns the list of duplicate referenceIds.
   */
  async detectDuplicateCharges(tenantId: string): Promise<string[]> {
    // Fetch all order-linked transactions for this tenant
    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: {
        tenantId,
        referenceType: 'order',
        referenceId: { not: null },
      },
      select: { referenceId: true },
    });

    const refCounts = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.referenceId) continue;
      refCounts.set(tx.referenceId, (refCounts.get(tx.referenceId) ?? 0) + 1);
    }

    const duplicates: string[] = [];
    for (const [refId, count] of refCounts.entries()) {
      if (count > 1) {
        duplicates.push(refId);
        this.logger.warn(
          `Duplicate charge detected: order ${refId} appears ${count} times in ledger transactions`,
        );
      }
    }

    return duplicates;
  }

  // ── 6. reconstructAuditTimeline ──────────────────────────────────────────

  /**
   * Returns all LedgerEntries for a tenant in a date range, formatted as an
   * ordered audit timeline suitable for regulatory review.
   */
  async reconstructAuditTimeline(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<
    Array<{
      timestamp: Date;
      event: string;
      amount: number;
      accountCode: string;
      referenceId: string | null;
    }>
  > {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        tenantId,
        postedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { postedAt: 'asc' },
      select: {
        postedAt: true,
        entryType: true,
        accountCode: true,
        amount: true,
        referenceId: true,
      },
    });

    return entries.map(entry => ({
      timestamp: entry.postedAt,
      event: `${entry.entryType} ${entry.accountCode}`,
      amount: entry.amount,
      accountCode: entry.accountCode,
      referenceId: entry.referenceId ?? null,
    }));
  }

  // ── 7. getFinancialSummary ────────────────────────────────────────────────

  /**
   * Aggregates overall financial data for a tenant:
   * revenue, refunds, net revenue, pending order count, and ledger drift.
   */
  async getFinancialSummary(tenantId: string): Promise<{
    totalRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    pendingOrders: number;
    drift: number;
  }> {
    const [orders, pendingCount, refunds, snapshot] = await Promise.all([
      // Revenue orders
      this.prisma.order.findMany({
        where: { tenantId, status: { in: REVENUE_STATUSES } },
        select: { id: true, totalAmount: true },
      }),
      // Pending order count
      this.prisma.order.count({
        where: {
          tenantId,
          status: { in: ['created', 'approved', 'producing', 'shipped'] },
        },
      }),
      // All refunds across tenant orders
      this.prisma.refund.findMany({
        where: {
          order: { tenantId },
        },
        select: { amount: true },
      }),
      // Snapshot for drift
      this.createSnapshot(tenantId),
    ]);

    const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const totalRefunds = refunds.reduce((s, r) => s + Number(r.amount), 0);
    const netRevenue = totalRevenue - totalRefunds;

    return {
      totalRevenue,
      totalRefunds,
      netRevenue,
      pendingOrders: pendingCount,
      drift: snapshot.drift,
    };
  }
}
