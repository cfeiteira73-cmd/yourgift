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

  // ── Departments ────────────────────────────────────────────────────────

  async createDepartment(params: {
    organizationId: string;
    name: string;
    code?: string;
    parentId?: string;
    budgetLimitEur?: number;
  }): Promise<any> {
    return this.db.orgDepartment.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        code: params.code ?? null,
        parentId: params.parentId ?? null,
        budgetLimitEur: params.budgetLimitEur ?? null,
      },
    });
  }

  async getDepartments(organizationId: string): Promise<any[]> {
    return this.db.orgDepartment.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async addUserToDepartment(clientId: string, departmentId: string, role = 'member'): Promise<void> {
    try {
      await this.db.userDepartment.create({ data: { clientId, departmentId, role } });
    } catch {
      await this.db.userDepartment.update({
        where: { clientId_departmentId: { clientId, departmentId } },
        data: { role },
      });
    }
  }

  async getUserDepartments(clientId: string): Promise<any[]> {
    return this.db.userDepartment.findMany({ where: { clientId } });
  }

  // ── Delegations ────────────────────────────────────────────────────────

  async createDelegation(params: {
    delegatorId: string;
    delegateeId: string;
    scope: string;
    organizationId?: string;
    budgetLimitEur?: number;
    expiresAt?: Date;
  }): Promise<any> {
    return this.db.identityDelegation.create({
      data: {
        delegatorId: params.delegatorId,
        delegateeId: params.delegateeId,
        scope: params.scope,
        organizationId: params.organizationId ?? null,
        budgetLimitEur: params.budgetLimitEur ?? null,
        expiresAt: params.expiresAt ?? null,
      },
    });
  }

  async getActiveDelegations(clientId: string): Promise<any[]> {
    const now = new Date();
    return this.db.identityDelegation.findMany({
      where: {
        delegateeId: clientId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeDelegation(delegationId: string): Promise<void> {
    await this.db.identityDelegation.update({
      where: { id: delegationId },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  // Check if user has permission including delegated permissions
  async hasPermissionWithDelegation(clientId: string, permissionCode: string, organizationId?: string): Promise<boolean> {
    // Direct permission
    if (await this.hasPermission(clientId, permissionCode, organizationId)) return true;
    // Delegated permission
    const delegations = await this.getActiveDelegations(clientId);
    for (const delegation of delegations as any[]) {
      if (delegation.scope === permissionCode || delegation.scope === '*') return true;
    }
    return false;
  }

  // ── Approval Chains ────────────────────────────────────────────────────

  async createApprovalChain(params: {
    organizationId: string;
    name: string;
    triggerType: string;
    thresholdEur?: number;
    category?: string;
    steps: Array<{ stepOrder: number; approverId?: string; approverRole?: string; timeoutHours?: number; escalateTo?: string }>;
  }): Promise<any> {
    const chain = await this.db.approvalChain.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        triggerType: params.triggerType,
        thresholdEur: params.thresholdEur ?? null,
        category: params.category ?? null,
      },
    });
    // Create steps
    for (const step of params.steps) {
      await this.db.approvalChainStep.create({
        data: {
          approvalChainId: chain.id,
          stepOrder: step.stepOrder,
          approverId: step.approverId ?? null,
          approverRole: step.approverRole ?? null,
          timeoutHours: step.timeoutHours ?? 24,
          escalateTo: step.escalateTo ?? null,
        },
      });
    }
    return chain;
  }

  async getApprovalChains(organizationId: string): Promise<any[]> {
    const chains = await this.db.approvalChain.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    // Attach steps
    for (const chain of chains as any[]) {
      chain.steps = await this.db.approvalChainStep.findMany({
        where: { approvalChainId: chain.id },
        orderBy: { stepOrder: 'asc' },
      });
    }
    return chains;
  }

  async resolveApprovalChain(organizationId: string, triggerType: string, amountEur?: number, category?: string): Promise<any | null> {
    const chains = await this.db.approvalChain.findMany({
      where: {
        organizationId,
        triggerType,
        isActive: true,
        ...(category ? { OR: [{ category }, { category: null }] } : {}),
      },
      orderBy: { thresholdEur: 'desc' },
    });
    // Find the most specific matching chain (threshold <= amount)
    const matching = (chains as any[]).find((c) => {
      if (!c.thresholdEur) return true;
      if (!amountEur) return true;
      return Number(c.thresholdEur) <= amountEur;
    });
    if (!matching) return null;
    matching.steps = await this.db.approvalChainStep.findMany({
      where: { approvalChainId: matching.id },
      orderBy: { stepOrder: 'asc' },
    });
    return matching;
  }
}
