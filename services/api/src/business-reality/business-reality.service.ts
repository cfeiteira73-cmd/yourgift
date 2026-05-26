import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RevenueMetrics {
  total: number;
  margin: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface RefundMetrics {
  count: number;
  amount: number;
  ratio: number;
}

export interface ChurnMetrics {
  rate: number;
  highRiskCount: number;
  totalTracked: number;
}

export interface LtvMetrics {
  avg: number;
  max: number;
  min: number;
}

export interface ClientProfitabilityMetrics {
  profitable: number;
  unprofitable: number;
}

export interface SupplierProfitabilityRow {
  supplier: string;
  orderCount: number;
  totalMargin: number;
  avgMargin: number;
}

export interface InfraMetrics {
  tenantCount: number;
  monthlyEstimateEur: number;
  perTenantEur: number;
}

export interface GlobalBusinessReality {
  computedAt: Date;
  revenue30d: RevenueMetrics;
  refunds30d: RefundMetrics;
  churn: ChurnMetrics;
  ltv: LtvMetrics;
  clients: ClientProfitabilityMetrics;
  supplierProfitability: SupplierProfitabilityRow[];
  repeatPurchaseRate: number;
  infra: InfraMetrics;
}

export interface TenantBusinessReality {
  tenantId: string;
  computedAt: Date;
  revenue30d: RevenueMetrics;
  refunds30d: RefundMetrics;
  churn: ChurnMetrics;
  ltv: LtvMetrics;
  clients: ClientProfitabilityMetrics;
  supplierProfitability: SupplierProfitabilityRow[];
  repeatPurchaseRate: number;
  infra: InfraMetrics;
}

interface RawLtvRow {
  avg_ltv: number | null;
  max_ltv: number | null;
  min_ltv: number | null;
}

interface RawSupplierRow {
  supplier: string;
  order_count: bigint;
  total_margin: number | null;
  avg_margin: number | null;
}

interface RawRepeatRow {
  clients_with_multiple_orders: bigint;
  total_clients_with_orders: bigint;
}

@Injectable()
export class BusinessRealityEngine {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalBusinessReality(): Promise<GlobalBusinessReality> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const [
      revenueAgg,
      refundCount,
      refundAmountAgg,
      highChurnCount,
      totalTrackedClients,
      ltvRaw,
      profitableCount,
      unprofitableCount,
      supplierRaw,
      repeatRaw,
      tenantCount,
    ] = await Promise.all([
      // 1. Revenue last 30d
      this.prisma.order.aggregate({
        where: { status: 'paid', createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true, marginAmount: true },
        _count: { id: true },
      }),

      // 2a. Refund count last 30d
      this.prisma.refund.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // 2b. Refund amount last 30d
      this.prisma.refund.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),

      // 3a. High churn clients
      this.prisma.clientProcurementCycle.count({
        where: { churnRiskLevel: 'high' },
      }),

      // 3b. Total tracked clients
      this.prisma.clientProcurementCycle.count(),

      // 4. Real LTV via raw SQL
      this.prisma.$queryRaw<RawLtvRow[]>(
        Prisma.sql`
          SELECT
            AVG(ltv_cumulative) AS avg_ltv,
            MAX(ltv_cumulative) AS max_ltv,
            MIN(ltv_cumulative) AS min_ltv
          FROM (
            SELECT DISTINCT ON (client_id) ltv_cumulative
            FROM client_financial_snapshots
            ORDER BY client_id, computed_at DESC
          ) sub
        `,
      ),

      // 5a. Profitable clients last 6m
      this.prisma.clientFinancialSnapshot.count({
        where: {
          periodMonth: { gte: sixMonthsAgoStr },
          grossMarginPct: { gt: 0 },
        },
      }),

      // 5b. Unprofitable clients last 6m
      this.prisma.clientFinancialSnapshot.count({
        where: {
          periodMonth: { gte: sixMonthsAgoStr },
          grossMarginPct: { lte: 0 },
        },
      }),

      // 6. Supplier profitability raw SQL
      this.prisma.$queryRaw<RawSupplierRow[]>(
        Prisma.sql`
          SELECT
            supplier,
            COUNT(*) AS order_count,
            SUM(margin_amount) AS total_margin,
            AVG(margin_amount) AS avg_margin
          FROM orders
          WHERE status = 'paid'
            AND created_at > NOW() - INTERVAL '30 days'
            AND supplier IS NOT NULL
          GROUP BY supplier
          ORDER BY total_margin DESC
        `,
      ),

      // 7. Repeat purchase rate raw SQL
      this.prisma.$queryRaw<RawRepeatRow[]>(
        Prisma.sql`
          SELECT
            COUNT(DISTINCT CASE WHEN cnt > 1 THEN client_id END) AS clients_with_multiple_orders,
            COUNT(DISTINCT client_id) AS total_clients_with_orders
          FROM (
            SELECT client_id, COUNT(*) AS cnt
            FROM orders
            WHERE status = 'paid'
            GROUP BY client_id
          ) sub
        `,
      ),

      // 8. Active tenant count
      this.prisma.tenant.count({ where: { isActive: true } }),
    ]);

    const revenue30dTotal = Number(revenueAgg._sum.totalAmount ?? 0);
    const revenue30dMargin = Number(revenueAgg._sum.marginAmount ?? 0);
    const orderCount = revenueAgg._count.id;
    const avgOrderValue = orderCount > 0 ? revenue30dTotal / orderCount : 0;

    const refundAmount = Number(refundAmountAgg._sum.amount ?? 0);
    const refundRatio = revenue30dTotal > 0 ? refundAmount / revenue30dTotal : 0;

    const churnRate =
      totalTrackedClients > 0 ? highChurnCount / totalTrackedClients : 0;

    const ltvRow = ltvRaw[0] ?? { avg_ltv: null, max_ltv: null, min_ltv: null };

    const repeatRow = repeatRaw[0] ?? {
      clients_with_multiple_orders: BigInt(0),
      total_clients_with_orders: BigInt(0),
    };
    const totalClientsWithOrders = Number(repeatRow.total_clients_with_orders);
    const repeatPurchaseRate =
      totalClientsWithOrders > 0
        ? Number(repeatRow.clients_with_multiple_orders) / totalClientsWithOrders
        : 0;

    const monthlyInfraCostEur = 150;
    const infraCostPerTenantEur = monthlyInfraCostEur / Math.max(tenantCount, 1);

    return {
      computedAt: now,
      revenue30d: {
        total: revenue30dTotal,
        margin: revenue30dMargin,
        orderCount,
        avgOrderValue,
      },
      refunds30d: {
        count: refundCount,
        amount: refundAmount,
        ratio: refundRatio,
      },
      churn: {
        rate: churnRate,
        highRiskCount: highChurnCount,
        totalTracked: totalTrackedClients,
      },
      ltv: {
        avg: Number(ltvRow.avg_ltv ?? 0),
        max: Number(ltvRow.max_ltv ?? 0),
        min: Number(ltvRow.min_ltv ?? 0),
      },
      clients: {
        profitable: profitableCount,
        unprofitable: unprofitableCount,
      },
      supplierProfitability: supplierRaw.map((r) => ({
        supplier: r.supplier,
        orderCount: Number(r.order_count),
        totalMargin: Number(r.total_margin ?? 0),
        avgMargin: Number(r.avg_margin ?? 0),
      })),
      repeatPurchaseRate,
      infra: {
        tenantCount,
        monthlyEstimateEur: monthlyInfraCostEur,
        perTenantEur: infraCostPerTenantEur,
      },
    };
  }

  async getTenantBusinessReality(tenantId: string): Promise<TenantBusinessReality> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const [
      revenueAgg,
      refundCount,
      refundAmountAgg,
      highChurnCount,
      totalTrackedClients,
      ltvRaw,
      profitableCount,
      unprofitableCount,
      supplierRaw,
      repeatRaw,
      tenantCount,
    ] = await Promise.all([
      // 1. Revenue last 30d scoped to tenant
      this.prisma.order.aggregate({
        where: { status: 'paid', createdAt: { gte: thirtyDaysAgo }, tenantId },
        _sum: { totalAmount: true, marginAmount: true },
        _count: { id: true },
      }),

      // 2a. Refund count last 30d scoped to tenant
      this.prisma.refund.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          order: { tenantId },
        },
      }),

      // 2b. Refund amount last 30d scoped to tenant
      this.prisma.refund.aggregate({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          order: { tenantId },
        },
        _sum: { amount: true },
      }),

      // 3a. High churn clients for this tenant (via subquery)
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM client_procurement_cycles cpc
          WHERE cpc.churn_risk_level = 'high'
          AND cpc.client_id IN (SELECT id FROM clients WHERE tenant_id = ${tenantId})`,
      ).then(r => Number(r[0]?.count ?? 0)),

      // 3b. Total tracked clients for this tenant (via subquery)
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM client_procurement_cycles cpc
          WHERE cpc.client_id IN (SELECT id FROM clients WHERE tenant_id = ${tenantId})`,
      ).then(r => Number(r[0]?.count ?? 0)),

      // 4. Real LTV for tenant via raw SQL
      this.prisma.$queryRaw<RawLtvRow[]>(
        Prisma.sql`
          SELECT
            AVG(cfs.ltv_cumulative) AS avg_ltv,
            MAX(cfs.ltv_cumulative) AS max_ltv,
            MIN(cfs.ltv_cumulative) AS min_ltv
          FROM (
            SELECT DISTINCT ON (cfs2.client_id) cfs2.ltv_cumulative, cfs2.client_id
            FROM client_financial_snapshots cfs2
            INNER JOIN clients c ON c.id = cfs2.client_id
            WHERE c.tenant_id = ${tenantId}
            ORDER BY cfs2.client_id, cfs2.computed_at DESC
          ) cfs
        `,
      ),

      // 5a. Profitable clients last 6m for tenant (via subquery)
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM client_financial_snapshots cfs
          WHERE cfs.period_month >= ${sixMonthsAgoStr}
          AND cfs.gross_margin_pct > 0
          AND cfs.client_id IN (SELECT id FROM clients WHERE tenant_id = ${tenantId})`,
      ).then(r => Number(r[0]?.count ?? 0)),

      // 5b. Unprofitable clients last 6m for tenant (via subquery)
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM client_financial_snapshots cfs
          WHERE cfs.period_month >= ${sixMonthsAgoStr}
          AND cfs.gross_margin_pct <= 0
          AND cfs.client_id IN (SELECT id FROM clients WHERE tenant_id = ${tenantId})`,
      ).then(r => Number(r[0]?.count ?? 0)),

      // 6. Supplier profitability for tenant
      this.prisma.$queryRaw<RawSupplierRow[]>(
        Prisma.sql`
          SELECT
            supplier,
            COUNT(*) AS order_count,
            SUM(margin_amount) AS total_margin,
            AVG(margin_amount) AS avg_margin
          FROM orders
          WHERE status = 'paid'
            AND created_at > NOW() - INTERVAL '30 days'
            AND supplier IS NOT NULL
            AND tenant_id = ${tenantId}
          GROUP BY supplier
          ORDER BY total_margin DESC
        `,
      ),

      // 7. Repeat purchase rate for tenant
      this.prisma.$queryRaw<RawRepeatRow[]>(
        Prisma.sql`
          SELECT
            COUNT(DISTINCT CASE WHEN cnt > 1 THEN client_id END) AS clients_with_multiple_orders,
            COUNT(DISTINCT client_id) AS total_clients_with_orders
          FROM (
            SELECT client_id, COUNT(*) AS cnt
            FROM orders
            WHERE status = 'paid'
              AND tenant_id = ${tenantId}
            GROUP BY client_id
          ) sub
        `,
      ),

      // 8. Active tenants (global count for infra estimate)
      this.prisma.tenant.count({ where: { isActive: true } }),
    ]);

    const revenue30dTotal = Number(revenueAgg._sum.totalAmount ?? 0);
    const revenue30dMargin = Number(revenueAgg._sum.marginAmount ?? 0);
    const orderCount = revenueAgg._count.id;
    const avgOrderValue = orderCount > 0 ? revenue30dTotal / orderCount : 0;

    const refundAmount = Number(refundAmountAgg._sum.amount ?? 0);
    const refundRatio = revenue30dTotal > 0 ? refundAmount / revenue30dTotal : 0;

    const churnRate =
      totalTrackedClients > 0 ? highChurnCount / totalTrackedClients : 0;

    const ltvRow = ltvRaw[0] ?? { avg_ltv: null, max_ltv: null, min_ltv: null };

    const repeatRow = repeatRaw[0] ?? {
      clients_with_multiple_orders: BigInt(0),
      total_clients_with_orders: BigInt(0),
    };
    const totalClientsWithOrders = Number(repeatRow.total_clients_with_orders);
    const repeatPurchaseRate =
      totalClientsWithOrders > 0
        ? Number(repeatRow.clients_with_multiple_orders) / totalClientsWithOrders
        : 0;

    const monthlyInfraCostEur = 150;
    const infraCostPerTenantEur = monthlyInfraCostEur / Math.max(tenantCount, 1);

    return {
      tenantId,
      computedAt: now,
      revenue30d: {
        total: revenue30dTotal,
        margin: revenue30dMargin,
        orderCount,
        avgOrderValue,
      },
      refunds30d: {
        count: refundCount,
        amount: refundAmount,
        ratio: refundRatio,
      },
      churn: {
        rate: churnRate,
        highRiskCount: highChurnCount,
        totalTracked: totalTrackedClients,
      },
      ltv: {
        avg: Number(ltvRow.avg_ltv ?? 0),
        max: Number(ltvRow.max_ltv ?? 0),
        min: Number(ltvRow.min_ltv ?? 0),
      },
      clients: {
        profitable: profitableCount,
        unprofitable: unprofitableCount,
      },
      supplierProfitability: supplierRaw.map((r) => ({
        supplier: r.supplier,
        orderCount: Number(r.order_count),
        totalMargin: Number(r.total_margin ?? 0),
        avgMargin: Number(r.avg_margin ?? 0),
      })),
      repeatPurchaseRate,
      infra: {
        tenantCount,
        monthlyEstimateEur: monthlyInfraCostEur,
        perTenantEur: infraCostPerTenantEur,
      },
    };
  }
}
