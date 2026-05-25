import { Injectable } from '@nestjs/common';
import { trace, SpanStatusCode, Span, Tracer } from '@opentelemetry/api';

@Injectable()
export class TelemetryService {
  private readonly tracer: Tracer;

  constructor() {
    this.tracer = trace.getTracer('yourgift-api');
  }

  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    const span = this.tracer.startSpan(name);
    if (attributes) {
      span.setAttributes(attributes);
    }
    return span;
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  setTenantContext(span: Span, tenantId: string, requestId?: string): void {
    span.setAttributes({
      'yourgift.tenant_id': tenantId,
      ...(requestId ? { 'yourgift.request_id': requestId } : {}),
    });
  }
}
