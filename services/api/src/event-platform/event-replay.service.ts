import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  /**
   * Replay all events for a stream from a given sequence number.
   * Used for projection rebuilds, consumer catch-up, debugging.
   */
  async replayStream(params: {
    streamId: string;
    fromSequence?: number;
    toSequence?: number;
    consumerGroup?: string;
  }): Promise<{ replayed: number; lastSequence: number }> {
    const events = await this.prisma.procurementEvent.findMany({
      where: {
        streamId: params.streamId,
        sequenceNum: {
          gte: params.fromSequence ?? 1,
          ...(params.toSequence ? { lte: params.toSequence } : {}),
        },
      },
      orderBy: { sequenceNum: 'asc' },
    });

    this.logger.log(
      `Replaying ${events.length} events for stream ${params.streamId} from seq=${params.fromSequence ?? 1}`,
    );

    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;
      this.events.emit(event.eventType, {
        ...payload,
        _streamId: event.streamId,
        _seq: event.sequenceNum,
        _replay: true,
        _consumerGroup: params.consumerGroup ?? 'replay',
      });
    }

    const lastEvent = events[events.length - 1];
    return { replayed: events.length, lastSequence: lastEvent?.sequenceNum ?? 0 };
  }

  /**
   * Replay events for a consumer group from its last committed offset.
   * Catches up a consumer that fell behind or crashed.
   */
  async replayForConsumerGroup(
    consumerGroup: string,
    streamType?: string,
  ): Promise<{ replayed: number }> {
    const offset = await this.prisma.eventConsumerOffset.findUnique({
      where: {
        consumerGroup_streamType: {
          consumerGroup,
          streamType: (streamType ?? null) as string,
        },
      },
    });

    const fromSeq = (offset?.lastSequenceNum ?? 0) + 1;

    const events = await this.prisma.procurementEvent.findMany({
      where: {
        sequenceNum: { gte: fromSeq },
        ...(streamType ? { streamType } : {}),
      },
      orderBy: { sequenceNum: 'asc' },
      take: 1000, // safety limit
    });

    this.logger.log(
      `Consumer group ${consumerGroup} catch-up: replaying ${events.length} events from seq=${fromSeq}`,
    );

    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;
      this.events.emit(event.eventType, {
        ...payload,
        _streamId: event.streamId,
        _seq: event.sequenceNum,
        _replay: true,
        _consumerGroup: consumerGroup,
      });
    }

    if (events.length > 0) {
      const lastSeq = events[events.length - 1]!.sequenceNum;
      await this.prisma.eventConsumerOffset.upsert({
        where: {
          consumerGroup_streamType: {
            consumerGroup,
            streamType: (streamType ?? null) as string,
          },
        },
        create: {
          consumerGroup,
          streamType: (streamType ?? null) as string,
          lastSequenceNum: lastSeq,
          lastProcessedAt: new Date(),
          eventsProcessed: events.length,
        },
        update: {
          lastSequenceNum: lastSeq,
          lastProcessedAt: new Date(),
          eventsProcessed: { increment: events.length },
        },
      });
    }

    return { replayed: events.length };
  }

  /**
   * Full system rebuild: replay all events across all streams.
   * WARNING: This is a heavy operation — use only for disaster recovery.
   */
  async fullSystemRebuild(
    dryRun = true,
  ): Promise<{ totalEvents: number; streams: number; dryRun: boolean }> {
    const [totalEvents, streamCount] = await Promise.all([
      this.prisma.procurementEvent.count(),
      this.prisma.procurementEvent
        .groupBy({ by: ['streamId'] })
        .then((r) => r.length),
    ]);

    if (!dryRun) {
      const events = await this.prisma.procurementEvent.findMany({
        orderBy: [{ streamId: 'asc' }, { sequenceNum: 'asc' }],
      });
      for (const event of events) {
        const payload = event.payload as Record<string, unknown>;
        this.events.emit(event.eventType, {
          ...payload,
          _streamId: event.streamId,
          _seq: event.sequenceNum,
          _fullRebuild: true,
        });
      }
      this.logger.warn(
        `Full system rebuild completed: ${events.length} events replayed across ${streamCount} streams`,
      );
    }

    return { totalEvents, streams: streamCount, dryRun };
  }

  async getEventStreamHealth() {
    const [totalEvents, totalStreams, latestEvent, oldestEvent] = await Promise.all([
      this.prisma.procurementEvent.count(),
      this.prisma.procurementEvent.groupBy({ by: ['streamId'] }).then((r) => r.length),
      this.prisma.procurementEvent.findFirst({ orderBy: { appliedAt: 'desc' } }),
      this.prisma.procurementEvent.findFirst({ orderBy: { appliedAt: 'asc' } }),
    ]);

    const byStreamType = await this.prisma.procurementEvent.groupBy({
      by: ['streamType'],
      _count: { id: true },
      _max: { sequenceNum: true },
    });

    return {
      totalEvents,
      totalStreams,
      latestEventAt: latestEvent?.appliedAt ?? null,
      oldestEventAt: oldestEvent?.appliedAt ?? null,
      byStreamType: byStreamType.map((s) => ({
        streamType: s.streamType,
        eventCount: s._count.id,
        maxSequence: s._max.sequenceNum,
      })),
    };
  }
}
