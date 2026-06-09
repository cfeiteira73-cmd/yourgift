import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S17: Executive Superintelligence ────────────────────────────────
//
// CEO-level "one screen" aggregating all OS signals: orders, revenue, procurement,
// inventory, QC, customer health, supplier performance — with AI brief generation.
//
// GET  ?mode=snapshot            — latest executive snapshot (or generate if stale)
// GET  ?mode=live                — live KPI aggregation (real-time, no cache)
// GET  ?mode=history             — snapshot history for trend analysis
// POST { action:'generate' }     — force generate new AI executive brief
// POST { action:'forecast' }     — AI revenue + business forecast
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_SONNET = 'claude-3-5-sonnet-20241022';
const CLAUDE_HAIKU  = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 800, model = CLAUDE_HAIKU): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

async function aggregateLiveKPIs(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const startOf30d = new Date(Date.now() - 30 * 86400000).toISOString();
  const startOf7d  = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    ordersMonth, ordersPrevMonth, orders7d,
    quotesPending, clientsTotal,
    rfqsActive, rfqsAwarded,
    inventoryAlerts, invTotal,
    qcRecent, customerHealth,
  ] = await Promise.all([
    // Orders this month
    supabase.from('orders').select('total, status').gte('created_at', startOfMonth),
    // Orders prev month
    supabase.from('orders').select('total').gte('created_at', startOfPrevMonth).lt('created_at', startOfMonth),
    // Orders last 7d
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', startOf7d),
    // Pending quotes
    supabase.from('quotes').select('id', { count: 'exact', head: true }).in('status', ['submitted','pricing','proposed']),
    // Total clients
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    // Active RFQs
    supabase.from('omega_x_rfqs').select('id', { count: 'exact', head: true }).in('status', ['sent','responses_received','negotiating']),
    // Awarded RFQs this month
    supabase.from('omega_x_rfqs').select('savings_amount').eq('status', 'awarded').gte('updated_at', startOfMonth),
    // Inventory alerts
    supabase.from('omega_x_inventory').select('id', { count: 'exact', head: true }).in('status', ['low_stock','out_of_stock']),
    // Inventory value
    supabase.from('omega_x_inventory').select('total_value'),
    // Recent QC pass rate
    supabase.from('omega_x_qc_inspections').select('pass_rate, overall_score, status').gte('created_at', startOf30d),
    // Customer health
    supabase.from('omega_x_customer_health').select('health_score, churn_risk, upsell_score'),
  ]);

  // Artwork pending (table may not exist in all environments)
  let artworkPendingCount = 0;
  try {
    const aw = await supabase.from('artwork_submissions')
      .select('id', { count: 'exact', head: true }).eq('status', 'pending_review');
    artworkPendingCount = aw.count ?? 0;
  } catch { /* table may not exist */ }

  type OrderRow    = { total: number | null; status: string | null };
  type SavingsRow  = { savings_amount: number | null };
  type QCRow       = { pass_rate: number | null; overall_score: number | null; status: string | null };
  type HealthRow   = { health_score: number; churn_risk: string; upsell_score: number | null };
  type InvRow      = { total_value: number | null };

  const ordM: OrderRow[]   = (ordersMonth.data ?? []) as OrderRow[];
  const ordPM: OrderRow[]  = (ordersPrevMonth.data ?? []) as OrderRow[];

  const revenueMonth = ordM.reduce((s: number, o: OrderRow) => s + Number(o.total ?? 0), 0);
  const revenuePrevMonth = ordPM.reduce((s: number, o: OrderRow) => s + Number(o.total ?? 0), 0);
  const revenueMoM = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : 0;

  const ordersInProgress = ordM.filter((o: OrderRow) => !['delivered','cancelled'].includes(o.status ?? '')).length;

  const savingsMonth = ((rfqsAwarded.data ?? []) as SavingsRow[]).reduce((s: number, r: SavingsRow) => s + Number(r.savings_amount ?? 0), 0);

  const qcData: QCRow[] = (qcRecent.data ?? []) as QCRow[];
  const avgQCScore = qcData.length > 0 ? qcData.reduce((s: number, q: QCRow) => s + Number(q.overall_score ?? 0), 0) / qcData.length : 0;
  const qcPassRate = qcData.length > 0 ? qcData.filter((q: QCRow) => q.status === 'passed').length / qcData.length * 100 : 0;

  const health: HealthRow[] = (customerHealth.data ?? []) as HealthRow[];
  const avgHealthScore = health.length > 0 ? health.reduce((s: number, h: HealthRow) => s + h.health_score, 0) / health.length : 0;
  const atRiskClients = health.filter((h: HealthRow) => ['high','critical'].includes(h.churn_risk)).length;
  const upsellOpps = health.filter((h: HealthRow) => (h.upsell_score ?? 0) >= 60).length;

  const invValue = ((invTotal.data ?? []) as InvRow[]).reduce((s: number, i: InvRow) => s + Number(i.total_value ?? 0), 0);

  // Business health benchmark score (0-100)
  let benchmarkScore = 50;
  if (revenueMoM > 0) benchmarkScore += 10;
  if (revenueMoM > 10) benchmarkScore += 5;
  if ((inventoryAlerts.count ?? 0) === 0) benchmarkScore += 5;
  if (avgHealthScore >= 65) benchmarkScore += 10;
  if (qcPassRate >= 90) benchmarkScore += 10;
  if (atRiskClients === 0) benchmarkScore += 5;
  if (savingsMonth > 0) benchmarkScore += 5;
  benchmarkScore = Math.min(100, benchmarkScore);

  return {
    // Revenue
    revenue_mtd: revenueMonth,
    revenue_prev_month: revenuePrevMonth,
    revenue_mom_pct: revenueMoM,
    // Orders
    orders_mtd: ordM.length,
    orders_7d: orders7d.count ?? 0,
    orders_in_progress: ordersInProgress,
    // Commercial
    quotes_pending: quotesPending.count ?? 0,
    clients_total: clientsTotal.count ?? 0,
    // Procurement
    rfqs_active: rfqsActive.count ?? 0,
    savings_mtd: savingsMonth,
    // Inventory
    inventory_alerts: inventoryAlerts.count ?? 0,
    inventory_value: invValue,
    // QC
    qc_avg_score: avgQCScore,
    qc_pass_rate: qcPassRate,
    // Customer health
    avg_customer_health: avgHealthScore,
    at_risk_clients: atRiskClients,
    upsell_opportunities: upsellOpps,
    // Artwork
    artwork_pending: artworkPendingCount,
    // Meta
    benchmark_score: benchmarkScore,
    computed_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'snapshot';

  // ── Latest snapshot (with staleness check) ───────────────────────────────
  if (mode === 'snapshot') {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('omega_x_executive_snapshots')
      .select('*').eq('snapshot_date', today).eq('period', 'daily').maybeSingle();

    if (existing) return NextResponse.json({ snapshot: existing, source: 'cache' });

    // Generate fresh
    const kpis = await aggregateLiveKPIs(supabase);
    return NextResponse.json({ kpis, source: 'live', snapshot: null });
  }

  // ── Live KPIs ─────────────────────────────────────────────────────────────
  if (mode === 'live') {
    const kpis = await aggregateLiveKPIs(supabase);
    return NextResponse.json({ kpis });
  }

  // ── Snapshot history ──────────────────────────────────────────────────────
  if (mode === 'history') {
    const { data: snapshots } = await supabase.from('omega_x_executive_snapshots')
      .select('snapshot_date, period, benchmark_score, kpis')
      .order('snapshot_date', { ascending: false }).limit(30);
    return NextResponse.json({ snapshots: snapshots ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Generate full AI executive brief ─────────────────────────────────────
  if (action === 'generate') {
    const kpis = await aggregateLiveKPIs(supabase);
    const today = new Date().toISOString().split('T')[0];

    const briefPrompt = `
Negócio: YourGift — empresa B2B de merchandising e produtos personalizados, Portugal.
KPIs hoje:
- Receita MTD: €${Number(kpis.revenue_mtd).toFixed(0)} (${Number(kpis.revenue_mom_pct) >= 0 ? '+' : ''}${Number(kpis.revenue_mom_pct).toFixed(1)}% vs mês anterior)
- Encomendas MTD: ${kpis.orders_mtd} (${kpis.orders_7d} últimos 7 dias)
- Orçamentos pendentes: ${kpis.quotes_pending}
- RFQs procurement ativos: ${kpis.rfqs_active}
- Poupanças procurement MTD: €${Number(kpis.savings_mtd).toFixed(0)}
- Alertas inventário: ${kpis.inventory_alerts}
- Score médio QC: ${Number(kpis.qc_avg_score).toFixed(0)}/100 (pass rate ${Number(kpis.qc_pass_rate).toFixed(0)}%)
- Saúde clientes: ${Number(kpis.avg_customer_health).toFixed(0)}/100 média (${kpis.at_risk_clients} em risco)
- Oportunidades upsell: ${kpis.upsell_opportunities}
- Score geral negócio: ${kpis.benchmark_score}/100

Gera um briefing executivo diário em JSON com os campos:
{
  "brief": "resumo executivo de 3-4 frases para o CEO (em português)",
  "risks": [{"title": string, "description": string, "severity": "low"|"medium"|"high"}],
  "opportunities": [{"title": string, "description": string, "potential": string}],
  "actions": [{"action": string, "owner": string, "deadline": string, "impact": string}]
}
Máximo 2 riscos, 2 oportunidades, 3 ações prioritárias. Conciso, direto.`;

    const aiResponse = await callClaude(
      'És o Chief Intelligence Officer da YourGift. Analisas dados e generates briefings estratégicos. Responde em JSON válido.',
      briefPrompt,
      1000,
      CLAUDE_SONNET,
    );

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(aiResponse); } catch { /* fallback */ }

    const snapshot = {
      snapshot_date: today,
      period: 'daily',
      kpis,
      ai_brief: parsed.brief as string ?? null,
      ai_risks: parsed.risks ?? [],
      ai_opportunities: parsed.opportunities ?? [],
      ai_actions: parsed.actions ?? [],
      benchmark_score: kpis.benchmark_score,
      generated_at: new Date().toISOString(),
    };

    await supabase.from('omega_x_executive_snapshots')
      .upsert(snapshot, { onConflict: 'snapshot_date,period' });

    return NextResponse.json({ snapshot, ai_response: parsed, action: 'generated' });
  }

  // ── Forecast ──────────────────────────────────────────────────────────────
  if (action === 'forecast') {
    const kpis = await aggregateLiveKPIs(supabase);

    // Get last 3 months snapshots for trend
    const { data: history } = await supabase.from('omega_x_executive_snapshots')
      .select('snapshot_date, kpis').order('snapshot_date', { ascending: false }).limit(90);

    const forecastText = await callClaude(
      'És um analista financeiro especializado em B2B. Responde em JSON.',
      `YourGift — B2B merchandising Portugal.
KPIs atuais: receita MTD €${Number(kpis.revenue_mtd).toFixed(0)}, MoM ${Number(kpis.revenue_mom_pct).toFixed(1)}%, ${kpis.orders_mtd} encomendas, ${kpis.clients_total} clientes, score ${kpis.benchmark_score}/100.
Histórico disponível: ${history?.length ?? 0} snapshots.
Gera forecast em JSON: { "revenue_next_30d": number, "revenue_next_90d": number, "orders_next_30d": number, "growth_trajectory": "accelerating"|"stable"|"declining", "confidence": 0-1, "key_drivers": [string], "risks": [string] }`,
      500,
    );

    let forecast: Record<string, unknown> = {};
    try { forecast = JSON.parse(forecastText); } catch { /* empty */ }

    return NextResponse.json({ forecast, current_kpis: kpis, action: 'forecast_generated' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
