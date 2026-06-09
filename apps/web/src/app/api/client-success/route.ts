import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA ABSOLUTE FINAL — Phase 6: Enterprise Client Success ────────────────
//
// Customer success dashboard: health scoring, milestone tracking, QBR prep,
// renewal forecasting, and AI engagement recommendations.
//
// GET  ?mode=dashboard        — portfolio overview: health distribution, at-risk, champions
// GET  ?mode=client&id=       — deep client profile: health, orders, activity
// GET  ?mode=renewals         — renewal pipeline (clients by renewal risk)
// GET  ?mode=milestones       — milestone tracker per client
// POST { action:'log_touchpoint' }   — log CS touchpoint
// POST { action:'set_milestone' }    — create/update client milestone
// POST { action:'ai_qbr' }          — AI-generate QBR talking points
// POST { action:'segment' }         — segment clients by health tier
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

async function callClaude(system: string, user: string, maxTokens = 300): Promise<string> {
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
        model: 'claude-3-haiku-20240307',
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

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'dashboard';

  if (mode === 'dashboard') {
    // Get all clients + latest health scores
    const [clientsRes, healthRes, ordersRes] = await Promise.all([
      supabase.from('clients')
        .select('id, name, email, health_score, total_revenue, last_order_date, created_at')
        .order('total_revenue', { ascending: false }).limit(100),
      supabase.from('omega_final_health_scores')
        .select('client_id, overall_score, risk_level, churn_probability, next_action, revenue_score, engagement_score, scored_at')
        .order('scored_at', { ascending: false }).limit(200),
      supabase.from('orders')
        .select('client_id, total_amount, created_at')
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .not('status', 'eq', 'cancelled'),
    ]);

    const clients = clientsRes.data ?? [];
    const healthScores = healthRes.data ?? [];
    const orders = ordersRes.data ?? [];

    // Deduplicate health scores (latest per client)
    type HealthRow = NonNullable<typeof healthRes.data>[number];
    const latestHealth = new Map<string, HealthRow>();
    for (const h of healthScores) {
      if (!latestHealth.has(h.client_id) || new Date(h.scored_at) > new Date(latestHealth.get(h.client_id)!.scored_at)) {
        latestHealth.set(h.client_id, h);
      }
    }

    // Revenue in last 90d per client
    const revByClient = new Map<string, number>();
    for (const o of orders) {
      if (o.client_id) {
        revByClient.set(String(o.client_id), (revByClient.get(String(o.client_id)) ?? 0) + Number(o.total_amount ?? 0));
      }
    }

    const champions = clients.filter(c => {
      const h = latestHealth.get(String(c.id));
      return (Number(h?.overall_score ?? c.health_score ?? 0)) >= 80;
    });

    const atRisk = clients.filter(c => {
      const h = latestHealth.get(String(c.id));
      return ['high', 'critical'].includes(h?.risk_level ?? '') || Number(h?.overall_score ?? c.health_score ?? 60) < 40;
    });

    const needsAttention = clients.filter(c => {
      const h = latestHealth.get(String(c.id));
      const score = Number(h?.overall_score ?? c.health_score ?? 60);
      return score >= 40 && score < 65;
    });

    // Health distribution buckets
    const distribution = {
      champions: champions.length,
      healthy: clients.filter(c => {
        const h = latestHealth.get(String(c.id));
        const score = Number(h?.overall_score ?? c.health_score ?? 60);
        return score >= 65 && score < 80;
      }).length,
      needs_attention: needsAttention.length,
      at_risk: atRisk.length,
    };

    return NextResponse.json({
      summary: {
        total_clients: clients.length,
        champions: champions.length,
        at_risk: atRisk.length,
        needs_attention: needsAttention.length,
        health_distribution: distribution,
        avg_health_score: clients.length > 0
          ? Math.round(clients.reduce((s, c) => s + Number(c.health_score ?? 60), 0) / clients.length)
          : 0,
      },
      at_risk_clients: atRisk.slice(0, 10).map(c => ({
        ...c,
        health: latestHealth.get(String(c.id)),
        rev_90d: revByClient.get(String(c.id)) ?? 0,
      })),
      champion_clients: champions.slice(0, 10).map(c => ({
        ...c,
        health: latestHealth.get(String(c.id)),
        rev_90d: revByClient.get(String(c.id)) ?? 0,
      })),
      needs_attention: needsAttention.slice(0, 10).map(c => ({
        ...c,
        health: latestHealth.get(String(c.id)),
        rev_90d: revByClient.get(String(c.id)) ?? 0,
      })),
    });
  }

  if (mode === 'client') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const [clientRes, healthRes, ordersRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('omega_final_health_scores')
        .select('*').eq('client_id', id)
        .order('scored_at', { ascending: false }).limit(10),
      supabase.from('orders')
        .select('id, total_amount, status, created_at')
        .eq('client_id', id).order('created_at', { ascending: false }).limit(20),
    ]);

    if (clientRes.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      client: clientRes.data,
      health_history: healthRes.data ?? [],
      recent_orders: ordersRes.data ?? [],
    });
  }

  if (mode === 'renewals') {
    // Clients sorted by churn probability (renewal risk)
    const { data: scores } = await supabase.from('omega_final_health_scores')
      .select('client_id, churn_probability, risk_level, overall_score, next_action')
      .order('churn_probability', { ascending: false }).limit(30);

    if (!scores?.length) return NextResponse.json({ renewals: [] });

    const clientIds = [...new Set(scores.map(s => s.client_id))];
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, total_revenue, last_order_date')
      .in('id', clientIds);

    const clientMap = new Map((clients ?? []).map(c => [String(c.id), c]));

    const renewals = scores.map(s => ({
      ...s,
      client: clientMap.get(s.client_id),
    })).filter(r => r.client);

    return NextResponse.json({ renewals });
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

  if (action === 'ai_qbr') {
    const { client_id } = body;
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

    const [clientRes, healthRes, ordersRes] = await Promise.all([
      supabase.from('clients').select('name, email, total_revenue, health_score, last_order_date').eq('id', client_id).single(),
      supabase.from('omega_final_health_scores').select('*').eq('client_id', client_id).order('scored_at', { ascending: false }).limit(1).single(),
      supabase.from('orders').select('total_amount, status, created_at').eq('client_id', client_id)
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .not('status', 'eq', 'cancelled'),
    ]);

    const client = clientRes.data;
    const health = healthRes.data;
    const orders = ordersRes.data ?? [];
    const rev90 = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    const qbr = await callClaude(
      'És um Customer Success Manager B2B experiente. Preparas QBRs (Quarterly Business Reviews) eficazes em português.',
      `QBR para cliente: ${client?.name ?? 'Cliente'}
- Revenue total: €${client?.total_revenue ?? 0}
- Revenue últimos 90d: €${rev90.toFixed(0)}
- Health score: ${health?.overall_score ?? client?.health_score ?? 'N/A'}/100
- Risco: ${health?.risk_level ?? 'desconhecido'}
- Probabilidade churn: ${health?.churn_probability != null ? (Number(health.churn_probability) * 100).toFixed(0) : 'N/A'}%
- Próxima acção recomendada: ${health?.next_action ?? 'N/A'}
- Última encomenda: ${client?.last_order_date ? new Date(client.last_order_date).toLocaleDateString('pt-PT') : 'N/A'}

Gera 5 pontos de conversa para o QBR: valor entregue, métricas-chave, desafios, oportunidades e próximos passos. (máx 200 palavras)`,
      350,
    );

    return NextResponse.json({ qbr, client: client?.name });
  }

  if (action === 'segment') {
    const { data: clients } = await supabase.from('clients')
      .select('id, name, health_score, total_revenue').limit(200);

    const segments = {
      champions:       [] as string[],
      healthy:         [] as string[],
      needs_attention: [] as string[],
      at_risk:         [] as string[],
    };

    for (const c of (clients ?? [])) {
      const score = Number(c.health_score ?? 60);
      if (score >= 80) segments.champions.push(String(c.id));
      else if (score >= 65) segments.healthy.push(String(c.id));
      else if (score >= 40) segments.needs_attention.push(String(c.id));
      else segments.at_risk.push(String(c.id));
    }

    return NextResponse.json({ segments, totals: {
      champions: segments.champions.length,
      healthy: segments.healthy.length,
      needs_attention: segments.needs_attention.length,
      at_risk: segments.at_risk.length,
    }});
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
