import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

/**
 * BYPASS_TENANT_KEY
 *
 * Apply @BypassTenantGuard() to routes that legitimately operate
 * across tenants (admin-only endpoints, health checks, etc).
 */
export const BYPASS_TENANT_KEY = 'bypassTenantGuard';
export const BypassTenantGuard = () => SetMetadata(BYPASS_TENANT_KEY, true);

interface AuthUser {
  sub: string;
  email: string;
  tenantId?: string;
  role?: string;
}

interface AuthRequest extends Request {
  user?: AuthUser;
  params: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * TenantGuard — Multi-Tenant Data Isolation
 *
 * Enforces that authenticated users can only access resources
 * belonging to their own tenant. Prevents cross-tenant data leaks
 * (Tenant A reading Tenant B's orders, budgets, suppliers, etc).
 *
 * Strategy:
 * 1. Extract tenantId from JWT user (set by JwtStrategy)
 * 2. Extract tenantId from request (params, body, or query)
 * 3. If request tenantId is present and doesn't match user's → FORBIDDEN
 * 4. Admin role bypasses the check (can access all tenants)
 * 5. Routes decorated with @BypassTenantGuard() skip the check
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 *   @Controller('orders')
 *   export class OrdersController { ... }
 *
 * Or globally in AppModule:
 *   { provide: APP_GUARD, useClass: TenantGuard }
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── 1. Check bypass decorator ───────────────────────────────────────────
    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    // Not authenticated — let JwtAuthGuard handle it
    if (!user) return true;

    // ── 2. Admin bypasses tenant isolation ──────────────────────────────────
    if (user.role === 'admin' || user.role === 'ADMIN') return true;

    // ── 3. User has no tenantId — allow (public/personal routes) ───────────
    const userTenantId = user.tenantId;
    if (!userTenantId) return true;

    // ── 4. Extract requested tenantId from request ──────────────────────────
    const requestedTenantId = this.extractRequestedTenantId(request);

    // No tenantId in request — can't check, allow (controller must scope query)
    if (!requestedTenantId) return true;

    // ── 5. Enforce isolation ────────────────────────────────────────────────
    if (requestedTenantId !== userTenantId) {
      this.logger.warn(
        `Tenant isolation violation: user=${user.sub} ` +
        `userTenant=${userTenantId} requestedTenant=${requestedTenantId} ` +
        `path=${request.path} method=${request.method}`,
      );
      throw new ForbiddenException('Access denied: cross-tenant resource');
    }

    return true;
  }

  /**
   * Extracts tenantId from the request in order of precedence:
   * 1. Route param   → /tenants/:tenantId/...
   * 2. Request body  → { tenantId: "..." }
   * 3. Query param   → ?tenantId=...
   */
  private extractRequestedTenantId(request: AuthRequest): string | null {
    // Route params
    if (request.params?.tenantId) return request.params.tenantId;

    // Body (POST/PATCH)
    if (request.body && typeof request.body === 'object') {
      const tenantId = (request.body as Record<string, unknown>).tenantId;
      if (typeof tenantId === 'string') return tenantId;
    }

    // Query string
    const query = request.query as Record<string, string>;
    if (query?.tenantId) return query.tenantId;

    return null;
  }
}
