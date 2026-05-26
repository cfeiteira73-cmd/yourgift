import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupportTicket } from '@prisma/client';

export interface CustomerOrderView {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
  tracking: {
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    lastEvent: string | null;
  };
  createdAt: Date;
}

export interface CustomerTimelineEntry {
  timestamp: Date;
  event: string;
  actor: string;
  description: string;
}

export interface CreateSupportTicketInput {
  orderId?: string;
  category: string;
  title: string;
  description: string;
}

export interface CreateRefundRequestInput {
  orderId: string;
  reason: string;
  amount?: number;
}

@Injectable()
export class CustomerPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyOrders(clientId: string): Promise<CustomerOrderView[]> {
    const orders = await this.prisma.order.findMany({
      where: { clientId, status: { not: 'cancelled' } },
      include: {
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const views: CustomerOrderView[] = await Promise.all(
      orders.map(async (order) => {
        const latestShipmentEvent = await this.prisma.shipmentEvent.findFirst({
          where: { orderId: order.id },
          orderBy: { occurredAt: 'desc' },
        });

        return {
          id: order.id,
          ref: order.ref,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
          tracking: {
            trackingNumber: order.trackingNumber,
            shippedAt: order.shippedAt,
            deliveredAt: order.deliveredAt,
            lastEvent: latestShipmentEvent?.event ?? null,
          },
          createdAt: order.createdAt,
        };
      }),
    );

    return views;
  }

  async getOrderTimeline(
    clientId: string,
    orderId: string,
  ): Promise<CustomerTimelineEntry[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.clientId !== clientId) {
      throw new ForbiddenException('Access denied to this order');
    }

    const [eventLogs, shipmentEvents, refunds] = await Promise.all([
      this.prisma.eventLog.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.shipmentEvent.findMany({
        where: { orderId },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.refund.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const entries: CustomerTimelineEntry[] = [];

    for (const e of eventLogs) {
      const payload = e.payload as Record<string, unknown> | null;
      entries.push({
        timestamp: e.createdAt,
        event: e.event,
        actor: (payload?.['actorType'] as string) ?? 'system',
        description: String(payload?.['description'] ?? e.event),
      });
    }

    for (const s of shipmentEvents) {
      const locationPart = s.location ? ` at ${s.location}` : '';
      entries.push({
        timestamp: s.occurredAt,
        event: `shipment.${s.event}`,
        actor: s.carrier ?? 'carrier',
        description:
          s.description ?? `Package ${s.event}${locationPart}`,
      });
    }

    for (const r of refunds) {
      entries.push({
        timestamp: r.createdAt,
        event: 'payment.refunded',
        actor: 'system',
        description: `Refund of €${Number(r.amount).toFixed(2)} processed`,
      });
    }

    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return entries;
  }

  async getMyShipments(clientId: string): Promise<
    {
      orderId: string;
      orderRef: string;
      trackingNumber: string | null;
      carrier: string | null;
      status: string;
      shippedAt: Date;
      deliveredAt: Date | null;
    }[]
  > {
    const orders = await this.prisma.order.findMany({
      where: { clientId, shippedAt: { not: null } },
      select: {
        id: true,
        ref: true,
        trackingNumber: true,
        supplier: true,
        shippedAt: true,
        deliveredAt: true,
        status: true,
      },
      orderBy: { shippedAt: 'desc' },
      take: 20,
    });

    const results = await Promise.all(
      orders.map(async (order) => {
        const lastShipmentEvent = await this.prisma.shipmentEvent.findFirst({
          where: { orderId: order.id },
          orderBy: { occurredAt: 'desc' },
        });

        return {
          orderId: order.id,
          orderRef: order.ref,
          trackingNumber: order.trackingNumber,
          carrier: lastShipmentEvent?.carrier ?? null,
          status: order.status,
          shippedAt: order.shippedAt as Date,
          deliveredAt: order.deliveredAt,
        };
      }),
    );

    return results;
  }

  async createSupportTicket(
    clientId: string,
    input: CreateSupportTicketInput,
  ): Promise<SupportTicket> {
    if (input.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: input.orderId },
      });
      if (!order) {
        throw new NotFoundException(`Order ${input.orderId} not found`);
      }
      if (order.clientId !== clientId) {
        throw new ForbiddenException('Access denied to this order');
      }
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId: input.orderId ?? null,
        category: input.category,
        title: input.title,
        description: input.description,
        status: 'open',
        escalationLevel: 'L1',
      },
    });

    return ticket;
  }

  async createRefundRequest(
    clientId: string,
    input: CreateRefundRequestInput,
  ): Promise<SupportTicket> {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (order.clientId !== clientId) {
      throw new ForbiddenException('Access denied to this order');
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId: input.orderId,
        category: 'refund_request',
        title: `Refund request for order ${order.ref}`,
        description: input.reason,
        status: 'open',
        escalationLevel: 'L1',
        metadata: {
          requestedAmount: input.amount ?? null,
        },
      },
    });

    return ticket;
  }
}
