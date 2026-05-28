import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S12: Self-Healing Infrastructure ────────────────────────────────
//
// Health probe management + automated remediation logging for all OS services.
// Tracks consecutive failures, triggers remediations, logs outcomes.
//
// GET  ?mode=probes             — all probes with current status
// GET  ?mode=summary            — infra health summary
// GET  ?mode=remediations       — recent remediation log
// POST { action:'create_probe' }   — register health probe
// POST { action:'record_check' }   — log probe check result (success/failure)
// POST { action:'remediate' }      — trigger + log remediation attempt
// POST { action:'reset' }          — reset consecutive_failures counter
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'summary';

  if (mode === 'summary') {
    const { data } = await supabase.from('omega_x_health_probes')
      .select('status, consecutive_failures, service_name');
    const probes = data ?? [];
    const healthy = probes.filter(p => p.status === 'healthy').length;
    const degraded = probes.filter(p => p.status === 'degraded').length;
    const unhealthy = probes.filter(p => p.status === 'unhealthy').length;
    const total = probes.length;
    const overallHealth = total === 0 ? 100
      : Math.round(((healthy + degraded * 0.5) / total) * 100);

    return NextResponse.json({
      total, healthy, degraded, unhealthy,
      overall_health: overallHealth,
      critical_services: probes.filter(p => p.status === 'unhealthy').map(p => p.service_name),
    });
  }

  if (mode === 'probes') {
    const { data } = await supabase.from('omega_x_health_probes')
      .select('*').order('status');
    return NextResponse.json({ probes: data ?? [] });
  }

  if (mode === 'remediations') {
    const { data } = await supabase.from('omega_x_remediation_log')
      .select('*, omega_x_health_probes(service_name)')
      .order('triggered_at', { ascending: false }).limit(50);
    return NextResponse.json({ remediations: data ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'create_probe') {
    const { service_name, probe_type, endpoint, check_interval = 60,
      timeout_ms = 5000, threshold_fail = 3, remediation } = body;
    if (!service_name || !probe_type) {
      return NextResponse.json({ error: 'service_name and probe_type required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('omega_x_health_probes').insert({
      service_name, probe_type, endpoint, check_interval, timeout_ms, threshold_fail, remediation,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ probe: data, action: 'created' });
  }

  if (action === 'record_check') {
    const { id, success, latency_ms } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: probe } = await supabase.from('omega_x_health_probes')
      .select('consecutive_failures, threshold_fail').eq('id', id).single();

    if (!probe) return NextResponse.json({ error: 'Probe not found' }, { status: 404 });

    const now = new Date().toISOString();
    if (success) {
      await supabase.from('omega_x_health_probes').update({
        status: 'healthy', consecutive_failures: 0,
        last_check: now, last_success: now,
      }).eq('id', id);
      return NextResponse.json({ status: 'healthy', action: 'recorded' });
    } else {
      const newFails = (probe.consecutive_failures ?? 0) + 1;
      const newStatus = newFails >= (probe.threshold_fail ?? 3) ? 'unhealthy'
        : newFails >= Math.floor((probe.threshold_fail ?? 3) / 2) ? 'degraded'
        : 'healthy';

      await supabase.from('omega_x_health_probes').update({
        status: newStatus, consecutive_failures: newFails,
        last_check: now,
      }).eq('id', id);

      return NextResponse.json({ status: newStatus, consecutive_failures: newFails, action: 'recorded' });
    }
  }

  if (action === 'remediate') {
    const { id, trigger_reason, action_taken, outcome, duration_ms, details } = body;
    if (!id || !trigger_reason || !action_taken || !outcome) {
      return NextResponse.json({ error: 'id, trigger_reason, action_taken, outcome required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('omega_x_remediation_log').insert({
      probe_id: id, trigger_reason, action_taken, outcome,
      duration_ms: duration_ms ?? null, details: details ?? {},
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If success, reset the probe
    if (outcome === 'success') {
      await supabase.from('omega_x_health_probes').update({
        status: 'healthy', consecutive_failures: 0, last_success: new Date().toISOString(),
      }).eq('id', id);
    }
    return NextResponse.json({ remediation: data, action: 'logged' });
  }

  if (action === 'reset') {
    const { id } = body;
    const { data, error } = await supabase.from('omega_x_health_probes')
      .update({ consecutive_failures: 0, status: 'healthy', last_check: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ probe: data, action: 'reset' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
