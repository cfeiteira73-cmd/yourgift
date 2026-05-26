import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export type StreamType =
  | 'order'
  | 'quote'
  | 'campaign'
  | 'employee_order'
  | 'budget'
  | 'approval';

export interface EventMetadata {
  actorId?: string;
  actorType?: 'client' | 'admin' | 'system' | 'employee';
  correlationId?: string;
  causationId?: string;
}

@Injectable()
export class EventSourcingService {
  private readonly logger = new Logger(EventSourcingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  /** Append an event to a stream — the ONLY way state changes are recorded */
  async append(
    streamId: string,
    streamType: StreamType,
    eventType: string,
    payload: Record<string, unknown>,
    metadata: EventMetadata = {},
  ): Promise<number> {
    const last = await this.prisma.procurementEvent.findFirst({
      where: { streamId },
      orderBy: { sequenceNum: 'desc' },
    });
    const sequenceNum = (last?.sequenceNum ?? 0) + 1;

    await this.prisma.procurementEvent.create({
      data: {
        streamId,
        streamType,
        eventType,
        sequenceNum,
        payload: payload as object,
        metadata: metadata as object,
      },
    });

    // Propagate to in-process event bus for real-time subscribers
    this.events.emit(eventType, {
      ...payload,
      _streamId: streamId,
      _seq: sequenceNum,
    });

    this.logger.debug(
      `Event appended: [${streamType}:${streamId}] ${eventType} seq=${sequenceNum}`,
    );
    return sequenceNum;
  }

  /** Replay all events for a stream from a given sequence number */
  async replay(streamId: string, fromSeq = 1) {
    return this.prisma.procurementEvent.findMany({
      where: { streamId, sequenceNum: { gte: fromSeq } },
      orderBy: { sequenceNum: 'asc' },
    });
  }

  /** Get full event stream for an entity */
  async getStream(streamId: string) {
    return this.prisma.procurementEvent.findMany({
      where: { streamId },
      orderBy: { sequenceNum: 'asc' },
    });
  }

  /** Derive current order state by replaying its event stream */
  async deriveOrderState(orderId: string): Promise<Record<string, unknown>> {
    const eventList = await this.replay(orderId);
    let state: Record<string, unknown> = {};

    for (const event of eventList) {
      const p = event.payload as Record<string, unknown>;
      switch (event.eventType) {
        case 'order.created':
          state = { ...p, status: 'created' };
          break;
        case 'order.status_changed':
          state = { ...state, status: p['newStatus'], updatedAt: event.appliedAt };
          break;
        case 'order.paid':
          state = { ...state, status: 'paid', paidAt: event.appliedAt };
          break;
        case 'order.shipped':
          state = {
            ...state,
            status: 'shipped',
            trackingNumber: p['trackingNumber'],
            shippedAt: event.appliedAt,
          };
          break;
        default:
          state = { ...state, ...p };
      }
    }

    return state;
  }

  /** Query events across all streams with optional filters */
  async queryEvents(filters: {
    streamType?: StreamType;
    eventType?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.streamType) where['streamType'] = filters.streamType;
    if (filters.eventType) where['eventType'] = { contains: filters.eventType };
    if (filters.from !== undefined || filters.to !== undefined) {
      const range: Record<string, Date> = {};
      if (filters.from) range['gte'] = filters.from;
      if (filters.to) range['lte'] = filters.to;
      where['appliedAt'] = range;
    }

    const [events, total] = await Promise.all([
      this.prisma.procurementEvent.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.procurementEvent.count({ where }),
    ]);

    return { events, total };
  }
}
