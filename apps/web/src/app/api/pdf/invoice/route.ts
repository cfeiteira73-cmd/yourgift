import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Premium Invoice PDF — Print-ready HTML ───────────────────────────────────
// GET /api/pdf/invoice?ref=YGI-123456
// Returns premium HTML invoice document

export const dynamic = 'force-dynamic';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  if (!ref) return new NextResponse('Invoice reference required', { status: 400 });

  const db = getAdminDb();
  if (!db) return new NextResponse('Service unavailable', { status: 503 });

  const { data: invoice } = await db
    .from('invoices')
    .select('id, ref, status, amount, vat_rate, created_at, due_date, paid_at, orders(ref, total_amount), clients(name, company, email, address)')
    .eq('ref', ref)
    .single();

  if (!invoice) return new NextResponse('Invoice not found', { status: 404 });

  const client = (invoice.clients as any) ?? {};
  const order  = (invoice.orders as any) ?? {};
  const date   = new Date(invoice.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '30 dias';
  const vatRate  = Number(invoice.vat_rate ?? 23);
  const base     = Number(invoice.amount ?? 0);
  const vat      = base * (vatRate / 100);
  const total    = base + vat;
  const isPaid   = invoice.status === 'paid';

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>Factura ${invoice.ref} — YourGift</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600&family=DM+Mono:wght@400&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Montserrat',sans-serif;font-weight:300;background:#090907;color:#f0ece4;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:0}
  @media print{body{background:#fff;color:#1a1a17}h1,h2,h3{font-family:'Libre Baskerville',serif}}
  .page{min-height:100vh;padding:48px 56px;max-width:900px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;padding-bottom:24px;border-bottom:2px solid #9a7c4a}
  .logo{font-family:'Libre Baskerville',serif;font-size:22px;font-weight:400;color:#f0ece4}
  .logo span{color:#d4b47a}
  h1{font-family:'Libre Baskerville',serif;font-size:32px;font-weight:400;color:#f0ece4;letter-spacing:-0.02em;margin-bottom:8px}
  .badge{display:inline-block;padding:5px 14px;border:1px solid ${isPaid ? '#5a9e72' : 'rgba(154,124,74,0.35)'};color:${isPaid ? '#5a9e72' : '#d4b47a'};font-size:9px;letter-spacing:0.22em;text-transform:uppercase;font-weight:600;background:${isPaid ? 'rgba(90,158,114,0.08)' : 'rgba(154,124,74,0.06)'};margin-bottom:32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(154,124,74,0.10);margin:28px 0}
  .cell{background:#141411;padding:20px 24px}
  .cell-label{font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,236,228,0.32);margin-bottom:8px;font-weight:600}
  .cell-value{font-size:13px;color:#f0ece4;line-height:1.5}
  table.items{width:100%;border-collapse:collapse;margin:20px 0}
  table.items th{font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.32);font-weight:600;padding:10px 16px;border-bottom:1px solid rgba(154,124,74,0.14);text-align:left}
  table.items td{padding:14px 16px;border-bottom:1px solid rgba(154,124,74,0.08);color:rgba(240,236,228,0.72);font-size:13px}
  .total-row{font-family:'DM Mono',monospace;font-size:14px;color:#d4b47a;text-align:right}
  .grand-total{font-size:20px;color:#f0ece4;font-weight:400}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid rgba(154,124,74,0.10);display:flex;justify-content:space-between;font-size:10px;color:rgba(240,236,228,0.24)}
  .iban-box{background:rgba(154,124,74,0.06);border:1px solid rgba(154,124,74,0.14);padding:16px 20px;margin-top:24px}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">your<span>gift</span>.pt</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(240,236,228,0.28);margin-top:4px;font-weight:500">Corporate Gifts · Lisboa, Portugal</div>
      <div style="font-size:11px;color:rgba(240,236,228,0.32);margin-top:6px">geral@yourgift.pt · +351 210 000 000</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,236,228,0.38);margin-bottom:6px">Documento N.º</div>
      <div style="font-family:'DM Mono',monospace;font-size:18px;color:#d4b47a">${invoice.ref}</div>
      <div style="font-size:11px;color:rgba(240,236,228,0.38);margin-top:4px">${date}</div>
    </div>
  </div>

  <div style="margin-bottom:8px"><span class="badge">${isPaid ? '✓ PAGA' : 'PENDENTE'}</span></div>
  <h1>Factura</h1>

  <div class="grid">
    <div class="cell">
      <div class="cell-label">Emitida por</div>
      <div class="cell-value">YourGift Lda.<br/><span style="color:rgba(240,236,228,0.42);font-size:11px">NIF: PT999999999<br/>Lisboa, Portugal</span></div>
    </div>
    <div class="cell">
      <div class="cell-label">Facturado a</div>
      <div class="cell-value">${client.company || client.name || '—'}<br/>
      <span style="color:rgba(240,236,228,0.42);font-size:11px">${client.name || ''}<br/>${client.email || ''}</span></div>
    </div>
    <div class="cell">
      <div class="cell-label">Data de Vencimento</div>
      <div class="cell-value">${dueDate}</div>
    </div>
    <div class="cell">
      <div class="cell-label">Encomenda associada</div>
      <div class="cell-value" style="font-family:'DM Mono',monospace;color:#d4b47a">${order.ref || '—'}</div>
    </div>
  </div>

  <table class="items">
    <thead><tr>
      <th>Descrição</th>
      <th style="text-align:right">Valor</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>Produtos personalizados — Encomenda ${order.ref || invoice.ref}</td>
        <td class="total-row" style="font-size:13px">€${base.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="color:rgba(240,236,228,0.42)">IVA (${vatRate}%)</td>
        <td class="total-row" style="font-size:13px">€${vat.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="font-size:15px;color:#f0ece4;font-weight:600;padding-top:20px">Total com IVA</td>
        <td class="total-row grand-total" style="padding-top:20px">€${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${!isPaid ? `<div class="iban-box">
    <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(240,236,228,0.38);font-weight:600;margin-bottom:10px">Dados para Pagamento</div>
    <div style="font-family:'DM Mono',monospace;font-size:12px;color:#d4b47a">IBAN: PT50 0000 0000 0000 0000 0000 0</div>
    <div style="font-size:11px;color:rgba(240,236,228,0.38);margin-top:6px">Referência: ${invoice.ref}</div>
  </div>` : `<div class="iban-box" style="border-color:rgba(90,158,114,0.25);background:rgba(90,158,114,0.06)">
    <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:#5a9e72;font-weight:600">✓ Factura paga em ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('pt-PT') : '—'}</div>
  </div>`}

  <div class="footer">
    <span>YourGift Lda. · NIF: PT999999999 · Lisboa, Portugal</span>
    <span>yourgift.pt · ${new Date().getFullYear()}</span>
  </div>
</div>
</body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-cache' },
  });
}
