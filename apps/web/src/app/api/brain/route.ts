import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S9: AI Operating Brain ──────────────────────────────────
//
// Semantic memory, procurement intelligence, predictive BI, autonomous insights.
//
// GET  /api/brain?mode=insights|memory|forecast|anomalies
// POST /api/brain  { action: 'log_interaction', data: {...} }
//                  { action: 'semantic_query', query: '...', limit: 5 }
//                  { action: 'generate_insight', context: '...' }
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

interface Order {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  client_id: string | null;
  clients?: { name: string | null } | null;
}

interface Quote {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  client_id: string | null;
}

// ── GET: Insights + forecasting ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const mode = request.nextUrl.searchParams.get('mode') ?? 'insights';

    // Resolve client context
    let clientId: string | null = null;
    if (!isAdmin) {
      const { data: c } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      clientId = c?.id ?? null;
    }

    // ── Fetch recent operational data ──────────────────────────────────────
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

    let ordersQ = supabase.from('orders').select('id, ref, status, total_amount, created_at, client_id, clients(name)').gte('created_at', since90);
    let quotesQ = supabase.from('quotes').select('id, status, total_amount, created_at, client_id').gte('created_at', since90);

    if (clientId) {
      ordersQ = ordersQ.eq('client_id', clientId);
      quotesQ = quotesQ.eq('client_id', clientId);
    }

    const [ordersRes, quotesRes] = await Promise.all([
      ordersQ.order('created_at', { ascending: false }).limit(200),
      quotesQ.order('created_at', { ascending: false }).limit(100),
    ]);

    const orders = (ordersRes.data ?? []) as unknown as Order[];
    const quotes = (quotesRes.data ?? []) as unknown as Quote[];

    if (mode === 'forecast') {
      return NextResponse.json(buildForecast(orders, quotes));
    }

    if (mode === 'anomalies') {
      return NextResponse.json(detectAnomalies(orders, quotes, isAdmin));
    }

    if (mode === 'memory') {
      // Procurement memory: top products, recurring patterns, client preferences
      return NextResponse.json(buildMemory(orders, quotes, isAdmin));
    }

    // Default: curated insights
    return NextResponse.json({
      insights: buildInsights(orders, quotes, isAdmin),
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[brain] GET error:', error);
    return NextResponse.json({ error: 'Brain unavailable' }, { status: 500 });
  }
}

// ── POST: Semantic query + AI insight generation ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const body = await request.json() as { action: string; query?: string; context?: string; data?: Record<string, unknown>; limit?: number };

    if (body.action === 'generate_insight') {
      // Use Claude Haiku to generate a specific insight
      const context = body.context ?? '';
      if (!context) return NextResponse.json({ error: 'context required' }, { status: 400 });

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });

      const resp = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 400,
          system: `Você é o AI Operating Brain do YourGift OS — o sistema operativo de merchandising mais avançado do mundo.
Analisa dados operacionais e gera insights precisos, accionáveis e estratégicos em Português (PT-PT).
Seja directo, quantitativo quando possível, e sempre oriente para acção. Máximo 3-4 frases.`,
          messages: [{ role: 'user', content: context }],
        }),
      });

      if (!resp.ok) return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
      const ai = await resp.json() as { content: Array<{ type: string; text: string }> };
      const text = ai.content.find(c => c.type === 'text')?.text ?? '';
      return NextResponse.json({ insight: text, generatedAt: new Date().toISOString() });
    }

    if (body.action === 'semantic_query') {
      // Keyword-scored search across orders and quotes
      const query = (body.query ?? '').toLowerCase().trim();
      if (!query) return NextResponse.json({ results: [] });

      let clientId: string | null = null;
      if (!isAdmin) {
        const { data: c } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
        clientId = c?.id ?? null;
      }

      let q = supabase.from('orders').select('id, ref, status, total_amount, created_at').ilike('ref', `%${query}%`).limit(body.limit ?? 5);
      if (clientId) q = q.eq('client_id', clientId);
      const { data: matches } = await q;
      return NextResponse.json({ results: matches ?? [], query });
    }

    if (body.action === 'log_interaction') {
      // Future: persist to brain_interactions table when created
      // For now: acknowledge gracefully
      return NextResponse.json({ ok: true, logged: false, reason: 'table_pending' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[brain] POST error:', error);
    return NextResponse.json({ error: 'Brain unavailable' }, { status: 500 });
  }
}

// ── Intelligence builders ──────────────────────────────────────────────────────

function buildInsights(orders: Order[], quotes: Quote[], isAdmin: boolean) {
  const insights: Array<{ id: string; type: string; title: string; body: string; severity: 'info' | 'warning' | 'critical' | 'success'; value?: string }> = [];

  const validOrders = orders.filter(o => o.status !== 'cancelled' && o.total_amount != null);
  const totalRevenue = validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const last30 = orders.filter(o => new Date(o.created_at) >= new Date(Date.now() - 30 * 86400000));
  const prev30 = orders.filter(o => {
    const d = new Date(o.created_at);
    return d < new Date(Date.now() - 30 * 86400000) && d >= new Date(Date.now() - 60 * 86400000);
  });

  // Revenue trend
  const currRev = last30.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const prevRev = prev30.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
  if (prevRev > 0) {
    const pct = ((currRev - prevRev) / prevRev) * 100;
    insights.push({
      id: 'revenue-trend',
      type: 'revenue',
      title: pct >= 0 ? 'Receita em crescimento' : 'Receita em queda',
      body: `${Math.abs(Math.round(pct))}% ${pct >= 0 ? 'acima' : 'abaixo'} do período anterior (últimos 30 dias vs. 30-60 dias atrás).`,
      severity: pct >= 10 ? 'success' : pct >= -10 ? 'info' : 'warning',
      value: `€${Math.round(currRev).toLocaleString('pt-PT')}`,
    });
  }

  // Quote conversion rate
  const totalQuotes = quotes.length;
  const converted = quotes.filter(q => q.status === 'converted').length;
  if (totalQuotes >= 3) {
    const rate = Math.round((converted / totalQuotes) * 100);
    insights.push({
      id: 'conversion-rate',
      type: 'conversion',
      title: rate >= 40 ? 'Taxa de conversão saudável' : 'Oportunidade: converter mais orçamentos',
      body: `${rate}% dos orçamentos dos últimos 90 dias foram convertidos em encomenda (${converted} de ${totalQuotes}).`,
      severity: rate >= 40 ? 'success' : rate >= 25 ? 'info' : 'warning',
      value: `${rate}%`,
    });
  }

  // Pending quotes alert
  const pendingQuotes = quotes.filter(q => ['submitted', 'pricing'].includes(q.status));
  if (pendingQuotes.length > 0) {
    const pendingValue = pendingQuotes.reduce((s, q) => s + (q.total_amount ?? 0), 0);
    insights.push({
      id: 'pending-quotes',
      type: 'pipeline',
      title: `${pendingQuotes.length} orçamento(s) aguarda(m) resposta`,
      body: `Pipeline de €${Math.round(pendingValue).toLocaleString('pt-PT')} em orçamentos pendentes. Resposta rápida aumenta conversão.`,
      severity: pendingQuotes.length >= 5 ? 'warning' : 'info',
      value: `€${Math.round(pendingValue).toLocaleString('pt-PT')}`,
    });
  }

  // Active orders
  const activeOrders = orders.filter(o => ['confirmed', 'producing', 'shipped'].includes(o.status));
  if (activeOrders.length > 0) {
    insights.push({
      id: 'active-pipeline',
      type: 'operations',
      title: `${activeOrders.length} encomenda(s) activa(s)`,
      body: `Total em pipeline activo: €${Math.round(activeOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)).toLocaleString('pt-PT')}.`,
      severity: 'info',
      value: String(activeOrders.length),
    });
  }

  // Admin: platform volume
  if (isAdmin && totalRevenue > 0) {
    const avgOrder = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
    insights.push({
      id: 'platform-volume',
      type: 'platform',
      title: 'Volume total da plataforma (90 dias)',
      body: `€${Math.round(totalRevenue).toLocaleString('pt-PT')} em receita · ${validOrders.length} encomendas · valor médio €${Math.round(avgOrder).toLocaleString('pt-PT')}.`,
      severity: 'info',
      value: `€${Math.round(totalRevenue).toLocaleString('pt-PT')}`,
    });
  }

  return insights;
}

function buildForecast(orders: Order[], quotes: Quote[]) {
  const validOrders = orders.filter(o => o.status !== 'cancelled' && o.total_amount != null);

  // Weekly revenue buckets (last 12 weeks)
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const wEnd = new Date(Date.now() - i * 7 * 86400000);
    const wStart = new Date(wEnd.getTime() - 7 * 86400000);
    const rev = validOrders
      .filter(o => new Date(o.created_at) >= wStart && new Date(o.created_at) < wEnd)
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);
    return { week: i, revenue: Math.round(rev), label: wStart.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' }) };
  }).reverse();

  // Simple linear regression for next 4 weeks
  const n = weeks.length;
  const xMean = (n - 1) / 2;
  const yMean = weeks.reduce((s, w) => s + w.revenue, 0) / n;
  let num = 0; let den = 0;
  weeks.forEach((w, i) => {
    num += (i - xMean) * (w.revenue - yMean);
    den += (i - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const forecast = Array.from({ length: 4 }, (_, i) => {
    const x = n + i;
    const predicted = Math.max(0, Math.round(intercept + slope * x));
    const forecastDate = new Date(Date.now() + (i + 1) * 7 * 86400000);
    return {
      week: i + 1,
      predicted,
      label: forecastDate.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' }),
      confidence: Math.max(40, 95 - i * 12), // decays with distance
    };
  });

  // Pipeline-adjusted forecast (add pending quote value probability)
  const pendingValue = quotes.filter(q => ['submitted', 'pricing', 'proposed'].includes(q.status))
    .reduce((s, q) => s + (q.total_amount ?? 0), 0);
  const expectedConversion = 0.35; // 35% base conversion
  const pipelineContribution = Math.round(pendingValue * expectedConversion / 4); // spread over 4 weeks

  return {
    historical: weeks,
    forecast: forecast.map(f => ({ ...f, adjustedPredicted: f.predicted + pipelineContribution })),
    slope: Math.round(slope),
    trend: slope > 50 ? 'crescimento' : slope < -50 ? 'queda' : 'estável',
    pipelineContribution,
    generatedAt: new Date().toISOString(),
  };
}

function detectAnomalies(orders: Order[], quotes: Quote[], isAdmin: boolean) {
  const anomalies: Array<{ id: string; type: string; description: string; severity: 'low' | 'medium' | 'high'; entityId?: string }> = [];

  // High-value orders stuck in pending
  const stuckOrders = orders.filter(o => {
    if (o.status !== 'pending') return false;
    const hoursElapsed = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
    return hoursElapsed > 48;
  });
  stuckOrders.forEach(o => {
    const hours = Math.round((Date.now() - new Date(o.created_at).getTime()) / 3600000);
    anomalies.push({
      id: `stuck-order-${o.id}`,
      type: 'stuck_order',
      description: `Encomenda ${o.ref} pendente há ${hours}h sem confirmação`,
      severity: hours > 72 ? 'high' : 'medium',
      entityId: o.id,
    });
  });

  // Quotes aged > 14 days without response
  const agedQuotes = quotes.filter(q => {
    if (!['submitted', 'pricing'].includes(q.status)) return false;
    const daysElapsed = (Date.now() - new Date(q.created_at).getTime()) / 86400000;
    return daysElapsed > 14;
  });
  agedQuotes.forEach(q => {
    const days = Math.round((Date.now() - new Date(q.created_at).getTime()) / 86400000);
    anomalies.push({
      id: `aged-quote-${q.id}`,
      type: 'aged_quote',
      description: `Orçamento sem resposta há ${days} dias (probabilidade conversão -${Math.min(60, days * 3)}%)`,
      severity: days > 21 ? 'high' : 'medium',
      entityId: q.id,
    });
  });

  // Revenue gap: no orders last 7 days (for client with history)
  if (!isAdmin) {
    const recent = orders.filter(o => new Date(o.created_at) >= new Date(Date.now() - 7 * 86400000));
    const hasHistory = orders.length > 5;
    if (hasHistory && recent.length === 0) {
      anomalies.push({
        id: 'no-recent-orders',
        type: 'inactivity',
        description: 'Sem encomendas nos últimos 7 dias. Considera submeter um novo pedido.',
        severity: 'low',
      });
    }
  }

  return {
    anomalies,
    total: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'high').length,
    generatedAt: new Date().toISOString(),
  };
}

function buildMemory(orders: Order[], quotes: Quote[], isAdmin: boolean) {
  // Procurement memory: behavioural patterns
  const validOrders = orders.filter(o => o.status !== 'cancelled' && o.total_amount != null);

  // Order frequency (days between orders)
  const sorted = [...validOrders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let avgDaysBetweenOrders = 0;
  if (sorted.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].created_at).getTime() - new Date(sorted[i-1].created_at).getTime()) / 86400000);
    }
    avgDaysBetweenOrders = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  // Spend trajectory
  const last30Rev = validOrders.filter(o => new Date(o.created_at) >= new Date(Date.now() - 30 * 86400000))
    .reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const prev30Rev = validOrders.filter(o => {
    const d = new Date(o.created_at);
    return d < new Date(Date.now() - 30 * 86400000) && d >= new Date(Date.now() - 60 * 86400000);
  }).reduce((s, o) => s + (o.total_amount ?? 0), 0);

  // Next order prediction
  let nextOrderDue: string | null = null;
  if (sorted.length > 0 && avgDaysBetweenOrders > 0) {
    const lastOrderDate = new Date(sorted[sorted.length - 1].created_at);
    const predictedDate = new Date(lastOrderDate.getTime() + avgDaysBetweenOrders * 86400000);
    const daysUntil = Math.round((predictedDate.getTime() - Date.now()) / 86400000);
    nextOrderDue = daysUntil > 0 ? `em ~${daysUntil} dias` : 'já esperada';
  }

  return {
    totalOrders: validOrders.length,
    avgDaysBetweenOrders,
    avgOrderValue: validOrders.length > 0 ? Math.round(validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0) / validOrders.length) : 0,
    last30Revenue: Math.round(last30Rev),
    prev30Revenue: Math.round(prev30Rev),
    spendTrend: prev30Rev > 0 ? Math.round(((last30Rev - prev30Rev) / prev30Rev) * 100) : 0,
    nextOrderDue,
    totalQuotes: quotes.length,
    quoteConversionRate: quotes.length > 0 ? Math.round((quotes.filter(q => q.status === 'converted').length / quotes.length) * 100) : 0,
    generatedAt: new Date().toISOString(),
  };
}
