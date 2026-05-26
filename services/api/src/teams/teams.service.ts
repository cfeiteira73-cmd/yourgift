import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class TeamsService implements OnModuleInit {
  private readonly logger = new Logger(TeamsService.name);
  private webhookUrl: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventBusService,
  ) {
    this.webhookUrl = this.config.get<string>('TEAMS_WEBHOOK_URL');
  }

  onModuleInit() {
    if (!this.webhookUrl) {
      this.logger.warn('TEAMS_WEBHOOK_URL not set — Teams notifications disabled');
      return;
    }
    this.events.on('order.created', (order: any) => this.notifyOrderCreated(order));
    this.events.on('order.paid', (order: any) => this.notifyOrderPaid(order));
    this.events.on('approval.requested', (data: any) => this.notifyApprovalRequested(data));
  }

  private async send(card: object): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: card,
            },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(`Teams webhook error ${res.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error(`Teams notification failed: ${err}`);
    }
  }

  async notifyOrderCreated(order: any): Promise<void> {
    const adminUrl = this.config.get<string>('ADMIN_URL') ?? 'https://admin.yourgift.pt';
    await this.send({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '🛍️ Novo Pedido — YourGift',
          weight: 'Bolder',
          size: 'Medium',
          color: 'Accent',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Referência', value: order.ref ?? '-' },
            { title: 'Cliente', value: order.client?.name ?? order.clientId ?? '-' },
            { title: 'Total', value: `€${(order.totalAmount ?? 0).toFixed(2)}` },
            { title: 'Estado', value: order.status ?? 'criado' },
          ],
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Ver no Admin',
          url: `${adminUrl}/orders/${order.id}`,
        },
      ],
    });
  }

  async notifyOrderPaid(order: any): Promise<void> {
    await this.send({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `✅ Pagamento confirmado — Pedido **${order.ref}** · €${(order.totalAmount ?? 0).toFixed(2)}`,
          wrap: true,
          color: 'Good',
        },
      ],
    });
  }

  async notifyApprovalRequested(data: any): Promise<void> {
    await this.send({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `⏳ Aprovação necessária — ${data.stage ?? 'manager'} deve aprovar o pedido **${data.orderId ?? '-'}**`,
          wrap: true,
          color: 'Warning',
        },
      ],
    });
  }
}
