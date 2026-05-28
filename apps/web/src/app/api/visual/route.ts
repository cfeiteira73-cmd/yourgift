import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S6: Visual Product Configuration Engine ────────────────────────
//
// 3D/visual product configurator sessions: store configuration state, track
// render requests, and generate AI-powered product descriptions.
//
// GET  ?mode=sessions           — list visual config sessions
// GET  ?mode=session&id=        — session detail + renders
// POST { action:'create' }      — new session with product config
// POST { action:'update_config' }— update configuration (colors, text, materials)
// POST { action:'request_render' }— queue render (thumbnail/preview/hd/ar_ready)
// POST { action:'complete_render' }— mark render complete with URL
// POST { action:'ai_describe' } — AI-generate product description from config
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

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
        model: CLAUDE_HAIKU, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
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
  const mode = searchParams.get('mode') ?? 'sessions';

  if (mode === 'sessions') {
    const status = searchParams.get('status');
    let q = supabase.from('omega_x_visual_sessions')
      .select('id, session_token, product_name, render_status, complexity_score, preview_url, created_at, client_id')
      .order('created_at', { ascending: false }).limit(50);
    if (status) q = q.eq('render_status', status);
    const { data } = await q;
    return NextResponse.json({ sessions: data ?? [] });
  }

  if (mode === 'session') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const [session, renders] = await Promise.all([
      supabase.from('omega_x_visual_sessions').select('*').eq('id', id).single(),
      supabase.from('omega_x_visual_renders').select('*').eq('session_id', id).order('created_at'),
    ]);
    if (session.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ session: session.data, renders: renders.data ?? [] });
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

  if (action === 'create') {
    const { client_id, product_id, product_name, configuration = {}, render_engine = 'css3d' } = body;
    const config = configuration as Record<string, unknown>;
    const complexity = Object.keys(config).length * 10 + (config.custom_text ? 20 : 0);

    const { data, error } = await supabase.from('omega_x_visual_sessions').insert({
      client_id: client_id ?? null,
      product_id: product_id ?? null,
      product_name, configuration, render_engine,
      complexity_score: Math.min(complexity, 100),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data, action: 'created' });
  }

  if (action === 'update_config') {
    const { id, configuration } = body;
    const config = configuration as Record<string, unknown>;
    const complexity = Object.keys(config).length * 10 + (config.custom_text ? 20 : 0);

    const { data, error } = await supabase.from('omega_x_visual_sessions')
      .update({
        configuration,
        complexity_score: Math.min(complexity, 100),
        render_status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data, action: 'config_updated' });
  }

  if (action === 'request_render') {
    const { session_id, render_type = 'preview', width = 800, height = 600 } = body;
    const start = Date.now();

    await supabase.from('omega_x_visual_sessions')
      .update({ render_status: 'rendering', updated_at: new Date().toISOString() })
      .eq('id', session_id);

    // Stub: real implementation would call render service (Three.js/Babylon/etc.)
    const renderMs = Date.now() - start + Math.floor(Math.random() * 200);
    const { data, error } = await supabase.from('omega_x_visual_renders').insert({
      session_id, render_type, width, height,
      url: null, // populated by complete_render
      render_ms: renderMs,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ render: data, action: 'queued' });
  }

  if (action === 'complete_render') {
    const { render_id, session_id, url, file_size_kb } = body;

    await supabase.from('omega_x_visual_renders').update({ url, file_size_kb }).eq('id', render_id);
    await supabase.from('omega_x_visual_sessions').update({
      render_status: 'complete', preview_url: url, updated_at: new Date().toISOString(),
    }).eq('id', session_id);

    return NextResponse.json({ action: 'render_completed', url });
  }

  if (action === 'ai_describe') {
    const { id } = body;
    const { data: session } = await supabase.from('omega_x_visual_sessions')
      .select('product_name, configuration').eq('id', id).single();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const config = session.configuration as Record<string, unknown>;
    const description = await callClaude(
      'Escritor de copy de produto B2B para Portugal. Cria descrições concisas e persuasivas.',
      `Produto: ${session.product_name}
Configuração: ${JSON.stringify(config, null, 2)}
Escreve uma descrição de produto (2-3 frases) em português para usar numa proposta B2B. Destaca a personalização.`,
      200,
    );

    return NextResponse.json({ description, action: 'described' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
