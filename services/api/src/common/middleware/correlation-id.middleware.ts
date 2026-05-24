import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// ─── Request Context Store ────────────────────────────────────────────────────
// Propagates requestId through the async call tree without passing it manually
export interface RequestContext {
  requestId: string;
  startTime: number;
  method: string;
  path: string;
  userId?: string;
  tenantId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string {
  return requestContext.getStore()?.requestId ?? 'no-context';
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Honour client-supplied ID (Stripe, webhooks, enterprise integrations) or generate
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    const context: RequestContext = {
      requestId,
      startTime: Date.now(),
      method: req.method,
      path: req.path,
    };

    // Propagate to response so clients can correlate logs
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', requestId);

    // Run the rest of the request inside the async context
    requestContext.run(context, () => next());
  }
}
