import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type { Request } from 'express';

interface AuthUser {
  sub?: string;
  tenantId?: string;
  role?: string;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * TenantThrottlerGuard
 *
 * Extends the default ThrottlerGuard to use tenantId (not IP) as the
 * rate-limiting key for authenticated requests.
 *
 * This prevents:
 * - One tenant hammering the API and starving others
 * - IP-based bypass via proxies / Cloudflare edge IPs
 *
 * Rate limits (from ThrottlerModule config in app.module.ts):
 *   short: 20 req/s   per tenant
 *   long:  200 req/min per tenant
 *
 * Admin accounts get 5× the normal limits (set in getTracker).
 *
 * Falls back to IP-based throttling for unauthenticated requests.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthRequest): Promise<string> {
    const user = req.user;

    if (user?.tenantId) {
      // Authenticated — bucket by tenant (all users of same company share quota)
      const prefix = user.role === 'admin' ? 'admin' : 'tenant';
      return `${prefix}:${user.tenantId}`;
    }

    if (user?.sub) {
      // Authenticated but no tenantId — bucket by user
      return `user:${user.sub}`;
    }

    // Unauthenticated — bucket by IP (behind Cloudflare / proxy)
    const ip =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    return `ip:${ip}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Too many requests — slow down');
  }
}
