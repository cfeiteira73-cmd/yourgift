import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class NotionService implements OnModuleInit {
  private readonly logger = new Logger(NotionService.name);
  private token: string | undefined;
  private databaseId: string | undefined;
  private readonly baseUrl = 'https://api.notion.com/v1';
  private readonly notionVersion = '2022-06-28';

  constructor(private config: ConfigService, private events: EventBusService) {
    this.token = this.config.get<string>('NOTION_API_KEY');
    this.databaseId = this.config.get<string>('NOTION_ORDERS_DB_ID');
  }

  onModuleInit() {
    if (!this.token || !this.databaseId) {
      this.logger.warn('NOTION_API_KEY or NOTION_ORDERS_DB_ID not set — Notion sync disabled');
      return;
    }
    this.events.on('order.created', (order: unknown) => this.createOrderPage(order));
    this.events.on('order.paid', (order: unknown) => this.updateOrderStatus(order, 'Pago'));
    this.events.on('order.shipped', (order: unknown) => this.updateOrderStatus(order, 'Expedido'));
    this.events.on('order.delivered', (order: unknown) => this.updateOrderStatus(order, 'Entregue'));
    this.events.on('quote.requested', (quote: unknown) => this.createQuotePage(quote));
  }

  private async notionFetch(path: string, method = 'GET', body?: object): Promise<unknown> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        this.logger.warn(`Notion ${method} ${path} → ${res.status}`);
        return null;
      }
      return res.json();
    } catch (err) {
      this.logger.error(`Notion error: ${err}`);
      return null;
    }
  }

  async createOrderPage(order: unknown): Promise<void> {
    const o = order as Record<string, unknown>;
    const client = o['client'] as Record<string, unknown> | undefined;

    await this.notionFetch('/pages', 'POST', {
      parent: { database_id: this.databaseId },
      properties: {
        'Nome': { title: [{ text: { content: (o['ref'] as string | undefined) ?? '' } }] },
        'Cliente': { rich_text: [{ text: { content: (client?.['name'] as string | undefined) ?? '' } }] },
        'Estado': { select: { name: 'Criado' } },
        'Total': { number: (o['totalAmount'] as number | undefined) ?? 0 },
        'Data': { date: { start: new Date().toISOString().split('T')[0] } },
        'ID': { rich_text: [{ text: { content: (o['id'] as string | undefined) ?? '' } }] },
      },
    });
  }

  async createQuotePage(quote: unknown): Promise<void> {
    const q = quote as Record<string, unknown>;

    await this.notionFetch('/pages', 'POST', {
      parent: { database_id: this.databaseId },
      properties: {
        'Nome': { title: [{ text: { content: (q['ref'] as string | undefined) ?? (q['id'] as string | undefined) ?? 'Pedido s/ref' } }] },
        'Cliente': { rich_text: [{ text: { content: (q['name'] as string | undefined) ?? '' } }] },
        'Estado': { select: { name: 'Proposta Recebida' } },
        'Total': { number: (q['budget'] as number | undefined) ?? 0 },
        'Data': { date: { start: new Date().toISOString().split('T')[0] } },
        'ID': { rich_text: [{ text: { content: (q['id'] as string | undefined) ?? '' } }] },
      },
    });
  }

  async updateOrderStatus(order: unknown, status: string): Promise<void> {
    const o = order as Record<string, unknown>;
    const ref = o['ref'] as string | undefined;
    if (!ref) return;

    const search = await this.notionFetch(
      '/databases/' + this.databaseId + '/query',
      'POST',
      { filter: { property: 'Nome', title: { equals: ref } } },
    ) as Record<string, unknown> | null;

    const results = search?.['results'] as Array<Record<string, unknown>> | undefined;
    const pageId = results?.[0]?.['id'] as string | undefined;
    if (!pageId) return;

    await this.notionFetch(`/pages/${pageId}`, 'PATCH', {
      properties: { 'Estado': { select: { name: status } } },
    });
  }
}
