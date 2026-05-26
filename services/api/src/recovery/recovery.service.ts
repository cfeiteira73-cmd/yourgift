import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CircuitBreakerStatus {
  allowed: boolean;
  state: string;
}

export interface WithRetryOptions {
  service: string;
  operation: string;
  maxAttempts: number;
  initialDelayMs: number;
  jitter?: boolean;
  idempotencyKey?: string;
  tenantId?: string;
}

export interface RetryStats {
  service: string;
  operation: string;
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  avgDurationMs: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_SECONDS = 60;

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkCircuitBreaker(service: string): Promise<CircuitBreakerStatus> {
    const state = await this.prisma.circuitBreakerState.findUnique({
      where: { service },
    });

    if (!state) {
      // No record — circuit is implicitly closed
      return { allowed: true, state: 'closed' };
    }

    if (state.state === 'open') {
      if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
        // Transition to half_open
        await this.prisma.circuitBreakerState.update({
          where: { service },
          data: { state: 'half_open', halfOpenAt: new Date() },
        });
        return { allowed: true, state: 'half_open' };
      }
      return { allowed: false, state: 'open' };
    }

    return { allowed: true, state: state.state };
  }

  async recordSuccess(service: string): Promise<void> {
    const existing = await this.prisma.circuitBreakerState.findUnique({
      where: { service },
    });

    if (!existing) return;

    const isHalfOpen = existing.state === 'half_open';
    await this.prisma.circuitBreakerState.update({
      where: { service },
      data: {
        successCount: { increment: 1 },
        lastSuccessAt: new Date(),
        ...(isHalfOpen
          ? {
              state: 'closed',
              failureCount: 0,
              openedAt: null,
              halfOpenAt: null,
              nextRetryAt: null,
            }
          : {}),
      },
    });

    if (isHalfOpen) {
      this.logger.log(`Circuit breaker CLOSED for service: ${service}`);
    }
  }

  async recordFailure(service: string): Promise<void> {
    const existing = await this.prisma.circuitBreakerState.upsert({
      where: { service },
      create: {
        service,
        state: 'closed',
        failureCount: 1,
        lastFailureAt: new Date(),
        threshold: DEFAULT_FAILURE_THRESHOLD,
        cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
      },
      update: {
        failureCount: { increment: 1 },
        lastFailureAt: new Date(),
      },
    });

    const threshold = existing.threshold ?? DEFAULT_FAILURE_THRESHOLD;
    const newCount = (existing.failureCount ?? 0) + 1;

    if (
      (existing.state === 'closed' || existing.state === 'half_open') &&
      newCount >= threshold
    ) {
      const cooldown = existing.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
      const nextRetryAt = new Date(Date.now() + cooldown * 1000);
      await this.prisma.circuitBreakerState.update({
        where: { service },
        data: {
          state: 'open',
          openedAt: new Date(),
          halfOpenAt: null,
          nextRetryAt,
        },
      });
      this.logger.warn(
        `Circuit breaker OPENED for service: ${service} (failures=${newCount}, retryAt=${nextRetryAt.toISOString()})`,
      );
    }
  }

  async getCircuitBreakers(): Promise<unknown[]> {
    return this.prisma.circuitBreakerState.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async resetCircuitBreaker(service: string): Promise<unknown> {
    const result = await this.prisma.circuitBreakerState.upsert({
      where: { service },
      create: {
        service,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        threshold: DEFAULT_FAILURE_THRESHOLD,
        cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
      },
      update: {
        state: 'closed',
        failureCount: 0,
        openedAt: null,
        halfOpenAt: null,
        nextRetryAt: null,
      },
    });
    this.logger.log(`Circuit breaker manually reset for service: ${service}`);
    return result;
  }

  async withRetry<T>(
    fn: () => Promise<T>,
    options: WithRetryOptions,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      const attemptStart = Date.now();

      const { allowed } = await this.checkCircuitBreaker(options.service);
      if (!allowed) {
        const err = new Error(`Circuit breaker OPEN for service: ${options.service}`);
        await this.writeRetryAudit(options, attempt, false, err.message, Date.now() - attemptStart);
        throw err;
      }

      try {
        const result = await fn();
        await this.recordSuccess(options.service);
        await this.writeRetryAudit(options, attempt, true, undefined, Date.now() - attemptStart);
        return result;
      } catch (err) {
        const error = err as Error;
        lastError = error;
        await this.recordFailure(options.service);
        await this.writeRetryAudit(options, attempt, false, error.message, Date.now() - attemptStart, this.backoffMs(attempt, options));

        if (attempt < options.maxAttempts) {
          const delay = this.backoffMs(attempt, options);
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Max retry attempts reached');
  }

  private backoffMs(attempt: number, options: WithRetryOptions): number {
    const base = options.initialDelayMs * Math.pow(2, attempt - 1);
    const jitter = options.jitter !== false ? Math.random() * base * 0.2 : 0;
    return Math.round(Math.min(base + jitter, 30_000));
  }

  private async writeRetryAudit(
    options: WithRetryOptions,
    attempt: number,
    success: boolean,
    errorMessage: string | undefined,
    durationMs: number,
    backoffMs?: number,
  ): Promise<void> {
    await this.prisma.retryAudit.create({
      data: {
        service: options.service,
        operation: options.operation,
        attempt,
        success,
        errorMessage: errorMessage ?? null,
        durationMs,
        backoffMs: backoffMs ?? null,
        idempotencyKey: options.idempotencyKey ?? null,
        tenantId: options.tenantId ?? null,
      },
    });
  }

  async getDegradedServices(): Promise<unknown[]> {
    return this.prisma.circuitBreakerState.findMany({
      where: { state: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getRetryStats(service?: string, hours = 24): Promise<RetryStats[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const audits = await this.prisma.retryAudit.findMany({
      where: {
        createdAt: { gte: since },
        ...(service ? { service } : {}),
      },
      select: { service: true, operation: true, success: true, durationMs: true },
    });

    const grouped = new Map<string, { total: number; succeeded: number; durations: number[] }>();
    for (const a of audits) {
      const key = `${a.service}:${a.operation}`;
      const entry = grouped.get(key) ?? { total: 0, succeeded: 0, durations: [] };
      entry.total++;
      if (a.success) entry.succeeded++;
      if (a.durationMs != null) entry.durations.push(a.durationMs);
      grouped.set(key, entry);
    }

    return Array.from(grouped.entries()).map(([key, data]) => {
      const [svc, op] = key.split(':');
      const avg =
        data.durations.length > 0
          ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
          : 0;
      return {
        service: svc,
        operation: op,
        total: data.total,
        succeeded: data.succeeded,
        failed: data.total - data.succeeded,
        successRate: data.total > 0 ? data.succeeded / data.total : 1,
        avgDurationMs: avg,
      };
    });
  }

  async testServiceHealth(service: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    // Lightweight DB round-trip as a generic connectivity test
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
