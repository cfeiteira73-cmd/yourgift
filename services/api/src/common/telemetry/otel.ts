// This MUST be imported BEFORE NestJS boots — in main.ts before any other import

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'yourgift-api',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter({ url: exporterUrl })),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: false }, // NestJS uses its own routing
      '@opentelemetry/instrumentation-pg': { enabled: true }, // PostgreSQL via Prisma
    }),
  ],
});

export function initTelemetry(): void {
  sdk.start();
  process.on('SIGTERM', () => {
    void sdk.shutdown();
  });
}
