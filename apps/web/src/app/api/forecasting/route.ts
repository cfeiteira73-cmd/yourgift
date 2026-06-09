import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA ABSOLUTE FINAL — Phase 5: AI Forecasting Engine ────────────────────
//
// Revenue, margin, churn, and growth forecasting with AI recommendations.
// Uses real order/client/quote data to generate forward-looking intelligence.
//
// GET  ?mode=summary        — latest forecasts + key signals
// GET  ?mode=revenue        — revenue forecast (30/60/90d)
// GET  ?mode=churn          — churn risk forecast by cohort
// GET  ?mode=growth         — growth opportunities
// POST { action:'run' }     — force-generate all forecasts with AI
// POST { action:'scenario' }— what-if scenario analysis
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

async function callClaude(system: string, user: string, maxTokens = 600): Promise<string> {
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

async function gatherLiveData(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [orders30, orders60, orders90, clients, quotes, healthScores] = await Promise.all([
    supabase.from('orders').select('id, total_amount, status, created_at')
      .gte('created_at', d30).not('status', 'eq', 'cancelled'),
    supabase.from('orders').select('id, total_amount, status, created_at')
      .gte('created_at', d60).lt('created_at', d30).not('status', 'eq', 'cancelled'),
    supabase.from('orders').select('id, total_amount, status, created_at')
      .gte('created_at', d90).lt('created_at', d60).not('status', 'eq', 'cancelled'),
    supabase.from('clients').select('id, health_score, total_revenue, last_order_date').limit(200),
    supabase.from('quotes').select('id, total_amount, status').eq('status', 'pending').limit(50),
    supabase.from('omega_final_health_scores').select('overall_score, churn_probability, risk_level')
      .order('scored_at', { ascending: false }).limit(50),
  ]);

  const rev30 = (orders30.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const rev60 = (orders60.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const rev90 = (orders90.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  const avgRev = (rev30 + rev60 + rev90) / 3;
  const trend = rev30 > 0 && rev60 > 0 ? ((rev30 - rev60) / rev60) * 100 : 0;

  const pipelineValue = (quotes.data ?? []).reduce((s, q) => s + Number(q.total_amount ?? 0), 0);

  const avgChurn = (healthScores.data ?? []).length > 0
    ? (healthScores.data ?? []).reduce((s, h) => s + Number(h.churn_probability ?? 0), 0) / (healthScores.data ?? []).length
    : 0;

  const atRiskClients = (healthScores.data ?? []).filter(h => ['high', 'critical'].includes(h.risk_level ?? '')).length;
  const highHealthClients = (healthScores.data ?? []).filter(h => Number(h.overall_score ?? 0) >= 80).length;

  return {
    revenue: { last30: rev30, last60: rev60, last90: rev90, avg_monthly: avgRev, trend_pct: trend },
    orders: { count30: (orders30.data ?? []).length, count60: (orders60.data ?? []).length },
    clients: { total: (clients.data ?? []).length, at_risk: atRiskClients, healthy: highHealthClients },
    pipeline: { value: pipelineValue, count: (quotes.data ?? []).length },
    churn: { avg_probability: avgChurn },
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'summary';

  if (mode === 'summary') {
    const liveData = await gatherLiveData(supabase);

    // Projections (simple linear)
    const growthFactor = 1 + (liveData.revenue.trend_pct / 100);
    const proj30 = liveData.revenue.last30 * Math.max(0.5, Math.min(2, growthFactor));
    const proj60 = proj30 * Math.max(0.5, Math.min(2, growthFactor));
    const proj90 = proj60 * Math.max(0.5, Math.min(2, growthFactor));

    return NextResponse.json({
      live: liveData,
      projections: {
        next30d: Math.round(proj30),
        next60d: Math.round(proj60),
        next90d: Math.round(proj90),
        confidence: liveData.revenue.avg_monthly > 0 ? 'medium' : 'low',
      },
      signals: {
        pipeline_value: liveData.pipeline.value,
        pipeline_conversion_est: Math.round(liveData.pipeline.value * 0.35),
        at_risk_clients: liveData.clients.at_risk,
        churn_risk_revenue_est: Math.round(liveData.clients.at_risk * (liveData.revenue.avg_monthly / Math.max(liveData.clients.total, 1))),
      },
    });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'run') {
    const liveData = await gatherLiveData(supabase);

    const [revForecast, churnForecast, strategyRec] = await Promise.all([
      callClaude(
        'És um analista financeiro sénior de e-commerce B2B. Fazes previsões precisas e accionáveis em português.',
        `Dados de receita YourGift OS:
- Últimos 30d: €${liveData.revenue.last30.toFixed(0)} (${liveData.orders.count30} encomendas)
- 30-60d: €${liveData.revenue.last60.toFixed(0)} (${liveData.orders.count60} encomendas)
- Tendência: ${liveData.revenue.trend_pct.toFixed(1)}%
- Pipeline: €${liveData.pipeline.value.toFixed(0)} em ${liveData.pipeline.count} orçamentos
- Clientes em risco: ${liveData.clients.at_risk}/${liveData.clients.total}

Faz uma previsão de receita para os próximos 30, 60 e 90 dias com cenário optimista, base e pessimista. (máx 200 palavras)`,
        300,
      ),
      callClaude(
        'És um especialista em customer success e retenção B2B. Analisas risco de churn em português.',
        `Análise de churn YourGift OS:
- ${liveData.clients.at_risk} clientes em risco alto/crítico de ${liveData.clients.total} total
- Probabilidade média de churn: ${(liveData.churn.avg_probability * 100).toFixed(1)}%
- ${liveData.clients.healthy} clientes com score ≥80/100

Identifica os principais factores de risco e sugere 3 acções de retenção prioritárias. (máx 150 palavras)`,
        250,
      ),
      callClaude(
        'És o Chief Strategy Officer de uma plataforma B2B de merchandising. Pensas estrategicamente em português.',
        `Situação actual YourGift OS:
- Receita mensal média: €${liveData.revenue.avg_monthly.toFixed(0)}
- Tendência: ${liveData.revenue.trend_pct > 0 ? '+' : ''}${liveData.revenue.trend_pct.toFixed(1)}%
- Pipeline: €${liveData.pipeline.value.toFixed(0)}
- Clientes saudáveis: ${liveData.clients.healthy} | Em risco: ${liveData.clients.at_risk}

Qual é a maior alavanca de crescimento no próximo trimestre? Sê específico. (máx 100 palavras)`,
        150,
      ),
    ]);

    return NextResponse.json({
      live: liveData,
      forecasts: {
        revenue: revForecast,
        churn: churnForecast,
        strategy: strategyRec,
      },
      generated_at: new Date().toISOString(),
    });
  }

  if (action === 'scenario') {
    const { scenario, params } = body;
    if (!scenario) return NextResponse.json({ error: 'scenario required' }, { status: 400 });

    const liveData = await gatherLiveData(supabase);

    const analysis = await callClaude(
      'És um analista de cenários financeiros B2B. Respondes sempre em português.',
      `Cenário: "${scenario}"
Parâmetros: ${JSON.stringify(params ?? {})}
Contexto actual: receita €${liveData.revenue.last30.toFixed(0)}/mês, ${liveData.clients.total} clientes, pipeline €${liveData.pipeline.value.toFixed(0)}.
Analisa o impacto deste cenário no negócio (máx 150 palavras).`,
      250,
    );

    return NextResponse.json({ scenario, analysis, live: liveData });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
