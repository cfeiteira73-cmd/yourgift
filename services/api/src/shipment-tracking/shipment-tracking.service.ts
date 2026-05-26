import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma, ShipmentEvent } from '@prisma/client';

export interface ShipmentEventInput {
  orderId: string;
  event: string;
  carrier?: string;
  trackingNumber?: string;
  location?: string;
  description?: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ActiveShipmentSummary {
  orderId: string;
  orderRef: string;
  clientId: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date;
  daysInTransit: number;
  isDelayed: boolean;
  lastEvent: ShipmentEvent | null;
}

@Injectable()
export class ShipmentTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async recordEvent(input: ShipmentEventInput): Promise<ShipmentEvent> {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }

    const occurredAt = input.occurredAt ?? new Date();

    const shipmentEvent = await this.prisma.shipmentEvent.create({
      data: {
        orderId: input.orderId,
        event: input.event,
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
        occurredAt,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        recordedAt: new Date(),
      },
    });

    if (input.event === 'dispatched') {
      await this.prisma.order.update({
        where: { id: input.orderId },
        data: {
          shippedAt: occurredAt,
          ...(input.trackingNumber
            ? { trackingNumber: input.trackingNumber }
            : {}),
        },
      });
    }

    if (input.event === 'delivered') {
      await this.prisma.order.update({
        where: { id: input.orderId },
        data: {
          deliveredAt: occurredAt,
          status: 'delivered',
        },
      });
    }

    if (input.event === 'failed_delivery') {
      await this.prisma.eventLog.create({
        data: {
          orderId: input.orderId,
          entity: 'shipment',
          entityId: shipmentEvent.id,
          event: 'shipment.failed_delivery',
          payload: {
            orderId: input.orderId,
            trackingNumber: input.trackingNumber ?? null,
            location: input.location ?? null,
          },
        },
      });
    }

    this.eventBus.emit('shipment.event.recorded', {
      orderId: input.orderId,
      event: input.event,
      trackingNumber: input.trackingNumber ?? null,
    });

    return shipmentEvent;
  }

  async getTimeline(orderId: string): Promise<{
    order: {
      id: string;
      ref: string;
      status: string;
      trackingNumber: string | null;
      shippedAt: Date | null;
      deliveredAt: Date | null;
    };
    events: ShipmentEvent[];
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        ref: true,
        status: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const events = await this.prisma.shipmentEvent.findMany({
      where: { orderId },
      orderBy: { occurredAt: 'asc' },
    });

    return { order, events };
  }

  async getActiveShipments(): Promise<ActiveShipmentSummary[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        shippedAt: { not: null },
        deliveredAt: null,
        status: { notIn: ['cancelled', 'delivered'] },
      },
      select: {
        id: true,
        ref: true,
        clientId: true,
        trackingNumber: true,
        supplier: true,
        shippedAt: true,
        totalAmount: true,
      },
      orderBy: { shippedAt: 'asc' },
      take: 100,
    });

    const summaries: ActiveShipmentSummary[] = await Promise.all(
      orders.map(async (order) => {
        const lastEvent = await this.prisma.shipmentEvent.findFirst({
          where: { orderId: order.id },
          orderBy: { occurredAt: 'desc' },
        });

        const shippedAt = order.shippedAt as Date;
        const daysInTransit = Math.floor(
          (Date.now() - shippedAt.getTime()) / 86400000,
        );
        const isDelayed = daysInTransit > 7;

        return {
          orderId: order.id,
          orderRef: order.ref,
          clientId: order.clientId,
          trackingNumber: order.trackingNumber,
          carrier: lastEvent?.carrier ?? null,
          shippedAt,
          daysInTransit,
          isDelayed,
          lastEvent,
        };
      }),
    );

    return summaries;
  }

  async getDelayedShipments(): Promise<ActiveShipmentSummary[]> {
    const all = await this.getActiveShipments();
    return all.filter((s) => s.isDelayed);
  }

  async recordDelivery(
    orderId: string,
    carrier?: string,
    trackingNumber?: string,
  ): Promise<ShipmentEvent> {
    return this.recordEvent({
      orderId,
      event: 'delivered',
      carrier,
      trackingNumber,
      occurredAt: new Date(),
      description: 'Marked delivered by operator',
    });
  }
}
