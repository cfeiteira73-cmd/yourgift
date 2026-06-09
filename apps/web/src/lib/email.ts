/**
 * YourGift — Premium Email System via Resend
 * All templates match homepage brand: warm-dark + bronze + Libre Baskerville
 * yourgift.pt domain verified in Resend
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM         = process.env.EMAIL_FROM ?? 'noreply@yourgift.pt';
const FROM_NAME    = 'YourGift';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

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
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM}>`,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo ?? 'geral@yourgift.pt',
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

// ── Shared Premium Layout ─────────────────────────────────────────────────────

function emailShell(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>` : ''}
<title>YourGift</title>
</head>
<body style="margin:0;padding:0;background:#080807;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080807;padding:48px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f0c;border:1px solid rgba(154,124,74,0.18)">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid rgba(154,124,74,0.12)">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td>
  <span style="font-size:18px;font-weight:400;color:#f0ece4;letter-spacing:0.02em">
    your<span style="color:#d4b47a">gift</span>.pt
  </span>
  <br/><span style="font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,236,228,0.28);font-weight:600">Premium Corporate Gifts</span>
</td>
<td align="right">
  <span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.28)">Lisboa, Portugal</span>
</td>
</tr>
</table>
</td></tr>

<!-- Content -->
<tr><td style="padding:36px 40px">
${content}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px 32px;border-top:1px solid rgba(154,124,74,0.10);text-align:center">
<p style="margin:0 0 8px;font-size:11px;color:rgba(240,236,228,0.28);line-height:1.6">
  <a href="${APP_URL}" style="color:rgba(240,236,228,0.38);text-decoration:none">yourgift.pt</a>
  &nbsp;·&nbsp;
  <a href="mailto:geral@yourgift.pt" style="color:rgba(240,236,228,0.38);text-decoration:none">geral@yourgift.pt</a>
  &nbsp;·&nbsp;
  <a href="${APP_URL}/privacy-policy" style="color:rgba(240,236,228,0.38);text-decoration:none">Privacidade</a>
</p>
<p style="margin:0;font-size:10px;color:rgba(240,236,228,0.18)">© ${new Date().getFullYear()} YourGift Lda. · Todos os direitos reservados.</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// Status pill
function statusPill(label: string, color = '#b8975e'): string {
  return `<span style="display:inline-block;padding:4px 12px;border:1px solid ${color};color:${color};font-size:9px;letter-spacing:0.22em;text-transform:uppercase;font-weight:600">${label}</span>`;
}

// Bronze CTA button
function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#b8975e;color:#090907;padding:13px 32px;text-decoration:none;font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">${label}</a>`;
}

// Divider
const DIV = `<div style="border-top:1px solid rgba(154,124,74,0.12);margin:24px 0"></div>`;

// ── Template 1: Welcome ────────────────────────────────────────────────────────

export function welcomeEmail(opts: { name: string; email: string }): { subject: string; html: string } {
  return {
    subject: 'Bem-vindo à YourGift — A tua conta está pronta',
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Bem-vindo</p>
<h1 style="font-size:26px;font-weight:400;color:#f0ece4;margin:0 0 20px;line-height:1.15;letter-spacing:-0.01em">
  Olá, ${opts.name}.<br/>
  <em style="font-style:italic;color:#d4b47a">A tua conta está pronta.</em>
</h1>
<p style="font-size:14px;color:rgba(240,236,228,0.62);line-height:1.75;margin:0 0 24px">
  A YourGift é a plataforma B2B premium para corporate gifts, branded merchandise e company stores.<br/>
  20.000+ produtos. Proposta em 48h. Gestor dedicado.
</p>
${DIV}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
${[
  ['📦', 'Catálogo completo', '20.000+ produtos personalizáveis'],
  ['⚡', 'Proposta em 48h', 'Orçamento detalhado com mockup'],
  ['🎯', 'Gestor dedicado', 'Um ponto de contacto para tudo'],
].map(([icon, title, desc]) => `<tr>
  <td width="40" style="vertical-align:top;padding:8px 0"><span style="font-size:20px">${icon}</span></td>
  <td style="padding:8px 0 8px 12px">
    <div style="font-size:13px;font-weight:600;color:#f0ece4;margin-bottom:2px">${title}</div>
    <div style="font-size:12px;color:rgba(240,236,228,0.42)">${desc}</div>
  </td>
</tr>`).join('')}
</table>
<div style="text-align:center;margin-bottom:8px">
  ${ctaButton('Explorar Catálogo →', `${APP_URL}/catalog/produtos`)}
</div>
<p style="text-align:center;margin:12px 0 0;font-size:11px;color:rgba(240,236,228,0.28)">Ou <a href="${APP_URL}/rfq" style="color:#d4b47a;text-decoration:none">pede um orçamento gratuito</a></p>
`, `Bem-vindo à YourGift — a plataforma B2B premium para corporate gifts`),
  };
}

// ── Template 2: Magic Link ─────────────────────────────────────────────────────

export function magicLinkEmail(opts: { name?: string; link: string; expiresIn?: string }): { subject: string; html: string } {
  return {
    subject: 'YourGift — O teu link de acesso',
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Acesso Seguro</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;line-height:1.2;letter-spacing:-0.01em">
  O teu link de acesso<br/><em style="font-style:italic;color:#d4b47a">está aqui.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.7;margin:0 0 28px">
  Clica no botão abaixo para entrares na tua conta YourGift.${opts.expiresIn ? ` O link expira em ${opts.expiresIn}.` : ''}<br/>
  <span style="color:rgba(240,236,228,0.38)">Se não pediste este acesso, ignora este email.</span>
</p>
<div style="text-align:center;margin-bottom:28px">
  ${ctaButton('Entrar na Minha Conta →', opts.link)}
</div>
${DIV}
<p style="font-size:11px;color:rgba(240,236,228,0.28);text-align:center;margin:0">
  Por razões de segurança, este link é de uso único.
</p>
`, `O teu link de acesso à YourGift`),
  };
}

// ── Template 3: Quote Ready ───────────────────────────────────────────────────

export function quoteReadyEmail(opts: {
  clientName: string;
  quoteRef: string;
  totalAmount?: number;
  validUntil?: string;
  portalUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Proposta pronta — ${opts.quoteRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Proposta Comercial</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;letter-spacing:-0.01em">
  Olá ${opts.clientName},<br/>
  <em style="font-style:italic;color:#d4b47a">a tua proposta está pronta.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.7;margin:0 0 24px">
  Preparámos uma proposta detalhada para o teu pedido. Inclui mockup, preços, prazos e condições.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(154,124,74,0.08);border:1px solid rgba(154,124,74,0.18);margin-bottom:28px">
<tr><td style="padding:20px 24px">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td><span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600">Referência</span><br/>
    <span style="font-size:16px;color:#d4b47a;font-family:'Courier New',monospace">${opts.quoteRef}</span></td>
    ${opts.totalAmount ? `<td align="right"><span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600">Valor total</span><br/><span style="font-size:18px;color:#f0ece4;font-family:'Courier New',monospace">€${opts.totalAmount.toFixed(2)}</span></td>` : ''}
  </tr>
  ${opts.validUntil ? `<tr><td colspan="2" style="padding-top:10px"><span style="font-size:11px;color:rgba(240,236,228,0.28)">Válido até ${opts.validUntil}</span></td></tr>` : ''}
  </table>
</td></tr>
</table>
<div style="text-align:center;margin-bottom:16px">
  ${ctaButton('Ver Proposta Completa →', opts.portalUrl)}
</div>
<p style="text-align:center;font-size:11px;color:rgba(240,236,228,0.28);margin:0">
  Dúvidas? Responde a este email ou contacta-nos: <a href="mailto:geral@yourgift.pt" style="color:#d4b47a;text-decoration:none">geral@yourgift.pt</a>
</p>
`, `A tua proposta YourGift ${opts.quoteRef} está pronta`),
  };
}

// ── Template 4: Order Confirmation ───────────────────────────────────────────

export function orderConfirmationEmail(opts: {
  clientName: string;
  orderRef: string;
  totalAmount: number;
  products: Array<{ title: string; qty: number; price: number }>;
  orderUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Encomenda confirmada — ${opts.orderRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Encomenda Confirmada</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;letter-spacing:-0.01em">
  ${opts.clientName},<br/><em style="font-style:italic;color:#d4b47a">encomenda recebida.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.7;margin:0 0 24px">
  O pagamento foi processado e a tua encomenda entrou em produção.<br/>
  Receberás actualizações em cada etapa.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#141411;border:1px solid rgba(154,124,74,0.14);margin-bottom:24px">
<tr><td style="padding:20px 24px">
  <p style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600;margin:0 0 14px">Produtos</p>
  ${opts.products.map(p => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(154,124,74,0.08);font-size:13px">
    <span style="color:rgba(240,236,228,0.72)">${p.title} × ${p.qty}</span>
    <span style="color:#d4b47a;font-family:'Courier New',monospace">€${(p.price * p.qty).toFixed(2)}</span>
  </div>`).join('')}
  <div style="display:flex;justify-content:space-between;padding:14px 0 0;font-size:15px">
    <span style="color:#f0ece4;font-weight:600">Total</span>
    <span style="color:#d4b47a;font-family:'Courier New',monospace;font-size:17px">€${opts.totalAmount.toFixed(2)}</span>
  </div>
</td></tr>
</table>
<div style="text-align:center;margin-bottom:16px">
  ${ctaButton('Ver Encomenda →', opts.orderUrl)}
</div>
`, `Encomenda ${opts.orderRef} confirmada — em produção`),
  };
}

// ── Template 5: Payment Confirmation ─────────────────────────────────────────

export function paymentConfirmationEmail(opts: {
  clientName: string;
  orderRef: string;
  amount: number;
  stripeSessionId: string;
}): { subject: string; html: string } {
  return {
    subject: `Pagamento recebido — ${opts.orderRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Pagamento Confirmado</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 20px;letter-spacing:-0.01em">
  Olá ${opts.clientName},<br/><em style="font-style:italic;color:#d4b47a">pagamento recebido.</em>
</h1>
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(154,124,74,0.06);border:1px solid rgba(154,124,74,0.18);margin-bottom:28px">
<tr><td style="padding:20px 28px;text-align:center">
  <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600;margin-bottom:8px">Valor pago</div>
  <div style="font-size:28px;color:#d4b47a;font-family:'Courier New',monospace">€${opts.amount.toFixed(2)}</div>
  <div style="font-size:11px;color:rgba(240,236,228,0.38);margin-top:8px">Ref: ${opts.orderRef}</div>
</td></tr>
</table>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.75;margin:0 0 24px">
  A tua encomenda está agora em processamento.<br/>
  Receberás uma actualização quando entrar em produção.
</p>
<p style="font-size:11px;color:rgba(240,236,228,0.28);text-align:center;margin:0">
  Referência de pagamento: <span style="font-family:'Courier New',monospace;color:rgba(240,236,228,0.42)">${opts.stripeSessionId.substring(0, 20)}...</span>
</p>
`, `Pagamento de €${opts.amount.toFixed(2)} recebido — ${opts.orderRef}`),
  };
}

// ── Template 6: Artwork Approval ─────────────────────────────────────────────

export function artworkApprovalEmail(opts: {
  clientName: string;
  orderRef: string;
  artworkName: string;
  approvalUrl: string;
  previewUrl?: string;
}): { subject: string; html: string } {
  return {
    subject: `Arte para aprovação — ${opts.orderRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Aprovação de Arte</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;letter-spacing:-0.01em">
  ${opts.clientName},<br/><em style="font-style:italic;color:#d4b47a">a tua arte está pronta.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.7;margin:0 0 24px">
  Preparámos o mockup para a encomenda <strong style="color:#f0ece4">${opts.orderRef}</strong>.<br/>
  Por favor aprova ou solicita alterações antes de avançarmos para produção.
</p>
${opts.previewUrl ? `<div style="text-align:center;margin-bottom:20px"><img src="${opts.previewUrl}" alt="Preview" style="max-width:100%;border:1px solid rgba(154,124,74,0.18)"/></div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#141411;border:1px solid rgba(154,124,74,0.14);margin-bottom:24px">
<tr><td style="padding:16px 24px">
  <span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600">Arte</span><br/>
  <span style="font-size:14px;color:#f0ece4">${opts.artworkName}</span>
</td></tr>
</table>
<div style="text-align:center;margin-bottom:16px">
  ${ctaButton('Ver e Aprovar Arte →', opts.approvalUrl)}
</div>
<p style="text-align:center;font-size:11px;color:rgba(240,236,228,0.28)">
  A produção só avança após a tua aprovação escrita.
</p>
`, `Arte para aprovação — ${opts.orderRef}`),
  };
}

// ── Template 7: Tracking ──────────────────────────────────────────────────────

export function trackingEmail(opts: {
  clientName: string;
  orderRef: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}): { subject: string; html: string } {
  return {
    subject: `Encomenda expedida — ${opts.orderRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Em trânsito</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;letter-spacing:-0.01em">
  ${opts.clientName},<br/><em style="font-style:italic;color:#d4b47a">a caminho.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.7;margin:0 0 24px">
  A tua encomenda <strong style="color:#f0ece4">${opts.orderRef}</strong> foi expedida por <strong style="color:#f0ece4">${opts.carrier}</strong>.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#141411;border:1px solid rgba(154,124,74,0.14);margin-bottom:24px">
<tr><td style="padding:20px 24px">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td><span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600">Rastreio</span><br/>
    <span style="font-size:15px;color:#d4b47a;font-family:'Courier New',monospace">${opts.trackingNumber}</span></td>
    ${opts.estimatedDelivery ? `<td align="right"><span style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600">Entrega estimada</span><br/><span style="font-size:13px;color:#f0ece4">${opts.estimatedDelivery}</span></td>` : ''}
  </tr>
  </table>
</td></tr>
</table>
${opts.trackingUrl ? `<div style="text-align:center;margin-bottom:16px">${ctaButton('Rastrear Encomenda →', opts.trackingUrl)}</div>` : ''}
`, `Encomenda ${opts.orderRef} expedida — ${opts.trackingNumber}`),
  };
}

// ── Template 8: Delivered ─────────────────────────────────────────────────────

export function deliveredEmail(opts: {
  clientName: string;
  orderRef: string;
  portalUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Entregue com sucesso — ${opts.orderRef} | YourGift`,
    html: emailShell(`
<p style="font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;margin:0 0 12px;font-weight:600">· Entregue</p>
<h1 style="font-size:24px;font-weight:400;color:#f0ece4;margin:0 0 16px;letter-spacing:-0.01em">
  ${opts.clientName},<br/><em style="font-style:italic;color:#d4b47a">chegou.</em>
</h1>
<p style="font-size:13px;color:rgba(240,236,228,0.62);line-height:1.75;margin:0 0 28px">
  A encomenda <strong style="color:#f0ece4">${opts.orderRef}</strong> foi entregue com sucesso.<br/>
  Esperamos que o resultado final supere as expectativas.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
<tr><td align="center" style="padding:16px;background:rgba(154,124,74,0.06);border:1px solid rgba(154,124,74,0.14)">
  <div style="font-size:32px;margin-bottom:8px">✦</div>
  <p style="margin:0;font-size:13px;color:rgba(240,236,228,0.62)">
    A tua próxima encomenda já está a um clique de distância.<br/>
    <a href="${opts.portalUrl}" style="color:#d4b47a;text-decoration:none">Reorder em 2 cliques →</a>
  </p>
</td></tr>
</table>
<div style="text-align:center;margin-bottom:16px">
  ${ctaButton('Ver Portal →', opts.portalUrl)}
</div>
<p style="text-align:center;font-size:11px;color:rgba(240,236,228,0.28);margin:0">
  Partilha a tua experiência: <a href="mailto:geral@yourgift.pt?subject=Feedback ${opts.orderRef}" style="color:#d4b47a;text-decoration:none">geral@yourgift.pt</a>
</p>
`, `Encomenda ${opts.orderRef} entregue — obrigado`),
  };
}
