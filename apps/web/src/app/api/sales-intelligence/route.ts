import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S13: AI Sales + Customer Success Intelligence ──────────────────
//
// Autonomous customer health scoring, churn prediction, upsell detection,
// and AI-generated sales action recommendations.
//
// GET  ?mode=dashboard               — health scores + alerts + pipeline
// GET  ?mode=client&id=...           — single client deep analysis
// GET  ?mode=actions                 — pending sales actions queue
// POST { action:'compute_all' }      — recompute all health scores from orders/clients
// POST { action:'compute_one', clientId } — score single client
// POST { action:'generate_actions' } — AI generate sales action queue
// POST { action:'complete_action', id } — mark action as done
// POST { action:'create_action', ... } — manual action creation
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 512): Promise<string> {
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
        model: CLAUDE_HAIKU, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

interface ClientData {
  id: string; name: string | null; email: string | null;
  company: string | null; tier: string | null; auth_user_id: string | null;
}

interface OrderData {
  client_id: string; status: string | null; total: number | null; created_at: string | null;
}

function computeHealthScore(orders: OrderData[], daysSinceLastOrder: number | null): {
  health: number; churnRisk: string; churnProb: number; upsell: number; engagement: number;
} {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status ?? '')).length;

  // Recency score (0-30)
  const recency = daysSinceLastOrder == null ? 0
    : daysSinceLastOrder <= 30 ? 30
    : daysSinceLastOrder <= 60 ? 20
    : daysSinceLastOrder <= 90 ? 10
    : daysSinceLastOrder <= 180 ? 5
    : 0;

  // Frequency score (0-30)
  const frequency = totalOrders >= 10 ? 30 : totalOrders >= 5 ? 20 : totalOrders >= 3 ? 15 : totalOrders >= 1 ? 8 : 0;

  // Monetary score (0-30)
  const monetary = totalSpent >= 50000 ? 30 : totalSpent >= 20000 ? 25 : totalSpent >= 10000 ? 20
    : totalSpent >= 5000 ? 15 : totalSpent >= 1000 ? 10 : totalSpent > 0 ? 5 : 0;

  // Active engagement (0-10)
  const engagement_pts = activeOrders > 0 ? 10 : 0;

  const health = Math.min(100, recency + frequency + monetary + engagement_pts);
  const engagement = Math.min(100, Math.round(((recency / 30) * 40 + (frequency / 30) * 60)));

  // Churn risk based on health + recency
  let churnRisk: string;
  let churnProb: number;
  if (health >= 70) { churnRisk = 'low'; churnProb = 0.05; }
  else if (health >= 50) { churnRisk = 'medium'; churnProb = 0.20; }
  else if (health >= 30) { churnRisk = 'high'; churnProb = 0.45; }
  else { churnRisk = 'critical'; churnProb = 0.75; }

  // Upsell score (higher spend + recent + healthy = more upsell opportunity)
  const upsell = Math.min(100, Math.round((health * 0.5) + (monetary / 30) * 30 + (recency / 30) * 20));

  return { health, churnRisk, churnProb, upsell, engagement };
}

async function scoreClient(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, client: ClientData): Promise<Record<string, unknown>> {
  const { data: orders } = await supabase.from('orders')
    .select('client_id, status, total, created_at').eq('client_id', client.id)
    .order('created_at', { ascending: false });

  const ords = orders ?? [];
  const totalOrders = ords.length;
  const totalSpent = ords.reduce((s, o) => s + Number(o.total ?? 0), 0);

  const lastOrder = ords[0];
  const daysSinceLastOrder = lastOrder?.created_at
    ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000)
    : null;

  const scores = computeHealthScore(ords, daysSinceLastOrder);

  // Alert type detection
  let alertType: string | null = null;
  let alertPriority = 'low';
  if (scores.churnRisk === 'critical') { alertType = 'win_back'; alertPriority = 'critical'; }
  else if (scores.churnRisk === 'high') { alertType = 'at_risk'; alertPriority = 'high'; }
  else if (scores.health >= 70 && scores.upsell >= 60) { alertType = 'upsell'; alertPriority = 'medium'; }
  else if (scores.health >= 85) { alertType = 'vip_nurture'; alertPriority = 'low'; }

  // LTV estimate (3× current spend if healthy, 1× if at risk)
  const ltvMultiplier = scores.health >= 70 ? 3 : scores.health >= 50 ? 2 : 1;
  const ltvEstimate = totalSpent * ltvMultiplier;

  const healthRecord = {
    client_id: client.id,
    client_name: client.name ?? client.company ?? 'Cliente',
    client_email: client.email ?? null,
    health_score: scores.health,
    churn_risk: scores.churnRisk,
    churn_probability: scores.churnProb,
    upsell_score: scores.upsell,
    engagement_score: scores.engagement,
    ltv_estimate: ltvEstimate,
    last_order_days: daysSinceLastOrder,
    total_orders: totalOrders,
    total_spent: totalSpent,
    alert_type: alertType,
    alert_priority: alertPriority,
    last_computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase.from('omega_x_customer_health').upsert(healthRecord, { onConflict: 'client_id' });
  return healthRecord;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'dashboard';

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (mode === 'dashboard') {
    const [healthRes, actionsRes] = await Promise.all([
      supabase.from('omega_x_customer_health').select('*').order('health_score'),
      supabase.from('omega_x_sales_actions').select('*').eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false }).limit(20),
    ]);

    const health = healthRes.data ?? [];
    const avgHealth = health.length > 0 ? health.reduce((s, h) => s + h.health_score, 0) / health.length : 0;

    return NextResponse.json({
      health,
      actions: actionsRes.data ?? [],
      summary: {
        total_clients: health.length,
        avg_health_score: avgHealth,
        at_risk: health.filter(h => ['high','critical'].includes(h.churn_risk)).length,
        upsell_opportunities: health.filter(h => (h.upsell_score ?? 0) >= 60).length,
        vip_clients: health.filter(h => (h.health_score ?? 0) >= 80).length,
        total_ltv: health.reduce((s, h) => s + Number(h.ltv_estimate ?? 0), 0),
      },
    });
  }

  // ── Single client ─────────────────────────────────────────────────────────
  if (mode === 'client') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const [healthRes, actionsRes] = await Promise.all([
      supabase.from('omega_x_customer_health').select('*').eq('client_id', id).single(),
      supabase.from('omega_x_sales_actions').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({ health: healthRes.data, actions: actionsRes.data ?? [] });
  }

  // ── Actions queue ─────────────────────────────────────────────────────────
  if (mode === 'actions') {
    const { data: actions } = await supabase.from('omega_x_sales_actions')
      .select('*').eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false });
    return NextResponse.json({ actions: actions ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Compute all health scores ─────────────────────────────────────────────
  if (action === 'compute_all') {
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, company, tier, auth_user_id').limit(200);

    if (!clients?.length) return NextResponse.json({ message: 'No clients found', computed: 0 });

    let computed = 0;
    for (const client of clients) {
      await scoreClient(supabase, client as ClientData);
      computed++;
    }

    return NextResponse.json({ computed, action: 'health_computed' });
  }

  // ── Compute single client ─────────────────────────────────────────────────
  if (action === 'compute_one') {
    const { clientId } = body;
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

    const { data: client } = await supabase.from('clients')
      .select('id, name, email, company, tier, auth_user_id').eq('id', clientId).single();
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const health = await scoreClient(supabase, client as ClientData);
    return NextResponse.json({ health, action: 'computed' });
  }

  // ── Generate AI sales actions ─────────────────────────────────────────────
  if (action === 'generate_actions') {
    const { data: health } = await supabase.from('omega_x_customer_health')
      .select('*').not('alert_type', 'is', null).order('alert_priority').limit(15);

    if (!health?.length) return NextResponse.json({ message: 'No alerts to action', generated: 0 });

    let generated = 0;
    for (const h of health) {
      // Check if recent action already exists
      const { data: existing } = await supabase.from('omega_x_sales_actions')
        .select('id').eq('client_id', h.client_id).eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(1).maybeSingle();
      if (existing) continue;

      const actionTypeMap: Record<string, string> = {
        at_risk: 'call', win_back: 'email', upsell: 'proposal', vip_nurture: 'check_in',
      };
      const actionType = actionTypeMap[h.alert_type ?? ''] ?? 'follow_up';

      // AI script generation
      const script = await callClaude(
        'Escreves mensagens de vendas em nome do YourGift. Tom: profissional, personalizado, conciso. Responde em português.',
        `Cliente: ${h.client_name}. Score saúde: ${h.health_score}/100. Risco churn: ${h.churn_risk}. Última encomenda: ${h.last_order_days ?? '?'} dias. Gasto total: €${Number(h.total_spent ?? 0).toFixed(0)}. Tipo de ação: ${actionType}. Escreve uma mensagem curta (3-4 frases) para ${actionType === 'call' ? 'um telefonema de check-in' : actionType === 'email' ? 'um email de win-back' : actionType === 'proposal' ? 'uma proposta de upsell' : 'um check-in de nurturing'}. Não incluas assunto.`,
        300,
      );

      await supabase.from('omega_x_sales_actions').insert({
        client_id: h.client_id,
        client_name: h.client_name,
        action_type: actionType,
        priority: h.alert_priority ?? 'medium',
        subject: `${h.alert_type?.replace('_',' ')} — ${h.client_name}`,
        ai_script: script || null,
        status: 'pending',
        due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        created_by: user.id,
      });
      generated++;
    }

    return NextResponse.json({ generated, action: 'actions_generated' });
  }

  // ── Complete action ───────────────────────────────────────────────────────
  if (action === 'complete_action') {
    const { id, notes } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabase.from('omega_x_sales_actions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: 'action_completed' });
  }

  // ── Create manual action ──────────────────────────────────────────────────
  if (action === 'create_action') {
    const { client_id, client_name, action_type, priority, subject, due_date, notes } = body;
    if (!client_id || !action_type) return NextResponse.json({ error: 'client_id and action_type required' }, { status: 400 });

    const { data: act, error } = await supabase.from('omega_x_sales_actions').insert({
      client_id, client_name: client_name ?? 'Cliente',
      action_type, priority: priority ?? 'medium',
      subject: subject ?? null, due_date: due_date ?? null,
      notes: notes ?? null, status: 'pending', created_by: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action_record: act, action: 'action_created' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
