import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TenantPlan = 'starter' | 'growth' | 'enterprise';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(data: {
    slug: string;
    name: string;
    plan?: TenantPlan;
    maxUsers?: number;
    maxOrdersPerMonth?: number;
    ownerId: string;
  }) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException(`Tenant slug '${data.slug}' already exists`);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          name: data.name,
          plan: data.plan ?? 'starter',
          maxUsers: data.maxUsers ?? 10,
          maxOrdersPerMonth: data.maxOrdersPerMonth ?? 500,
        },
      });
      await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: data.ownerId, role: 'owner', joinedAt: new Date() },
      });
      return tenant;
    });
  }

  async getTenant(idOrSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { memberships: { where: { isActive: true } } },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${idOrSlug}' not found`);
    return tenant;
  }

  async listTenants(includeInactive = false) {
    return this.prisma.tenant.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(tenantId: string, userId: string, role: TenantRole = 'member', invitedBy?: string) {
    return this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, role, invitedBy, joinedAt: new Date(), isActive: true },
      update: { role, isActive: true, joinedAt: new Date() },
    });
  }

  async removeMember(tenantId: string, userId: string) {
    return this.prisma.tenantMembership.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { isActive: false },
    });
  }

  async getMembers(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePlan(tenantId: string, plan: TenantPlan, maxUsers?: number, maxOrdersPerMonth?: number) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan, ...(maxUsers ? { maxUsers } : {}), ...(maxOrdersPerMonth ? { maxOrdersPerMonth } : {}) },
    });
  }

  async getTenantStats(tenantId: string) {
    const [orders, clients, companies, members] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.client.count({ where: { tenantId } }),
      this.prisma.company.count({ where: { tenantId } }),
      this.prisma.tenantMembership.count({ where: { tenantId, isActive: true } }),
    ]);

    // Orders this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const ordersThisMonth = await this.prisma.order.count({
      where: { tenantId, createdAt: { gte: monthStart } },
    });

    return { orders, ordersThisMonth, clients, companies, members };
  }

  async getPlatformStats() {
    const [totalTenants, activeTenants, byPlan] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenant.groupBy({ by: ['plan'], _count: { id: true } }),
    ]);
    const planMap = Object.fromEntries(byPlan.map((p) => [p.plan, p._count.id]));
    return { totalTenants, activeTenants, planMap };
  }
}
