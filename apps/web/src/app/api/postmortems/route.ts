import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA ABSOLUTE FINAL — Phase 2: Postmortem Generator ─────────────────────
//
// AI-powered incident postmortem creation, on-call management, escalation matrix.
//
// GET  ?mode=list                  — all postmortems
// GET  ?mode=detail&id=            — single postmortem
// GET  ?mode=oncall                — current & upcoming on-call schedule
// GET  ?mode=stats                 — MTTR, incident frequency, postmortem coverage
// POST { action:'generate' }       — AI-generate postmortem from incident
// POST { action:'update' }         — update postmortem fields
// POST { action:'publish' }        — publish postmortem
// POST { action:'add_oncall' }     — add on-call shift
// POST { action:'create_manual' }  — create postmortem manually
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

async function callClaude(system: string, user: string, maxTokens = 500): Promise<string> {
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
  const mode = searchParams.get('mode') ?? 'list';

  if (mode === 'list') {
    const { data } = await supabase.from('omega_abs_postmortems')
      .select('id, title, severity, status, authored_by, created_at, published_at')
      .order('created_at', { ascending: false }).limit(30);
    return NextResponse.json({ postmortems: data ?? [] });
  }

  if (mode === 'detail') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_abs_postmortems')
      .select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ postmortem: data });
  }

  if (mode === 'oncall') {
    const now = new Date().toISOString();
    const [current, upcoming] = await Promise.all([
      supabase.from('omega_abs_oncall')
        .select('*')
        .lte('shift_start', now)
        .gte('shift_end', now)
        .eq('active', true),
      supabase.from('omega_abs_oncall')
        .select('*')
        .gt('shift_start', now)
        .eq('active', true)
        .order('shift_start').limit(5),
    ]);
    return NextResponse.json({
      current: current.data ?? [],
      upcoming: upcoming.data ?? [],
    });
  }

  if (mode === 'stats') {
    const [pmRes, incidentsRes] = await Promise.all([
      supabase.from('omega_abs_postmortems').select('severity, status'),
      supabase.from('omega_final_incidents')
        .select('severity, status, mttr_minutes, resolved_at')
        .not('resolved_at', 'is', null).limit(100),
    ]);

    const incidents = incidentsRes.data ?? [];
    const avgMTTR = incidents.length > 0
      ? Math.round(incidents.reduce((s, i) => s + (i.mttr_minutes ?? 0), 0) / incidents.length)
      : 0;

    const pms = pmRes.data ?? [];
    return NextResponse.json({
      stats: {
        total_postmortems: pms.length,
        published: pms.filter(p => p.status === 'published').length,
        draft: pms.filter(p => p.status === 'draft').length,
        total_incidents_resolved: incidents.length,
        avg_mttr_minutes: avgMTTR,
        postmortem_coverage_pct: incidents.length > 0
          ? Math.round((pms.length / incidents.length) * 100) : 0,
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

  if (action === 'generate') {
    const { incident_id } = body;
    if (!incident_id) return NextResponse.json({ error: 'incident_id required' }, { status: 400 });

    const { data: incident } = await supabase.from('omega_final_incidents')
      .select('*').eq('id', incident_id).single();
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

    // Generate postmortem content with AI
    const [rootCause, lessons, actionItems] = await Promise.all([
      callClaude(
        'És um engenheiro sénior de SRE/DevOps. Analisas incidentes e identificas causas-raiz em português.',
        `Incidente: "${incident.title}", severidade: ${incident.severity}, categoria: ${incident.category}.
Descrição: ${incident.description ?? 'N/A'}. Notas de resolução: ${incident.resolution_notes ?? 'N/A'}.
Identifica a causa-raiz mais provável em 2-3 frases.`,
        150,
      ),
      callClaude(
        'És um engenheiro SRE. Extrais lições aprendidas de incidentes em português.',
        `Incidente: "${incident.title}" (${incident.severity}). Causa: ${incident.root_cause ?? 'N/A'}.
Quais são as 2 principais lições aprendidas? (máx 60 palavras)`,
        100,
      ),
      callClaude(
        'És um gestor de operações. Defines action items específicos em português.',
        `Incidente: "${incident.title}". Lista 3 action items específicos e mensuráveis para prevenir recorrência. Formato: "1. [Ação] — [Responsável] — [Prazo]". (máx 80 palavras)`,
        120,
      ),
    ]);

    const timeline = [
      { time: incident.created_at, event: 'Incidente detetado' },
      { time: incident.resolved_at ?? new Date().toISOString(), event: 'Incidente resolvido' },
    ];

    const { data } = await supabase.from('omega_abs_postmortems').insert({
      incident_id,
      title: `Postmortem: ${incident.title}`,
      severity: incident.severity,
      authored_by: user.email,
      timeline,
      root_cause: rootCause,
      contributing_factors: [incident.category ?? 'unknown'],
      impact_summary: `Incidente ${incident.severity} afetou ${incident.entity_type ?? 'sistema'}.${incident.mttr_minutes ? ` MTTR: ${incident.mttr_minutes} minutos.` : ''}`,
      lessons_learned: lessons,
      action_items: actionItems ? [{ text: actionItems, status: 'open' }] : [],
      status: 'draft',
    }).select().single();

    return NextResponse.json({ postmortem: data });
  }

  if (action === 'create_manual') {
    const { title, severity, root_cause, impact_summary, lessons_learned, timeline } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const { data } = await supabase.from('omega_abs_postmortems').insert({
      title,
      severity: severity ?? 'medium',
      authored_by: user.email,
      root_cause: root_cause ?? null,
      impact_summary: impact_summary ?? null,
      lessons_learned: lessons_learned ?? null,
      timeline: timeline ?? [],
      status: 'draft',
    }).select().single();

    return NextResponse.json({ postmortem: data });
  }

  if (action === 'update') {
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const allowed = ['title', 'root_cause', 'contributing_factors', 'impact_summary',
                     'action_items', 'lessons_learned', 'status', 'timeline'];
    const filtered: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (updates[k] !== undefined) filtered[k] = updates[k];
    }

    const { data } = await supabase.from('omega_abs_postmortems')
      .update(filtered).eq('id', id).select().single();

    return NextResponse.json({ postmortem: data });
  }

  if (action === 'publish') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data } = await supabase.from('omega_abs_postmortems')
      .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).select().single();

    return NextResponse.json({ postmortem: data });
  }

  if (action === 'add_oncall') {
    const { engineer, email, shift_start, shift_end, escalation_level, timezone } = body;
    if (!engineer || !email || !shift_start || !shift_end) {
      return NextResponse.json({ error: 'engineer, email, shift_start, shift_end required' }, { status: 400 });
    }

    const { data } = await supabase.from('omega_abs_oncall').insert({
      engineer, email, shift_start, shift_end,
      escalation_level: escalation_level ?? 1,
      timezone: timezone ?? 'Europe/Lisbon',
    }).select().single();

    return NextResponse.json({ oncall: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
