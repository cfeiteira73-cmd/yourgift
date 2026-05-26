import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class HubSpotService implements OnModuleInit {
  private readonly logger = new Logger(HubSpotService.name);
  private apiKey: string | undefined;
  private readonly baseUrl = 'https://api.hubapi.com';

  constructor(private config: ConfigService, private events: EventBusService) {
    this.apiKey = this.config.get<string>('HUBSPOT_API_KEY');
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn('HUBSPOT_API_KEY not set — HubSpot sync disabled');
      return;
    }
    this.events.on('order.created', (order: unknown) => this.syncOrderAsDeal(order));
    this.events.on('order.paid', (order: unknown) => this.updateDealStage(order, 'closedwon'));
    this.events.on('quote.requested', (quote: unknown) => this.syncQuoteAsDeal(quote));
  }

  private async hubspotFetch(path: string, method = 'GET', body?: object): Promise<unknown> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        this.logger.warn(`HubSpot ${method} ${path} → ${res.status}`);
        return null;
      }
      return res.json();
    } catch (err) {
      this.logger.error(`HubSpot error: ${err}`);
      return null;
    }
  }

  async syncOrderAsDeal(order: unknown): Promise<void> {
    const o = order as Record<string, unknown>;
    const client = o['client'] as Record<string, unknown> | undefined;
    const company = o['company'] as Record<string, unknown> | undefined;
    const contactEmail = client?.['email'] as string | undefined;
    if (!contactEmail) return;

    await this.hubspotFetch('/crm/v3/objects/contacts', 'POST', {
      properties: {
        email: contactEmail,
        firstname: (client?.['name'] as string | undefined)?.split(' ')[0] ?? '',
        lastname: (client?.['name'] as string | undefined)?.split(' ').slice(1).join(' ') ?? '',
        company: (company?.['name'] as string | undefined) ?? (client?.['company'] as string | undefined) ?? '',
      },
    });

    await this.hubspotFetch('/crm/v3/objects/deals', 'POST', {
      properties: {
        dealname: `YourGift — ${o['ref'] as string}`,
        amount: String(o['totalAmount'] ?? 0),
        pipeline: 'default',
        dealstage: 'presentationscheduled',
        closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }

  async syncQuoteAsDeal(quote: unknown): Promise<void> {
    const q = quote as Record<string, unknown>;
    const dealname = `YourGift Quote — ${q['ref'] as string ?? q['id'] as string}`;

    await this.hubspotFetch('/crm/v3/objects/deals', 'POST', {
      properties: {
        dealname,
        amount: String(q['budget'] ?? 0),
        pipeline: 'default',
        dealstage: 'appointmentscheduled',
        closedate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }

  async updateDealStage(order: unknown, stage: string): Promise<void> {
    const o = order as Record<string, unknown>;
    const search = await this.hubspotFetch('/crm/v3/objects/deals/search', 'POST', {
      filterGroups: [{
        filters: [{ propertyName: 'dealname', operator: 'EQ', value: `YourGift — ${o['ref'] as string}` }],
      }],
      properties: ['dealname', 'dealstage'],
      limit: 1,
    }) as Record<string, unknown> | null;

    const results = search?.['results'] as Array<Record<string, unknown>> | undefined;
    const dealId = results?.[0]?.['id'] as string | undefined;
    if (!dealId) return;

    await this.hubspotFetch(`/crm/v3/objects/deals/${dealId}`, 'PATCH', {
      properties: { dealstage: stage },
    });
  }
}
