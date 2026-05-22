import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export type JobType = 'order.fulfill' | 'artwork.process' | 'notification.send' | 'product.sync';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit(): void {
    // Poll every 10 seconds for pending jobs
    this.timer = setInterval(() => void this.processNext(), 10_000);
    this.logger.log('Job queue started (10s polling, SKIP LOCKED)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(
    type: JobType,
    payload: Record<string, unknown>,
    scheduledAt?: Date,
  ): Promise<string> {
    const job = await this.prisma.job.create({
      data: { type, payload, scheduledAt: scheduledAt ?? new Date() },
    });
    this.logger.log(`Job enqueued: ${type} [${job.id}]`);
    return job.id;
  }

  /**
   * Idempotent enqueue — if a job with the same type + idempotencyKey already
   * exists in pending/processing/completed state, return its id without creating
   * a duplicate. Failed jobs are re-queued.
   */
  async enqueueIdempotent(
    type: JobType,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    scheduledAt?: Date,
  ): Promise<string | null> {
    const existing = await this.prisma.job.findFirst({
      where: {
        type,
        status: { in: ['pending', 'processing', 'completed'] },
        payload: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
    });
    if (existing) return existing.id;
    return this.enqueue(type, { ...payload, idempotencyKey }, scheduledAt);
  }

  private async processNext(): Promise<void> {
    // Use SKIP LOCKED for concurrent worker safety — PostgreSQL feature.
    // Multiple API instances can poll simultaneously without claiming the same job.
    const jobs = await this.prisma.$queryRaw<Array<{
      id: string;
      type: string;
      payload: string;
      attempts: number;
    }>>`
      UPDATE jobs
      SET status = 'processing', started_at = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM jobs
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
          AND attempts < max_attempts
        ORDER BY scheduled_at ASC
        LIMIT 5
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, type, payload::text, attempts
    `;

    if (!jobs.length) return;

    await Promise.allSettled(
      jobs.map(async (job) => {
        try {
          const payload =
            typeof job.payload === 'string'
              ? (JSON.parse(job.payload) as Record<string, unknown>)
              : (job.payload as Record<string, unknown>);

          await this.executeJob(job.type as JobType, payload);

          await this.prisma.$executeRaw`
            UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = ${job.id}::uuid
          `;
          this.logger.log(`✓ Job completed: ${job.type} [${job.id}]`);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          const isLastAttempt = job.attempts >= 3;
          const retryDelay = job.attempts * 60; // seconds

          if (isLastAttempt) {
            await this.prisma.$executeRaw`
              UPDATE jobs SET status = 'failed', error = ${error} WHERE id = ${job.id}::uuid
            `;
            this.logger.error(`✗ Job failed (dead-letter): ${job.type} [${job.id}]`);
          } else {
            await this.prisma.$executeRaw`
              UPDATE jobs SET status = 'pending', error = ${error},
                scheduled_at = NOW() + (${retryDelay} || ' seconds')::interval
              WHERE id = ${job.id}::uuid
            `;
            this.logger.warn(`↻ Job retry ${job.attempts}/3: ${job.type} [${job.id}]`);
          }
        }
      }),
    );
  }

  private async executeJob(
    type: JobType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.events.emit(`job.${type}`, payload);
  }

  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.job.count({ where: { status: 'pending' } }),
      this.prisma.job.count({ where: { status: 'processing' } }),
      this.prisma.job.count({ where: { status: 'completed' } }),
      this.prisma.job.count({ where: { status: 'failed' } }),
    ]);
    return { pending, processing, completed, failed };
  }

  async getRecentJobs(limit = 50) {
    return this.prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
