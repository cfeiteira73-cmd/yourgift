import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA ABSOLUTE FINAL — Phase 1: Dispute Lifecycle ────────────────────────
//
// Full chargeback & dispute management with AI evidence recommendations.
//
// GET  ?mode=list                 — all disputes (filterable by status)
// GET  ?mode=detail&id=           — single dispute detail
// GET  ?mode=stats                — dispute KPIs
// POST { action:'open' }          — open/create a dispute record
// POST { action:'update' }        — update status / add evidence
// POST { action:'ai_evidence' }   — generate AI evidence recommendation
// POST { action:'resolve' }       — mark dispute resolved (won/lost)
//
// ─────────────────────────────────────────────────────────────────────────────

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
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';

  if (mode === 'list') {
    const status = searchParams.get('status');
    let query = supabase.from('omega_abs_disputes')
      .select('*').order('created_at', { ascending: false }).limit(50);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    return NextResponse.json({ disputes: data ?? [] });
  }

  if (mode === 'detail') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_abs_disputes')
      .select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ dispute: data });
  }

  if (mode === 'stats') {
    const { data } = await supabase.from('omega_abs_disputes').select('status, amount');

    const stats = {
      total: (data ?? []).length,
      open: (data ?? []).filter(d => ['needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'].includes(d.status)).length,
      won: (data ?? []).filter(d => d.status === 'won').length,
      lost: (data ?? []).filter(d => d.status === 'lost').length,
      total_at_risk: (data ?? [])
        .filter(d => ['needs_response', 'under_review'].includes(d.status))
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      total_lost: (data ?? [])
        .filter(d => d.status === 'lost')
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
    };

    return NextResponse.json({ stats });
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

  if (action === 'open') {
    const { stripe_dispute_id, stripe_charge_id, order_id, client_id, amount, currency, reason, due_by } = body;
    if (!amount) return NextResponse.json({ error: 'amount required' }, { status: 400 });

    // Generate AI recommendation immediately
    const ai_recommendation = await callClaude(
      'És um especialista em gestão de chargebacks e disputas Stripe. Dás conselhos concisos em português.',
      `Nova disputa: €${amount}, razão: "${reason ?? 'não especificada'}", prazo: ${due_by ?? 'não definido'}.
Sugere os 3 documentos de evidência mais importantes para contestar esta disputa (máx 80 palavras).`,
      120,
    );

    const { data } = await supabase.from('omega_abs_disputes').insert({
      stripe_dispute_id: stripe_dispute_id ?? null,
      stripe_charge_id: stripe_charge_id ?? null,
      order_id: order_id ?? null,
      client_id: client_id ?? null,
      amount,
      currency: currency ?? 'eur',
      reason: reason ?? null,
      due_by: due_by ?? null,
      ai_recommendation,
    }).select().single();

    // Create urgent notification
    await supabase.from('omega_final_notifications').insert({
      user_email: null,
      type: 'error',
      category: 'financial',
      title: `Nova Disputa: €${amount}`,
      message: ai_recommendation || `Razão: ${reason ?? 'desconhecida'}. Prazo: ${due_by ?? 'ver Stripe'}`,
      action_url: '/disputes',
      action_label: 'Gerir Disputa',
      priority: 3,
      source: 'disputes',
    });

    return NextResponse.json({ dispute: data });
  }

  if (action === 'update') {
    const { id, status, evidence_submitted, evidence_details } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (evidence_submitted !== undefined) update.evidence_submitted = evidence_submitted;
    if (evidence_details) update.evidence_details = evidence_details;

    const { data } = await supabase.from('omega_abs_disputes')
      .update(update).eq('id', id).select().single();

    return NextResponse.json({ dispute: data });
  }

  if (action === 'ai_evidence') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: dispute } = await supabase.from('omega_abs_disputes')
      .select('*').eq('id', id).single();
    if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const recommendation = await callClaude(
      'És um especialista em disputas de pagamento e chargebacks. Respondes em português de forma detalhada.',
      `Disputa #${String(dispute.id).slice(0, 8)}: €${dispute.amount}, razão: "${dispute.reason ?? 'N/A'}",
status: ${dispute.status}, prazo: ${dispute.due_by ?? 'N/A'}.
Evidências já submetidas: ${dispute.evidence_submitted ? 'Sim' : 'Não'}.
Gera um plano de contestação detalhado com documentos específicos a recolher (máx 150 palavras).`,
      200,
    );

    await supabase.from('omega_abs_disputes')
      .update({ ai_recommendation: recommendation, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ recommendation });
  }

  if (action === 'resolve') {
    const { id, outcome } = body;
    if (!id || !outcome) return NextResponse.json({ error: 'id and outcome required' }, { status: 400 });

    const finalStatus = outcome === 'won' ? 'won' : 'lost';
    const { data } = await supabase.from('omega_abs_disputes')
      .update({
        status: finalStatus,
        outcome,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id).select().single();

    return NextResponse.json({ dispute: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
