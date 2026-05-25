import { trace, SpanStatusCode } from '@opentelemetry/api';

export function Traced(spanName?: string) {
  return function (target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    descriptor.value = async function (...args: unknown[]) {
      const tracer = trace.getTracer('yourgift-api');
      const name = spanName ?? `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`;
      return tracer.startActiveSpan(name, async (span) => {
        try {
          const result = await original.apply(this, args);
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
    };
    return descriptor;
  };
}
