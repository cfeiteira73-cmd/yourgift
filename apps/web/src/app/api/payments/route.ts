import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA ABSOLUTE FINAL — Phase 1: Live Money Validation ────────────────────
//
// Real-time payment intelligence, settlement reconciliation, risk scoring,
// webhook deduplication, and dispute prevention.
//
// GET  ?mode=dashboard     — live money KPIs + recent events
// GET  ?mode=settlements   — daily settlement history
// GET  ?mode=events        — webhook event log (paginated)
// GET  ?mode=risks         — payment risk scores
// GET  ?mode=risk&id=      — single risk record detail
// POST { action:'score_payment' }     — score a payment for risk
// POST { action:'score_all' }         — batch-score open orders
// POST { action:'log_event' }         — log/deduplicate a webhook event
// POST { action:'sync_settlement' }   — sync/create a settlement record
// POST { action:'review_risk' }       — mark risk reviewed
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

async function callClaude(system: string, user: string, maxTokens = 200): Promise<string> {
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

function scoreRisk(order: Record<string, unknown>): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  const amount = Number(order.total_amount ?? 0);
  const daysSinceOrder = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at as string).getTime()) / 86400000)
    : 0;

  // High amount signal
  if (amount > 5000) { score += 25; signals.push(`Valor elevado: €${amount}`); }
  else if (amount > 2000) { score += 12; signals.push(`Valor médio-alto: €${amount}`); }

  // Stale pending order
  if ((order.status as string) === 'pending' && daysSinceOrder > 3) {
    score += 20; signals.push(`Pendente há ${daysSinceOrder}d`);
  }

  // No payment intent attached
  if (!order.stripe_payment_intent_id) {
    score += 15; signals.push('Sem Stripe Payment Intent');
  }

  // Very new order with large amount
  if (daysSinceOrder < 1 && amount > 1000) {
    score += 10; signals.push('Grande valor em encomenda recente');
  }

  const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score: Math.min(score, 100), signals };
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
    const [eventsRes, settlementsRes, risksRes, disputesRes] = await Promise.all([
      supabase.from('omega_abs_payment_events')
        .select('id, event_type, amount, created_at, duplicate')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('omega_abs_settlements')
        .select('settlement_date, net_settled, gross_volume, drift_amount, status')
        .order('settlement_date', { ascending: false }).limit(7),
      supabase.from('omega_abs_payment_risks')
        .select('id, risk_level, risk_score, flagged, reviewed, order_id')
        .eq('flagged', true).eq('reviewed', false)
        .order('risk_score', { ascending: false }).limit(10),
      supabase.from('omega_abs_disputes')
        .select('id, amount, status, reason, created_at')
        .in('status', ['needs_response', 'under_review', 'warning_needs_response'])
        .order('created_at', { ascending: false }).limit(5),
    ]);

    const totalNetSettled = (settlementsRes.data ?? [])
      .reduce((sum, s) => sum + Number(s.net_settled ?? 0), 0);

    const totalDrift = (settlementsRes.data ?? [])
      .reduce((sum, s) => sum + Math.abs(Number(s.drift_amount ?? 0)), 0);

    const duplicates = (eventsRes.data ?? []).filter(e => e.duplicate).length;

    return NextResponse.json({
      kpis: {
        total_net_settled_7d: Math.round(totalNetSettled * 100) / 100,
        total_drift_7d: Math.round(totalDrift * 100) / 100,
        open_disputes: disputesRes.data?.length ?? 0,
        flagged_risks: risksRes.data?.length ?? 0,
        duplicate_events: duplicates,
      },
      recent_events: eventsRes.data ?? [],
      settlements: settlementsRes.data ?? [],
      flagged_risks: risksRes.data ?? [],
      open_disputes: disputesRes.data ?? [],
    });
  }

  if (mode === 'settlements') {
    const { data } = await supabase.from('omega_abs_settlements')
      .select('*').order('settlement_date', { ascending: false }).limit(30);
    return NextResponse.json({ settlements: data ?? [] });
  }

  if (mode === 'events') {
    const page = parseInt(searchParams.get('page') ?? '0');
    const { data } = await supabase.from('omega_abs_payment_events')
      .select('*').order('created_at', { ascending: false })
      .range(page * 50, page * 50 + 49);
    return NextResponse.json({ events: data ?? [] });
  }

  if (mode === 'risks') {
    const onlyFlagged = searchParams.get('flagged') === 'true';
    let query = supabase.from('omega_abs_payment_risks')
      .select('*').order('risk_score', { ascending: false }).limit(50);
    if (onlyFlagged) query = query.eq('flagged', true);
    const { data } = await query;
    return NextResponse.json({ risks: data ?? [] });
  }

  if (mode === 'risk') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_abs_payment_risks')
      .select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ risk: data });
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

  if (action === 'log_event') {
    const { stripe_event_id, event_type, amount, currency, object_id, raw_payload } = body;
    if (!stripe_event_id || !event_type) {
      return NextResponse.json({ error: 'stripe_event_id and event_type required' }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase.from('omega_abs_payment_events')
      .select('id').eq('stripe_event_id', stripe_event_id).maybeSingle();

    if (existing) {
      // Mark as duplicate
      await supabase.from('omega_abs_payment_events')
        .update({ duplicate: true }).eq('stripe_event_id', stripe_event_id);
      return NextResponse.json({ status: 'duplicate', event_id: existing.id });
    }

    const { data } = await supabase.from('omega_abs_payment_events').insert({
      stripe_event_id, event_type,
      amount: amount ?? null,
      currency: currency ?? 'eur',
      object_id: object_id ?? null,
      raw_payload: raw_payload ?? null,
      processed_at: new Date().toISOString(),
    }).select().single();

    return NextResponse.json({ status: 'logged', event: data });
  }

  if (action === 'score_payment') {
    const { order_id } = body;
    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

    const { data: order } = await supabase.from('orders')
      .select('id, total_amount, status, created_at, stripe_payment_intent_id, client_id')
      .eq('id', order_id).maybeSingle();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { score, signals } = scoreRisk(order as Record<string, unknown>);
    const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';

    const { data: risk } = await supabase.from('omega_abs_payment_risks').upsert({
      order_id: String(order.id),
      client_id: order.client_id ? String(order.client_id) : null,
      payment_intent: order.stripe_payment_intent_id ?? null,
      risk_score: score,
      risk_level: level,
      signals,
      flagged: score >= 40,
    }, { onConflict: 'order_id' }).select().single();

    return NextResponse.json({ risk, score, level, signals });
  }

  if (action === 'score_all') {
    const { data: orders } = await supabase.from('orders')
      .select('id, total_amount, status, created_at, stripe_payment_intent_id, client_id')
      .limit(100);

    const results = [];
    for (const order of (orders ?? [])) {
      const { score, signals } = scoreRisk(order as Record<string, unknown>);
      const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
      if (score > 0) {
        await supabase.from('omega_abs_payment_risks').upsert({
          order_id: String(order.id),
          client_id: order.client_id ? String(order.client_id) : null,
          payment_intent: order.stripe_payment_intent_id ?? null,
          risk_score: score,
          risk_level: level,
          signals,
          flagged: score >= 40,
        }, { onConflict: 'order_id' });
        results.push({ order_id: order.id, score, level });
      }
    }

    return NextResponse.json({
      scored: results.length,
      flagged: results.filter(r => r.score >= 40).length,
      results,
    });
  }

  if (action === 'sync_settlement') {
    const { settlement_date, gross_volume, refunds, disputes, fees, net_settled,
            transaction_count, stripe_payout_id, internal_expected } = body;

    if (!settlement_date) return NextResponse.json({ error: 'settlement_date required' }, { status: 400 });

    const drift = internal_expected != null
      ? Math.abs(Number(net_settled ?? 0) - Number(internal_expected)) : 0;

    const { data } = await supabase.from('omega_abs_settlements').upsert({
      settlement_date,
      gross_volume: gross_volume ?? 0,
      refunds: refunds ?? 0,
      disputes: disputes ?? 0,
      fees: fees ?? 0,
      net_settled: net_settled ?? 0,
      transaction_count: transaction_count ?? 0,
      stripe_payout_id: stripe_payout_id ?? null,
      status: 'paid',
      internal_expected: internal_expected ?? null,
      drift_amount: drift,
    }, { onConflict: 'settlement_date,currency' }).select().single();

    // Alert if significant drift
    if (drift > 50) {
      await supabase.from('omega_final_notifications').insert({
        user_email: null,
        type: 'warning',
        category: 'financial',
        title: `Settlement Drift: €${drift.toFixed(2)} em ${settlement_date}`,
        message: `Diferença entre Stripe (€${net_settled}) e internal (€${internal_expected})`,
        action_url: '/payments',
        action_label: 'Ver Pagamentos',
        priority: 2,
        source: 'payments_settlement',
      });
    }

    return NextResponse.json({ settlement: data, drift });
  }

  if (action === 'review_risk') {
    const { risk_id, review_notes } = body;
    if (!risk_id) return NextResponse.json({ error: 'risk_id required' }, { status: 400 });

    const { data } = await supabase.from('omega_abs_payment_risks')
      .update({ reviewed: true, reviewer_email: user.email, review_notes: review_notes ?? null })
      .eq('id', risk_id).select().single();

    return NextResponse.json({ risk: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
