import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TenantPLEntry {
  tenantId: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  totalOpex: number;
  ebitda: number;
  orderCount: number;
}

@Injectable()
export class FinancialConsolidationService {
  private readonly logger = new Logger(FinancialConsolidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consolidate P&L across ALL tenants for a given period.
   * Persists the result as a snapshot for fast historical retrieval.
   */
  async consolidate(params: {
    periodLabel: string;
    periodType: 'monthly' | 'quarterly' | 'ytd' | 'custom';
    periodStart: Date;
    periodEnd: Date;
    computedBy?: string;
  }): Promise<string> {
    this.logger.log(
      `Consolidating P&L: ${params.periodLabel} (${params.periodStart.toISOString().slice(0, 10)} → ${params.periodEnd.toISOString().slice(0, 10)})`,
    );

    // 1. Get all active tenants
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });

    // 2. Per-tenant P&L
    const tenantResults: TenantPLEntry[] = [];

    for (const tenant of tenants) {
      const orders = await this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: params.periodStart, lte: params.periodEnd },
          status: { not: 'cancelled' },
        },
      });

      const revenue = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
      const cogs = revenue * 0.6;
      const grossProfit = revenue - cogs;

      const costAllocations = await this.prisma.costAllocation.findMany({
        where: {
          tenantId: tenant.id,
          periodStart: { gte: params.periodStart },
          periodEnd: { lte: params.periodEnd },
        },
      });
      const totalOpex = costAllocations.reduce((s, c) => s + Number(c.allocatedAmount), 0);
      const ebitda = grossProfit - totalOpex;

      tenantResults.push({
        tenantId: tenant.id,
        revenue,
        cogs,
        grossProfit,
        totalOpex,
        ebitda,
        orderCount: orders.length,
      });
    }

    // 3. Aggregate totals
    const totalRevenue = tenantResults.reduce((s, t) => s + t.revenue, 0);
    const totalCogs = tenantResults.reduce((s, t) => s + t.cogs, 0);
    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const totalOpex = tenantResults.reduce((s, t) => s + t.totalOpex, 0);
    const ebitda = grossProfit - totalOpex;
    const ebitdaMarginPct = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const totalOrders = tenantResults.reduce((s, t) => s + t.orderCount, 0);

    // 4. By-supplier breakdown
    const supplierOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: params.periodStart, lte: params.periodEnd },
        status: { not: 'cancelled' },
        supplier: { not: null },
      },
      select: { supplier: true, totalAmount: true },
    });
    const bySupplier: Record<string, number> = {};
    for (const o of supplierOrders) {
      if (o.supplier) {
        bySupplier[o.supplier] = (bySupplier[o.supplier] ?? 0) + Number(o.totalAmount ?? 0);
      }
    }

    // 5. By-category breakdown (from order items → products)
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: params.periodStart, lte: params.periodEnd } } },
      include: { product: { select: { category: true } } },
    });
    const byCategory: Record<string, number> = {};
    for (const item of orderItems) {
      const cat = item.product?.category ?? 'uncategorized';
      byCategory[cat] = (byCategory[cat] ?? 0) + item.unitPrice * item.quantity;
    }

    // 6. By-department breakdown
    const deptCosts = await this.prisma.costAllocation.findMany({
      where: {
        periodStart: { gte: params.periodStart },
        periodEnd: { lte: params.periodEnd },
        department: { not: null },
      },
      select: { department: true, allocatedAmount: true },
    });
    const byDepartment: Record<string, number> = {};
    for (const c of deptCosts) {
      if (c.department) {
        byDepartment[c.department] = (byDepartment[c.department] ?? 0) + Number(c.allocatedAmount);
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    // 7. Persist consolidation snapshot
    const consolidation = await this.prisma.financialConsolidation.create({
      data: {
        periodLabel: params.periodLabel,
        periodType: params.periodType,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        totalRevenue: round(totalRevenue),
        totalCogs: round(totalCogs),
        grossProfit: round(grossProfit),
        grossMarginPct: round(grossMarginPct),
        totalOpex: round(totalOpex),
        ebitda: round(ebitda),
        ebitdaMarginPct: round(ebitdaMarginPct),
        tenantBreakdown: tenantResults.map((t) => ({
          ...t,
          revenue: round(t.revenue),
          ebitda: round(t.ebitda),
        })) as object,
        bySupplier: bySupplier as object,
        byCategory: byCategory as object,
        byDepartment: byDepartment as object,
        tenantCount: tenants.length,
        orderCount: totalOrders,
        computedBy: params.computedBy ?? 'system',
      },
    });

    this.logger.log(
      `Consolidation complete: ${params.periodLabel} — revenue=${round(totalRevenue)}, EBITDA=${round(ebitda)}, tenants=${tenants.length}`,
    );
    return consolidation.id;
  }

  /** Auto-consolidate current month */
  async consolidateCurrentMonth(): Promise<string> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const label = `M${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    return this.consolidate({ periodLabel: label, periodType: 'monthly', periodStart, periodEnd });
  }

  /** Auto-consolidate current quarter */
  async consolidateCurrentQuarter(): Promise<string> {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const periodStart = new Date(now.getFullYear(), quarter * 3, 1);
    const periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    const label = `Q${quarter + 1}-${now.getFullYear()}`;
    return this.consolidate({ periodLabel: label, periodType: 'quarterly', periodStart, periodEnd });
  }

  async getConsolidations(periodType?: string, limit = 12) {
    return this.prisma.financialConsolidation.findMany({
      where: periodType ? { periodType } : {},
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  }

  async getLatestConsolidation() {
    return this.prisma.financialConsolidation.findFirst({ orderBy: { computedAt: 'desc' } });
  }

  /** Platform-wide P&L trend (monthly consolidations for last N months) */
  async getPLTrend(
    months = 6,
  ): Promise<Array<{ period: string; revenue: number; ebitda: number; margin: number }>> {
    const consolidations = await this.prisma.financialConsolidation.findMany({
      where: { periodType: 'monthly' },
      orderBy: { periodStart: 'desc' },
      take: months,
    });
    return consolidations
      .map((c) => ({
        period: c.periodLabel,
        revenue: Number(c.totalRevenue),
        ebitda: Number(c.ebitda),
        margin: Number(c.ebitdaMarginPct),
      }))
      .reverse();
  }
}
