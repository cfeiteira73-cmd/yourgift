import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  Context,
} from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';

export interface SpanFilters {
  service?: string;
  tenantId?: string;
  traceId?: string;
  status?: number;
  limit?: number;
}

export interface TraceStats {
  service: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  count: number;
}

/**
 * PrismaSpanExporter — persists finished OpenTelemetry spans to the DB.
 */
class PrismaSpanExporter implements SpanExporter {
  private readonly logger = new Logger(PrismaSpanExporter.name);

  constructor(private readonly prisma: PrismaService) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    this.doExport(spans)
      .then(() => resultCallback({ code: ExportResultCode.SUCCESS }))
      .catch((err: Error) => {
        this.logger.error('Failed to export spans', err.stack);
        resultCallback({ code: ExportResultCode.FAILED, error: err });
      });
  }

  private async doExport(spans: ReadableSpan[]): Promise<void> {
    if (spans.length === 0) return;

    const data = spans.map((span) => {
      const sc = span.spanContext();
      return {
        traceId: sc.traceId,
        spanId: sc.spanId,
        parentSpanId: span.parentSpanContext?.spanId ?? null,
        name: span.name,
        service: (span.resource.attributes['service.name'] as string) ?? 'unknown',
        kind: span.kind,
        statusCode: span.status.code,
        statusMessage: span.status.message ?? null,
        startTimeNs: BigInt(
          Math.round(span.startTime[0] * 1e9 + span.startTime[1]),
        ),
        durationNs: BigInt(
          Math.round(span.duration[0] * 1e9 + span.duration[1]),
        ),
        attributes: span.attributes as object,
        events: span.events as unknown as object,
        links: span.links as unknown as object,
        resource: span.resource.attributes as object,
        tenantId:
          (span.attributes['tenantId'] as string) ??
          (span.attributes['tenant.id'] as string) ??
          null,
      };
    });

    await this.prisma.traceSpan.createMany({ data, skipDuplicates: true });
  }

  async shutdown(): Promise<void> {
    // No-op — PrismaService lifecycle managed by NestJS
  }
}

@Injectable()
export class TracingService implements OnModuleInit {
  private readonly logger = new Logger(TracingService.name);
  private provider!: BasicTracerProvider;

  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.serviceName = this.config.get<string>('SERVICE_NAME') ?? 'yourgift-api';
    this.serviceVersion = this.config.get<string>('APP_VERSION') ?? '1.0.0';
  }

  onModuleInit(): void {
    const exporter = new PrismaSpanExporter(this.prisma);
    const processor = new SimpleSpanProcessor(exporter);

    this.provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        'service.name': this.serviceName,
        'service.version': this.serviceVersion,
        'deployment.environment':
          this.config.get<string>('NODE_ENV') ?? 'development',
      }),
      spanProcessors: [processor],
    });

    trace.setGlobalTracerProvider(this.provider);
    this.logger.log(`TracingService initialised — service=${this.serviceName}`);
  }

  /** Create a new span. Caller is responsible for ending it. */
  createSpan(
    name: string,
    attributes: Record<string, string | number | boolean>,
    parentContext?: Context,
  ): Span {
    const tracer = trace.getTracer(this.serviceName, this.serviceVersion);
    const ctx = parentContext ?? context.active();
    const span = tracer.startSpan(
      name,
      {
        attributes: {
          'service.name': this.serviceName,
          'service.version': this.serviceVersion,
          ...attributes,
        },
      },
      ctx,
    );
    return span;
  }

  /** Execute fn within a span. Records error and re-throws if fn throws. */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    const span = this.createSpan(name, attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const error = err as Error;
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw err;
    } finally {
      span.end();
    }
  }

  /**
   * Injects W3C trace-context headers into the given headers map
   * so that downstream services can continue the same trace.
   */
  propagateContext(
    headers: Record<string, string>,
  ): Record<string, string> {
    propagation.inject(context.active(), headers);
    return headers;
  }

  async getTraces(filters: SpanFilters): Promise<unknown[]> {
    const limit = Math.min(filters.limit ?? 100, 500);
    return this.prisma.traceSpan.findMany({
      where: {
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.traceId ? { traceId: filters.traceId } : {}),
        ...(filters.status !== undefined ? { statusCode: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getStatsLastHour(): Promise<TraceStats[]> {
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const spans = await this.prisma.traceSpan.findMany({
      where: { createdAt: { gte: since } },
      select: { service: true, durationNs: true },
    });

    // Group by service
    const byService = new Map<string, number[]>();
    for (const s of spans) {
      const ms = Number(s.durationNs) / 1e6;
      if (!byService.has(s.service)) byService.set(s.service, []);
      byService.get(s.service)!.push(ms);
    }

    return Array.from(byService.entries()).map(([service, times]) => {
      const sorted = [...times].sort((a, b) => a - b);
      const p = (pct: number): number => {
        const idx = Math.ceil(sorted.length * pct) - 1;
        return Math.round(sorted[Math.max(0, idx)] ?? 0);
      };
      return {
        service,
        p50Ms: p(0.5),
        p95Ms: p(0.95),
        p99Ms: p(0.99),
        count: sorted.length,
      };
    });
  }
}
