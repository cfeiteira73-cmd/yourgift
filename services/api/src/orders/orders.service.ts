import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  OrderStatus,
  validateTransition,
} from './order-state-machine';

export interface OrderFilters {
  status?: OrderStatus;
  companyId?: string;
  dateRange?: { from: Date; to: Date };
}

export interface AnalyticsFilters {
  companyId?: string;
  dateRange?: { from: Date; to: Date };
}

function buildOrderRef(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `YGO-${datePart}-${rand}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfLastMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function endOfLastMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(clientId: string, dto: CreateOrderDto) {
    const ref = buildOrderRef();

    const order = await this.prisma.order.create({
      data: {
        ref,
        clientId,
        status: 'created',
        companyId: dto.companyId,
        departmentId: dto.departmentId,
        campaignId: dto.campaignId,
        shippingAddress: dto.shippingAddress as object,
        pricingSnapshot: dto.pricingSnapshot as object ?? {},
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: order.id,
        event: 'order.created',
        actorId: clientId,
        payload: { ref: order.ref, status: 'created' },
      },
    });

    this.events.emit('order.created', order);
    return order;
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async findAll(clientId: string, filters?: OrderFilters) {
    const where: Record<string, unknown> = { clientId };

    if (filters?.status) {
      where['status'] = filters.status;
    }
    if (filters?.companyId) {
      where['companyId'] = filters.companyId;
    }
    if (filters?.dateRange) {
      where['createdAt'] = {
        gte: filters.dateRange.from,
        lte: filters.dateRange.to,
      };
    }

    return this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── DETAIL ────────────────────────────────────────────────────────────────

  async findOne(id: string, clientId?: string) {
    const where: Record<string, unknown> = { id };
    if (clientId) where['clientId'] = clientId;

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        artworks: true,
        approvals: true,
        eventLogs: { orderBy: { createdAt: 'asc' } },
        client: true,
      },
    });

    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────

  async updateStatus(id: string, status: OrderStatus, actorId?: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);

    const from = existing.status as OrderStatus;
    if (!validateTransition(from, status)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${status}`,
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'approved') {
      updateData['approvedAt'] = new Date();
      if (actorId) updateData['approvedById'] = actorId;
    }
    if (status === 'shipped') {
      updateData['shippedAt'] = new Date();
    }
    if (status === 'delivered') {
      updateData['deliveredAt'] = new Date();
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: id,
        event: `order.${status}`,
        actorId: actorId ?? null,
        payload: { from, to: status },
      },
    });

    this.events.emit(`order.${status}`, order);
    return order;
  }

  // ─── TIMELINE ─────────────────────────────────────────────────────────────

  async getTimeline(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const logs = await this.prisma.eventLog.findMany({
      where: { entity: 'order', entityId: id },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map((log) => ({
      id: log.id,
      event: log.event,
      actorId: log.actorId,
      payload: log.payload,
      timestamp: log.createdAt,
      label: this.humaniseEvent(log.event),
    }));
  }

  private humaniseEvent(event: string): string {
    const map: Record<string, string> = {
      'order.created': 'Order created',
      'order.paid': 'Payment confirmed',
      'order.approved': 'Order approved',
      'order.producing': 'Production started',
      'order.shipped': 'Order shipped',
      'order.delivered': 'Order delivered',
      'order.cancelled': 'Order cancelled',
      'order.cancellation_requested': 'Cancellation requested',
    };
    return map[event] ?? event;
  }

  // ─── CANCEL ────────────────────────────────────────────────────────────────

  async cancelOrder(id: string, reason: string, actorId: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);

    if (!validateTransition(existing.status as OrderStatus, 'cancelled')) {
      throw new BadRequestException(
        `Order in status "${existing.status}" cannot be cancelled`,
      );
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: id,
        event: 'order.cancelled',
        actorId,
        payload: { reason, previousStatus: existing.status },
      },
    });

    this.events.emit('order.cancelled', { ...order, reason });
    return order;
  }

  // ─── FULFILL ──────────────────────────────────────────────────────────────

  async fulfillOrder(id: string, actorId: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);

    const from = existing.status as OrderStatus;
    const to: OrderStatus = 'producing';

    if (!validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}. Order must be in "approved" status to start fulfillment.`,
      );
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: { status: to },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: id,
        event: 'order.fulfillment_started',
        actorId,
        payload: { from, to },
      },
    });

    this.events.emit('order.fulfillment_started', order);
    return order;
  }

  // ─── ANALYTICS ────────────────────────────────────────────────────────────

  async getAnalytics(filters: AnalyticsFilters) {
    const now = new Date();
    const mtdStart = startOfMonth(now);

    const where: Record<string, unknown> = {};
    if (filters.companyId) where['companyId'] = filters.companyId;
    if (filters.dateRange) {
      where['createdAt'] = {
        gte: filters.dateRange.from,
        lte: filters.dateRange.to,
      };
    }

    const mtdWhere: Record<string, unknown> = {
      ...where,
      createdAt: { gte: mtdStart },
    };

    const [allOrders, mtdOrders, statusGroups, supplierGroups, recentOrders] =
      await Promise.all([
        this.prisma.order.findMany({
          where,
          include: { items: true },
        }),
        this.prisma.order.findMany({
          where: mtdWhere,
          include: { items: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['supplier'],
          where,
          _count: { supplier: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.findMany({
          where,
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        }),
      ]);

    const sumAmount = (orders: typeof allOrders) =>
      orders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);

    const sumMargin = (orders: typeof allOrders) =>
      orders.reduce((acc, o) => acc + (o.marginAmount ?? 0), 0);

    // Top clients by spend
    const clientMap = new Map<
      string,
      { clientId: string; name: string; totalSpent: number; orderCount: number }
    >();
    for (const o of allOrders) {
      const entry = clientMap.get(o.clientId) ?? {
        clientId: o.clientId,
        name: o.clientId,
        totalSpent: 0,
        orderCount: 0,
      };
      entry.totalSpent += o.totalAmount ?? 0;
      entry.orderCount += 1;
      clientMap.set(o.clientId, entry);
    }
    const topClients = [...clientMap.values()]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const byStatus = statusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
      revenue: g._sum.totalAmount ?? 0,
    }));

    const bySupplier = supplierGroups.map((g) => ({
      supplier: g.supplier ?? 'unknown',
      count: g._count.supplier,
      revenue: g._sum.totalAmount ?? 0,
    }));

    return {
      revenueMtd: sumAmount(mtdOrders),
      revenueTotal: sumAmount(allOrders),
      orderCount: allOrders.length,
      avgOrderValue:
        allOrders.length > 0 ? sumAmount(allOrders) / allOrders.length : 0,
      marginMtd: sumMargin(mtdOrders),
      marginTotal: sumMargin(allOrders),
      byStatus,
      bySupplier,
      recentOrders,
      topClients,
    };
  }

  // ─── DASHBOARD KPIs ───────────────────────────────────────────────────────

  async getDashboardKpis() {
    const now = new Date();
    const mtdStart = startOfMonth(now);
    const lastMonthStart = startOfLastMonth(now);
    const lastMonthEnd = endOfLastMonth(now);

    const [mtdOrders, lastMonthOrders, activeOrders, pendingApprovals, allOrders] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { createdAt: { gte: mtdStart } },
        }),
        this.prisma.order.findMany({
          where: {
            createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          },
        }),
        this.prisma.order.count({
          where: {
            status: { in: ['paid', 'approved', 'producing', 'shipped'] },
          },
        }),
        this.prisma.order.count({ where: { status: 'paid' } }),
        this.prisma.order.findMany({
          where: { marginAmount: { not: null }, totalAmount: { gt: 0 } },
          select: { marginAmount: true, totalAmount: true },
        }),
      ]);

    const revenueMtd = mtdOrders.reduce(
      (acc, o) => acc + (o.totalAmount ?? 0),
      0,
    );
    const revenueLastMonth = lastMonthOrders.reduce(
      (acc, o) => acc + (o.totalAmount ?? 0),
      0,
    );

    const revenueGrowth =
      revenueLastMonth > 0
        ? ((revenueMtd - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

    const avgMargin =
      allOrders.length > 0
        ? allOrders.reduce((acc, o) => {
            const margin = (o.marginAmount ?? 0) / (o.totalAmount ?? 1);
            return acc + margin;
          }, 0) /
          allOrders.length *
          100
        : 0;

    // Top supplier by revenue this month (using groupBy)
    const supplierGroups = await this.prisma.order.groupBy({
      by: ['supplier'],
      where: { createdAt: { gte: mtdStart }, supplier: { not: null } },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 1,
    });

    const topSupplier = supplierGroups[0]?.supplier ?? 'N/A';

    return {
      revenueMtd,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      activeOrders,
      pendingApprovals,
      avgMargin: Math.round(avgMargin * 100) / 100,
      topSupplier,
    };
  }
}
