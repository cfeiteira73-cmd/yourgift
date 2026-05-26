import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { RequestCostContext } from './request-cost-context';

// Re-export so existing imports from this file continue to work
export { RequestCostContext } from './request-cost-context';

@Injectable()
export class CostPerRequestInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest<{
      user?: { tenantId?: string };
      headers: Record<string, string | string[] | undefined>;
      route?: { path?: string };
      url: string;
      method: string;
    }>();

    const tenantId: string =
      req.user?.tenantId ??
      (typeof req.headers['x-tenant-id'] === 'string'
        ? req.headers['x-tenant-id']
        : Array.isArray(req.headers['x-tenant-id'])
          ? (req.headers['x-tenant-id'][0] ?? 'default')
          : 'default');

    const endpoint: string = req.route?.path ?? req.url;
    const method: string = req.method;

    return new Observable((subscriber) => {
      RequestCostContext.run(() => {
        next.handle().pipe(
          tap({
            next: () => {
              this.attributeCost(start, tenantId, endpoint, method, RequestCostContext.getQueryCount());
            },
            error: () => {
              this.attributeCost(start, tenantId, endpoint, method, RequestCostContext.getQueryCount());
            },
          }),
        ).subscribe(subscriber);
      });
    });
  }

  private attributeCost(
    start: number,
    tenantId: string,
    endpoint: string,
    method: string,
    queryCount: number,
  ): void {
    const computeMs = Date.now() - start;
    const computeCostEur = computeMs * 0.0000001;
    const dbQueryCostEur = queryCount * 0.000005;
    const networkCostEur = 0.000001;
    const totalCostEur = computeCostEur + dbQueryCostEur + networkCostEur;

    const payload = {
      tenantId,
      endpoint,
      method,
      computeMs,
      computeCostEur,
      dbQueryCostEur,
      networkCostEur,
      totalCostEur,
      queryCount,
      attributedAt: new Date().toISOString(),
    };

    // Fire-and-forget — do not await
    this.prisma.eventLog
      .create({
        data: {
          event: 'cost.request_attributed',
          entity: 'request',
          entityId: `${tenantId}:${method}:${endpoint}`,
          actorType: 'system',
          payload,
        },
      })
      .catch(() => {
        // Intentionally silent — cost attribution must never break the request
      });
  }
}
