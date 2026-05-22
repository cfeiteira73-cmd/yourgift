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
    this.logger.log('Job queue started (10s polling)');
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

  private async processNext(): Promise<void> {
    const jobs = await this.prisma.job.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    for (const job of jobs) {
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'processing',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      try {
        await this.executeJob(job.type as JobType, job.payload as Record<string, unknown>);
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: 'completed', completedAt: new Date() },
        });
        this.logger.log(`Job completed: ${job.type} [${job.id}]`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const isLastAttempt = job.attempts + 1 >= 3;
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: isLastAttempt ? 'failed' : 'pending',
            error,
            ...(isLastAttempt
              ? {}
              : {
                  scheduledAt: new Date(Date.now() + 60_000 * (job.attempts + 1)),
                }),
          },
        });
        this.logger.error(`Job failed: ${job.type} [${job.id}] — ${error}`);
      }
    }
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
