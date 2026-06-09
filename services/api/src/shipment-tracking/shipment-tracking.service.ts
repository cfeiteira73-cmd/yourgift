import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma, ShipmentEvent } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

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
  private readonly logger = new Logger(ShipmentTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
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
      // Notify client via email (non-blocking)
      void this.sendTrackingEmail(input.orderId, input).catch(err =>
        this.logger.warn(`Tracking email failed for order ${input.orderId}: ${err}`),
      );
    }

    if (input.event === 'delivered') {
      await this.prisma.order.update({
        where: { id: input.orderId },
        data: {
          deliveredAt: occurredAt,
          status: 'delivered',
        },
      });
      // Notify client via delivery email (non-blocking)
      void this.sendDeliveredEmail(input.orderId).catch(err =>
        this.logger.warn(`Delivered email failed for order ${input.orderId}: ${err}`),
      );
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

  // ── Email helpers ────────────────────────────────────────────────────────────

  private async sendTrackingEmail(orderId: string, input: ShipmentEventInput): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: { select: { name: true, email: true } } },
    });
    if (!order || !(order as any).client?.email) return;

    const webUrl = this.config.get<string>('APP_URL') ?? 'https://www.yourgift.pt';
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (!resendKey) return;

    const client = (order as any).client;
    const body = {
      clientName:     client.name ?? 'Cliente',
      orderRef:       (order as any).ref ?? orderId,
      trackingNumber: input.trackingNumber ?? '—',
      carrier:        input.carrier ?? 'Transportadora',
      trackingUrl:    input.metadata?.trackingUrl as string | undefined,
      estimatedDelivery: input.metadata?.estimatedDelivery as string | undefined,
    };

    // Build inline email HTML (mirrors apps/web/src/lib/email.ts trackingEmail)
    const subject = `Encomenda expedida — ${body.orderRef} | YourGift`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="background:#090907;font-family:'Helvetica Neue',sans-serif;color:#f0ece4;padding:32px">
<h2 style="font-size:22px;font-weight:400;color:#f0ece4">${body.clientName}, a tua encomenda está a caminho.</h2>
<p>Expedida por <strong>${body.carrier}</strong>. Rastreio: <strong style="font-family:monospace;color:#d4b47a">${body.trackingNumber}</strong></p>
${body.trackingUrl ? `<p><a href="${body.trackingUrl}" style="color:#d4b47a">Rastrear encomenda →</a></p>` : ''}
<p><a href="${webUrl}/client-portal" style="color:#b8975e">Ver portal →</a></p>
<p style="font-size:11px;color:rgba(240,236,228,0.3)">© ${new Date().getFullYear()} YourGift · yourgift.pt</p>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'YourGift <noreply@yourgift.pt>',
        to: [client.email],
        subject,
        html,
        reply_to: 'geral@yourgift.pt',
      }),
    });
  }

  private async sendDeliveredEmail(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: { select: { name: true, email: true } } },
    });
    if (!order || !(order as any).client?.email) return;

    const webUrl = this.config.get<string>('APP_URL') ?? 'https://www.yourgift.pt';
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (!resendKey) return;

    const client = (order as any).client;
    const ref = (order as any).ref ?? orderId;
    const subject = `Entregue com sucesso — ${ref} | YourGift`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="background:#090907;font-family:'Helvetica Neue',sans-serif;color:#f0ece4;padding:32px">
<h2 style="font-size:22px;font-weight:400;color:#f0ece4">${client.name ?? 'Cliente'}, chegou.</h2>
<p>A tua encomenda <strong style="color:#d4b47a">${ref}</strong> foi entregue com sucesso.</p>
<p><a href="${webUrl}/client-portal" style="display:inline-block;background:#b8975e;color:#090907;padding:12px 24px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase">Ver Portal →</a></p>
<p style="font-size:11px;color:rgba(240,236,228,0.3)">© ${new Date().getFullYear()} YourGift · yourgift.pt</p>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'YourGift <noreply@yourgift.pt>',
        to: [client.email],
        subject,
        html,
        reply_to: 'geral@yourgift.pt',
      }),
    });
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
