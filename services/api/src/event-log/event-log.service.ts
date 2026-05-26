import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EventLogQuery {
  entity?: string;
  event?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: EventLogQuery) {
    const {
      entity,
      event,
      actorId,
      from,
      to,
      limit = 50,
      offset = 0,
    } = query;

    const where: Record<string, unknown> = {};
    if (entity) where['entity'] = entity;
    if (event) where['event'] = { contains: event, mode: 'insensitive' };
    if (actorId) where['actorId'] = actorId;
    if (from || to) {
      where['createdAt'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return { data, total, limit, offset };
  }
}
