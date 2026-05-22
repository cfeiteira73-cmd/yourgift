import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardKpis {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  conversionRate: number;
  activeClients: number;
  pendingApprovals: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  ordersByStatus: Array<{ status: string; count: number; amount: number }>;
  topProducts: Array<{ title: string; quantity: number; revenue: number }>;
  topClients: Array<{ name: string; company: string; orders: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    ref: string;
    clientName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  monthlyTrend: Array<{ month: string; revenue: number; orders: number }>;
}

export interface RevenueBreakdown {
  total: number;
  byDay: { date: string; revenue: number; orders: number }[];
  byStatus: { status: string; revenue: number; count: number }[];
}

export interface MarginAnalytics {
  totalMargin: number;
  avgMarginPct: number;
  bySupplier: { supplier: string; margin: number; marginPct: number; revenue: number }[];
  byCategory: { category: string; margin: number; marginPct: number; revenue: number }[];
}

export interface SupplierPerformance {
  supplier: string;
  orderCount: number;
  revenue: number;
  avgDeliveryDays: number;
  onTimeRate: number;
}

export interface OrderFunnel {
  stage: string;
  count: number;
  pct: number;
}

export interface TopProduct {
  productId: string;
  title: string;
  orderCount: number;
  quantitySold: number;
  revenue: number;
}

export interface ClientAnalytics {
  clientId: string;
  name: string;
  totalSpent: number;
  orderCount: number;
  avgOrderValue: number;
  repeatRate: number;
  clv: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── REVENUE DASHBOARD ────────────────────────────────────────────────────

  async getRevenueDashboard(from: Date, to: Date): Promise<RevenueBreakdown> {
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, status: true, createdAt: true },
    });

    const total = orders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);

    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { revenue: 0, orders: 0 };
      entry.revenue += o.totalAmount ?? 0;
      entry.orders += 1;
      dayMap.set(key, entry);
    }
    const byDay = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const statusMap = new Map<string, { revenue: number; count: number }>();
    for (const o of orders) {
      const entry = statusMap.get(o.status) ?? { revenue: 0, count: 0 };
      entry.revenue += o.totalAmount ?? 0;
      entry.count += 1;
      statusMap.set(o.status, entry);
    }
    const byStatus = [...statusMap.entries()].map(([status, v]) => ({
      status,
      ...v,
    }));

    return { total, byDay, byStatus };
  }

  // ─── MARGIN ANALYTICS ─────────────────────────────────────────────────────

  async getMarginAnalytics(from: Date, to: Date): Promise<MarginAnalytics> {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        marginAmount: { not: null },
      },
      select: {
        supplier: true,
        marginAmount: true,
        totalAmount: true,
        items: {
          select: {
            unitPrice: true,
            quantity: true,
            product: { select: { category: true } },
          },
        },
      },
    });

    const totalMargin = orders.reduce((acc, o) => acc + (o.marginAmount ?? 0), 0);
    const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);
    const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    // By supplier (supplier is a string field: 'midocean' | 'pf_concept' | 'stricker')
    const supplierMap = new Map<string, { margin: number; revenue: number }>();
    for (const o of orders) {
      const key = o.supplier ?? 'unknown';
      const entry = supplierMap.get(key) ?? { margin: 0, revenue: 0 };
      entry.margin += o.marginAmount ?? 0;
      entry.revenue += o.totalAmount ?? 0;
      supplierMap.set(key, entry);
    }

    const bySupplier = [...supplierMap.entries()].map(([supplier, v]) => ({
      supplier,
      margin: v.margin,
      marginPct: v.revenue > 0 ? (v.margin / v.revenue) * 100 : 0,
      revenue: v.revenue,
    }));

    // By category (derived from order items)
    const categoryMap = new Map<string, { margin: number; revenue: number }>();
    for (const o of orders) {
      for (const item of o.items) {
        const category = item.product?.category ?? 'uncategorised';
        const lineRevenue = item.unitPrice * item.quantity;
        const lineMarginFraction =
          o.totalAmount && o.totalAmount > 0
            ? (o.marginAmount ?? 0) / o.totalAmount
            : 0;
        const lineMargin = lineRevenue * lineMarginFraction;
        const entry = categoryMap.get(category) ?? { margin: 0, revenue: 0 };
        entry.margin += lineMargin;
        entry.revenue += lineRevenue;
        categoryMap.set(category, entry);
      }
    }

    const byCategory = [...categoryMap.entries()].map(([category, v]) => ({
      category,
      margin: v.margin,
      marginPct: v.revenue > 0 ? (v.margin / v.revenue) * 100 : 0,
      revenue: v.revenue,
    }));

    return { totalMargin, avgMarginPct, bySupplier, byCategory };
  }

  // ─── SUPPLIER PERFORMANCE ─────────────────────────────────────────────────

  async getSupplierPerformance(): Promise<SupplierPerformance[]> {
    const orders = await this.prisma.order.findMany({
      where: { supplier: { not: null } },
      select: {
        supplier: true,
        totalAmount: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
        status: true,
      },
    });

    const supplierMap = new Map<
      string,
      {
        orderCount: number;
        revenue: number;
        deliveryDaysTotal: number;
        deliveredCount: number;
        onTimeCount: number;
      }
    >();

    for (const o of orders) {
      const key = o.supplier as string;
      const entry = supplierMap.get(key) ?? {
        orderCount: 0,
        revenue: 0,
        deliveryDaysTotal: 0,
        deliveredCount: 0,
        onTimeCount: 0,
      };
      entry.orderCount += 1;
      entry.revenue += o.totalAmount ?? 0;

      if (o.shippedAt && o.deliveredAt) {
        const days =
          (o.deliveredAt.getTime() - o.shippedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        entry.deliveryDaysTotal += days;
        entry.deliveredCount += 1;
        if (days <= 7) entry.onTimeCount += 1;
      }

      supplierMap.set(key, entry);
    }

    return [...supplierMap.entries()].map(([supplier, v]) => ({
      supplier,
      orderCount: v.orderCount,
      revenue: v.revenue,
      avgDeliveryDays:
        v.deliveredCount > 0
          ? Math.round((v.deliveryDaysTotal / v.deliveredCount) * 10) / 10
          : 0,
      onTimeRate:
        v.deliveredCount > 0
          ? Math.round((v.onTimeCount / v.deliveredCount) * 1000) / 10
          : 0,
    }));
  }

  // ─── ORDER FUNNEL ─────────────────────────────────────────────────────────

  async getOrderFunnel(): Promise<OrderFunnel[]> {
    const stages = [
      'created',
      'paid',
      'approved',
      'producing',
      'shipped',
      'delivered',
    ];

    const counts = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const countMap = new Map(counts.map((c) => [c.status, c._count.status]));
    const topCount = countMap.get('created') ?? 1;

    return stages.map((stage) => {
      const count = countMap.get(stage) ?? 0;
      return {
        stage,
        count,
        pct: Math.round((count / topCount) * 1000) / 10,
      };
    });
  }

  // ─── TOP PRODUCTS ─────────────────────────────────────────────────────────

  async getTopProducts(limit: number = 10): Promise<TopProduct[]> {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { unitPrice: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true },
        })
      : [];

    const productTitleMap = new Map(products.map((p) => [p.id, p.title]));

    return items.map((i) => ({
      productId: i.productId,
      title: productTitleMap.get(i.productId) ?? i.productId,
      orderCount: i._count.productId,
      quantitySold: i._sum.quantity ?? 0,
      revenue: i._sum.unitPrice ?? 0,
    }));
  }

  // ─── COMPREHENSIVE DASHBOARD ──────────────────────────────────────────────

  async getDashboard(range: '7d' | '30d' | '90d' | '12m' = '30d'): Promise<DashboardData> {
    const now = new Date();
    let from: Date;

    switch (range) {
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '12m':
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch all orders in range
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lte: now } },
      select: {
        id: true,
        ref: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        clientId: true,
        companyId: true,
        client: { select: { name: true } },
        company: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            productId: true,
            product: { select: { title: true } },
          },
        },
      },
    });

    // KPIs
    const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
    const totalRevenue = nonCancelledOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const totalOrders = nonCancelledOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Conversion rate: quotes (created) -> paid+
    const totalQuotes = orders.filter((o) => o.status === 'created').length;
    const converted = orders.filter((o) => !['created', 'cancelled'].includes(o.status)).length;
    const conversionRate = (totalQuotes + converted) > 0
      ? (converted / (totalQuotes + converted)) * 100
      : 0;

    // Active clients: distinct clients with orders in range
    const activeClients = new Set(nonCancelledOrders.map((o) => o.clientId)).size;

    // Pending approvals
    const pendingApprovals = await this.prisma.approval.count({ where: { status: 'pending' } }).catch(() => 0);

    // Revenue by day
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of nonCancelledOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { revenue: 0, orders: 0 };
      entry.revenue += o.totalAmount ?? 0;
      entry.orders += 1;
      dayMap.set(key, entry);
    }
    const revenueByDay = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Orders by status
    const statusMap = new Map<string, { count: number; amount: number }>();
    for (const o of orders) {
      const entry = statusMap.get(o.status) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += o.totalAmount ?? 0;
      statusMap.set(o.status, entry);
    }
    const ordersByStatus = [...statusMap.entries()].map(([status, v]) => ({
      status,
      ...v,
    }));

    // Top products
    const productMap = new Map<string, { title: string; quantity: number; revenue: number }>();
    for (const o of nonCancelledOrders) {
      for (const item of o.items) {
        const title = item.product?.title ?? item.productId;
        const entry = productMap.get(item.productId) ?? { title, quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += item.unitPrice * item.quantity;
        productMap.set(item.productId, entry);
      }
    }
    const topProducts = [...productMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(({ title, quantity, revenue }) => ({ title, quantity, revenue }));

    // Top clients
    const clientMap = new Map<string, { name: string; company: string; orders: number; revenue: number }>();
    for (const o of nonCancelledOrders) {
      const entry = clientMap.get(o.clientId) ?? {
        name: o.client?.name ?? o.clientId,
        company: o.company?.name ?? '',
        orders: 0,
        revenue: 0,
      };
      entry.orders += 1;
      entry.revenue += o.totalAmount ?? 0;
      clientMap.set(o.clientId, entry);
    }
    const topClients = [...clientMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        ref: o.ref ?? o.id.slice(0, 8).toUpperCase(),
        clientName: o.client?.name ?? o.clientId,
        status: o.status,
        totalAmount: o.totalAmount ?? 0,
        createdAt: o.createdAt.toISOString(),
      }));

    // Monthly trend (last 12 months)
    const monthMap = new Map<string, { revenue: number; orders: number }>();
    const allOrdersForTrend = await this.prisma.order.findMany({
      where: {
        status: { not: 'cancelled' },
        createdAt: { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: { totalAmount: true, createdAt: true },
    });
    for (const o of allOrdersForTrend) {
      const key = o.createdAt.toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? { revenue: 0, orders: 0 };
      entry.revenue += o.totalAmount ?? 0;
      entry.orders += 1;
      monthMap.set(key, entry);
    }
    const monthlyTrend = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    return {
      kpis: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        conversionRate: Math.round(conversionRate * 10) / 10,
        activeClients,
        pendingApprovals,
      },
      revenueByDay,
      ordersByStatus,
      topProducts,
      topClients,
      recentOrders,
      monthlyTrend,
    };
  }

  // ─── CLIENT ANALYTICS ────────────────────────────────────────────────────

  async getClientAnalytics(companyId?: string): Promise<ClientAnalytics[]> {
    const orders = await this.prisma.order.findMany({
      where: companyId ? { companyId } : undefined,
      select: {
        clientId: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });

    const clientMap = new Map<
      string,
      {
        name: string;
        totalSpent: number;
        orderCount: number;
        months: Set<string>;
      }
    >();

    for (const o of orders) {
      const entry = clientMap.get(o.clientId) ?? {
        name: o.client?.name ?? o.clientId,
        totalSpent: 0,
        orderCount: 0,
        months: new Set<string>(),
      };
      entry.totalSpent += o.totalAmount ?? 0;
      entry.orderCount += 1;
      entry.months.add(o.createdAt.toISOString().slice(0, 7));
      clientMap.set(o.clientId, entry);
    }

    return [...clientMap.entries()]
      .map(([clientId, v]) => {
        const avgOrderValue =
          v.orderCount > 0 ? v.totalSpent / v.orderCount : 0;
        const repeatRate = v.orderCount > 1 ? (v.orderCount - 1) / v.orderCount : 0;
        const monthCount = v.months.size || 1;
        const clv = (v.totalSpent / monthCount) * 12;

        return {
          clientId,
          name: v.name,
          totalSpent: v.totalSpent,
          orderCount: v.orderCount,
          avgOrderValue,
          repeatRate: Math.round(repeatRate * 1000) / 10,
          clv: Math.round(clv * 100) / 100,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }
}
