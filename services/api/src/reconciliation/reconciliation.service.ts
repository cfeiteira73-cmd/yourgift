import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ReconciliationType = 'full' | 'delta';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface IssueFilters {
  severity?: IssueSeverity;
  issueType?: string;
  tenantId?: string;
  limit?: number;
}

interface ReconciliationCheckResult {
  issueType: string;
  severity: IssueSeverity;
  description: string;
  referenceType?: string;
  referenceId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  discrepancy?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runReconciliation(
    type: ReconciliationType,
    triggeredBy = 'system',
    tenantId?: string,
  ): Promise<unknown> {
    const periodEnd = new Date();
    const periodStart = new Date(
      periodEnd.getTime() - (type === 'delta' ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
    );

    const run = await this.prisma.reconciliationRun.create({
      data: {
        runType: type,
        periodStart,
        periodEnd,
        status: 'running',
        triggeredBy,
        tenantId: tenantId ?? null,
        integrityScore: 100,
      },
    });

    const startMs = Date.now();
    const issues: ReconciliationCheckResult[] = [];
    let totalChecked = 0;

    try {
      const [orphan, drift, missingInvoice, negMargin, dupCharge] =
        await Promise.allSettled([
          this.checkOrphanPayments(periodStart, periodEnd, tenantId),
          this.checkLedgerDrift(periodStart, periodEnd, tenantId),
          this.checkMissingInvoices(tenantId),
          this.checkNegativeMargin(periodStart, periodEnd, tenantId),
          this.checkDuplicateCharges(periodStart, periodEnd, tenantId),
        ]);

      const extract = (
        r: PromiseSettledResult<ReconciliationCheckResult[]>,
        count: number,
      ): ReconciliationCheckResult[] => {
        totalChecked += count;
        if (r.status === 'fulfilled') return r.value;
        this.logger.error('Reconciliation check failed', (r as PromiseRejectedResult).reason);
        return [];
      };

      issues.push(
        ...extract(orphan, (await this.prisma.order.count({ where: { stripePaymentId: { not: null } } }))),
        ...extract(drift, 1),
        ...extract(missingInvoice, (await this.prisma.order.count({ where: { status: 'delivered' } }))),
        ...extract(negMargin, (await this.prisma.order.count({ where: { marginAmount: { not: null } } }))),
        ...extract(dupCharge, (await this.prisma.order.count({ where: { stripeSessionId: { not: null } } }))),
      );

      // Persist issues
      if (issues.length > 0) {
        await this.prisma.reconciliationIssue.createMany({
          data: issues.map((issue) => ({
            runId: run.id,
            issueType: issue.issueType,
            severity: issue.severity,
            description: issue.description,
            referenceType: issue.referenceType ?? null,
            referenceId: issue.referenceId ?? null,
            expectedAmount: issue.expectedAmount ?? null,
            actualAmount: issue.actualAmount ?? null,
            discrepancy: issue.discrepancy ?? null,
            tenantId: tenantId ?? null,
            metadata: (issue.metadata ?? {}) as object,
          })),
        });
      }

      // Compute integrity score
      const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
      const highIssues = issues.filter((i) => i.severity === 'high').length;
      const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
      const integrityScore = Math.max(
        0,
        100 -
          (criticalIssues * 20 + highIssues * 10 + mediumIssues * 5) /
            Math.max(totalChecked, 1),
      );

      const updatedRun = await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          integrityScore,
          totalChecked,
          issuesFound: issues.length,
          durationMs: Date.now() - startMs,
          completedAt: new Date(),
        },
      });

      return updatedRun;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Reconciliation run ${run.id} failed`, error.stack);
      await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          durationMs: Date.now() - startMs,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  // ── Check implementations ────────────────────────────────────────────────

  private async checkOrphanPayments(
    start: Date,
    end: Date,
    tenantId?: string,
  ): Promise<ReconciliationCheckResult[]> {
    const ordersWithPayment = await this.prisma.order.findMany({
      where: {
        stripePaymentId: { not: null },
        createdAt: { gte: start, lte: end },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { id: true, stripePaymentId: true, totalAmount: true },
    });

    const issues: ReconciliationCheckResult[] = [];
    for (const order of ordersWithPayment) {
      if (!order.stripePaymentId) continue;
      const txn = await this.prisma.ledgerTransaction.findFirst({
        where: {
          referenceType: 'order',
          referenceId: order.id,
        },
      });
      if (!txn) {
        issues.push({
          issueType: 'orphan_payment',
          severity: 'high',
          description: `Order ${order.id} has stripePaymentId but no LedgerTransaction`,
          referenceType: 'order',
          referenceId: order.id,
          expectedAmount: order.totalAmount ?? undefined,
          metadata: { stripePaymentId: order.stripePaymentId },
        });
      }
    }
    return issues;
  }

  private async checkLedgerDrift(
    start: Date,
    end: Date,
    tenantId?: string,
  ): Promise<ReconciliationCheckResult[]> {
    const orderSum = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: 'paid',
        createdAt: { gte: start, lte: end },
        ...(tenantId ? { tenantId } : {}),
      },
    });

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountCode: { startsWith: 'revenue' },
        postedAt: { gte: start, lte: end },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { amount: true },
    });

    const orderTotal = orderSum._sum.totalAmount ?? 0;
    const ledgerTotal = ledgerEntries.reduce((s, e) => s + e.amount, 0);
    const diff = Math.abs(orderTotal - ledgerTotal);

    if (diff > 0.01) {
      return [
        {
          issueType: 'ledger_drift',
          severity: diff > 1000 ? 'critical' : diff > 100 ? 'high' : 'medium',
          description: `Ledger drift of ${diff.toFixed(2)} EUR detected`,
          expectedAmount: orderTotal,
          actualAmount: ledgerTotal,
          discrepancy: diff,
        },
      ];
    }
    return [];
  }

  private async checkMissingInvoices(tenantId?: string): Promise<ReconciliationCheckResult[]> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const deliveredOrders = await this.prisma.order.findMany({
      where: {
        status: 'delivered',
        deliveredAt: { lte: cutoff },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { id: true, totalAmount: true },
    });

    const issues: ReconciliationCheckResult[] = [];
    for (const order of deliveredOrders) {
      const invoiceEvent = await this.prisma.eventLog.findFirst({
        where: {
          orderId: order.id,
          event: 'invoice.generated',
        },
      });
      if (!invoiceEvent) {
        issues.push({
          issueType: 'missing_invoice',
          severity: 'medium',
          description: `Order ${order.id} delivered > 48h ago with no invoice event`,
          referenceType: 'order',
          referenceId: order.id,
        });
      }
    }
    return issues;
  }

  private async checkNegativeMargin(
    start: Date,
    end: Date,
    tenantId?: string,
  ): Promise<ReconciliationCheckResult[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        marginAmount: { lt: 0 },
        createdAt: { gte: start, lte: end },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { id: true, marginAmount: true, totalAmount: true },
    });

    return orders.map((o) => ({
      issueType: 'negative_margin',
      severity: 'high' as IssueSeverity,
      description: `Order ${o.id} has negative margin of ${o.marginAmount?.toFixed(2)} EUR`,
      referenceType: 'order',
      referenceId: o.id,
      actualAmount: o.marginAmount ?? undefined,
      metadata: { totalAmount: o.totalAmount },
    }));
  }

  private async checkDuplicateCharges(
    start: Date,
    end: Date,
    tenantId?: string,
  ): Promise<ReconciliationCheckResult[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        stripeSessionId: { not: null },
        createdAt: { gte: start, lte: end },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { id: true, stripeSessionId: true, totalAmount: true },
    });

    const sessionMap = new Map<string, typeof orders>();
    for (const o of orders) {
      if (!o.stripeSessionId) continue;
      const list = sessionMap.get(o.stripeSessionId) ?? [];
      list.push(o);
      sessionMap.set(o.stripeSessionId, list);
    }

    const issues: ReconciliationCheckResult[] = [];
    for (const [sessionId, group] of sessionMap) {
      if (group.length > 1) {
        issues.push({
          issueType: 'duplicate_charge',
          severity: 'critical',
          description: `Stripe session ${sessionId} linked to ${group.length} orders`,
          metadata: {
            sessionId,
            orderIds: group.map((o) => o.id),
          },
        });
      }
    }
    return issues;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async repairIssue(issueId: string, repairedBy: string): Promise<unknown> {
    return this.prisma.reconciliationIssue.update({
      where: { id: issueId },
      data: {
        status: 'resolved',
        repairedBy,
        repairedAt: new Date(),
        repairAction: `Manually marked as repaired by ${repairedBy}`,
      },
    });
  }

  async getHistory(tenantId?: string): Promise<unknown[]> {
    return this.prisma.reconciliationRun.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
  }

  async getRunById(runId: string): Promise<unknown> {
    return this.prisma.reconciliationRun.findUniqueOrThrow({
      where: { id: runId },
      include: { issues: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async getOpenIssues(filters: IssueFilters): Promise<unknown[]> {
    return this.prisma.reconciliationIssue.findMany({
      where: {
        status: 'open',
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      take: filters.limit ?? 100,
    });
  }
}
