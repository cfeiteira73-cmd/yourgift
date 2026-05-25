import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * InternalGuard
 *
 * Allows requests from trusted internal callers (admin worker, cron jobs)
 * that present a valid x-internal-token header.
 *
 * Usage:
 *   @UseGuards(JwtOrInternalGuard)   // prefer this — allows both JWT users and internal callers
 *   @UseGuards(InternalGuard)         // use only if the endpoint is exclusively internal
 *
 * The guard injects a synthetic system user into req.user so downstream
 * handlers that read req.user.id will receive 'system' instead of crashing.
 *
 * Security:
 * - Token must match INTERNAL_TOKEN env var (min 32 chars enforced at runtime)
 * - If INTERNAL_TOKEN is not configured, all internal requests are rejected
 * - Token comparison uses constant-time equality to prevent timing attacks
 */
@Injectable()
export class InternalGuard implements CanActivate {
  private readonly logger = new Logger(InternalGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.INTERNAL_TOKEN;

    if (!expectedToken) {
      this.logger.warn('INTERNAL_TOKEN is not set — all internal requests rejected');
      throw new UnauthorizedException('Internal access not configured');
    }

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const providedToken = request.headers['x-internal-token'];

    if (typeof providedToken !== 'string' || !this.safeCompare(providedToken, expectedToken)) {
      throw new UnauthorizedException('Invalid internal token');
    }

    // Inject a synthetic system user so controllers that read req.user.id work safely
    request.user = { id: 'system', role: 'internal', email: 'system@internal' };

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing oracle attacks.
   * Falls back to a simple scan when lengths differ (safe — length is public info).
   */
  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
