import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface CreateTicketInput {
  clientId: string;
  orderId?: string;
  category: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TicketStats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byEscalationLevel: Record<string, number>;
  avgResolutionHours: number | null;
  openCount: number;
  escalatedCount: number;
}

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async createTicket(input: CreateTicketInput) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId: input.clientId,
        orderId: input.orderId ?? null,
        category: input.category,
        title: input.title,
        description: input.description,
        status: 'open',
        escalationLevel: 'L1',
        metadata: (input.metadata ?? {}) as object,
      },
    });

    this.events.emit('support.ticket.created', {
      ticketId: ticket.id,
      clientId: ticket.clientId,
      category: ticket.category,
    });

    this.logger.log(`Ticket created: ${ticket.id} [${ticket.category}]`);
    return ticket;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async getTickets(filters: {
    status?: string;
    category?: string;
    escalationLevel?: string;
    limit?: number;
  }) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.escalationLevel
          ? { escalationLevel: filters.escalationLevel }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────

  async getTicketById(ticketId: string) {
    return this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
  }

  // ── Assign ────────────────────────────────────────────────────────────────

  async assignTicket(ticketId: string, assignedTo: string) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'in_progress', assignedTo },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'support_ticket',
        entityId: ticketId,
        event: 'ticket.assigned',
        actorType: 'admin',
        payload: { assignedTo } as object,
      },
    });

    this.events.emit('support.ticket.assigned', { ticketId, assignedTo });

    this.logger.log(`Ticket ${ticketId} assigned to ${assignedTo}`);
    return ticket;
  }

  // ── Escalate ──────────────────────────────────────────────────────────────

  async escalateTicket(ticketId: string, toLevel: 'L2' | 'L3', reason: string) {
    const existing = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'escalated',
        escalationLevel: toLevel,
        metadata: {
          ...(existing.metadata as Record<string, unknown>),
          escalationReason: reason,
          escalatedAt: new Date().toISOString(),
        } as object,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'support_ticket',
        entityId: ticketId,
        event: 'ticket.escalated',
        actorType: 'admin',
        payload: {
          from: existing.escalationLevel,
          to: toLevel,
          reason,
        } as object,
      },
    });

    this.events.emit('support.ticket.escalated', { ticketId, toLevel, reason });

    this.logger.log(`Ticket ${ticketId} escalated to ${toLevel}: ${reason}`);
    return ticket;
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  async resolveTicket(ticketId: string, resolutionNotes: string) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionNotes,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'support_ticket',
        entityId: ticketId,
        event: 'ticket.resolved',
        actorType: 'system',
        payload: { resolutionNotes } as object,
      },
    });

    this.events.emit('support.ticket.resolved', { ticketId, resolutionNotes });

    this.logger.log(`Ticket ${ticketId} resolved`);
    return ticket;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<TicketStats> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [byStatusRaw, byCategoryRaw, byEscalationRaw, avgResult] =
      await Promise.all([
        this.prisma.supportTicket.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.supportTicket.groupBy({
          by: ['category'],
          _count: { id: true },
        }),
        this.prisma.supportTicket.groupBy({
          by: ['escalationLevel'],
          _count: { id: true },
        }),
        this.prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::float AS avg_hours
          FROM support_tickets
          WHERE resolved_at IS NOT NULL
            AND created_at >= ${thirtyDaysAgo}
        `,
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count.id;
    }

    const byCategory: Record<string, number> = {};
    for (const row of byCategoryRaw) {
      byCategory[row.category] = row._count.id;
    }

    const byEscalationLevel: Record<string, number> = {};
    for (const row of byEscalationRaw) {
      byEscalationLevel[row.escalationLevel] = row._count.id;
    }

    const avgResolutionHours =
      avgResult[0]?.avg_hours != null ? Number(avgResult[0].avg_hours) : null;

    return {
      byStatus,
      byCategory,
      byEscalationLevel,
      avgResolutionHours,
      openCount: byStatus['open'] ?? 0,
      escalatedCount: byStatus['escalated'] ?? 0,
    };
  }

  // ── Auto-Triage ───────────────────────────────────────────────────────────

  async autoTriageTicket(
    ticketId: string,
  ): Promise<{ action: string; detail: string }> {
    const ticket = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });

    if (ticket.category === 'payment_issue') {
      if (ticket.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: ticket.orderId },
        });
        if (order && order.stripePaymentId) {
          await this.resolveTicket(ticketId, 'Payment confirmed in system');
          return { action: 'resolved', detail: 'Payment confirmed in system' };
        }
      }
      await this.escalateTicket(ticketId, 'L2', 'Payment not confirmed in system');
      return { action: 'escalated', detail: 'Payment not confirmed in system' };
    }

    if (ticket.category === 'shipping_delay') {
      if (ticket.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: ticket.orderId },
        });
        if (order?.shippedAt && !order.deliveredAt) {
          const daysSinceShipped =
            (Date.now() - new Date(order.shippedAt).getTime()) / 86400000;
          if (daysSinceShipped > 10) {
            await this.escalateTicket(
              ticketId,
              'L2',
              'Shipment delay confirmed',
            );
            return {
              action: 'escalated',
              detail: 'Shipment delay confirmed',
            };
          }
        }
      }
      const detail = 'Package is within normal delivery window';
      await this.resolveTicket(ticketId, detail);
      return { action: 'resolved', detail };
    }

    if (ticket.category === 'refund_request') {
      await this.escalateTicket(
        ticketId,
        'L2',
        'Refund requires human review',
      );
      return {
        action: 'escalated',
        detail: 'Refund requires human review',
      };
    }

    if (ticket.category === 'production_issue') {
      if (ticket.orderId) {
        const job = await this.prisma.productionJob.findFirst({
          where: { orderId: ticket.orderId, status: 'failed' },
        });
        if (job) {
          await this.escalateTicket(ticketId, 'L2', 'Production job failed');
          return { action: 'escalated', detail: 'Production job failed' };
        }
      }
      const detail = 'Production is on track';
      await this.resolveTicket(ticketId, detail);
      return { action: 'resolved', detail };
    }

    // Default
    await this.escalateTicket(ticketId, 'L2', 'Manual review required');
    return { action: 'escalated', detail: 'Manual review required' };
  }
}
