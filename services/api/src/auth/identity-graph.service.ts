import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserPermissions {
  clientId: string;
  organizationId?: string;
  role: string;
  permissions: string[]; // permission codes
}

@Injectable()
export class IdentityGraphService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  // ── Organization management ───────────────────────────────────────────
  async createOrganization(name: string, domain?: string, plan = 'free'): Promise<any> {
    return this.db.organization.create({
      data: { name, domain: domain ?? null, plan },
    });
  }

  async getOrganization(id: string): Promise<any> {
    return this.db.organization.findUnique({ where: { id } });
  }

  async findOrgByDomain(domain: string): Promise<any> {
    return this.db.organization.findUnique({ where: { domain } });
  }

  // ── User-organization membership ──────────────────────────────────────
  async addUserToOrg(clientId: string, organizationId: string, role = 'member'): Promise<any> {
    try {
      return await this.db.userOrganization.create({
        data: { clientId, organizationId, role, joinedAt: new Date() },
      });
    } catch {
      // Already a member — update role
      return this.db.userOrganization.update({
        where: { clientId_organizationId: { clientId, organizationId } },
        data: { role },
      });
    }
  }

  async getUserOrgs(clientId: string): Promise<any[]> {
    return this.db.userOrganization.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOrgMembers(organizationId: string): Promise<any[]> {
    return this.db.userOrganization.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Permission resolution ──────────────────────────────────────────────
  async resolvePermissions(clientId: string, organizationId?: string): Promise<UserPermissions> {
    // Get role for this client in this org (or default to 'viewer')
    let role = 'viewer';
    if (organizationId) {
      const membership = await this.db.userOrganization.findUnique({
        where: { clientId_organizationId: { clientId, organizationId } },
      });
      if (membership) role = membership.role;
    }

    // Get all permissions for this role
    const rolePerms = await this.db.rolePermission.findMany({
      where: { role },
      select: { permissionId: true },
    });

    const permIds = rolePerms.map((rp: any) => rp.permissionId);
    const perms = permIds.length > 0
      ? await this.db.appPermission.findMany({
          where: { id: { in: permIds } },
          select: { code: true },
        })
      : [];

    return {
      clientId,
      organizationId,
      role,
      permissions: perms.map((p: any) => p.code),
    };
  }

  async hasPermission(clientId: string, permissionCode: string, organizationId?: string): Promise<boolean> {
    const { permissions } = await this.resolvePermissions(clientId, organizationId);
    return permissions.includes(permissionCode);
  }

  async getAllPermissions(): Promise<any[]> {
    return this.db.appPermission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async linkRolePermission(role: string, permissionId: string): Promise<void> {
    try {
      await this.db.rolePermission.create({ data: { role, permissionId } });
    } catch { }
  }
}
