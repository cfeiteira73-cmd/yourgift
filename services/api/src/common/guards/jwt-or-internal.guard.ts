import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InternalGuard } from './internal.guard';

/**
 * JwtOrInternalGuard
 *
 * Passes if the request carries EITHER:
 *   a) A valid JWT Bearer token (standard user auth), OR
 *   b) A valid x-internal-token header (admin worker / cron auth)
 *
 * Apply this to endpoints that must be reachable by both authenticated
 * users (via the web/admin UI) and automated internal callers (via workers).
 *
 * Usage:
 *   @UseGuards(JwtOrInternalGuard)
 *   @Post(':id/fulfill')
 *   fulfillOrder(@Request() req, @Param('id') id: string) { ... }
 */
@Injectable()
export class JwtOrInternalGuard implements CanActivate {
  private readonly jwtGuard = new JwtAuthGuard();
  private readonly internalGuard = new InternalGuard();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try JWT first
    try {
      const jwtResult = await Promise.resolve(this.jwtGuard.canActivate(context));
      if (jwtResult) return true;
    } catch {
      // JWT failed — try internal token
    }

    // Fallback to internal token
    try {
      const internalResult = await Promise.resolve(this.internalGuard.canActivate(context));
      if (internalResult) return true;
    } catch {
      // Internal token also failed
    }

    return false;
  }
}
