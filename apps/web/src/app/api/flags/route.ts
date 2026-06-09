import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S11: Feature Flags & Experimentation ────────────────────────────
//
// Manage feature flags with progressive rollout, targeting rules, and A/B
// experiment tracking with AI-generated analysis of results.
//
// GET  ?mode=list               — all flags with experiment counts
// GET  ?mode=flag&key=          — flag detail + experiments + results
// GET  ?mode=evaluate&key=&uid= — evaluate flag for a user (true/false + variant)
// POST { action:'create' }      — create new flag
// POST { action:'update' }      — update flag settings
// POST { action:'toggle' }      — enable/disable flag
// POST { action:'create_experiment' } — attach A/B experiment to flag
// POST { action:'conclude_experiment' } — mark experiment concluded with AI analysis
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 400): Promise<string> {
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

// Deterministic hash for rollout targeting (no crypto dependency)
function hashForRollout(key: string, userId: string): number {
  const str = `${key}:${userId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';

  // ── Flag list ─────────────────────────────────────────────────────────────
  if (mode === 'list') {
    const { data: flags } = await supabase.from('omega_x_feature_flags')
      .select('*, omega_x_experiments(id, status, name)')
      .order('updated_at', { ascending: false });
    return NextResponse.json({ flags: flags ?? [] });
  }

  // ── Flag detail ───────────────────────────────────────────────────────────
  if (mode === 'flag') {
    const key = searchParams.get('key');
    const id = searchParams.get('id');
    if (!key && !id) return NextResponse.json({ error: 'key or id required' }, { status: 400 });

    let q = supabase.from('omega_x_feature_flags').select('*');
    if (key) q = q.eq('key', key);
    else if (id) q = q.eq('id', id);
    const { data: flag } = await q.single();
    if (!flag) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: experiments } = await supabase.from('omega_x_experiments')
      .select('*').eq('flag_id', flag.id).order('created_at', { ascending: false });

    return NextResponse.json({ flag, experiments: experiments ?? [] });
  }

  // ── Evaluate flag for a user ──────────────────────────────────────────────
  if (mode === 'evaluate') {
    const key = searchParams.get('key');
    const uid = searchParams.get('uid') ?? user.id;
    const email = searchParams.get('email') ?? (user.email ?? '');

    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const { data: flag } = await supabase.from('omega_x_feature_flags')
      .select('*').eq('key', key).single();

    if (!flag) return NextResponse.json({ enabled: false, variant: null, reason: 'not_found' });
    if (!flag.enabled) return NextResponse.json({ enabled: false, variant: null, reason: 'disabled' });

    // Check targeting rules
    const targeting = flag.targeting as { emails?: string[]; segments?: string[] } ?? {};
    if (targeting.emails && targeting.emails.length > 0) {
      if (targeting.emails.includes(email)) {
        return NextResponse.json({ enabled: true, variant: 'targeted', reason: 'email_match' });
      }
    }

    // Rollout %
    const bucket = hashForRollout(key, uid);
    const enabled = bucket < flag.rollout_pct;

    // Variant assignment for experiments
    let variant: string | null = null;
    if (enabled && flag.variants && Object.keys(flag.variants as object).length > 0) {
      const variants = flag.variants as Record<string, number>;
      let cumulative = 0;
      const normalizedBucket = (bucket / 100);
      for (const [name, weight] of Object.entries(variants)) {
        cumulative += weight;
        if (normalizedBucket < cumulative) { variant = name; break; }
      }
    }

    return NextResponse.json({ enabled, variant, reason: enabled ? 'rollout' : 'out_of_rollout', bucket });
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

  // ── Create flag ───────────────────────────────────────────────────────────
  if (action === 'create') {
    const { key, name, description, rollout_pct = 0, targeting = {}, variants = {}, metadata = {} } = body;
    if (!key || !name) return NextResponse.json({ error: 'key and name required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_x_feature_flags').insert({
      key, name, description, rollout_pct, targeting, variants, metadata,
      created_by: user.email,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flag: data, action: 'created' });
  }

  // ── Update flag ───────────────────────────────────────────────────────────
  if (action === 'update') {
    const { id, key, name, description, rollout_pct, targeting, variants, metadata } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (key !== undefined) updates.key = key;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (rollout_pct !== undefined) updates.rollout_pct = rollout_pct;
    if (targeting !== undefined) updates.targeting = targeting;
    if (variants !== undefined) updates.variants = variants;
    if (metadata !== undefined) updates.metadata = metadata;

    const { data, error } = await supabase.from('omega_x_feature_flags')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flag: data, action: 'updated' });
  }

  // ── Toggle flag on/off ────────────────────────────────────────────────────
  if (action === 'toggle') {
    const { id, enabled } = body;
    if (!id || enabled === undefined) return NextResponse.json({ error: 'id and enabled required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_x_feature_flags')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flag: data, action: enabled ? 'enabled' : 'disabled' });
  }

  // ── Create experiment ─────────────────────────────────────────────────────
  if (action === 'create_experiment') {
    const { flag_id, name, hypothesis, metric } = body;
    if (!flag_id || !name || !metric) {
      return NextResponse.json({ error: 'flag_id, name, metric required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('omega_x_experiments').insert({
      flag_id, name, hypothesis, metric, status: 'draft',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ experiment: data, action: 'created' });
  }

  // ── Start experiment ──────────────────────────────────────────────────────
  if (action === 'start_experiment') {
    const { id } = body;
    const { data, error } = await supabase.from('omega_x_experiments')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ experiment: data, action: 'started' });
  }

  // ── Conclude experiment with AI analysis ──────────────────────────────────
  if (action === 'conclude_experiment') {
    const { id, winner, results } = body;
    if (!id || !results) return NextResponse.json({ error: 'id and results required' }, { status: 400 });

    const { data: exp } = await supabase.from('omega_x_experiments')
      .select('*, omega_x_feature_flags(name, key)').eq('id', id).single();

    const analysis = await callClaude(
      'És um analista de produto especializado em A/B testing. Responde em português, de forma concisa.',
      `Experimento: "${exp?.name ?? 'N/A'}" | Métrica: ${exp?.metric ?? 'N/A'}
Hipótese: ${exp?.hypothesis ?? 'N/A'}
Resultados: ${JSON.stringify(results, null, 2)}
Vencedor: ${winner ?? 'inconclusivo'}

Analisa os resultados (3-4 frases): o que funcionou, porquê, e qual é a recomendação de produto.`,
      400,
    );

    const { data, error } = await supabase.from('omega_x_experiments')
      .update({
        status: 'concluded',
        ended_at: new Date().toISOString(),
        winner: winner ?? null,
        results: results ?? {},
        ai_analysis: analysis || null,
      }).eq('id', id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ experiment: data, ai_analysis: analysis, action: 'concluded' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
