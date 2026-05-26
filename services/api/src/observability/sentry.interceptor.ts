import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user?: { sub?: string; email?: string; tenantId?: string };
}

/**
 * SentryInterceptor
 *
 * Wraps every request in a Sentry transaction for distributed tracing.
 * Captures exceptions and attaches user context so errors are searchable
 * by user ID, tenant, email in the Sentry UI.
 *
 * Used alongside AllExceptionsFilter:
 *  - Filter  → formats the error response (HTTP shape)
 *  - Interceptor → ships the error to Sentry with full context
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const { method, url, user } = request;

    // Set user on Sentry scope if authenticated
    if (user?.sub) {
      Sentry.setUser({
        id: user.sub,
        email: user.email,
        segment: user.tenantId,
      });
    }

    return next.handle().pipe(
      catchError((error: unknown) => {
        // Only capture 5xx / unexpected errors — not validation / auth 4xx
        const status = (error as { status?: number })?.status;
        const isOperationalError = !status || status >= 500;

        if (isOperationalError) {
          Sentry.withScope((scope) => {
            scope.setTag('method', method);
            scope.setTag('url', url);
            scope.setExtra('user', user ?? null);
            Sentry.captureException(error);
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
