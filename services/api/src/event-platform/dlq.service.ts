import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export type FailureCategory = 'transient' | 'permanent' | 'schema_mismatch' | 'timeout' | 'unknown';

@Injectable()
export class DLQService {
  private readonly logger = new Logger(DLQService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async enqueue(params: {
    streamId: string;
    streamType: string;
    eventType: string;
    eventId: string;
    payload: Record<string, unknown>;
    failureReason: string;
    failureCategory?: FailureCategory;
    consumerGroup?: string;
    attemptCount?: number;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const entry = await this.prisma.eventDLQ.create({
      data: {
        streamId: params.streamId,
        streamType: params.streamType,
        eventType: params.eventType,
        eventId: params.eventId,
        payload: params.payload as object,
        failureReason: params.failureReason,
        failureCategory: params.failureCategory ?? 'unknown',
        consumerGroup: params.consumerGroup ?? 'default',
        attemptCount: params.attemptCount ?? 1,
        metadata: (params.metadata ?? {}) as object,
      },
    });

    this.logger.warn(`DLQ: event ${params.eventType} [${params.eventId}] enqueued — ${params.failureReason}`);
    this.events.emit('dlq.event_enqueued', { dlqId: entry.id, eventType: params.eventType, category: params.failureCategory });
    return entry.id;
  }

  async replay(dlqId: string, replayedBy = 'system'): Promise<void> {
    const entry = await this.prisma.eventDLQ.findUniqueOrThrow({ where: { id: dlqId } });

    if (entry.status === 'resolved') {
      throw new Error(`DLQ entry ${dlqId} is already resolved`);
    }

    await this.prisma.eventDLQ.update({
      where: { id: dlqId },
      data: { status: 'replaying', replayedBy },
    });

    try {
      // Re-emit the event on the bus for consumers to pick up
      const payload = entry.payload as Record<string, unknown>;
      this.events.emit(entry.eventType, { ...payload, _dlqReplay: true, _dlqId: dlqId });

      await this.prisma.eventDLQ.update({
        where: { id: dlqId },
        data: { status: 'resolved', replayedAt: new Date() },
      });
      this.logger.log(`DLQ: replayed event ${entry.eventType} [${dlqId}]`);
    } catch (err) {
      await this.prisma.eventDLQ.update({
        where: { id: dlqId },
        data: {
          status: 'failed',
          attemptCount: { increment: 1 },
          lastFailedAt: new Date(),
          failureReason: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  async replayBatch(
    filters: { consumerGroup?: string; eventType?: string; limit?: number },
    replayedBy = 'system',
  ): Promise<{ replayed: number; failed: number }> {
    const entries = await this.prisma.eventDLQ.findMany({
      where: {
        status: 'failed',
        ...(filters.consumerGroup ? { consumerGroup: filters.consumerGroup } : {}),
        ...(filters.eventType ? { eventType: filters.eventType } : {}),
      },
      take: filters.limit ?? 10,
      orderBy: { firstFailedAt: 'asc' },
    });

    let replayed = 0;
    let failed = 0;
    for (const entry of entries) {
      try {
        await this.replay(entry.id, replayedBy);
        replayed++;
      } catch {
        failed++;
      }
    }
    return { replayed, failed };
  }

  async discard(dlqId: string): Promise<void> {
    await this.prisma.eventDLQ.update({ where: { id: dlqId }, data: { status: 'discarded' } });
    this.logger.warn(`DLQ: entry ${dlqId} discarded`);
  }

  async getStats() {
    const [total, byStatus, byCategory, byConsumerGroup] = await Promise.all([
      this.prisma.eventDLQ.count(),
      this.prisma.eventDLQ.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.eventDLQ.groupBy({ by: ['failureCategory'], _count: { id: true } }),
      this.prisma.eventDLQ.groupBy({ by: ['consumerGroup'], _count: { id: true } }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      byCategory: Object.fromEntries(byCategory.map((c) => [c.failureCategory, c._count.id])),
      byConsumerGroup: Object.fromEntries(byConsumerGroup.map((g) => [g.consumerGroup, g._count.id])),
    };
  }

  async list(filters: { status?: string; consumerGroup?: string; limit?: number }) {
    return this.prisma.eventDLQ.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.consumerGroup ? { consumerGroup: filters.consumerGroup } : {}),
      },
      orderBy: { lastFailedAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }
}
