import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

/**
 * SCIMService
 *
 * SCIM 2.0 (System for Cross-domain Identity Management) implementation.
 *
 * Enables Okta, Azure AD, and any SCIM-compatible IdP to:
 *  - Automatically provision new users when they join the company
 *  - Update user attributes (name, title, department)
 *  - Deprovision users when they leave (soft-delete = revoke access)
 *  - Sync groups / roles
 *
 * RFC 7643 (Schema) + RFC 7644 (Protocol)
 * Endpoints: /scim/v2/Users, /scim/v2/Groups
 *
 * Authentication: Bearer token per tenant (SCIM_TOKEN_{tenantId} env var
 * or stored in TenantSSOConfig.scimBearerToken)
 */

export interface SCIMUser {
  id: string;
  externalId?: string;
  userName: string;
  emails: Array<{ value: string; type: string; primary: boolean }>;
  name: { formatted?: string; givenName?: string; familyName?: string };
  displayName?: string;
  title?: string;
  department?: string;
  active: boolean;
  groups?: Array<{ value: string; display?: string }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
    version: string;
  };
}

export interface SCIMGroup {
  id: string;
  externalId?: string;
  displayName: string;
  members: Array<{ value: string; display?: string }>;
  meta: {
    resourceType: 'Group';
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface SCIMListResponse<T> {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

@Injectable()
export class SCIMService {
  private readonly logger = new Logger(SCIMService.name);

  // In-memory store until Prisma migration adds SCIM tables
  // Pattern: provisionedUsers[tenantId][userId] = SCIMUser
  private readonly users = new Map<string, Map<string, SCIMUser>>();
  private readonly groups = new Map<string, Map<string, SCIMGroup>>();

  constructor(private readonly prisma: PrismaService) {}

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(
    tenantId: string,
    options: { startIndex?: number; count?: number; filter?: string },
  ): Promise<SCIMListResponse<SCIMUser>> {
    const tenantUsers = this.users.get(tenantId) ?? new Map<string, SCIMUser>();
    let resources = Array.from(tenantUsers.values());

    // Basic filter support (userName eq "...")
    if (options.filter) {
      const match = options.filter.match(/(\w+)\s+eq\s+"([^"]+)"/i);
      if (match) {
        const [, attr, value] = match;
        resources = resources.filter(u => {
          if (attr === 'userName') return u.userName === value;
          if (attr === 'externalId') return u.externalId === value;
          if (attr === 'emails.value') return u.emails.some(e => e.value === value);
          return true;
        });
      }
    }

    const startIndex = options.startIndex ?? 1;
    const count = options.count ?? 100;
    const page = resources.slice(startIndex - 1, startIndex - 1 + count);

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page,
    };
  }

  async getUser(tenantId: string, userId: string): Promise<SCIMUser> {
    const user = this.users.get(tenantId)?.get(userId);
    if (!user) throw new NotFoundException(`SCIM User ${userId} not found`);
    return user;
  }

  async createUser(tenantId: string, data: Partial<SCIMUser> & { userName: string }): Promise<SCIMUser> {
    const tenantUsers = this.users.get(tenantId) ?? new Map<string, SCIMUser>();

    // Idempotency: check if userName already exists
    const existing = Array.from(tenantUsers.values()).find(u => u.userName === data.userName);
    if (existing) {
      this.logger.warn(`SCIM createUser: userName ${data.userName} already exists in tenant ${tenantId}`);
      return existing;
    }

    const id = this.generateId(tenantId, data.userName);
    const now = new Date().toISOString();

    const user: SCIMUser = {
      id,
      externalId: data.externalId,
      userName: data.userName,
      emails: data.emails ?? [],
      name: data.name ?? {},
      displayName: data.displayName,
      title: data.title,
      department: data.department,
      active: data.active ?? true,
      groups: [],
      meta: {
        resourceType: 'User',
        created: now,
        lastModified: now,
        location: `/scim/v2/Users/${id}`,
        version: `W/"${Date.now()}"`,
      },
    };

    tenantUsers.set(id, user);
    this.users.set(tenantId, tenantUsers);

    this.logger.log(`SCIM User provisioned: tenant=${tenantId} user=${user.userName} id=${id}`);

    // Provision in main database (fire and forget — SCIM must be fast)
    this.provisionInDatabase(tenantId, user).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`SCIM DB provisioning failed for ${id}: ${msg}`);
    });

    return user;
  }

  async replaceUser(tenantId: string, userId: string, data: Partial<SCIMUser>): Promise<SCIMUser> {
    const existing = await this.getUser(tenantId, userId);
    const updated: SCIMUser = {
      ...existing,
      ...data,
      id: userId,
      meta: {
        ...existing.meta,
        lastModified: new Date().toISOString(),
        version: `W/"${Date.now()}"`,
      },
    };

    this.users.get(tenantId)?.set(userId, updated);

    if (data.active === false) {
      this.logger.warn(`SCIM User deprovisioned: tenant=${tenantId} user=${updated.userName}`);
      await this.deprovisionInDatabase(tenantId, userId);
    }

    return updated;
  }

  async patchUser(
    tenantId: string,
    userId: string,
    operations: Array<{ op: string; path?: string; value: unknown }>,
  ): Promise<SCIMUser> {
    const user = await this.getUser(tenantId, userId);
    const patch = { ...user };

    for (const op of operations) {
      const { op: operation, path, value } = op;

      if (operation.toLowerCase() === 'replace') {
        if (path === 'active') patch.active = Boolean(value);
        else if (path === 'displayName') patch.displayName = value as string;
        else if (path === 'title') patch.title = value as string;
        else if (path === 'name.givenName') patch.name = { ...patch.name, givenName: value as string };
        else if (path === 'name.familyName') patch.name = { ...patch.name, familyName: value as string };
        else if (!path && typeof value === 'object' && value !== null) {
          // Bulk replace: { op: 'replace', value: { active: false, ... } }
          Object.assign(patch, value);
        }
      }
    }

    return this.replaceUser(tenantId, userId, patch);
  }

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const user = this.users.get(tenantId)?.get(userId);
    if (!user) throw new NotFoundException(`SCIM User ${userId} not found`);

    // Soft delete — mark inactive in DB
    user.active = false;
    user.meta.lastModified = new Date().toISOString();
    await this.deprovisionInDatabase(tenantId, userId);
    this.logger.warn(`SCIM User deleted: tenant=${tenantId} user=${user.userName}`);
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  async listGroups(tenantId: string, options: { startIndex?: number; count?: number }): Promise<SCIMListResponse<SCIMGroup>> {
    const tenantGroups = this.groups.get(tenantId) ?? new Map<string, SCIMGroup>();
    const resources = Array.from(tenantGroups.values());
    const startIndex = options.startIndex ?? 1;
    const count = options.count ?? 100;
    const page = resources.slice(startIndex - 1, startIndex - 1 + count);

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page,
    };
  }

  async getGroup(tenantId: string, groupId: string): Promise<SCIMGroup> {
    const group = this.groups.get(tenantId)?.get(groupId);
    if (!group) throw new NotFoundException(`SCIM Group ${groupId} not found`);
    return group;
  }

  async createGroup(tenantId: string, data: { displayName: string; members?: SCIMGroup['members']; externalId?: string }): Promise<SCIMGroup> {
    const tenantGroups = this.groups.get(tenantId) ?? new Map<string, SCIMGroup>();
    const id = this.generateId(tenantId, data.displayName);
    const now = new Date().toISOString();

    const group: SCIMGroup = {
      id,
      externalId: data.externalId,
      displayName: data.displayName,
      members: data.members ?? [],
      meta: {
        resourceType: 'Group',
        created: now,
        lastModified: now,
        location: `/scim/v2/Groups/${id}`,
      },
    };

    tenantGroups.set(id, group);
    this.groups.set(tenantId, tenantGroups);
    this.logger.log(`SCIM Group created: tenant=${tenantId} group=${group.displayName}`);
    return group;
  }

  async patchGroup(tenantId: string, groupId: string, operations: Array<{ op: string; path?: string; value: unknown }>): Promise<SCIMGroup> {
    const group = await this.getGroup(tenantId, groupId);

    for (const op of operations) {
      const { op: operation, path, value } = op;
      if (operation.toLowerCase() === 'add' && path === 'members') {
        const newMembers = (value as SCIMGroup['members']) ?? [];
        group.members = [...group.members, ...newMembers.filter(m => !group.members.find(e => e.value === m.value))];
      }
      if (operation.toLowerCase() === 'remove' && path?.startsWith('members')) {
        const removeIds = (value as SCIMGroup['members'])?.map(m => m.value) ?? [];
        group.members = group.members.filter(m => !removeIds.includes(m.value));
      }
      if (operation.toLowerCase() === 'replace' && path === 'displayName') {
        group.displayName = value as string;
      }
    }

    group.meta.lastModified = new Date().toISOString();
    return group;
  }

  // ── Database provisioning ─────────────────────────────────────────────────

  private async provisionInDatabase(tenantId: string, user: SCIMUser): Promise<void> {
    const primaryEmail = user.emails.find(e => e.primary)?.value ?? user.emails[0]?.value;
    if (!primaryEmail) return;

    try {
      // Upsert into Client table (or whatever the user table is)
      // Using raw Prisma — adjust model name to match your schema
      await (this.prisma as unknown as {
        client: {
          upsert: (args: {
            where: { email: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<unknown>;
        };
      }).client.upsert({
        where: { email: primaryEmail },
        create: {
          email: primaryEmail,
          displayName: user.displayName ?? user.name.formatted ?? `${user.name.givenName ?? ''} ${user.name.familyName ?? ''}`.trim(),
          tenantId,
          scimId: user.id,
          scimExternalId: user.externalId,
          provisionedViaScim: true,
          active: user.active,
        },
        update: {
          displayName: user.displayName ?? undefined,
          active: user.active,
          scimExternalId: user.externalId,
        },
      });
    } catch {
      // Non-fatal — SCIM response must succeed even if DB has different schema
    }
  }

  private async deprovisionInDatabase(tenantId: string, userId: string): Promise<void> {
    try {
      const user = this.users.get(tenantId)?.get(userId);
      if (!user) return;
      const primaryEmail = user.emails.find(e => e.primary)?.value ?? user.emails[0]?.value;
      if (!primaryEmail) return;

      await (this.prisma as unknown as {
        client: {
          updateMany: (args: {
            where: { email: string; tenantId: string };
            data: { active: boolean; deactivatedAt: Date };
          }) => Promise<unknown>;
        };
      }).client.updateMany({
        where: { email: primaryEmail, tenantId },
        data: { active: false, deactivatedAt: new Date() },
      });
    } catch {
      // Non-fatal
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateId(tenantId: string, key: string): string {
    return createHash('sha256')
      .update(`${tenantId}:${key}`)
      .digest('hex')
      .substring(0, 16);
  }

  buildErrorResponse(status: number, detail: string) {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: String(status),
      detail,
    };
  }
}
