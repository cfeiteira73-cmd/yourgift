import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Order shape expected from event bus ───────────────────────────────────────

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface OrderForEmail {
  id: string;
  ref: string;
  status: string;
  totalAmount?: number | null;
  trackingNumber?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  items?: OrderItem[];
  client?: { name?: string | null; email?: string | null } | null;
}

// ── Legacy DTO kept for backward-compat ───────────────────────────────────────

export interface SendNotificationDto {
  type: string;
  orderId?: string;
  email?: string;
  data?: Record<string, unknown>;
}

// ── Shared HTML helpers ───────────────────────────────────────────────────────

function emailWrapper(accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>YourGift</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#07111f;border-radius:12px 12px 0 0;padding:28px 36px;text-align:left;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                your<span style="color:${accentColor};">gift</span>
              </span>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:36px;border-left:1px solid #e8ecf2;border-right:1px solid #e8ecf2;">
              ${body}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f4f6fb;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;border:1px solid #e8ecf2;border-top:none;">
              <p style="margin:0;font-size:12px;color:#8a96a8;">
                YourGift · Plataforma B2B de Corporate Gifts · Portugal<br/>
                <a href="https://yourgift.pt" style="color:${accentColor};text-decoration:none;">yourgift.pt</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#07111f;letter-spacing:-0.4px;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#3d4a5c;line-height:1.6;">${text}</p>`;
}

function orderTable(order: OrderForEmail, accent: string): string {
  const addr = order.shippingAddress as {
    name?: string; street?: string; city?: string; postalCode?: string; country?: string;
  } | null;

  const rows: Array<[string, string]> = [
    ['Referência', order.ref],
    ['Estado', order.status],
  ];

  if (order.totalAmount != null && order.totalAmount > 0) {
    rows.push(['Total', `€${order.totalAmount.toFixed(2)}`]);
  }

  if (order.trackingNumber) {
    rows.push(['Nº de Tracking', order.trackingNumber]);
  }

  if (addr?.city) {
    const location = [addr.city, addr.postalCode, addr.country].filter(Boolean).join(' · ');
    rows.push(['Entrega em', location]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#8a96a8;font-weight:600;white-space:nowrap;border-bottom:1px solid #f0f3f8;">${label}</td>
        <td style="padding:10px 16px;font-size:13px;color:#07111f;font-weight:600;border-bottom:1px solid #f0f3f8;">${value}</td>
      </tr>`,
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf2;border-radius:8px;overflow:hidden;margin:20px 0;">
      <thead>
        <tr style="background:#07111f;">
          <th colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;color:${accent};text-align:left;letter-spacing:0.08em;text-transform:uppercase;">
            Resumo do Pedido
          </th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

function ctaButton(label: string, href: string, accent: string): string {
  return `
    <div style="margin:24px 0 8px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;background:${accent};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
        ${label}
      </a>
    </div>`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly accent = '#4da3ff';
  private readonly from = 'YourGift <noreply@yourgift.pt>';

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventBusService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onModuleInit() {
    this.events.on('order.created', (order: OrderForEmail) =>
      this.sendOrderCreated(order),
    );
    this.events.on('order.paid', (order: OrderForEmail) =>
      this.sendOrderPaid(order),
    );
    this.events.on('order.fulfillment_started', (order: OrderForEmail) =>
      this.sendOrderProducing(order),
    );
    this.events.on('order.shipped', (order: OrderForEmail) =>
      this.sendOrderShipped(order),
    );
    this.events.on('order.delivered', (order: OrderForEmail) =>
      this.sendOrderDelivered(order),
    );
  }

  // ── Resolve recipient ──────────────────────────────────────────────────────

  private resolveEmail(order: OrderForEmail): string | null {
    return order.client?.email ?? null;
  }

  // ── Core send via Resend REST API ──────────────────────────────────────────

  private async send(
    to: string,
    subject: string,
    html: string,
    opts?: { template?: string; from?: string; tenantId?: string; referenceId?: string; referenceType?: string },
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — email skipped');
      await this.logNotification({ to, subject, template: opts?.template, status: 'skipped', tenantId: opts?.tenantId, referenceId: opts?.referenceId, referenceType: opts?.referenceType });
      return;
    }

    const fromAddr = opts?.from ?? this.from;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddr, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Resend error ${res.status}: ${text}`);
      await this.logNotification({ to, subject, template: opts?.template, status: 'failed', errorMessage: `${res.status}: ${text}`, tenantId: opts?.tenantId, referenceId: opts?.referenceId, referenceType: opts?.referenceType });
    } else {
      const data = (await res.json()) as { id?: string };
      this.logger.log(`Email sent → ${to} | id=${data.id ?? 'unknown'}`);
      await this.logNotification({ to, subject, template: opts?.template, status: 'sent', messageId: data.id, tenantId: opts?.tenantId, referenceId: opts?.referenceId, referenceType: opts?.referenceType });
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────────────

  private async logNotification(entry: {
    to: string;
    subject: string;
    template?: string;
    status: string;
    messageId?: string;
    errorMessage?: string;
    tenantId?: string;
    referenceId?: string;
    referenceType?: string;
  }): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          to: entry.to,
          subject: entry.subject,
          template: entry.template ?? null,
          status: entry.status,
          messageId: entry.messageId ?? null,
          errorMessage: entry.errorMessage ?? null,
          tenantId: entry.tenantId ?? null,
          referenceId: entry.referenceId ?? null,
          referenceType: entry.referenceType ?? null,
        },
      });
    } catch (err) {
      // Non-critical — never block email delivery due to log write failure
      this.logger.warn('Failed to write notification log', err);
    }
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  async sendOrderCreated(order: OrderForEmail): Promise<void> {
    const to = this.resolveEmail(order);
    if (!to) {
      this.logger.warn(`sendOrderCreated: no email for order ${order.ref}`);
      return;
    }

    const subject = `YourGift — Pedido #${order.ref} Recebido`;
    const html = emailWrapper(
      this.accent,
      `
      ${h1('Pedido Recebido com Sucesso!')}
      ${p(`Obrigado! O seu pedido <strong>#${order.ref}</strong> foi recebido e está a ser processado pela nossa equipa.`)}
      ${p('Irá receber uma confirmação assim que o pagamento for processado.')}
      ${orderTable(order, this.accent)}
      ${ctaButton('Ver Pedido', `https://yourgift.pt/orders/${order.id}`, this.accent)}
      ${p('Se tiver alguma dúvida, não hesite em contactar-nos em <a href="mailto:hello@yourgift.pt" style="color:#4da3ff;">hello@yourgift.pt</a>.')}
    `,
    );

    try {
      await this.send(to, subject, html);
    } catch (err) {
      this.logger.error('sendOrderCreated failed', err);
    }
  }

  async sendOrderPaid(order: OrderForEmail): Promise<void> {
    const to = this.resolveEmail(order);
    if (!to) {
      this.logger.warn(`sendOrderPaid: no email for order ${order.ref}`);
      return;
    }

    const subject = `YourGift — Pagamento Confirmado #${order.ref}`;
    const html = emailWrapper(
      this.accent,
      `
      ${h1('Pagamento Confirmado!')}
      ${p(`O pagamento do seu pedido <strong>#${order.ref}</strong> foi confirmado com sucesso.`)}
      ${p('A nossa equipa irá agora proceder à aprovação e início da produção do seu pedido.')}
      ${orderTable(order, this.accent)}
      ${ctaButton('Acompanhar Pedido', `https://yourgift.pt/orders/${order.id}`, this.accent)}
    `,
    );

    try {
      await this.send(to, subject, html);
    } catch (err) {
      this.logger.error('sendOrderPaid failed', err);
    }
  }

  async sendOrderProducing(order: OrderForEmail): Promise<void> {
    const to = this.resolveEmail(order);
    if (!to) {
      this.logger.warn(`sendOrderProducing: no email for order ${order.ref}`);
      return;
    }

    const subject = `YourGift — O seu pedido está em produção`;
    const html = emailWrapper(
      this.accent,
      `
      ${h1('O seu pedido entrou em produção!')}
      ${p(`O pedido <strong>#${order.ref}</strong> foi aprovado e a produção começou.`)}
      ${p('Os seus artigos personalizados estão a ser preparados com cuidado. Iremos notificá-lo assim que forem expedidos.')}
      ${orderTable(order, this.accent)}
      ${ctaButton('Ver Estado do Pedido', `https://yourgift.pt/orders/${order.id}`, this.accent)}
    `,
    );

    try {
      await this.send(to, subject, html);
    } catch (err) {
      this.logger.error('sendOrderProducing failed', err);
    }
  }

  async sendOrderShipped(order: OrderForEmail): Promise<void> {
    const to = this.resolveEmail(order);
    if (!to) {
      this.logger.warn(`sendOrderShipped: no email for order ${order.ref}`);
      return;
    }

    const subject = `YourGift — Pedido Expedido! #${order.ref}`;
    const trackingNote = order.trackingNumber
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3d4a5c;line-height:1.6;">
           O número de tracking é: <strong style="font-family:monospace;color:#07111f;">${order.trackingNumber}</strong>
         </p>`
      : '';

    const html = emailWrapper(
      this.accent,
      `
      ${h1('O seu pedido foi expedido!')}
      ${p(`Ótimas notícias! O pedido <strong>#${order.ref}</strong> saiu do nosso armazém e está a caminho de si.`)}
      ${trackingNote}
      ${orderTable(order, this.accent)}
      ${ctaButton('Rastrear Pedido', `https://yourgift.pt/orders/${order.id}`, this.accent)}
      ${p('Estimamos que o pedido chegue nos próximos 2 a 5 dias úteis.')}
    `,
    );

    try {
      await this.send(to, subject, html);
    } catch (err) {
      this.logger.error('sendOrderShipped failed', err);
    }
  }

  async sendOrderDelivered(order: OrderForEmail): Promise<void> {
    const to = this.resolveEmail(order);
    if (!to) {
      this.logger.warn(`sendOrderDelivered: no email for order ${order.ref}`);
      return;
    }

    const subject = `YourGift — Pedido Entregue #${order.ref}`;
    const html = emailWrapper(
      this.accent,
      `
      ${h1('Pedido Entregue com Sucesso!')}
      ${p(`O seu pedido <strong>#${order.ref}</strong> foi entregue.`)}
      ${p('Esperamos que os seus artigos personalizados superem as suas expectativas. Se precisar de apoio ou quiser repetir o pedido, a nossa equipa está disponível.')}
      ${orderTable(order, this.accent)}
      ${ctaButton('Avaliar Experiência', 'https://yourgift.pt/feedback', this.accent)}
      ${p('Obrigado por escolher a YourGift. Até breve!')}
    `,
    );

    try {
      await this.send(to, subject, html);
    } catch (err) {
      this.logger.error('sendOrderDelivered failed', err);
    }
  }

  // ── Public: direct send (for queue workers + SSO) ────────────────────────

  /**
   * Send an arbitrary HTML email directly.
   * Used by EmailWorker and any code that builds its own HTML.
   */
  async sendDirect(to: string | string[], subject: string, html: string): Promise<void> {
    const recipient = Array.isArray(to) ? to[0] : to;
    if (!recipient) return;
    try {
      await this.send(recipient, subject, html);
    } catch (err) {
      this.logger.error('sendDirect failed', err);
    }
  }

  /**
   * Send an email from a named template + variables map.
   * Generates branded HTML using the existing emailWrapper helper.
   * Called by EmailWorker when processing queued email jobs.
   */
  async sendFromTemplate(
    to: string | string[],
    subject: string,
    template: string,
    variables: Record<string, unknown>,
    from?: string,
  ): Promise<void> {
    const recipient = Array.isArray(to) ? to[0] : to;
    if (!recipient) return;

    // Build branded body from template + variables
    const rows = Object.entries(variables)
      .map(([k, v]) => `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:500;">${String(v)}</td></tr>`)
      .join('');

    const body =
      h1(subject) +
      p(`Olá, este é um email automático do tipo <strong>${template}</strong>.`) +
      (rows
        ? `<table width="100%" cellpadding="6" style="border-collapse:collapse;margin:16px 0;">${rows}</table>`
        : '') +
      p('Para questões contacte <a href="mailto:ops@yourgift.pt" style="color:' + this.accent + ';">ops@yourgift.pt</a>.');

    const html = emailWrapper(this.accent, body);

    try {
      await this.send(recipient, subject, html, { template, from });
    } catch (err) {
      this.logger.error('sendFromTemplate failed', err);
    }
  }

  // ── Legacy generic method (kept for backward-compat) ──────────────────────

  async sendNotification(dto: SendNotificationDto): Promise<{ queued: boolean }> {
    this.logger.log(
      `[NOTIFICATION] type=${dto.type} orderId=${dto.orderId ?? 'n/a'} email=${dto.email ?? 'n/a'}`,
    );
    this.logger.debug('Notification payload:', dto.data);

    if (dto.email) {
      const subject = `YourGift — Notificação (${dto.type})`;
      const html = emailWrapper(
        this.accent,
        `${h1('Notificação YourGift')}${p(`Tipo: ${dto.type}`)}`,
      );
      try {
        await this.send(dto.email, subject, html);
      } catch (err) {
        this.logger.error('sendNotification failed', err);
      }
    }

    return { queued: true };
  }
}
