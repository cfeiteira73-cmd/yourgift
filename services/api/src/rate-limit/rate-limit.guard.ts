import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

interface AuthenticatedRequest {
  user?: { tenantId?: string; role?: string };
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      'unknown';

    const tenantId = request.user?.tenantId ?? 'anonymous';

    const [ipResult, tenantResult] = await Promise.all([
      this.rateLimitService.checkLimit(
        this.rateLimitService.buildKey('ip', ip),
        200,
        60,
      ),
      this.rateLimitService.checkLimit(
        this.rateLimitService.buildKey('tenant', tenantId),
        200,
        60,
      ),
    ]);

    if (!ipResult.allowed || !tenantResult.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(
            (Math.max(
              ipResult.resetAt.getTime(),
              tenantResult.resetAt.getTime(),
            ) -
              Date.now()) /
              1000,
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
