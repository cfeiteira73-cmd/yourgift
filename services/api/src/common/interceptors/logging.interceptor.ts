import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { getRequestContext } from '../middleware/correlation-id.middleware';

export interface StructuredLog {
  level: 'info' | 'warn' | 'error';
  ts: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  ip?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ctx = getRequestContext();

    const requestId = ctx?.requestId ?? (req.headers['x-request-id'] as string) ?? 'unknown';
    const startTime = ctx?.startTime ?? Date.now();

    const baseLog = {
      requestId,
      method: req.method,
      path: req.path,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as Request & { user?: { id?: string } }).user?.id,
    };

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const log: StructuredLog = {
          level: 'info',
          ts: new Date().toISOString(),
          statusCode: res.statusCode,
          durationMs,
          ...baseLog,
        };

        if (durationMs > 3000) {
          this.logger.warn(JSON.stringify({ ...log, level: 'warn', slowRequest: true }));
        } else {
          this.logger.log(JSON.stringify(log));
        }
      }),
      catchError((err: Error & { status?: number }) => {
        const durationMs = Date.now() - startTime;
        const statusCode = err.status ?? 500;
        const log: StructuredLog = {
          level: statusCode >= 500 ? 'error' : 'warn',
          ts: new Date().toISOString(),
          statusCode,
          durationMs,
          error: {
            name: err.name,
            message: err.message,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
          },
          ...baseLog,
        };

        if (statusCode >= 500) {
          this.logger.error(JSON.stringify(log));
        } else {
          this.logger.warn(JSON.stringify(log));
        }

        return throwError(() => err);
      }),
    );
  }
}
