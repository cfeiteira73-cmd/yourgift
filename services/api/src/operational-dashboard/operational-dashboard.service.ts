// FILE: services/api/src/operational-dashboard/operational-dashboard.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface OperationalTruth {
  snapshot: Date;
  // Real-time traffic
  ordersLast1h: number;
  ordersLast24h: number;
  paymentsLast1h: number;
  revenueToday: number;
  revenueMtd: number;
  // Quality
  refundRateLast30d: number;
  disputeRateLast30d: number;
  webhookFailureRateLast24h: number;
  // Queue health
  pendingJobs: number;
  failedJobs: number;
  stuckJobs: number;
  // Reconciliation
  lastReconciliationAt: Date | null;
  reconciliationDriftEur: number;
  reconciliationClean: boolean;
  // Infra
  stripeMode: 'live' | 'test';
  systemAgeDays: number;
  // Maturity
  paidOrdersTotal: number;
  activeClients: number;
  // Health score 0-100
  healthScore: number;
}

// ── Internal raw query shapes ─────────────────────────────────────────────────

interface CountRow {
  count: string;
}

interface SumRow {
  total: string | null;
}

interface ReconciliationRow {
  createdat: Date;
  payload: unknown;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OperationalDashboardService {
  private readonly logger = new Logger(OperationalDashboardService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getOperationalTruth(): Promise<OperationalTruth> {
    const snapshot = new Date();
    const now = snapshot.getTime();

    const t1h = new Date(now - 60 * 60 * 1000);
    const t24h = new Date(now - 24 * 60 * 60 * 1000);
    const t30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const t1hAgo = new Date(now - 60 * 60 * 1000);

    const todayStart = new Date(snapshot);
    todayStart.setHours(0, 0, 0, 0);

    const mtdStart = new Date(snapshot.getFullYear(), snapshot.getMonth(), 1);

    // ── Orders last 1h / 24h ──────────────────────────────────────────────────
    const [ordersLast1hRow, ordersLast24hRow] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Order" WHERE "createdAt" >= ${t1h}`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Order" WHERE "createdAt" >= ${t24h}`,
      ),
    ]);
    const ordersLast1h = parseInt(ordersLast1hRow[0]?.count ?? '0', 10);
    const ordersLast24h = parseInt(ordersLast24hRow[0]?.count ?? '0', 10);

    // ── Payments last 1h ──────────────────────────────────────────────────────
    const paymentsLast1hRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::text as count FROM "EventLog"
        WHERE event IN ('payment.confirmed', 'payment.succeeded')
          AND "createdAt" >= ${t1h}
      `,
    );
    const paymentsLast1h = parseInt(paymentsLast1hRows[0]?.count ?? '0', 10);

    // ── Revenue today / MTD ───────────────────────────────────────────────────
    const [revenueTodayRows, revenueMtdRows] = await Promise.all([
      this.prisma.$queryRaw<SumRow[]>(
        Prisma.sql`
          SELECT SUM("totalAmount")::text as total FROM "Order"
          WHERE status = 'paid' AND "createdAt" >= ${todayStart}
        `,
      ),
      this.prisma.$queryRaw<SumRow[]>(
        Prisma.sql`
          SELECT SUM("totalAmount")::text as total FROM "Order"
          WHERE status = 'paid' AND "createdAt" >= ${mtdStart}
        `,
      ),
    ]);
    const revenueToday = this.toEur(revenueTodayRows[0]?.total);
    const revenueMtd = this.toEur(revenueMtdRows[0]?.total);

    // ── Refund rate last 30d ──────────────────────────────────────────────────
    const [paidOrdersLast30dRows, refundedOrdersLast30dRows] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Order" WHERE status = 'paid' AND "createdAt" >= ${t30d}`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT r."orderId")::text as count
          FROM "Refund" r
          JOIN "Order" o ON o.id = r."orderId"
          WHERE r."createdAt" >= ${t30d} AND r.status IN ('completed', 'refunded')
        `,
      ),
    ]);
    const paidOrdersLast30d = parseInt(paidOrdersLast30dRows[0]?.count ?? '0', 10);
    const refundedOrdersLast30d = parseInt(refundedOrdersLast30dRows[0]?.count ?? '0', 10);
    const refundRateLast30d =
      paidOrdersLast30d > 0
        ? Math.round((refundedOrdersLast30d / paidOrdersLast30d) * 10000) / 100
        : 0;

    // ── Dispute rate last 30d ─────────────────────────────────────────────────
    const disputeEventsRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::text as count FROM "EventLog"
        WHERE event = 'payment.disputed' AND "createdAt" >= ${t30d}
      `,
    );
    const disputeCount = parseInt(disputeEventsRows[0]?.count ?? '0', 10);
    const disputeRateLast30d =
      paidOrdersLast30d > 0
        ? Math.round((disputeCount / paidOrdersLast30d) * 10000) / 100
        : 0;

    // ── Webhook failure rate last 24h ─────────────────────────────────────────
    const [webhookTotalRows, webhookFailedRows] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "WebhookDelivery" WHERE "createdAt" >= ${t24h}`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "WebhookDelivery" WHERE "createdAt" >= ${t24h} AND success = false`,
      ),
    ]);
    const webhookTotal = parseInt(webhookTotalRows[0]?.count ?? '0', 10);
    const webhookFailed = parseInt(webhookFailedRows[0]?.count ?? '0', 10);
    const webhookFailureRateLast24h =
      webhookTotal > 0
        ? Math.round((webhookFailed / webhookTotal) * 10000) / 100
        : 0;

    // ── Queue health ──────────────────────────────────────────────────────────
    const [pendingJobsRows, failedJobsRows, stuckJobsRows] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Job" WHERE status = 'pending'`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Job" WHERE status = 'failed'`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Job" WHERE status = 'failed' AND "createdAt" <= ${t1hAgo}`,
      ),
    ]);
    const pendingJobs = parseInt(pendingJobsRows[0]?.count ?? '0', 10);
    const failedJobs = parseInt(failedJobsRows[0]?.count ?? '0', 10);
    const stuckJobs = parseInt(stuckJobsRows[0]?.count ?? '0', 10);

    // ── Reconciliation state ──────────────────────────────────────────────────
    let lastReconciliationAt: Date | null = null;
    let reconciliationDriftEur = 0;
    let reconciliationClean = false;

    try {
      const reconRows = await this.prisma.$queryRaw<ReconciliationRow[]>(
        Prisma.sql`
          SELECT "createdAt" as createdat, payload FROM "EventLog"
          WHERE event IN ('reconciliation.completed', 'reconciliation.clean', 'reconciliation.drift_detected')
          ORDER BY "createdAt" DESC
          LIMIT 1
        `,
      );
      if (reconRows.length > 0) {
        const row = reconRows[0];
        lastReconciliationAt = row.createdat;
        const payload = row.payload as Record<string, unknown>;
        reconciliationDriftEur =
          typeof payload?.driftEur === 'number' ? Math.round(payload.driftEur * 100) / 100 : 0;
        reconciliationClean = Math.abs(reconciliationDriftEur) <= 0.01;
      }
    } catch (err) {
      this.logger.warn(`Could not read reconciliation EventLog: ${(err as Error).message}`);
    }

    // ── Stripe mode ───────────────────────────────────────────────────────────
    const stripeKey = this.config.get<string>('STRIPE_KEY') ?? '';
    const stripeMode: 'live' | 'test' = stripeKey.startsWith('sk_live_') ? 'live' : 'test';

    // ── System age ────────────────────────────────────────────────────────────
    const firstOrderRows = await this.prisma.$queryRaw<Array<{ createdat: Date }>>(
      Prisma.sql`SELECT "createdAt" as createdat FROM "Order" ORDER BY "createdAt" ASC LIMIT 1`,
    );
    const firstOrderDate = firstOrderRows[0]?.createdat ?? snapshot;
    const systemAgeDays = Math.floor(
      (snapshot.getTime() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // ── Maturity metrics ──────────────────────────────────────────────────────
    const [paidOrdersTotalRows, activeClientsRows] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::text as count FROM "Order" WHERE status = 'paid'`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT "clientId")::text as count FROM "Order"
          WHERE status = 'paid' AND "createdAt" >= ${t30d}
        `,
      ),
    ]);
    const paidOrdersTotal = parseInt(paidOrdersTotalRows[0]?.count ?? '0', 10);
    const activeClients = parseInt(activeClientsRows[0]?.count ?? '0', 10);

    // ── Health score ──────────────────────────────────────────────────────────
    let healthScore = 0;
    if (refundRateLast30d <= 2) healthScore += 20;
    else if (refundRateLast30d <= 5) healthScore += 10;

    if (disputeRateLast30d <= 0.5) healthScore += 20;
    else if (disputeRateLast30d <= 1) healthScore += 10;

    if (webhookFailureRateLast24h <= 1) healthScore += 20;
    else if (webhookFailureRateLast24h <= 5) healthScore += 10;

    if (stuckJobs === 0) healthScore += 20;
    else if (stuckJobs <= 3) healthScore += 10;

    if (reconciliationClean) healthScore += 20;

    this.logger.log(
      `Operational truth snapshot: score=${healthScore}/100 mode=${stripeMode} revenue_mtd=€${revenueMtd.toFixed(2)}`,
    );

    return {
      snapshot,
      ordersLast1h,
      ordersLast24h,
      paymentsLast1h,
      revenueToday,
      revenueMtd,
      refundRateLast30d,
      disputeRateLast30d,
      webhookFailureRateLast24h,
      pendingJobs,
      failedJobs,
      stuckJobs,
      lastReconciliationAt,
      reconciliationDriftEur,
      reconciliationClean,
      stripeMode,
      systemAgeDays,
      paidOrdersTotal,
      activeClients,
      healthScore,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private toEur(raw: string | null | undefined): number {
    const parsed = parseFloat(raw ?? '0');
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }
}
