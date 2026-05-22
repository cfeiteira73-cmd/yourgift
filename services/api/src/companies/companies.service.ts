import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCompanyDto {
  name: string;
  nif?: string;
  domain?: string;
  logoUrl?: string;
  primaryColor?: string;
  tier?: string;
  billingEmail?: string;
  shippingAddress?: Record<string, unknown>;
}

export interface UpdateCompanyDto {
  name?: string;
  nif?: string;
  domain?: string;
  logoUrl?: string;
  primaryColor?: string;
  tier?: string;
  billingEmail?: string;
  shippingAddress?: Record<string, unknown>;
}

export interface CompanyWithStats {
  id: string;
  name: string;
  nif: string | null;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  tier: string;
  billingEmail: string | null;
  shippingAddress: unknown;
  createdAt: Date;
  updatedAt: Date;
  clientCount: number;
  orderCount: number;
  activeStoreCount: number;
  totalSpent: number;
  departments: Array<{ id: string; name: string }>;
  budgetUtilization: number; // 0–1
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── LIST (with stats) ────────────────────────────────────────────────────

  async findAll(): Promise<CompanyWithStats[]> {
    const companies = await this.prisma.company.findMany({
      include: {
        _count: {
          select: {
            clients: true,
            orders: true,
            companyStores: true,
          },
        },
        departments: {
          select: { id: true, name: true },
          take: 10,
        },
        orders: {
          select: { totalAmount: true },
        },
        budgets: {
          where: { isActive: true },
          select: { limitAmount: true, spentAmount: true },
        },
        companyStores: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companies.map((c) => {
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + (o.totalAmount ?? 0),
        0,
      );
      const totalBudget = c.budgets.reduce((sum, b) => sum + b.limitAmount, 0);
      const totalSpentBudget = c.budgets.reduce(
        (sum, b) => sum + b.spentAmount,
        0,
      );
      const budgetUtilization =
        totalBudget > 0 ? totalSpentBudget / totalBudget : 0;

      return {
        id: c.id,
        name: c.name,
        nif: c.nif,
        domain: c.domain,
        logoUrl: c.logoUrl,
        primaryColor: c.primaryColor,
        tier: c.tier,
        billingEmail: c.billingEmail,
        shippingAddress: c.shippingAddress,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        clientCount: c._count.clients,
        orderCount: c._count.orders,
        activeStoreCount: c.companyStores.length,
        totalSpent,
        departments: c.departments,
        budgetUtilization: Math.min(budgetUtilization, 1),
      };
    });
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        clients: {
          select: {
            id: true,
            name: true,
            email: true,
            tier: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        departments: {
          select: {
            id: true,
            name: true,
            headEmail: true,
            createdAt: true,
          },
          orderBy: { name: 'asc' },
        },
        companyStores: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        budgets: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            period: true,
            limitAmount: true,
            spentAmount: true,
            alertThreshold: true,
            periodStart: true,
            periodEnd: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          select: {
            id: true,
            ref: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            clients: true,
            orders: true,
            companyStores: true,
            departments: true,
          },
        },
      },
    });

    if (!company) throw new NotFoundException(`Company ${id} not found`);

    const allOrders = await this.prisma.order.findMany({
      where: { companyId: id },
      select: { totalAmount: true },
    });
    const totalSpent = allOrders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );

    return { ...company, totalSpent };
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateCompanyDto) {
    if (dto.nif) {
      const existing = await this.prisma.company.findUnique({
        where: { nif: dto.nif },
      });
      if (existing) {
        throw new ConflictException(`NIF ${dto.nif} already registered`);
      }
    }

    return this.prisma.company.create({
      data: {
        name: dto.name,
        nif: dto.nif ?? null,
        domain: dto.domain ?? null,
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        tier: dto.tier ?? 'standard',
        billingEmail: dto.billingEmail ?? null,
        shippingAddress: dto.shippingAddress ?? undefined,
      },
    });
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Company ${id} not found`);

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nif !== undefined && { nif: dto.nif ?? null }),
        ...(dto.domain !== undefined && { domain: dto.domain ?? null }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl ?? null }),
        ...(dto.primaryColor !== undefined && {
          primaryColor: dto.primaryColor ?? null,
        }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.billingEmail !== undefined && {
          billingEmail: dto.billingEmail ?? null,
        }),
        ...(dto.shippingAddress !== undefined && {
          shippingAddress: dto.shippingAddress,
        }),
      },
    });
  }

  // ─── KPI SUMMARY ──────────────────────────────────────────────────────────

  async getStats() {
    const [totalCompanies, totalClients, allOrders, activeStores] =
      await Promise.all([
        this.prisma.company.count(),
        this.prisma.client.count({ where: { companyId: { not: null } } }),
        this.prisma.order.findMany({
          where: { companyId: { not: null } },
          select: { totalAmount: true },
        }),
        this.prisma.companyStore.count({ where: { isActive: true } }),
      ]);

    const totalRevenue = allOrders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );

    return { totalCompanies, totalClients, totalRevenue, activeStores };
  }
}
