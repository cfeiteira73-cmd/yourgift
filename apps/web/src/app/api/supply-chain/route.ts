import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S7: Supply Chain Resilience ─────────────────────────────────────
//
// Real-time supply chain risk monitoring, alternative sourcing intelligence,
// and supplier scorecards with AI mitigation recommendations.
//
// GET  ?mode=risks              — active risks (filterable by severity/status/type)
// GET  ?mode=risk&id=           — risk detail + alternatives
// GET  ?mode=scorecards         — supplier scorecards list
// GET  ?mode=dashboard          — aggregated supply chain health view
// POST { action:'create_risk' } — log a new supply chain risk
// POST { action:'update_risk' } — update risk status/mitigation
// POST { action:'add_alternative' } — propose alternative supplier for a risk
// POST { action:'update_alternative' } — approve/activate/reject alternative
// POST { action:'generate_scorecard' } — compute + AI-narrate supplier scorecard
// POST { action:'ai_mitigate' }  — AI-generate mitigation plan for a risk
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 600): Promise<string> {
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
        model: CLAUDE_HAIKU,
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
  const mode = searchParams.get('mode') ?? 'risks';

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (mode === 'dashboard') {
    const [risks, alternatives, scorecards] = await Promise.all([
      supabase.from('omega_x_supply_chain_risks')
        .select('id, severity, status, risk_type, risk_score, title, supplier_name')
        .order('risk_score', { ascending: false }),
      supabase.from('omega_x_supply_chain_alternatives')
        .select('id, status, alt_supplier_name, quality_score')
        .in('status', ['proposed', 'approved']),
      supabase.from('omega_x_supplier_scorecards')
        .select('supplier_id, supplier_name, period, overall_score')
        .order('computed_at', { ascending: false })
        .limit(20),
    ]);

    const riskData = risks.data ?? [];
    const openRisks = riskData.filter(r => r.status === 'open').length;
    const criticalRisks = riskData.filter(r => r.severity === 'critical').length;
    const avgRiskScore = riskData.length > 0
      ? riskData.reduce((s, r) => s + (r.risk_score ?? 0), 0) / riskData.length
      : 0;

    // Risk by type breakdown
    const byType: Record<string, number> = {};
    for (const r of riskData) {
      byType[r.risk_type] = (byType[r.risk_type] ?? 0) + 1;
    }

    // Chain resilience score (100 = no risk, decreases with open/critical)
    const resilienceScore = Math.max(0, 100 - criticalRisks * 20 - openRisks * 5 - Math.round(avgRiskScore * 0.3));

    return NextResponse.json({
      summary: {
        total_risks: riskData.length,
        open_risks: openRisks,
        critical_risks: criticalRisks,
        avg_risk_score: Math.round(avgRiskScore),
        resilience_score: Math.min(100, resilienceScore),
        alternatives_pending: alternatives.count ?? (alternatives.data ?? []).length,
        scorecards_count: (scorecards.data ?? []).length,
      },
      risks_by_type: byType,
      top_risks: riskData.slice(0, 5),
      recent_scorecards: (scorecards.data ?? []).slice(0, 5),
    });
  }

  // ── Risk list ─────────────────────────────────────────────────────────────
  if (mode === 'risks') {
    const severity = searchParams.get('severity');
    const status = searchParams.get('status') ?? 'open';
    const type = searchParams.get('type');

    let q = supabase.from('omega_x_supply_chain_risks')
      .select('*')
      .order('risk_score', { ascending: false });

    if (severity) q = q.eq('severity', severity);
    if (status !== 'all') q = q.eq('status', status);
    if (type) q = q.eq('risk_type', type);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ risks: data ?? [] });
  }

  // ── Risk detail + alternatives ────────────────────────────────────────────
  if (mode === 'risk') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const [risk, alternatives] = await Promise.all([
      supabase.from('omega_x_supply_chain_risks').select('*').eq('id', id).single(),
      supabase.from('omega_x_supply_chain_alternatives').select('*').eq('risk_id', id).order('quality_score', { ascending: false }),
    ]);

    if (risk.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ risk: risk.data, alternatives: alternatives.data ?? [] });
  }

  // ── Supplier scorecards ───────────────────────────────────────────────────
  if (mode === 'scorecards') {
    const supplierId = searchParams.get('supplier_id');
    let q = supabase.from('omega_x_supplier_scorecards')
      .select('*')
      .order('computed_at', { ascending: false });
    if (supplierId) q = q.eq('supplier_id', supplierId);
    const { data } = await q.limit(50);
    return NextResponse.json({ scorecards: data ?? [] });
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

  // ── Create risk ───────────────────────────────────────────────────────────
  if (action === 'create_risk') {
    const { supplier_id, supplier_name, risk_type, severity, title, description,
      affected_skus, probability, impact_score, mitigation } = body;

    const { data, error } = await supabase.from('omega_x_supply_chain_risks').insert({
      supplier_id, supplier_name, risk_type, severity, title, description,
      affected_skus, probability, impact_score, mitigation,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ risk: data, action: 'created' });
  }

  // ── Update risk ───────────────────────────────────────────────────────────
  if (action === 'update_risk') {
    const { id, status, mitigation, severity, probability, impact_score } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (mitigation) updates.mitigation = mitigation;
    if (severity) updates.severity = severity;
    if (probability !== undefined) updates.probability = probability;
    if (impact_score !== undefined) updates.impact_score = impact_score;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabase.from('omega_x_supply_chain_risks')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ risk: data, action: 'updated' });
  }

  // ── Add alternative ───────────────────────────────────────────────────────
  if (action === 'add_alternative') {
    const { risk_id, original_supplier_id, original_supplier_name,
      alt_supplier_id, alt_supplier_name, affected_skus,
      price_delta_pct, lead_time_days, quality_score } = body;

    const { data, error } = await supabase.from('omega_x_supply_chain_alternatives').insert({
      risk_id, original_supplier_id, original_supplier_name,
      alt_supplier_id, alt_supplier_name, affected_skus,
      price_delta_pct, lead_time_days, quality_score,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ alternative: data, action: 'created' });
  }

  // ── Update alternative status ─────────────────────────────────────────────
  if (action === 'update_alternative') {
    const { id, status, ai_recommendation } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_x_supply_chain_alternatives')
      .update({ status, ai_recommendation }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ alternative: data, action: 'updated' });
  }

  // ── Generate supplier scorecard ───────────────────────────────────────────
  if (action === 'generate_scorecard') {
    const { supplier_id, supplier_name, period,
      on_time_rate, quality_score, price_index, responsiveness } = body;

    const overall_score = (
      (on_time_rate ?? 0) * 0.35 +
      (quality_score ?? 0) * 0.30 +
      (price_index ?? 100) * 0.20 +
      (responsiveness ?? 0) * 0.15
    );

    const aiSummary = await callClaude(
      'És um analista de procurement B2B. Gera summaries de fornecedores concisos.',
      `Fornecedor: ${supplier_name} | Período: ${period}
On-time: ${on_time_rate}% | Qualidade: ${quality_score}/100 | Preço index: ${price_index} | Responsividade: ${responsiveness}/100
Score geral: ${overall_score.toFixed(1)}/100
Gera um parágrafo (3 frases) em português sobre a performance deste fornecedor e recomendações.`,
      300,
    );

    const { data, error } = await supabase.from('omega_x_supplier_scorecards')
      .upsert({
        supplier_id, supplier_name, period,
        on_time_rate, quality_score, price_index, responsiveness,
        overall_score: Math.round(overall_score * 10) / 10,
        ai_summary: aiSummary || null,
      }, { onConflict: 'supplier_id,period' })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scorecard: data, action: 'generated' });
  }

  // ── AI mitigation plan ────────────────────────────────────────────────────
  if (action === 'ai_mitigate') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: risk } = await supabase.from('omega_x_supply_chain_risks')
      .select('*').eq('id', id).single();
    if (!risk) return NextResponse.json({ error: 'Risk not found' }, { status: 404 });

    const { data: alts } = await supabase.from('omega_x_supply_chain_alternatives')
      .select('alt_supplier_name, quality_score, price_delta_pct, lead_time_days')
      .eq('risk_id', id);

    const mitigation = await callClaude(
      'És um especialista em gestão de cadeia de fornecimento B2B para Portugal. Responde em JSON.',
      `Risco: "${risk.title}" (${risk.risk_type}, severidade: ${risk.severity})
Fornecedor afetado: ${risk.supplier_name ?? 'N/A'}
SKUs afetados: ${(risk.affected_skus ?? []).join(', ') || 'N/A'}
Score de risco: ${risk.risk_score}/100
Alternativas disponíveis: ${alts && alts.length > 0 ? alts.map(a => `${a.alt_supplier_name} (score:${a.quality_score}, delta:${a.price_delta_pct}%)`).join(', ') : 'Nenhuma'}

Gera plano de mitigação em JSON:
{
  "immediate_actions": [string],
  "short_term": [string],
  "recommended_alternative": string|null,
  "estimated_recovery_days": number,
  "mitigation_summary": "texto conciso em português (2-3 frases)"
}`,
      500,
    );

    let plan: Record<string, unknown> = {};
    try { plan = JSON.parse(mitigation); } catch { plan = { mitigation_summary: mitigation }; }

    // Save mitigation back to risk
    if (plan.mitigation_summary) {
      await supabase.from('omega_x_supply_chain_risks')
        .update({ mitigation: plan.mitigation_summary as string, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ plan, risk_id: id, action: 'mitigation_generated' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
