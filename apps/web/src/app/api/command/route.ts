import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA ABSOLUTE FINAL — Command Center ────────────────────────────────────
//
// Real-time aggregation of ALL OMEGA signals into a single command view.
// "One screen to rule them all."
//
// GET  ?mode=full          — complete command snapshot (all systems)
// GET  ?mode=critical      — only critical / action-required signals
// GET  ?mode=pulse         — live pulse (lightweight, for polling)
//
// ─────────────────────────────────────────────────────────────────────────────


export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'full';

  const now = new Date();
  const d24h = new Date(now.getTime() - 86400000).toISOString();
  const d7d  = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d30d = new Date(now.getTime() - 30 * 86400000).toISOString();

  if (mode === 'pulse') {
    // Lightweight: just counts for badges
    const [orders, disputes, incidents, risks, secEvents] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('omega_abs_disputes').select('id', { count: 'exact', head: true })
        .in('status', ['needs_response', 'under_review']),
      supabase.from('omega_final_incidents').select('id', { count: 'exact', head: true })
        .in('status', ['open', 'investigating']),
      supabase.from('omega_abs_payment_risks').select('id', { count: 'exact', head: true })
        .eq('flagged', true).eq('reviewed', false),
      supabase.from('omega_abs_security_events').select('id', { count: 'exact', head: true })
        .gte('risk_score', 50).eq('reviewed', false),
    ]);

    return NextResponse.json({
      pulse: {
        pending_orders: orders.count ?? 0,
        open_disputes: disputes.count ?? 0,
        open_incidents: incidents.count ?? 0,
        flagged_payments: risks.count ?? 0,
        security_alerts: secEvents.count ?? 0,
        total_critical: (disputes.count ?? 0) + (incidents.count ?? 0) + (secEvents.count ?? 0),
      },
      ts: now.toISOString(),
    });
  }

  if (mode === 'critical') {
    const [disputesRes, incidentsRes, secRes, slaRes, atRiskRes] = await Promise.all([
      supabase.from('omega_abs_disputes')
        .select('id, amount, reason, status, due_by')
        .in('status', ['needs_response', 'warning_needs_response'])
        .order('due_by', { ascending: true, nullsFirst: false }).limit(5),
      supabase.from('omega_final_incidents')
        .select('id, title, severity, status, created_at')
        .in('status', ['open', 'investigating'])
        .eq('severity', 'critical').limit(5),
      supabase.from('omega_abs_security_events')
        .select('id, event_type, severity, risk_score, created_at')
        .gte('risk_score', 60).eq('reviewed', false)
        .order('risk_score', { ascending: false }).limit(5),
      supabase.from('omega_final_sla_breaches')
        .select('id, entity_type, entity_id, hours_overdue')
        .is('resolved_at', null).order('hours_overdue', { ascending: false }).limit(5),
      supabase.from('omega_final_health_scores')
        .select('client_id, overall_score, risk_level, churn_probability')
        .in('risk_level', ['critical', 'high'])
        .order('overall_score').limit(5),
    ]);

    return NextResponse.json({
      critical: {
        urgent_disputes: disputesRes.data ?? [],
        critical_incidents: incidentsRes.data ?? [],
        security_alerts: secRes.data ?? [],
        sla_breaches: slaRes.data ?? [],
        at_risk_clients: atRiskRes.data ?? [],
      },
    });
  }

  // Full snapshot
  const [
    ordersRes, revenueRes, clientsRes, quotesRes,
    incidentsRes, slaRes, autoRes,
    healthScoresRes, settlementsRes, disputesRes,
    secEventsRes, integrationsRes,
  ] = await Promise.all([
    supabase.from('orders').select('id, total_amount, status, created_at').gte('created_at', d30d),
    supabase.from('orders').select('total_amount').gte('created_at', d7d).not('status', 'eq', 'cancelled'),
    supabase.from('clients').select('id, health_score, total_revenue').limit(100),
    supabase.from('quotes').select('id, total_amount').eq('status', 'pending'),
    supabase.from('omega_final_incidents').select('status, severity').in('status', ['open', 'investigating', 'resolved']).limit(50),
    supabase.from('omega_final_sla_breaches').select('id').is('resolved_at', null),
    supabase.from('omega_final_autopilot_runs').select('actions_taken, completed_at').gte('created_at', d7d),
    supabase.from('omega_final_health_scores').select('overall_score, risk_level').order('scored_at', { ascending: false }).limit(100),
    supabase.from('omega_abs_settlements').select('net_settled, settlement_date').order('settlement_date', { ascending: false }).limit(7),
    supabase.from('omega_abs_disputes').select('status, amount'),
    supabase.from('omega_abs_security_events').select('severity, risk_score').gte('created_at', d7d),
    supabase.from('omega_abs_integrations').select('status, is_active').eq('is_active', true),
  ]);

  // Compute aggregates
  const orders = ordersRes.data ?? [];
  const rev7d = (revenueRes.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const rev30d = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const clients = clientsRes.data ?? [];
  const avgHealth = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + Number(c.health_score ?? 60), 0) / clients.length) : 0;

  const pipeline = (quotesRes.data ?? []).reduce((s, q) => s + Number(q.total_amount ?? 0), 0);

  const incidents = incidentsRes.data ?? [];
  const openIncidents = incidents.filter(i => ['open', 'investigating'].includes(i.status)).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && ['open', 'investigating'].includes(i.status)).length;

  const autopilotActions = (autoRes.data ?? []).reduce((s, r) => s + (r.actions_taken ?? 0), 0);

  const healthScores = healthScoresRes.data ?? [];
  const atRiskCount = healthScores.filter(h => ['critical', 'high'].includes(h.risk_level ?? '')).length;
  const champCount = healthScores.filter(h => Number(h.overall_score ?? 0) >= 80).length;

  const totalSettled = (settlementsRes.data ?? []).reduce((s, st) => s + Number(st.net_settled ?? 0), 0);
  const openDisputes = (disputesRes.data ?? []).filter(d => ['needs_response', 'under_review'].includes(d.status)).length;
  const disputeValue = (disputesRes.data ?? []).filter(d => d.status === 'needs_response').reduce((s, d) => s + Number(d.amount ?? 0), 0);

  const secAlerts = (secEventsRes.data ?? []).filter(e => e.risk_score >= 50).length;
  const integrations = integrationsRes.data ?? [];
  const integHealthy = integrations.filter(i => i.status === 'healthy').length;
  const integHealth = integrations.length > 0 ? Math.round((integHealthy / integrations.length) * 100) : 100;

  // Overall system health score
  const systemHealth = Math.max(0, Math.round(
    100
    - criticalIncidents * 20
    - openDisputes * 5
    - secAlerts * 3
    - (slaRes.data?.length ?? 0) * 5
    - (atRiskCount / Math.max(clients.length, 1)) * 20
  ));

  return NextResponse.json({
    system_health: Math.max(0, Math.min(100, systemHealth)),
    finance: {
      rev_7d: Math.round(rev7d),
      rev_30d: Math.round(rev30d),
      pipeline: Math.round(pipeline),
      settlements_7d: Math.round(totalSettled),
      open_disputes: openDisputes,
      dispute_value: Math.round(disputeValue),
      pending_orders: pendingOrders,
    },
    operations: {
      open_incidents: openIncidents,
      critical_incidents: criticalIncidents,
      sla_breaches: slaRes.data?.length ?? 0,
      autopilot_actions_7d: autopilotActions,
    },
    customers: {
      total: clients.length,
      avg_health: avgHealth,
      at_risk: atRiskCount,
      champions: champCount,
    },
    infrastructure: {
      integration_health_pct: integHealth,
      integrations_up: integHealthy,
      integrations_total: integrations.length,
    },
    security: {
      alerts_7d: secAlerts,
    },
    generated_at: now.toISOString(),
  });
  } catch (error) {
    console.error('[command] GET error:', error);
    return NextResponse.json({ error: 'Command center unavailable' }, { status: 500 });
  }
}
