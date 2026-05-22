import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerGroup(consumerGroup: string, streamType?: string): Promise<void> {
    await this.prisma.eventConsumerOffset.upsert({
      where: {
        consumerGroup_streamType: {
          consumerGroup,
          streamType: (streamType ?? null) as string,
        },
      },
      create: { consumerGroup, streamType: streamType ?? null, isActive: true },
      update: { isActive: true },
    });
    this.logger.log(`Consumer group registered: ${consumerGroup} (stream: ${streamType ?? 'all'})`);
  }

  async advanceOffset(
    consumerGroup: string,
    sequenceNum: number,
    eventId: string,
    streamType?: string,
  ): Promise<void> {
    await this.prisma.eventConsumerOffset.upsert({
      where: {
        consumerGroup_streamType: {
          consumerGroup,
          streamType: (streamType ?? null) as string,
        },
      },
      create: {
        consumerGroup,
        streamType: streamType ?? null,
        lastSequenceNum: sequenceNum,
        lastEventId: eventId,
        lastProcessedAt: new Date(),
        eventsProcessed: 1,
      },
      update: {
        lastSequenceNum: sequenceNum,
        lastEventId: eventId,
        lastProcessedAt: new Date(),
        eventsProcessed: { increment: 1 },
      },
    });
  }

  async recordError(consumerGroup: string, streamType?: string): Promise<void> {
    await this.prisma.eventConsumerOffset.updateMany({
      where: { consumerGroup, streamType: streamType ?? null },
      data: { errors: { increment: 1 } },
    });
  }

  async getOffset(consumerGroup: string, streamType?: string) {
    return this.prisma.eventConsumerOffset.findUnique({
      where: {
        consumerGroup_streamType: {
          consumerGroup,
          streamType: (streamType ?? null) as string,
        },
      },
    });
  }

  async getAllOffsets() {
    return this.prisma.eventConsumerOffset.findMany({
      where: { isActive: true },
      orderBy: { consumerGroup: 'asc' },
    });
  }

  /** Check if an event has already been processed (exactly-once guarantee) */
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    const key = await this.prisma.eventIdempotencyKey.findUnique({
      where: { idempotencyKey },
    });
    return key !== null && new Date() < key.expiresAt;
  }

  /** Mark an event as processed with its result */
  async markProcessed(params: {
    idempotencyKey: string;
    consumerGroup: string;
    eventType: string;
    streamId: string;
    sequenceNum: number;
    result?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.eventIdempotencyKey.upsert({
      where: { idempotencyKey: params.idempotencyKey },
      create: {
        idempotencyKey: params.idempotencyKey,
        consumerGroup: params.consumerGroup,
        eventType: params.eventType,
        streamId: params.streamId,
        sequenceNum: params.sequenceNum,
        result: (params.result ?? {}) as object,
      },
      update: { result: (params.result ?? {}) as object },
    });
  }

  async getConsumerLag(consumerGroup: string, streamType?: string): Promise<number> {
    const offset = await this.getOffset(consumerGroup, streamType);
    const lastSeq = await this.prisma.procurementEvent.findFirst({
      where: streamType ? { streamType } : {},
      orderBy: { sequenceNum: 'desc' },
    });
    const currentMax = lastSeq?.sequenceNum ?? 0;
    const committed = offset?.lastSequenceNum ?? 0;
    return Math.max(0, currentMax - committed);
  }
}
