import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class SlackService implements OnModuleInit {
  private readonly logger = new Logger(SlackService.name);
  private webhookUrl: string | undefined;

  constructor(
    private config: ConfigService,
    private events: EventBusService,
  ) {
    this.webhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');
  }

  onModuleInit() {
    if (!this.webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not set — Slack notifications disabled');
      return;
    }
    this.events.on('order.created', (order: any) => this.notifyOrderCreated(order));
    this.events.on('order.paid', (order: any) => this.notifyOrderPaid(order));
    this.events.on('approval.requested', (data: any) => this.notifyApprovalRequested(data));
    this.events.on('order.shipped', (order: any) => this.notifyOrderShipped(order));
  }

  private async send(payload: object): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error(`Slack send failed: ${err}`);
    }
  }

  async notifyOrderCreated(order: any) {
    await this.send({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🛍️ Novo Pedido Recebido', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Referência:*\n${order.ref}` },
            { type: 'mrkdwn', text: `*Estado:*\n${order.status}` },
            { type: 'mrkdwn', text: `*Cliente:*\n${order.client?.name ?? order.clientId}` },
            { type: 'mrkdwn', text: `*Total:*\n€${(order.totalAmount ?? 0).toFixed(2)}` },
          ],
        },
        {
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'Ver no Admin', emoji: true },
            url: `${this.config.get('ADMIN_URL', 'https://admin.yourgift.pt')}/orders/${order.id}`,
            style: 'primary',
          }],
        },
      ],
    });
  }

  async notifyOrderPaid(order: any) {
    await this.send({
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: `✅ *Pagamento confirmado* para pedido *${order.ref}* — €${(order.totalAmount ?? 0).toFixed(2)}` },
      }],
    });
  }

  async notifyApprovalRequested(data: any) {
    await this.send({
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: `⏳ *Aprovação necessária* — Pedido *${data.orderId ?? data.ref}* aguarda aprovação de *${data.stage ?? 'manager'}*` },
      }],
    });
  }

  async notifyOrderShipped(order: any) {
    await this.send({
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: `🚚 *Pedido expedido* — *${order.ref}*${order.trackingNumber ? ` · Tracking: ${order.trackingNumber}` : ''}` },
      }],
    });
  }
}
