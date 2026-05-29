import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// ── OMEGA WORLDCLASS — Executive Brief API ────────────────────────────────────
//
// X6 Executive Superintelligence: Autonomous AI-generated executive intelligence.
//
// GET  ?mode=brief     — full AI executive briefing (today's summary)
// GET  ?mode=kpis      — real KPI snapshot (revenue, orders, clients, margins)
// GET  ?mode=anomalies — detected business anomalies requiring attention
// GET  ?mode=forecast  — 30-day forward projection based on trend
//
// Intelligence generated:
//   - Revenue vs target gap analysis
//   - Order velocity trend (7d vs prior 7d)
//   - Client acquisition rate
//   - Average order value momentum
//   - Top performing product categories
//   - Payment risk surface (disputed / overdue)
//   - Production SLA health
//   - AI-generated narrative summary with strategic recommendations
//
// Admin-only endpoint.
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchRevenueMetrics(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

  const [thisMonth, lastMonth, last7d, prior7d] = await Promise.all([
    db!.from('orders')
      .select('total_amount, status')
      .gte('created_at', startOfMonth)
      .in('status', ['confirmed', 'shipped', 'delivered']),
    db!.from('orders')
      .select('total_amount')
      .gte('created_at', startOfLastMonth)
      .lte('created_at', endOfLastMonth)
      .in('status', ['confirmed', 'shipped', 'delivered']),
    db!.from('orders')
      .select('total_amount, created_at')
      .gte('created_at', sevenDaysAgo)
      .in('status', ['confirmed', 'shipped', 'delivered']),
    db!.from('orders')
      .select('total_amount')
      .gte('created_at', fourteenDaysAgo)
      .lte('created_at', sevenDaysAgo)
      .in('status', ['confirmed', 'shipped', 'delivered']),
  ]);

  const revenueThisMonth = (thisMonth.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const revenueLastMonth = (lastMonth.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const revenueLast7d = (last7d.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const revenuePrior7d = (prior7d.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

  const ordersThisMonth = thisMonth.data?.length ?? 0;
  const ordersLast7d = last7d.data?.length ?? 0;
  const ordersPrior7d = prior7d.data?.length ?? 0;

  const momGrowth = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : null;
  const velocityChange = revenuePrior7d > 0
    ? ((revenueLast7d - revenuePrior7d) / revenuePrior7d) * 100
    : null;
  const orderVelocityChange = ordersPrior7d > 0
    ? ((ordersLast7d - ordersPrior7d) / ordersPrior7d) * 100
    : null;

  return {
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth,
    ordersLast7d,
    momGrowth,
    velocityChange,
    orderVelocityChange,
    avgOrderValue: ordersThisMonth > 0 ? revenueThisMonth / ordersThisMonth : 0,
  };
}

async function fetchClientMetrics(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const [total, newThisMonth, newLastMonth, activeThisMonth] = await Promise.all([
    db!.from('clients').select('id', { count: 'exact', head: true }),
    db!.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    db!.from('clients').select('id', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo).lte('created_at', thirtyDaysAgo),
    db!.from('orders').select('client_id').gte('created_at', thirtyDaysAgo)
      .in('status', ['confirmed', 'shipped', 'delivered']),
  ]);

  const uniqueActiveClients = new Set((activeThisMonth.data ?? []).map(o => o.client_id)).size;
  const acquisitionGrowth = (newLastMonth.count ?? 0) > 0
    ? (((newThisMonth.count ?? 0) - (newLastMonth.count ?? 0)) / (newLastMonth.count ?? 1)) * 100
    : null;

  return {
    totalClients: total.count ?? 0,
    newClientsThisMonth: newThisMonth.count ?? 0,
    activeClientsThisMonth: uniqueActiveClients,
    acquisitionGrowth,
  };
}

async function fetchPaymentRisk(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const [overdue, disputed, pendingHigh] = await Promise.all([
    db!.from('invoices')
      .select('total_amount')
      .lt('due_date', new Date().toISOString())
      .in('status', ['pending', 'partial']),
    db!.from('omega_final_disputes')
      .select('amount')
      .in('status', ['warning_needs_response', 'needs_response', 'under_review']),
    db!.from('orders')
      .select('total_amount')
      .eq('payment_status', 'pending')
      .gt('total_amount', 5000)
      .in('status', ['confirmed', 'shipped']),
  ]);

  const overdueAmount = (overdue.data ?? []).reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const disputedAmount = (disputed.data ?? []).reduce((s, d) => s + (d.amount ?? 0), 0);
  const pendingHighValue = (pendingHigh.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

  return {
    overdueInvoices: overdue.data?.length ?? 0,
    overdueAmount,
    activeDisputes: disputed.data?.length ?? 0,
    disputedAmount,
    highValuePending: pendingHigh.data?.length ?? 0,
    pendingHighValue,
    riskScore: Math.min(100, (overdue.data?.length ?? 0) * 4 + (disputed.data?.length ?? 0) * 8),
  };
}

async function fetchProductionHealth(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const slaThreshold = new Date(Date.now() - 6 * 3600000).toISOString(); // 6h SLA

  const [inProduction, slaBreached, pendingQC] = await Promise.all([
    db!.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['in_production', 'in_artwork', 'in_sampling']),
    db!.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['in_production', 'in_artwork'])
      .lt('status_updated_at', slaThreshold),
    db!.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'quality_check'),
  ]);

  const slaHealthPct = (inProduction.count ?? 0) > 0
    ? Math.round((1 - (slaBreached.count ?? 0) / (inProduction.count ?? 1)) * 100)
    : 100;

  return {
    ordersInProduction: inProduction.count ?? 0,
    slaBreaches: slaBreached.count ?? 0,
    pendingQC: pendingQC.count ?? 0,
    slaHealthPct,
  };
}

async function fetchTopCategories(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data } = await db!.from('order_items')
    .select('quantity, unit_price, products(category)')
    .gte('created_at', thirtyDaysAgo)
    .limit(500);

  const catMap: Record<string, { revenue: number; units: number }> = {};
  for (const item of data ?? []) {
    const cat = (item.products as { category?: string } | null)?.category ?? 'outro';
    if (!catMap[cat]) catMap[cat] = { revenue: 0, units: 0 };
    catMap[cat].revenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
    catMap[cat].units += item.quantity ?? 0;
  }

  return Object.entries(catMap)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

// ── 30-day forecast (linear extrapolation from last 60 days) ──────────────────

async function buildForecast(db: ReturnType<typeof getAdminDb> | Awaited<ReturnType<typeof createClient>>) {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const { data } = await db!.from('orders')
    .select('total_amount, created_at')
    .gte('created_at', sixtyDaysAgo)
    .in('status', ['confirmed', 'shipped', 'delivered'])
    .order('created_at', { ascending: true });

  const orders = data ?? [];
  if (orders.length < 5) {
    return { projected30d: null, confidence: 'low', weeklyTrend: [] };
  }

  // Bucket by week
  const weeks: Record<number, number> = {};
  for (const o of orders) {
    const week = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (7 * 86400000));
    weeks[week] = (weeks[week] ?? 0) + (o.total_amount ?? 0);
  }
  const weeklyValues = Object.entries(weeks)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 8)
    .map(([w, v]) => ({ week: Number(w), revenue: v }))
    .reverse();

  // Linear regression slope
  const n = weeklyValues.length;
  const xMean = (n - 1) / 2;
  const yMean = weeklyValues.reduce((s, w) => s + w.revenue, 0) / n;
  let num = 0, den = 0;
  weeklyValues.forEach((w, i) => {
    num += (i - xMean) * (w.revenue - yMean);
    den += (i - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const lastWeekRevenue = weeklyValues[weeklyValues.length - 1]?.revenue ?? 0;

  // Project 4 weeks forward
  const projected30d = Math.max(0, (lastWeekRevenue + slope * 4) * 4);
  const confidence = Math.abs(slope) / (yMean || 1) < 0.3 ? 'high' : Math.abs(slope) / (yMean || 1) < 0.6 ? 'medium' : 'low';

  return { projected30d: Math.round(projected30d * 100) / 100, confidence, weeklyTrend: weeklyValues };
}

// ── AI Executive Brief generation ─────────────────────────────────────────────

async function generateExecutiveBrief(data: {
  revenue: Awaited<ReturnType<typeof fetchRevenueMetrics>>;
  clients: Awaited<ReturnType<typeof fetchClientMetrics>>;
  paymentRisk: Awaited<ReturnType<typeof fetchPaymentRisk>>;
  production: Awaited<ReturnType<typeof fetchProductionHealth>>;
  topCategories: Awaited<ReturnType<typeof fetchTopCategories>>;
  forecast: Awaited<ReturnType<typeof buildForecast>>;
}): Promise<{ narrative: string; recommendations: string[]; riskAlerts: string[] }> {
  if (!ANTHROPIC_API_KEY) {
    return { narrative: '', recommendations: [], riskAlerts: [] };
  }

  const prompt = `Dados do negócio YourGift hoje (${new Date().toLocaleDateString('pt-PT')}):

RECEITA:
- Este mês: €${data.revenue.revenueThisMonth.toFixed(0)} (MoM: ${data.revenue.momGrowth?.toFixed(1) ?? 'N/D'}%)
- Última semana: €${(data.revenue.revenueLast7d ?? 0).toFixed(0)} (vs semana anterior: ${data.revenue.velocityChange?.toFixed(1) ?? 'N/D'}%)
- Valor médio por encomenda: €${data.revenue.avgOrderValue.toFixed(0)}
- Encomendas este mês: ${data.revenue.ordersThisMonth}

CLIENTES:
- Total: ${data.clients.totalClients} | Novos (30d): ${data.clients.newClientsThisMonth} | Ativos (30d): ${data.clients.activeClientsThisMonth}
- Crescimento aquisição: ${data.clients.acquisitionGrowth?.toFixed(1) ?? 'N/D'}%

RISCO FINANCEIRO:
- Faturas em atraso: ${data.paymentRisk.overdueInvoices} (€${data.paymentRisk.overdueAmount.toFixed(0)})
- Disputas ativas: ${data.paymentRisk.activeDisputes} (€${data.paymentRisk.disputedAmount.toFixed(0)})

PRODUÇÃO:
- Em produção: ${data.production.ordersInProduction} | SLA violado: ${data.production.slaBreaches} | Controlo qualidade: ${data.production.pendingQC}
- Saúde SLA: ${data.production.slaHealthPct}%

TOP CATEGORIAS (30d):
${data.topCategories.map(c => `- ${c.category}: €${c.revenue.toFixed(0)} (${c.units} unidades)`).join('\n')}

PREVISÃO 30 DIAS:
- Projetado: €${data.forecast.projected30d?.toFixed(0) ?? 'N/D'} (confiança: ${data.forecast.confidence})

Com base nestes dados reais, gera:
1. Um resumo executivo conciso (3-4 frases, em português, tom de CFO/COO)
2. 3 recomendações estratégicas prioritárias (acionáveis, específicas)
3. 2-3 alertas de risco que requerem atenção imediata

Responde em JSON: { "narrative": "...", "recommendations": ["...", "...", "..."], "riskAlerts": ["...", "..."] }`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        system: 'És um CFO/COO AI que gera briefings executivos precisos e acionáveis. Responde APENAS em JSON válido, sem markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return { narrative: '', recommendations: [], riskAlerts: [] };
    const d = await res.json();
    const text = d.content?.[0]?.text ?? '{}';
    try {
      const parsed = JSON.parse(text);
      return {
        narrative: parsed.narrative ?? '',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        riskAlerts: Array.isArray(parsed.riskAlerts) ? parsed.riskAlerts : [],
      };
    } catch {
      return { narrative: text, recommendations: [], riskAlerts: [] };
    }
  } catch {
    return { narrative: '', recommendations: [], riskAlerts: [] };
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'brief';

  try {
    if (mode === 'kpis') {
      const [revenue, clients, paymentRisk, production] = await Promise.all([
        fetchRevenueMetrics(db),
        fetchClientMetrics(db),
        fetchPaymentRisk(db),
        fetchProductionHealth(db),
      ]);
      return NextResponse.json({ revenue, clients, paymentRisk, production, generatedAt: new Date().toISOString() });
    }

    if (mode === 'forecast') {
      const [revenue, forecast] = await Promise.all([
        fetchRevenueMetrics(db),
        buildForecast(db),
      ]);
      return NextResponse.json({ revenue, forecast, generatedAt: new Date().toISOString() });
    }

    if (mode === 'anomalies') {
      const [revenue, paymentRisk, production] = await Promise.all([
        fetchRevenueMetrics(db),
        fetchPaymentRisk(db),
        fetchProductionHealth(db),
      ]);

      const anomalies: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; message: string; value?: number }> = [];

      if (revenue.velocityChange !== null && revenue.velocityChange < -20) {
        anomalies.push({ type: 'revenue_drop', severity: 'critical', message: `Receita semanal caiu ${Math.abs(revenue.velocityChange).toFixed(1)}% vs semana anterior`, value: revenue.velocityChange });
      }
      if (paymentRisk.overdueInvoices > 5) {
        anomalies.push({ type: 'overdue_spike', severity: 'critical', message: `${paymentRisk.overdueInvoices} faturas em atraso (€${paymentRisk.overdueAmount.toFixed(0)})`, value: paymentRisk.overdueAmount });
      }
      if (paymentRisk.activeDisputes > 0) {
        anomalies.push({ type: 'disputes', severity: 'warning', message: `${paymentRisk.activeDisputes} disputas de pagamento ativas`, value: paymentRisk.activeDisputes });
      }
      if (production.slaBreaches > 3) {
        anomalies.push({ type: 'sla_breach', severity: 'critical', message: `${production.slaBreaches} encomendas violaram SLA de produção`, value: production.slaBreaches });
      }
      if (revenue.orderVelocityChange !== null && revenue.orderVelocityChange < -15) {
        anomalies.push({ type: 'order_slowdown', severity: 'warning', message: `Volume de encomendas caiu ${Math.abs(revenue.orderVelocityChange).toFixed(1)}% esta semana`, value: revenue.orderVelocityChange });
      }
      if (production.pendingQC > 10) {
        anomalies.push({ type: 'qc_backlog', severity: 'warning', message: `Backlog de controlo de qualidade: ${production.pendingQC} encomendas pendentes` });
      }

      return NextResponse.json({ anomalies, count: anomalies.length, generatedAt: new Date().toISOString() });
    }

    // Default: full brief mode
    const [revenue, clients, paymentRisk, production, topCategories, forecast] = await Promise.all([
      fetchRevenueMetrics(db),
      fetchClientMetrics(db),
      fetchPaymentRisk(db),
      fetchProductionHealth(db),
      fetchTopCategories(db),
      buildForecast(db),
    ]);

    const aiInsight = await generateExecutiveBrief({ revenue, clients, paymentRisk, production, topCategories, forecast });

    // Composite health score (0-100)
    const healthScore = Math.max(0, Math.min(100,
      60 +
      (revenue.velocityChange !== null ? Math.min(20, Math.max(-20, revenue.velocityChange / 2)) : 0) +
      (production.slaHealthPct - 80) * 0.5 -
      paymentRisk.riskScore * 0.2
    ));

    return NextResponse.json({
      brief: {
        narrative: aiInsight.narrative,
        recommendations: aiInsight.recommendations,
        riskAlerts: aiInsight.riskAlerts,
      },
      kpis: { revenue, clients, paymentRisk, production },
      topCategories,
      forecast,
      healthScore: Math.round(healthScore),
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[executive-brief]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
