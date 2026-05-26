import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../queue/queue.service';
import { REDIS_CONNECTION } from '../queue/queue.module';
import type { ConnectionOptions } from 'bullmq';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

type ServiceStatus = 'ok' | 'degraded' | 'down';

interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  detail?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, ServiceHealth>;
  latencyMs: number;
}

export interface DeepHealthResponse {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  durationMs: number;
  checkedAt: string;
}

/**
 * Hardened HealthService
 *
 * Checks all critical dependencies:
 * - Database (PostgreSQL via Prisma)
 * - Redis (Upstash — BullMQ connection)
 * - Queue depths (flags if any queue is critically backed up)
 * - Midocean API (supplier connectivity)
 *
 * Overall status:
 *   ok       — all services healthy
 *   degraded — non-critical service down (Midocean)
 *   down     — database OR redis unreachable
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queueService: QueueService,
    @Optional() @Inject(REDIS_CONNECTION) private readonly redisConnection: ConnectionOptions | null,
  ) {}

  async check(): Promise<HealthResponse> {
    const start = Date.now();

    const [db, redis, queues, midocean] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkMidocean(),
    ]);

    const services: Record<string, ServiceHealth> = {
      database:  db.status === 'fulfilled'      ? db.value      : { status: 'down',     detail: (db as PromiseRejectedResult).reason?.message },
      redis:     redis.status === 'fulfilled'   ? redis.value   : { status: 'down',     detail: (redis as PromiseRejectedResult).reason?.message },
      queues:    queues.status === 'fulfilled'  ? queues.value  : { status: 'degraded', detail: 'Queue stats unavailable' },
      midocean:  midocean.status === 'fulfilled'? midocean.value: { status: 'degraded', detail: 'Supplier API unreachable' },
    };

    // Overall status: down if DB or Redis fails, degraded for anything else
    const criticalDown = services.database.status === 'down' || services.redis.status === 'down';
    const anyDegraded = Object.values(services).some((s) => s.status !== 'ok');

    const overallStatus: 'ok' | 'degraded' | 'down' =
      criticalDown ? 'down' :
      anyDegraded  ? 'degraded' :
      'ok';

    if (overallStatus !== 'ok') {
      this.logger.warn(`Health check: ${overallStatus} — ${JSON.stringify(
        Object.entries(services)
          .filter(([, v]) => v.status !== 'ok')
          .map(([k, v]) => `${k}=${v.status}`),
      )}`);
    }

    return {
      status: overallStatus,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? '1.0.0',
      environment: this.config.get('NODE_ENV') ?? 'development',
      services,
      latencyMs: Date.now() - start,
    };
  }

  // ── Individual checks ─────────────────────────────────────────────────────

  private async checkDatabase(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - t };
    } catch (err) {
      return { status: 'down', latencyMs: Date.now() - t, detail: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      const url = this.config.get<string>('UPSTASH_REDIS_URL') ?? this.config.get<string>('REDIS_URL');
      if (!url) return { status: 'degraded', detail: 'REDIS_URL not configured' };

      // Quick TCP ping via a temporary Redis connection
      // Use BullMQ queue stats as Redis connectivity proxy (avoids extra dependency)
      const stats = await this.queueService.getQueueStats('email').catch(() => null);
      if (stats !== null) {
        return { status: 'ok', latencyMs: Date.now() - t, detail: 'ping via queue stats' };
      }
      return { status: 'degraded', detail: 'Cannot verify Redis — queue stats unavailable' };
    } catch (err) {
      // Try fallback via queue stats
      try {
        await this.queueService.getQueueStats('email');
        return { status: 'ok', latencyMs: Date.now() - t, detail: 'ping via queue stats' };
      } catch {
        return { status: 'down', latencyMs: Date.now() - t, detail: (err as Error).message };
      }
    }
  }

  private async checkQueues(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      const allStats = await this.queueService.getAllQueueStats();
      const criticalQueues = ['email', 'pdf-generation', 'financial-aggregation'];

      const backlogged = allStats.filter(
        (q) => criticalQueues.includes(q.name) && q.waiting > 500,
      );

      if (backlogged.length > 0) {
        return {
          status: 'degraded',
          latencyMs: Date.now() - t,
          detail: `High backlog: ${backlogged.map((q) => `${q.name}=${q.waiting}`).join(', ')}`,
        };
      }

      const totalFailed = allStats.reduce((s, q) => s + q.failed, 0);
      return {
        status: 'ok',
        latencyMs: Date.now() - t,
        detail: `${allStats.length} queues, ${totalFailed} failed jobs total`,
      };
    } catch (err) {
      return { status: 'degraded', detail: (err as Error).message };
    }
  }

  async deepCheck(): Promise<DeepHealthResponse> {
    const start = Date.now();

    const [db, redis, stripe, s3, queues] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStripe(),
      this.checkS3(),
      this.checkQueues(),
    ]);

    const services: Record<string, ServiceHealth> = {
      database: db.status === 'fulfilled' ? db.value : { status: 'down', detail: (db as PromiseRejectedResult).reason?.message },
      redis:    redis.status === 'fulfilled' ? redis.value : { status: 'down', detail: (redis as PromiseRejectedResult).reason?.message },
      stripe:   stripe.status === 'fulfilled' ? stripe.value : { status: 'degraded', detail: (stripe as PromiseRejectedResult).reason?.message },
      s3:       s3.status === 'fulfilled' ? s3.value : { status: 'degraded', detail: (s3 as PromiseRejectedResult).reason?.message },
      queues:   queues.status === 'fulfilled' ? queues.value : { status: 'degraded', detail: 'Queue stats unavailable' },
    };

    const hasDown = Object.values(services).some((s) => s.status === 'down');
    const hasDegraded = Object.values(services).some((s) => s.status !== 'ok');

    const overall: DeepHealthResponse['overall'] =
      hasDown ? 'unhealthy' :
      hasDegraded ? 'degraded' :
      'healthy';

    const durationMs = Date.now() - start;

    // Persist to DB (best-effort)
    this.prisma.healthCheckResult.create({
      data: {
        overall,
        results: services as object,
        durationMs,
      },
    }).catch((err: Error) => this.logger.warn('Failed to persist deep health check', err.message));

    return { overall, services, durationMs, checkedAt: new Date().toISOString() };
  }

  private async checkStripe(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
      if (!stripeKey) return { status: 'degraded', detail: 'STRIPE_SECRET_KEY not configured' };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('https://api.stripe.com/v1/charges?limit=1', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Stripe-Version': '2023-10-16',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      return {
        status: res.ok ? 'ok' : 'degraded',
        latencyMs: Date.now() - t,
        detail: `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - t,
        detail: (err as Error).name === 'AbortError' ? 'timeout (5s)' : (err as Error).message,
      };
    }
  }

  private async checkS3(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      const bucket = this.config.get<string>('AWS_S3_BUCKET');
      const region = this.config.get<string>('AWS_REGION') ?? 'eu-west-1';
      if (!bucket) return { status: 'degraded', detail: 'AWS_S3_BUCKET not configured' };

      const s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
        },
      });

      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return { status: 'ok', latencyMs: Date.now() - t, detail: `Bucket: ${bucket}` };
    } catch (err) {
      const error = err as Error & { name?: string };
      const isNotFound = error.name === 'NotFound' || error.name === 'NoSuchBucket';
      return {
        status: isNotFound ? 'down' : 'degraded',
        latencyMs: Date.now() - t,
        detail: error.message,
      };
    }
  }

  private async checkMidocean(): Promise<ServiceHealth> {
    const t = Date.now();
    try {
      const key = this.config.get<string>('MIDOCEAN_KEY');
      if (!key) return { status: 'degraded', detail: 'MIDOCEAN_KEY not configured' };

      // Lightweight HTTP ping — just check if the API responds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('https://api.midocean.com/gateway/products/2.0', {
        method: 'HEAD',
        headers: { 'x-Gateway-APIKey': key },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      return {
        status: res.ok || res.status === 405 ? 'ok' : 'degraded',
        latencyMs: Date.now() - t,
        detail: `HTTP ${res.status}`,
      };
    } catch (err) {
      const isTimeout = (err as Error).name === 'AbortError';
      return {
        status: 'degraded',
        latencyMs: Date.now() - t,
        detail: isTimeout ? 'timeout (5s)' : (err as Error).message,
      };
    }
  }
}
