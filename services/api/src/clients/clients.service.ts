import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateClientDto {
  email: string;
  name: string;
  company?: string;
  nif?: string;
  tier?: string;
  companyId?: string;
}

export interface UpdateClientDto {
  name?: string;
  company?: string;
  nif?: string;
  tier?: string;
  companyId?: string;
}

export interface ClientWithStats {
  id: string;
  email: string;
  name: string;
  company: string | null;
  nif: string | null;
  tier: string;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderCount: number;
  quoteCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  companyName: string | null;
  companyTier: string | null;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── LIST (with aggregated stats) ─────────────────────────────────────────

  async findAll(): Promise<ClientWithStats[]> {
    const clients = await this.prisma.client.findMany({
      include: {
        _count: { select: { orders: true, quotes: true } },
        companyRef: { select: { name: true, tier: true } },
        orders: {
          select: { totalAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((c) => {
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + (o.totalAmount ?? 0),
        0,
      );
      const lastOrderAt = c.orders[0]?.createdAt ?? null;

      return {
        id: c.id,
        email: c.email,
        name: c.name,
        company: c.company,
        nif: c.nif,
        tier: c.tier,
        companyId: c.companyId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        orderCount: c._count.orders,
        quoteCount: c._count.quotes,
        totalSpent,
        lastOrderAt,
        companyName: c.companyRef?.name ?? null,
        companyTier: c.companyRef?.tier ?? null,
      };
    });
  }

  // ─── DETAIL (with recent orders) ──────────────────────────────────────────

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        companyRef: {
          select: {
            id: true,
            name: true,
            tier: true,
            domain: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
        orders: {
          select: {
            id: true,
            ref: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            supplier: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: { select: { orders: true, quotes: true } },
      },
    });

    if (!client) throw new NotFoundException(`Client ${id} not found`);

    const allOrders = await this.prisma.order.findMany({
      where: { clientId: id },
      select: { totalAmount: true },
    });

    const totalSpent = allOrders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );

    const avgOrderValue =
      allOrders.length > 0 ? totalSpent / allOrders.length : 0;

    return {
      ...client,
      totalSpent,
      avgOrderValue,
    };
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(`Email ${dto.email} already registered`);
    }

    return this.prisma.client.create({
      data: {
        email: dto.email,
        name: dto.name,
        company: dto.company,
        nif: dto.nif,
        tier: dto.tier ?? 'standard',
        companyId: dto.companyId ?? null,
      },
    });
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Client ${id} not found`);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.nif !== undefined && { nif: dto.nif }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId ?? null }),
      },
    });
  }

  // ─── KPI SUMMARY ──────────────────────────────────────────────────────────

  async getStats() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [totalClients, allOrders, activeClientIds] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.order.findMany({
        select: { clientId: true, totalAmount: true },
      }),
      this.prisma.order
        .findMany({
          where: { createdAt: { gte: ninetyDaysAgo } },
          select: { clientId: true },
          distinct: ['clientId'],
        })
        .then((rows) => new Set(rows.map((r) => r.clientId))),
    ]);

    const totalRevenue = allOrders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const activeClients = activeClientIds.size;
    const avgLtv = totalClients > 0 ? totalRevenue / totalClients : 0;

    return { totalClients, activeClients, totalRevenue, avgLtv };
  }
}
