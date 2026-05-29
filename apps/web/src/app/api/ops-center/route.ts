import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA WORLDCLASS — Live Operations Center API ─────────────────────────────
//
// Unified mission-control aggregator: stuck orders, SLA breaches, failed webhooks,
// disputed payments, reconciliation drift, production delays, AI anomalies.
//
// GET  ?mode=dashboard   — full ops dashboard (all signals)
// GET  ?mode=stuck       — stuck orders (>6h no status change)
// GET  ?mode=webhooks    — failed webhook deliveries
// GET  ?mode=payments    — payment failures + disputes
// GET  ?mode=production  — production delays + bottlenecks
// GET  ?mode=anomalies   — AI anomaly alerts
// POST { action:'retry_webhook', id } — retry a failed webhook
// POST { action:'resolve_anomaly', id } — mark anomaly resolved
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

function adminSupabase() {
  const { createClient: createAdminClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') ?? 'dashboard';

  // Use service role for cross-table admin reads (falls back to anon if key missing)
  const db = adminSupabase() ?? supabase;

  try {
    if (mode === 'stuck') {
      return NextResponse.json(await getStuckOrders(db));
    }
    if (mode === 'webhooks') {
      return NextResponse.json(await getFailedWebhooks(db));
    }
    if (mode === 'payments') {
      return NextResponse.json(await getPaymentAlerts(db));
    }
    if (mode === 'production') {
      return NextResponse.json(await getProductionDelays(db));
    }
    if (mode === 'anomalies') {
      return NextResponse.json(await getAnomalyAlerts(db));
    }
    // Default: full dashboard
    return NextResponse.json(await getFullDashboard(db));
  } catch (err) {
    console.error('[ops-center] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const db = adminSupabase() ?? supabase;
  let body: { action?: string; id?: string };
  try { body = await request.json(); } catch { body = {}; }

  const { action, id } = body;

  if (action === 'retry_webhook' && id) {
    const { error } = await db
      .from('omega_final_webhook_events')
      .update({ status: 'pending', retry_count: 0, next_retry_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, queued: id });
  }

  if (action === 'resolve_anomaly' && id) {
    const { error } = await db
      .from('omega_final_ai_anomalies')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resolve_stuck' && id) {
    // Log resolution in audit
    await db.from('omega_final_audit_log').insert({
      entity_type: 'order',
      entity_id: id,
      action: 'manual_unstuck',
      performed_by: user.id,
      metadata: { resolved_via: 'ops_center' },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getStuckOrders(db: ReturnType<typeof adminSupabase>) {
  const stuckThresholdHours = 6;
  const cutoff = new Date(Date.now() - stuckThresholdHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await db!
    .from('orders')
    .select(`
      id, reference, status, total_amount, currency,
      updated_at, created_at,
      clients ( company_name )
    `)
    .not('status', 'in', '(delivered,cancelled,archived)')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(50);

  if (error) return { stuck_orders: [], error: error.message };

  const orders = (data ?? []).map((o: Record<string, unknown>) => {
    const hoursStuck = Math.floor(
      (Date.now() - new Date(o.updated_at as string).getTime()) / 3600000
    );
    return {
      ...o,
      hours_stuck: hoursStuck,
      severity: hoursStuck > 48 ? 'critical' : hoursStuck > 24 ? 'high' : 'medium',
    };
  });

  return {
    stuck_orders: orders,
    total_stuck: orders.length,
    critical_stuck: orders.filter((o: { severity: string }) => o.severity === 'critical').length,
  };
}

async function getFailedWebhooks(db: ReturnType<typeof adminSupabase>) {
  const { data: failed, error: fe } = await db!
    .from('omega_final_webhook_events')
    .select('id, event_type, endpoint_url, status, retry_count, last_error, next_retry_at, created_at, payload')
    .in('status', ['failed', 'dead_letter'])
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: pending } = await db!
    .from('omega_final_webhook_events')
    .select('id')
    .eq('status', 'pending')
    .limit(1);

  const { count: pendingCount } = await db!
    .from('omega_final_webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (fe) return { failed_webhooks: [], dead_letter: [], error: fe.message };

  const failedItems = (failed ?? []).filter((w: Record<string, unknown>) => w.status === 'failed');
  const deadLetters = (failed ?? []).filter((w: Record<string, unknown>) => w.status === 'dead_letter');

  return {
    failed_webhooks: failedItems,
    dead_letter: deadLetters,
    pending_count: pendingCount ?? 0,
    total_failed: failedItems.length,
    total_dead_letter: deadLetters.length,
  };
}

async function getPaymentAlerts(db: ReturnType<typeof adminSupabase>) {
  const [disputesRes, failedPaymentsRes, settlementsRes] = await Promise.all([
    db!.from('omega_final_disputes')
      .select('id, stripe_dispute_id, amount, currency, reason, status, due_by, created_at')
      .in('status', ['needs_response', 'warning_needs_response'])
      .order('due_by', { ascending: true })
      .limit(20),
    db!.from('omega_final_payment_events')
      .select('id, event_type, amount, object_id, created_at')
      .in('event_type', ['payment_intent.payment_failed', 'charge.failed'])
      .order('created_at', { ascending: false })
      .limit(20),
    db!.from('omega_final_settlement_reports')
      .select('settlement_date, net_settled, gross_volume, drift_amount, status')
      .not('status', 'eq', 'matched')
      .order('settlement_date', { ascending: false })
      .limit(10),
  ]);

  const disputes = disputesRes.data ?? [];
  const failedPayments = failedPaymentsRes.data ?? [];
  const driftSettlements = settlementsRes.data ?? [];

  return {
    open_disputes: disputes,
    failed_payments: failedPayments,
    reconciliation_drift: driftSettlements,
    total_at_risk: disputes.reduce((s: number, d: Record<string, unknown>) => s + (Number(d.amount) || 0), 0),
    total_failed: failedPayments.length,
    total_drift_settlements: driftSettlements.length,
  };
}

async function getProductionDelays(db: ReturnType<typeof adminSupabase>) {
  const { data: slaBreaches } = await db!
    .from('omega_final_sla_breaches')
    .select(`
      id, entity_type, entity_id, hours_overdue, created_at,
      omega_final_sla_rules ( name, entity_type, threshold_hours, severity )
    `)
    .eq('resolved', false)
    .order('hours_overdue', { ascending: false })
    .limit(30);

  // Orders in production with expected delivery soon/past
  const { data: productionOrders } = await db!
    .from('orders')
    .select('id, reference, status, expected_delivery, total_amount, currency, updated_at, clients(company_name)')
    .eq('status', 'in_production')
    .lte('expected_delivery', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()) // due within 2 days
    .order('expected_delivery', { ascending: true })
    .limit(20);

  const delayed = (productionOrders ?? []).map((o: Record<string, unknown>) => ({
    ...o,
    is_overdue: o.expected_delivery ? new Date(o.expected_delivery as string) < new Date() : false,
    hours_to_deadline: o.expected_delivery
      ? Math.round((new Date(o.expected_delivery as string).getTime() - Date.now()) / 3600000)
      : null,
  }));

  return {
    sla_breaches: slaBreaches ?? [],
    production_delays: delayed,
    total_sla_breaches: (slaBreaches ?? []).length,
    overdue_count: delayed.filter((o: { is_overdue: boolean }) => o.is_overdue).length,
  };
}

async function getAnomalyAlerts(db: ReturnType<typeof adminSupabase>) {
  const { data, error } = await db!
    .from('omega_final_ai_anomalies')
    .select('id, anomaly_type, severity, description, entity_type, entity_id, confidence_score, status, detected_at, resolved_at')
    .eq('status', 'open')
    .order('detected_at', { ascending: false })
    .limit(30);

  if (error) return { anomalies: [], total: 0, error: error.message };

  return {
    anomalies: data ?? [],
    total: (data ?? []).length,
    critical: (data ?? []).filter((a: Record<string, unknown>) => a.severity === 'critical').length,
  };
}

async function getFullDashboard(db: ReturnType<typeof adminSupabase>) {
  const [stuck, webhooks, payments, production, anomalies] = await Promise.all([
    getStuckOrders(db),
    getFailedWebhooks(db),
    getPaymentAlerts(db),
    getProductionDelays(db),
    getAnomalyAlerts(db),
  ]);

  const health_score = Math.max(0, 100 - (
    (stuck.total_stuck ?? 0) * 3 +
    (webhooks.total_dead_letter ?? 0) * 5 +
    ((payments as { open_disputes?: unknown[] }).open_disputes?.length ?? 0) * 4 +
    (production.total_sla_breaches ?? 0) * 2 +
    (anomalies.critical ?? 0) * 6
  ));

  return {
    health_score: Math.min(100, health_score),
    stuck_orders: stuck,
    webhooks,
    payments,
    production,
    anomalies,
    generated_at: new Date().toISOString(),
  };
}
