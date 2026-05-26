import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestId } from '../middleware/correlation-id.middleware';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    ts: string;
  };
}

/**
 * Wraps all successful responses in a consistent envelope:
 * { success: true, data: T, meta: { requestId, ts } }
 *
 * Controllers that return already-enveloped data (e.g. pagination wrappers)
 * pass through unchanged — we detect the `success` key to avoid double-wrapping.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      map((data) => {
        // Skip wrapping if already enveloped or if it's a raw stream/buffer
        if (
          data === null ||
          data === undefined ||
          Buffer.isBuffer(data) ||
          (typeof data === 'object' && 'success' in data)
        ) {
          return data as T;
        }

        return {
          success: true as const,
          data,
          meta: {
            requestId: getRequestId(),
            ts: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
