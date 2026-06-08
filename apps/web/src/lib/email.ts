/**
 * Email sending via Resend
 * Used by: order confirmation, artwork approval, tracking updates, etc.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.EMAIL_FROM ?? 'noreply@yourgift.pt';
const FROM_NAME = 'YourGift';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured — email not sent');
    return { error: 'Email not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM}>`,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });

    const data = await res.json();
    if (!res.ok) return { error: data.message ?? 'Send failed' };
    return { id: data.id };
  } catch (err) {
    console.error('[email] Send failed:', err);
    return { error: String(err) };
  }
}

// ── Email Templates ───────────────────────────────────────────────────────────

export function orderConfirmationEmail(opts: {
  clientName: string;
  orderRef: string;
  totalAmount: number;
  products: Array<{ title: string; qty: number; price: number }>;
  orderUrl: string;
}): { subject: string; html: string } {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';
  return {
    subject: `✅ Encomenda confirmada — ${opts.orderRef}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
  <div style="text-align:center;margin-bottom:32px">
    <img src="${APP_URL}/logo.png" alt="YourGift" height="40" style="height:40px" onerror="this.style.display='none'"/>
    <h1 style="color:#b8975e;font-size:24px;margin:16px 0 8px">Encomenda Confirmada!</h1>
    <p style="color:#8b949e;margin:0">Referência: <strong style="color:#e6edf3">${opts.orderRef}</strong></p>
  </div>
  <p>Olá ${opts.clientName},</p>
  <p>A tua encomenda foi confirmada e o pagamento processado com sucesso.</p>
  <div style="background:#161b22;border-radius:8px;padding:20px;margin:24px 0">
    <h3 style="margin:0 0 12px;color:#b8975e">Produtos</h3>
    ${opts.products.map(p => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #21262d">
        <span>${p.title} × ${p.qty}</span>
        <span>€${(p.price * p.qty).toFixed(2)}</span>
      </div>
    `).join('')}
    <div style="display:flex;justify-content:space-between;padding-top:12px;font-weight:700;font-size:18px">
      <span>Total</span>
      <span style="color:#b8975e">€${opts.totalAmount.toFixed(2)}</span>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px">
    <a href="${opts.orderUrl}" style="background:#b8975e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
      Ver Encomenda →
    </a>
  </div>
  <p style="color:#8b949e;font-size:12px;text-align:center;margin-top:32px">
    YourGift · Merchandising B2B Premium · yourgift.pt
  </p>
</div>`,
  };
}

export function paymentConfirmationEmail(opts: {
  clientName: string;
  orderRef: string;
  amount: number;
  stripeSessionId: string;
}): { subject: string; html: string } {
  return {
    subject: `💳 Pagamento recebido — ${opts.orderRef}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
  <h1 style="color:#63e6be">Pagamento confirmado</h1>
  <p>Olá ${opts.clientName},</p>
  <p>Recebemos o teu pagamento de <strong style="color:#b8975e">€${opts.amount.toFixed(2)}</strong> para a encomenda <strong>${opts.orderRef}</strong>.</p>
  <p style="color:#8b949e">A tua encomenda está agora em processamento. Receberás uma atualização quando entrar em produção.</p>
  <p style="color:#8b949e;font-size:12px;margin-top:32px">YourGift · yourgift.pt</p>
</div>`,
  };
}

export function trackingEmail(opts: {
  clientName: string;
  orderRef: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}): { subject: string; html: string } {
  return {
    subject: `📦 Encomenda expedida — ${opts.orderRef}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
  <h1 style="color:#b8975e">A tua encomenda foi expedida!</h1>
  <p>Olá ${opts.clientName},</p>
  <p>A tua encomenda <strong>${opts.orderRef}</strong> foi expedida por <strong>${opts.carrier}</strong>.</p>
  <div style="background:#161b22;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px">Número de rastreamento: <strong style="color:#b8975e">${opts.trackingNumber}</strong></p>
    ${opts.estimatedDelivery ? `<p style="margin:0;color:#8b949e">Entrega estimada: ${opts.estimatedDelivery}</p>` : ''}
  </div>
  ${opts.trackingUrl ? `<div style="text-align:center"><a href="${opts.trackingUrl}" style="background:#b8975e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Rastrear Encomenda →</a></div>` : ''}
  <p style="color:#8b949e;font-size:12px;margin-top:32px">YourGift · yourgift.pt</p>
</div>`,
  };
}
