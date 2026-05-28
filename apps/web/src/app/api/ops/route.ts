import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA FINAL — Operations Command Layer ────────────────────────────────────
//
// War room: incidents, SLA rules, SLA breach detection, MTTR tracking.
// AI generates recommendations for every incident.
//
// GET  ?mode=war_room          — aggregated ops dashboard
// GET  ?mode=incidents         — incident list (filterable)
// GET  ?mode=incident&id=      — incident detail
// GET  ?mode=sla_rules         — active SLA rules
// GET  ?mode=sla_breaches      — open SLA breaches
// GET  ?mode=mttr              — MTTR stats by category
// POST { action:'open_incident' }    — create incident
// POST { action:'update_incident' }  — update status/assignment
// POST { action:'resolve_incident' } — resolve + compute MTTR
// POST { action:'ai_recommend' }     — Claude Haiku recommendation
// POST { action:'create_sla_rule' }  — create SLA rule
// POST { action:'scan_sla' }         — scan for SLA breaches (autonomous)
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
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
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'war_room';

  if (mode === 'war_room') {
    const [incidents, breaches, rules] = await Promise.all([
      supabase.from('omega_final_incidents')
        .select('id, title, severity, category, status, assigned_to, created_at, resolved_at, mttr_minutes')
        .in('status', ['open', 'investigating'])
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('omega_final_sla_breaches')
        .select('*, omega_final_sla_rules(name, entity_type, threshold_hours, severity)')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('omega_final_sla_rules')
        .select('id, name, entity_type, threshold_hours, severity, is_active')
        .eq('is_active', true),
    ]);

    // MTTR stats for resolved incidents (last 30d)
    const { data: resolved } = await supabase.from('omega_final_incidents')
      .select('category, mttr_minutes')
      .eq('status', 'resolved')
      .not('mttr_minutes', 'is', null)
      .gte('resolved_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const mttrByCategory: Record<string, { total: number; count: number }> = {};
    for (const r of (resolved ?? [])) {
      if (!r.category) continue;
      if (!mttrByCategory[r.category]) mttrByCategory[r.category] = { total: 0, count: 0 };
      mttrByCategory[r.category].total += r.mttr_minutes ?? 0;
      mttrByCategory[r.category].count += 1;
    }
    const mttr = Object.entries(mttrByCategory).map(([cat, { total, count }]) => ({
      category: cat, avg_mttr_minutes: Math.round(total / count), count,
    }));

    const openCount = incidents.data?.length ?? 0;
    const criticalCount = incidents.data?.filter(i => i.severity === 'critical').length ?? 0;
    const breachCount = breaches.data?.length ?? 0;

    return NextResponse.json({
      summary: {
        open_incidents: openCount,
        critical_incidents: criticalCount,
        open_sla_breaches: breachCount,
        active_sla_rules: rules.data?.length ?? 0,
        health_score: Math.max(0, 100 - criticalCount * 25 - openCount * 5 - breachCount * 10),
      },
      incidents: incidents.data ?? [],
      sla_breaches: breaches.data ?? [],
      sla_rules: rules.data ?? [],
      mttr,
    });
  }

  if (mode === 'incidents') {
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');

    let q = supabase.from('omega_final_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) q = q.eq('status', status);
    if (severity) q = q.eq('severity', severity);
    if (category) q = q.eq('category', category);

    const { data } = await q;
    return NextResponse.json({ incidents: data ?? [] });
  }

  if (mode === 'incident') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_final_incidents')
      .select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ incident: data });
  }

  if (mode === 'sla_rules') {
    const { data } = await supabase.from('omega_final_sla_rules')
      .select('*').order('created_at', { ascending: false });
    return NextResponse.json({ rules: data ?? [] });
  }

  if (mode === 'sla_breaches') {
    const resolved = searchParams.get('resolved') === 'true';
    let q = supabase.from('omega_final_sla_breaches')
      .select('*, omega_final_sla_rules(name, entity_type, threshold_hours, severity)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!resolved) q = q.is('resolved_at', null);
    const { data } = await q;
    return NextResponse.json({ breaches: data ?? [] });
  }

  if (mode === 'mttr') {
    const { data } = await supabase.from('omega_final_incidents')
      .select('category, severity, mttr_minutes, resolved_at')
      .eq('status', 'resolved')
      .not('mttr_minutes', 'is', null)
      .gte('resolved_at', new Date(Date.now() - 90 * 86400000).toISOString());

    const stats: Record<string, { total: number; count: number; min: number; max: number }> = {};
    for (const r of (data ?? [])) {
      const k = r.category ?? 'unknown';
      if (!stats[k]) stats[k] = { total: 0, count: 0, min: Infinity, max: 0 };
      stats[k].total += r.mttr_minutes ?? 0;
      stats[k].count += 1;
      stats[k].min = Math.min(stats[k].min, r.mttr_minutes ?? 0);
      stats[k].max = Math.max(stats[k].max, r.mttr_minutes ?? 0);
    }

    return NextResponse.json({
      mttr: Object.entries(stats).map(([category, s]) => ({
        category,
        avg_mttr_minutes: Math.round(s.total / s.count),
        min_mttr_minutes: s.min === Infinity ? 0 : s.min,
        max_mttr_minutes: s.max,
        count: s.count,
      })),
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

  if (action === 'open_incident') {
    const { title, description, severity = 'medium', category, entity_type, entity_id, assigned_to } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    // Auto AI recommendation
    let ai_recommendation = '';
    if (ANTHROPIC_API_KEY) {
      ai_recommendation = await callClaude(
        'És um especialista em operações de plataforma B2B. Dás recomendações concisas e accionáveis em português.',
        `Incidente: "${title}" (${severity} / ${category ?? 'geral'})
${description ? `Descrição: ${description}` : ''}
Dá 2-3 passos imediatos para investigar e resolver este incidente.`,
        200,
      );
    }

    const { data, error } = await supabase.from('omega_final_incidents').insert({
      title, description, severity, category,
      entity_type: entity_type ?? null,
      entity_id: entity_id ? String(entity_id) : null,
      assigned_to: assigned_to ?? user.email,
      ai_recommendation,
      status: 'open',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-create notification for critical incidents
    if (severity === 'critical') {
      await supabase.from('omega_final_notifications').insert({
        user_email: null,
        type: 'error',
        category: 'system',
        title: `🚨 Incidente Crítico: ${title}`,
        message: description ?? '',
        action_url: `/ops`,
        action_label: 'Ver War Room',
        priority: 3,
        source: 'ops',
      });
    }

    return NextResponse.json({ incident: data, action: 'opened' });
  }

  if (action === 'update_incident') {
    const { id, status, assigned_to, root_cause, resolution_notes } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (root_cause !== undefined) updates.root_cause = root_cause;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
    if (status === 'investigating') updates.status = 'investigating';

    const { data, error } = await supabase.from('omega_final_incidents')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ incident: data, action: 'updated' });
  }

  if (action === 'resolve_incident') {
    const { id, resolution_notes, root_cause } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: existing } = await supabase.from('omega_final_incidents')
      .select('created_at, status').eq('id', id).single();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const resolvedAt = new Date();
    const createdAt = new Date(existing.created_at);
    const mttrMinutes = Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60000);

    const { data, error } = await supabase.from('omega_final_incidents')
      .update({
        status: 'resolved',
        resolved_at: resolvedAt.toISOString(),
        mttr_minutes: mttrMinutes,
        resolution_notes: resolution_notes ?? null,
        root_cause: root_cause ?? null,
        updated_at: resolvedAt.toISOString(),
      }).eq('id', id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ incident: data, mttr_minutes: mttrMinutes, action: 'resolved' });
  }

  if (action === 'ai_recommend') {
    const { id } = body;
    const { data: incident } = await supabase.from('omega_final_incidents')
      .select('*').eq('id', id).single();
    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const recommendation = await callClaude(
      'És um especialista em operações de plataforma B2B. Dás recomendações concisas e accionáveis em português.',
      `Incidente: "${incident.title}" (${incident.severity} / ${incident.category})
Status: ${incident.status}
${incident.description ? `Descrição: ${incident.description}` : ''}
${incident.root_cause ? `Causa raiz: ${incident.root_cause}` : ''}
Tempo aberto: ${Math.round((Date.now() - new Date(incident.created_at).getTime()) / 60000)} minutos

Dá uma recomendação detalhada de resolução com passos específicos.`,
      400,
    );

    await supabase.from('omega_final_incidents')
      .update({ ai_recommendation: recommendation, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ recommendation, action: 'recommended' });
  }

  if (action === 'create_sla_rule') {
    const { name, entity_type, metric, threshold_hours, breach_action = 'notify', escalation_email, severity = 'medium' } = body;
    if (!name || !entity_type || !metric || !threshold_hours) {
      return NextResponse.json({ error: 'name, entity_type, metric, threshold_hours required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('omega_final_sla_rules').insert({
      name, entity_type, metric, threshold_hours: Number(threshold_hours),
      breach_action, escalation_email: escalation_email ?? null, severity,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data, action: 'created' });
  }

  if (action === 'scan_sla') {
    // Autonomous SLA breach scanner
    // Scans open orders/quotes against active SLA rules
    const rules = await supabase.from('omega_final_sla_rules')
      .select('*').eq('is_active', true);

    let breachesCreated = 0;
    const newBreaches: Array<Record<string, unknown>> = [];

    for (const rule of (rules.data ?? [])) {
      const cutoff = new Date(Date.now() - rule.threshold_hours * 3600000).toISOString();

      if (rule.entity_type === 'order') {
        const { data: orders } = await supabase.from('orders')
          .select('id, status, created_at')
          .eq('status', 'pending')
          .lt('created_at', cutoff)
          .limit(50);

        for (const order of (orders ?? [])) {
          // Check if breach already logged
          const { count } = await supabase.from('omega_final_sla_breaches')
            .select('id', { count: 'exact', head: true })
            .eq('rule_id', rule.id)
            .eq('entity_id', String(order.id))
            .is('resolved_at', null);

          if ((count ?? 0) === 0) {
            const hoursOverdue = (Date.now() - new Date(order.created_at).getTime()) / 3600000 - rule.threshold_hours;
            await supabase.from('omega_final_sla_breaches').insert({
              rule_id: rule.id,
              entity_type: 'order',
              entity_id: String(order.id),
              hours_overdue: Math.round(hoursOverdue * 100) / 100,
            });
            breachesCreated++;
            newBreaches.push({ rule: rule.name, entity_type: 'order', entity_id: order.id, hours_overdue: hoursOverdue });

            // Notify
            await supabase.from('omega_final_notifications').insert({
              user_email: null,
              type: rule.severity === 'critical' ? 'error' : 'warning',
              category: 'sla',
              title: `SLA Breach: ${rule.name}`,
              message: `Encomenda ${order.id} excedeu ${rule.threshold_hours}h de SLA`,
              action_url: `/orders`,
              action_label: 'Ver Encomenda',
              priority: rule.severity === 'critical' ? 3 : rule.severity === 'high' ? 2 : 1,
              source: 'sla_scanner',
            });
          }
        }
      }

      if (rule.entity_type === 'quote') {
        const { data: quotes } = await supabase.from('quotes')
          .select('id, status, created_at')
          .eq('status', 'pending')
          .lt('created_at', cutoff)
          .limit(50);

        for (const quote of (quotes ?? [])) {
          const { count } = await supabase.from('omega_final_sla_breaches')
            .select('id', { count: 'exact', head: true })
            .eq('rule_id', rule.id)
            .eq('entity_id', String(quote.id))
            .is('resolved_at', null);

          if ((count ?? 0) === 0) {
            const hoursOverdue = (Date.now() - new Date(quote.created_at).getTime()) / 3600000 - rule.threshold_hours;
            await supabase.from('omega_final_sla_breaches').insert({
              rule_id: rule.id,
              entity_type: 'quote',
              entity_id: String(quote.id),
              hours_overdue: Math.round(hoursOverdue * 100) / 100,
            });
            breachesCreated++;
            newBreaches.push({ rule: rule.name, entity_type: 'quote', entity_id: quote.id, hours_overdue: hoursOverdue });
          }
        }
      }
    }

    return NextResponse.json({
      breaches_created: breachesCreated,
      new_breaches: newBreaches,
      rules_scanned: rules.data?.length ?? 0,
      action: 'scan_completed',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
