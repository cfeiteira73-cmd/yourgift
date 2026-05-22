import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import * as crypto from 'crypto';

const WEBHOOK_EVENTS = [
  'order.created',
  'order.paid',
  'order.approved',
  'order.shipped',
  'order.delivered',
  'quote.created',
  'quote.approved',
  'approval.requested',
  'approval.resolved',
  'campaign.created',
  'inventory.low',
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface CreateEndpointDto {
  url: string;
  events: string[];
  description?: string;
  companyId?: string;
}

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit(): void {
    for (const event of WEBHOOK_EVENTS) {
      this.events.on(event, (payload: unknown) =>
        void this.deliverEvent(event, payload),
      );
    }
  }

  // ── Signing ────────────────────────────────────────────────────────────────

  private sign(secret: string, body: string): string {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  // ── Delivery ───────────────────────────────────────────────────────────────

  private async deliverEvent(
    event: WebhookEvent,
    payload: unknown,
  ): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: event } },
    });

    await Promise.allSettled(
      endpoints.map((ep) => this.sendToEndpoint(ep, event, payload)),
    );
  }

  private async sendToEndpoint(
    endpoint: { id: string; url: string; secret: string },
    event: string,
    payload: unknown,
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
    const signature = this.sign(endpoint.secret, body);

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-YourGift-Signature': signature,
          'X-YourGift-Event': event,
          'User-Agent': 'YourGift-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 500);
      success = res.ok;
    } catch (err) {
      responseBody =
        err instanceof Error ? err.message : String(err);
    }

    await this.prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload:
          typeof payload === 'object' && payload !== null
            ? (payload as object)
            : { data: payload },
        statusCode,
        responseBody,
        success,
        attempts: 1,
        deliveredAt: success ? new Date() : undefined,
      },
    });

    if (success) {
      this.logger.log(`Webhook delivered: ${event} → ${endpoint.url}`);
    } else {
      this.logger.warn(
        `Webhook failed: ${event} → ${endpoint.url} (${statusCode ?? 'network error'})`,
      );
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async createEndpoint(data: CreateEndpointDto) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhookEndpoint.create({
      data: {
        url: data.url,
        events: data.events,
        description: data.description,
        companyId: data.companyId,
        secret,
      },
    });
  }

  async listEndpoints(companyId?: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: companyId ? { companyId } : undefined,
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEndpoint(id: string) {
    return this.prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { _count: { select: { deliveries: true } } },
    });
  }

  async deleteEndpoint(id: string) {
    return this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async toggleEndpoint(id: string, isActive: boolean) {
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: { isActive },
    });
  }

  async getDeliveries(endpointId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static readonly AVAILABLE_EVENTS = WEBHOOK_EVENTS;
}
