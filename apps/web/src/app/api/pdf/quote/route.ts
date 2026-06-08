import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Premium Quote PDF — Print-ready HTML ─────────────────────────────────────
// GET /api/pdf/quote?ref=YGQ-123456
// Returns HTML with @media print CSS — full-page professional document

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

  if (!ref) {
    return new NextResponse('Quote reference required (?ref=YGQ-XXXX)', { status: 400 });
  }

  const db = getAdminDb();
  if (!db) return new NextResponse('Service unavailable', { status: 503 });

  const { data: quote } = await db
    .from('quotes')
    .select('id, ref, status, total_amount, notes, created_at, clients(name, company, email)')
    .eq('ref', ref)
    .single();

  if (!quote) return new NextResponse('Quote not found', { status: 404 });

  const client = (quote.clients as any) ?? {};
  const date = new Date(quote.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const amount = quote.total_amount ? `€${Number(quote.total_amount).toFixed(2)}` : 'A definir';

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Orçamento ${quote.ref} — YourGift</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600&family=DM+Mono:wght@400&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Montserrat',sans-serif;font-weight:300;background:#090907;color:#f0ece4;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:0}
  @media print{body{background:#fff;color:#1a1a17}
    .page{min-height:297mm;padding:16mm 18mm}
    h1,h2,h3{font-family:'Libre Baskerville',serif}
    .accent{color:#9a7c4a!important}
    .card{background:#f7f5f0!important;border:1px solid rgba(26,26,23,0.12)!important}
    .divider{border-color:rgba(26,26,23,0.12)!important}
    .muted{color:rgba(26,26,23,0.42)!important}
    .body-text{color:rgba(26,26,23,0.75)!important}
    .bg-dark{background:#1a1a17!important}
    .text-on-dark{color:#f0ece4!important}
  }
  .page{min-height:100vh;padding:48px 56px;max-width:900px;margin:0 auto}
  /* Header */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;padding-bottom:24px;border-bottom:2px solid #9a7c4a}
  .logo{font-family:'Libre Baskerville',serif;font-size:22px;font-weight:400;color:#f0ece4}
  .logo span{color:#d4b47a}
  .logo-sub{font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(240,236,228,0.38);margin-top:4px;font-weight:500}
  .ref-block{text-align:right}
  .ref-label{font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,236,228,0.38);margin-bottom:6px}
  .ref-value{font-family:'DM Mono',monospace;font-size:18px;color:#d4b47a;font-weight:400}
  .ref-date{font-size:11px;color:rgba(240,236,228,0.42);margin-top:4px}
  /* Eyebrow */
  .eyebrow{display:flex;align-items:center;gap:12px;font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:#9a7c4a;font-weight:600;margin-bottom:12px}
  .eyebrow::before{content:'';width:24px;height:1px;background:#9a7c4a}
  /* Section */
  h1{font-family:'Libre Baskerville',serif;font-size:clamp(24px,3vw,36px);font-weight:400;color:#f0ece4;letter-spacing:-0.02em;line-height:1.1;margin-bottom:8px}
  h2{font-family:'Libre Baskerville',serif;font-size:16px;font-weight:400;color:#f0ece4;margin-bottom:16px}
  /* Cards */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(154,124,74,0.14);margin:32px 0}
  .card{background:#141411;padding:24px 28px}
  .card-label{font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,236,228,0.32);margin-bottom:8px;font-weight:600}
  .card-value{font-size:14px;color:#f0ece4;line-height:1.5}
  .card-sub{font-size:11px;color:rgba(240,236,228,0.42);margin-top:4px}
  /* Summary */
  .summary{background:#141411;border:1px solid rgba(154,124,74,0.18);padding:28px;margin:24px 0}
  .summary-row{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 0;border-bottom:1px solid rgba(154,124,74,0.10)}
  .summary-row:last-child{border-bottom:none}
  .summary-label{font-size:13px;color:rgba(240,236,228,0.72)}
  .summary-value{font-family:'DM Mono',monospace;font-size:14px;color:#d4b47a;font-weight:400}
  .summary-total{font-family:'Libre Baskerville',serif;font-size:20px;color:#f0ece4}
  /* Status badge */
  .badge{display:inline-block;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;font-weight:600;padding:5px 12px;border:1px solid rgba(154,124,74,0.35);color:#d4b47a;background:rgba(154,124,74,0.10)}
  /* Footer */
  .footer{margin-top:56px;padding-top:20px;border-top:1px solid rgba(154,124,74,0.14);display:flex;justify-content:space-between;align-items:flex-end}
  .footer-brand{font-family:'Libre Baskerville',serif;font-size:13px;color:rgba(240,236,228,0.42)}
  .footer-brand span{color:#d4b47a}
  .footer-contact{font-size:10px;color:rgba(240,236,228,0.24);text-align:right;line-height:1.6}
  /* Notes */
  .notes{background:rgba(154,124,74,0.06);border-left:2px solid #9a7c4a;padding:16px 20px;margin:20px 0;font-size:12px;color:rgba(240,236,228,0.62);line-height:1.7}
  .divider{border:none;border-top:1px solid rgba(154,124,74,0.14);margin:28px 0}
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">your<span>gift</span>.pt</div>
      <div class="logo-sub">Corporate Gifts · Branded Merchandise</div>
    </div>
    <div class="ref-block">
      <div class="ref-label">Referência</div>
      <div class="ref-value">${quote.ref}</div>
      <div class="ref-date">${date}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="eyebrow">Proposta Comercial</div>
  <h1>Orçamento <em style="font-style:italic;color:#d4b47a">Personalizado</em></h1>
  <div style="margin-top:12px;margin-bottom:32px">
    <span class="badge">${quote.status === 'submitted' ? 'Em análise' : quote.status === 'pricing' ? 'A calcular' : quote.status === 'proposed' ? 'Proposta enviada' : quote.status}</span>
  </div>

  <!-- Client + Details grid -->
  <div class="grid-2">
    <div class="card">
      <div class="card-label">Cliente</div>
      <div class="card-value">${client.company || client.name || '—'}</div>
      <div class="card-sub">${client.name || ''}</div>
      <div class="card-sub">${client.email || ''}</div>
    </div>
    <div class="card">
      <div class="card-label">Data da Proposta</div>
      <div class="card-value">${date}</div>
      <div class="card-sub">Validade: 30 dias</div>
    </div>
  </div>

  <!-- Notes / Description -->
  ${quote.notes ? `<div class="notes"><strong style="color:#d4b47a;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;font-family:'Montserrat',sans-serif">Detalhes do Pedido</strong><br/><br/>${quote.notes}</div>` : ''}

  <hr class="divider"/>

  <!-- Financial Summary -->
  <h2>Resumo Financeiro</h2>
  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">Valor base</span>
      <span class="summary-value">${amount}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">IVA (23%)</span>
      <span class="summary-value">${quote.total_amount ? `€${(Number(quote.total_amount) * 0.23).toFixed(2)}` : 'A calcular'}</span>
    </div>
    <div class="summary-row" style="padding-top:20px">
      <span style="font-family:'Libre Baskerville',serif;font-size:16px;color:#f0ece4">Total com IVA</span>
      <span class="summary-value" style="font-size:22px">${quote.total_amount ? `€${(Number(quote.total_amount) * 1.23).toFixed(2)}` : 'A definir'}</span>
    </div>
  </div>

  <!-- Conditions -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(154,124,74,0.10);margin:24px 0">
    ${[
      ['Condições de Pagamento', '50% início · 50% antes envio'],
      ['Prazo de Entrega', '10–20 dias úteis após aprovação'],
      ['Aprovação de Arte', 'Mockup incluído gratuitamente'],
      ['Envio', 'Portugal continental · Ilhas · Europa'],
    ].map(([l, v]) => `<div class="card"><div class="card-label">${l}</div><div class="card-value" style="font-size:12px">${v}</div></div>`).join('')}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">your<span>gift</span>.pt &nbsp;·&nbsp; <span style="color:rgba(240,236,228,0.28);font-family:'Montserrat',sans-serif;font-size:10px">Lisboa, Portugal</span></div>
    <div class="footer-contact">
      geral@yourgift.pt<br/>
      +351 210 000 000<br/>
      <span style="color:rgba(240,236,228,0.18)">yourgift.pt · ${new Date().getFullYear()}</span>
    </div>
  </div>
</div>

<script>
  // Auto-print when opened directly
  if(window.location.search.includes('print=1')) {
    window.onload = () => window.print();
  }
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
}
