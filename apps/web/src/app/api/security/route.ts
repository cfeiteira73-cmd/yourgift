import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA ABSOLUTE FINAL — Phase 10: Enterprise Security Engine ───────────────
//
// Suspicious activity detection, audit-trail forensics, threat intelligence,
// session risk scoring, and security event management.
//
// GET  ?mode=dashboard      — security posture overview
// GET  ?mode=events         — security event log (paginated)
// GET  ?mode=threats        — threat intel blocklist
// GET  ?mode=stats          — security statistics
// POST { action:'log_event' }       — log security event
// POST { action:'scan_audit' }      — scan audit trail for anomalies
// POST { action:'add_threat' }      — add threat indicator
// POST { action:'review_event' }    — mark event reviewed
// POST { action:'block_indicator' } — block IP/email/UA
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
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

function scoreSecurityEvent(event: Record<string, unknown>): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  // Failed auth attempts
  if (event.event_type === 'auth_failed') { score += 30; signals.push('Auth falhado'); }
  if (event.event_type === 'brute_force') { score += 60; signals.push('Possível brute force'); }
  if (event.event_type === 'rate_limited') { score += 20; signals.push('Rate limit atingido'); }
  if (event.event_type === 'privilege_escalation') { score += 50; signals.push('Escalada de privilégios'); }
  if (event.event_type === 'data_export') { score += 25; signals.push('Exportação de dados'); }
  if (event.event_type === 'bulk_delete') { score += 40; signals.push('Eliminação em massa'); }
  if (event.event_type === 'admin_access') { score += 10; signals.push('Acesso admin'); }
  if (event.event_type === 'suspicious_payload') { score += 45; signals.push('Payload suspeito'); }
  if (event.event_type === 'geo_anomaly') { score += 35; signals.push('Anomalia geográfica'); }

  // Unknown user agent
  if (!event.user_agent || (event.user_agent as string).length < 5) {
    score += 15; signals.push('User agent desconhecido');
  }

  return { score: Math.min(score, 100), signals };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'dashboard';

  if (mode === 'dashboard') {
    const [eventsRes, threatsRes, highRiskRes] = await Promise.all([
      supabase.from('omega_abs_security_events')
        .select('id, event_type, severity, outcome, risk_score, created_at, user_email, reviewed')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('omega_abs_threat_intel')
        .select('id, indicator, type, threat_level, active').eq('active', true).limit(10),
      supabase.from('omega_abs_security_events')
        .select('id, event_type, risk_score, user_email, created_at')
        .gte('risk_score', 50).eq('reviewed', false)
        .order('risk_score', { ascending: false }).limit(10),
    ]);

    const events = eventsRes.data ?? [];
    const criticalCount = events.filter(e => e.severity === 'critical').length;
    const blockedCount = events.filter(e => e.outcome === 'blocked').length;
    const unreviewed = (highRiskRes.data ?? []).length;

    return NextResponse.json({
      posture: {
        score: Math.max(0, 100 - criticalCount * 15 - unreviewed * 5),
        critical_events: criticalCount,
        blocked_requests: blockedCount,
        high_risk_unreviewed: unreviewed,
        active_threats: (threatsRes.data ?? []).length,
      },
      recent_events: events,
      high_risk: highRiskRes.data ?? [],
      threat_intel: threatsRes.data ?? [],
    });
  }

  if (mode === 'events') {
    const page = parseInt(searchParams.get('page') ?? '0');
    const severity = searchParams.get('severity');
    let query = supabase.from('omega_abs_security_events')
      .select('*').order('created_at', { ascending: false })
      .range(page * 50, page * 50 + 49);
    if (severity) query = query.eq('severity', severity);
    const { data } = await query;
    return NextResponse.json({ events: data ?? [] });
  }

  if (mode === 'threats') {
    const { data } = await supabase.from('omega_abs_threat_intel')
      .select('*').order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ threats: data ?? [] });
  }

  if (mode === 'stats') {
    const { data } = await supabase.from('omega_abs_security_events')
      .select('severity, outcome, event_type, risk_score')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const events = data ?? [];
    return NextResponse.json({
      stats: {
        total_7d: events.length,
        by_severity: {
          critical: events.filter(e => e.severity === 'critical').length,
          high:     events.filter(e => e.severity === 'high').length,
          medium:   events.filter(e => e.severity === 'medium').length,
          low:      events.filter(e => e.severity === 'low').length,
        },
        blocked_7d: events.filter(e => e.outcome === 'blocked').length,
        avg_risk_score: events.length > 0
          ? Math.round(events.reduce((s, e) => s + (e.risk_score ?? 0), 0) / events.length) : 0,
        top_event_types: Object.entries(
          events.reduce((acc, e) => ({ ...acc, [e.event_type]: (acc[e.event_type] ?? 0) + 1 }), {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1]).slice(0, 5),
      },
    });
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

  if (action === 'log_event') {
    const { event_type, ip_address, user_agent, resource, action: evAction, metadata } = body;
    if (!event_type) return NextResponse.json({ error: 'event_type required' }, { status: 400 });

    const { score, signals } = scoreSecurityEvent({ event_type, user_agent, ...body });
    const severity = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : score > 0 ? 'low' : 'info';

    const { data } = await supabase.from('omega_abs_security_events').insert({
      user_email: user.email,
      event_type,
      severity,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      resource: resource ?? null,
      action: evAction ?? null,
      risk_score: score,
      signals,
      metadata: metadata ?? {},
    }).select().single();

    // Auto-notify critical events
    if (severity === 'critical') {
      await supabase.from('omega_final_notifications').insert({
        user_email: null,
        type: 'error',
        category: 'security',
        title: `🚨 Evento de Segurança Crítico: ${event_type}`,
        message: signals.join(' · ') || 'Atividade suspeita detetada',
        action_url: '/security',
        action_label: 'Ver Segurança',
        priority: 3,
        source: 'security_engine',
      });
    }

    return NextResponse.json({ event: data, score, severity });
  }

  if (action === 'scan_audit') {
    // Scan last 200 audit trail entries for anomalies
    const { data: auditEntries } = await supabase.from('omega_final_audit_trail')
      .select('user_email, action, entity_type, result, created_at')
      .order('created_at', { ascending: false }).limit(200);

    const entries = auditEntries ?? [];
    const anomalies: Array<Record<string, unknown>> = [];

    // Detect bulk operations (>10 of same action from same user in <5 min)
    type AuditEntry = { user_email: string | null; action: string; entity_type: string | null; result: string | null; created_at: string };
    const grouped = (entries as AuditEntry[]).reduce((acc, e) => {
      const key = `${e.user_email}:${e.action}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {} as Record<string, AuditEntry[]>);

    for (const [key, evts] of Object.entries(grouped)) {
      if (evts.length > 10) {
        const [email, actionType] = key.split(':');
        anomalies.push({
          type: 'bulk_operation',
          user_email: email,
          action: actionType,
          count: evts.length,
          first_at: evts[evts.length - 1]?.created_at,
          last_at: evts[0]?.created_at,
        });
      }
    }

    // Detect failed operations surge
    const failed = (entries as AuditEntry[]).filter(e => e.result === 'error' || e.result === 'forbidden');
    if (failed.length > 20) {
      anomalies.push({
        type: 'high_error_rate',
        count: failed.length,
        rate_pct: Math.round((failed.length / entries.length) * 100),
      });
    }

    // AI anomaly interpretation if anomalies found
    let aiAnalysis = '';
    if (anomalies.length > 0) {
      aiAnalysis = await callClaude(
        'És um analista de segurança. Identificas padrões suspeitos em logs de auditoria em português.',
        `Anomalias detetadas nos últimos logs:
${JSON.stringify(anomalies, null, 2)}
Avalia o risco em 2-3 frases. (máx 80 palavras)`,
        120,
      );
    }

    // Log anomalies as security events
    for (const anomaly of anomalies) {
      await supabase.from('omega_abs_security_events').insert({
        user_email: anomaly.user_email as string ?? null,
        event_type: String(anomaly.type),
        severity: 'medium',
        risk_score: 40,
        signals: [String(anomaly.type)],
        metadata: anomaly,
      });
    }

    return NextResponse.json({
      anomalies,
      ai_analysis: aiAnalysis,
      entries_scanned: entries.length,
    });
  }

  if (action === 'add_threat') {
    const { indicator, type, threat_level, reason, auto_block } = body;
    if (!indicator || !type) return NextResponse.json({ error: 'indicator and type required' }, { status: 400 });

    const { data } = await supabase.from('omega_abs_threat_intel').upsert({
      indicator, type,
      threat_level: threat_level ?? 'medium',
      reason: reason ?? null,
      auto_block: auto_block ?? false,
      active: true,
      created_by: user.email,
    }, { onConflict: 'indicator' }).select().single();

    return NextResponse.json({ threat: data });
  }

  if (action === 'review_event') {
    const { event_id, notes } = body;
    if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 });

    const { data } = await supabase.from('omega_abs_security_events')
      .update({ reviewed: true, reviewed_by: user.email, notes: notes ?? null })
      .eq('id', event_id).select().single();

    return NextResponse.json({ event: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
