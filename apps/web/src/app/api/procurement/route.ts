import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S1: Autonomous Procurement AI Engine ────────────────────────────
//
// Full autonomous RFQ lifecycle with AI-powered supplier scoring, quote
// comparison, procurement forecasting, and memory graph updates.
//
// GET  ?mode=list|detail&id=...      — RFQ list / single RFQ with responses
// GET  ?mode=memory                  — procurement memory graph
// GET  ?mode=forecast                — AI demand + cost forecasting
// GET  ?mode=analytics               — savings, win-rates, supplier benchmarks
// POST { action:'create_rfq', ...}   — create + AI-enrich new RFQ
// POST { action:'add_response', ...} — log supplier bid + AI score
// POST { action:'ai_compare', rfqId} — AI comparison of all bids
// POST { action:'award', ...}        — award to supplier + update memory
// POST { action:'cancel', rfqId }    — cancel RFQ
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

// ── Score a supplier bid 0-100 with AI ────────────────────────────────────────
async function scoreSupplierBid(rfq: Record<string, unknown>, response: Record<string, unknown>): Promise<{ score: number; analysis: Record<string, unknown> }> {
  const targetPrice = Number(rfq.target_unit_price ?? 0);
  const bidPrice    = Number(response.unit_price ?? 0);
  const leadTime    = Number(response.lead_time_days ?? 14);
  const moq         = Number(response.moq ?? 1);
  const qty         = Number(rfq.quantity ?? 1);

  // Heuristic base score
  let score = 70;
  if (targetPrice > 0 && bidPrice > 0) {
    const pricePct = bidPrice / targetPrice;
    if (pricePct <= 0.85) score += 20;
    else if (pricePct <= 1.0) score += 10;
    else if (pricePct <= 1.1) score += 0;
    else score -= 15;
  }
  if (leadTime <= 7)  score += 8;
  if (leadTime <= 14) score += 4;
  if (leadTime > 21)  score -= 8;
  if (moq <= qty)     score += 5;
  if (moq > qty * 2)  score -= 10;
  score = Math.max(0, Math.min(100, score));

  // AI enrichment
  const aiText = await callClaude(
    'És um especialista em procurement de merchandising corporativo. Analisa propostas de fornecedores de forma concisa.',
    `RFQ: ${rfq.product_name} (qty: ${qty}, target: €${targetPrice}/un, prazo: ${rfq.deadline ?? 'flexível'}).
Proposta: ${response.supplier_name}, €${bidPrice}/un, ${leadTime}d lead time, MOQ ${moq}, termos: ${response.payment_terms ?? 'Net30'}.
Notas: ${response.notes ?? 'N/A'}.
Dá: 1) Pontos fortes (1 frase) 2) Riscos (1 frase) 3) Recomendação (sim/não e porquê, 1 frase). Máximo 3 linhas.`,
    256,
  );

  return {
    score: Math.round(score),
    analysis: {
      price_ratio:  targetPrice > 0 ? (bidPrice / targetPrice) : null,
      lead_time:    leadTime,
      moq_ok:       moq <= qty,
      ai_insight:   aiText || null,
      scored_at:    new Date().toISOString(),
    },
  };
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';
  const id   = searchParams.get('id');

  // ── Detail ────────────────────────────────────────────────────────────────
  if (mode === 'detail' && id) {
    const rfqQ = supabase.from('omega_x_rfqs').select('*').eq('id', id);
    if (!isAdmin) rfqQ.eq('created_by', user.id);
    const { data: rfq, error } = await rfqQ.single();
    if (error || !rfq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [responsesRes, negsRes] = await Promise.all([
      supabase.from('omega_x_rfq_responses').select('*').eq('rfq_id', id).order('rank', { ascending: true, nullsFirst: false }),
      supabase.from('omega_x_negotiations').select('*').eq('rfq_id', id).order('created_at', { ascending: true }),
    ]);

    return NextResponse.json({
      rfq,
      responses:    responsesRes.data ?? [],
      negotiations: negsRes.data ?? [],
    });
  }

  // ── Procurement memory graph ───────────────────────────────────────────────
  if (mode === 'memory') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { data, error } = await supabase
      .from('omega_x_proc_memory')
      .select('*')
      .order('total_rfqs', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ memory: data ?? [] });
  }

  // ── Forecast ──────────────────────────────────────────────────────────────
  if (mode === 'forecast') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { data: rfqs } = await supabase
      .from('omega_x_rfqs')
      .select('status,final_total,savings_amount,created_at,product_name,category,priority')
      .order('created_at', { ascending: false })
      .limit(100);

    const awarded   = (rfqs ?? []).filter(r => r.status === 'awarded' || r.status === 'completed');
    const totalSpend = awarded.reduce((s, r) => s + Number(r.final_total ?? 0), 0);
    const totalSavings = awarded.reduce((s, r) => s + Number(r.savings_amount ?? 0), 0);
    const avgSavingsPct = awarded.length > 0
      ? awarded.reduce((s, r) => s + Number(r.savings_amount ?? 0) / Math.max(Number(r.final_total ?? 1), 1) * 100, 0) / awarded.length
      : 0;

    // Category spend breakdown
    const categorySpend: Record<string, number> = {};
    for (const r of awarded) {
      const cat = r.category ?? 'Other';
      categorySpend[cat] = (categorySpend[cat] ?? 0) + Number(r.final_total ?? 0);
    }

    const aiInsight = await callClaude(
      'És um analista de procurement especializado em merchandising corporativo. Responde sempre em português.',
      `Dados de procurement: ${awarded.length} RFQs adjudicados, gasto total €${totalSpend.toFixed(0)}, poupanças €${totalSavings.toFixed(0)} (${avgSavingsPct.toFixed(1)}%). Categorias: ${Object.entries(categorySpend).map(([k,v]) => `${k}: €${v.toFixed(0)}`).join(', ')}. Em 2 frases, dá uma previsão de tendência e 1 recomendação de procurement para o próximo trimestre.`,
      300,
    );

    return NextResponse.json({
      total_spend:      totalSpend,
      total_savings:    totalSavings,
      avg_savings_pct:  avgSavingsPct,
      awarded_count:    awarded.length,
      category_spend:   categorySpend,
      ai_forecast:      aiInsight || null,
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  if (mode === 'analytics') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { data: rfqs } = await supabase.from('omega_x_rfqs').select('*').order('created_at', { ascending: false }).limit(200);
    const { data: responses } = await supabase.from('omega_x_rfq_responses').select('supplier_name,ai_score,status,unit_price').limit(500);

    const all = rfqs ?? [];
    const statusCounts = all.reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1; return acc;
    }, {});

    const supplierWins: Record<string, number> = {};
    for (const r of all.filter(r => r.winner_supplier)) {
      const s = r.winner_supplier!;
      supplierWins[s] = (supplierWins[s] ?? 0) + 1;
    }

    const totalSavings = all.reduce((s, r) => s + Number(r.savings_amount ?? 0), 0);
    const avgScore = (responses ?? []).filter(r => r.ai_score != null).reduce((s, r, _, arr) => s + r.ai_score / arr.length, 0);

    return NextResponse.json({
      total_rfqs:       all.length,
      status_breakdown: statusCounts,
      supplier_wins:    supplierWins,
      total_savings:    totalSavings,
      avg_bid_score:    Math.round(avgScore),
      response_count:   (responses ?? []).length,
    });
  }

  // ── List ──────────────────────────────────────────────────────────────────
  const statusFilter = searchParams.get('status');
  const priorityFilter = searchParams.get('priority');

  let query = supabase
    .from('omega_x_rfqs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50);

  if (!isAdmin) query = query.eq('created_by', user.id);
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
  if (priorityFilter && priorityFilter !== 'all') query = query.eq('priority', priorityFilter);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rfqs: data ?? [], total: count ?? 0, isAdmin });
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Create RFQ with AI enrichment ─────────────────────────────────────────
  if (action === 'create_rfq') {
    const { title, product_name, category, quantity, target_unit_price, deadline, delivery_country, requirements, priority, order_ref } = body;
    if (!title || !product_name || !quantity) {
      return NextResponse.json({ error: 'title, product_name, quantity required' }, { status: 400 });
    }

    const { data: client } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).maybeSingle();

    // AI enrichment — generate supplier recommendations & risk score
    const aiRecs = await callClaude(
      'És um especialista em procurement de merchandising corporativo. Responde em JSON válido.',
      `Produto: ${product_name}, categoria: ${category ?? 'geral'}, qty: ${quantity}, target: €${target_unit_price ?? 'não definido'}/un, prazo: ${deadline ?? 'flexível'}, destino: ${delivery_country ?? 'PT'}.
Retorna JSON: { "recommended_suppliers": ["nome1","nome2","nome3"], "risk_score": 0-100, "risk_factors": ["factor1"], "suggested_moq": number, "estimated_lead_days": number, "negotiation_tips": ["tip1","tip2"] }`,
      400,
    );

    let aiRecsObj: Record<string, unknown> = {};
    let riskScore: number | null = null;
    try {
      const parsed = JSON.parse(aiRecs);
      aiRecsObj = parsed;
      riskScore = typeof parsed.risk_score === 'number' ? parsed.risk_score : null;
    } catch { /* use empty */ }

    const { data: rfq, error } = await supabase
      .from('omega_x_rfqs')
      .insert({
        client_id:         client?.id ?? null,
        order_ref:         order_ref ?? null,
        title,
        product_name,
        category:          category ?? null,
        quantity,
        target_unit_price: target_unit_price ?? null,
        target_total:      target_unit_price ? target_unit_price * quantity : null,
        deadline:          deadline ?? null,
        delivery_country:  delivery_country ?? 'PT',
        requirements:      requirements ?? {},
        priority:          priority ?? 'normal',
        ai_recommendations: aiRecsObj,
        ai_risk_score:     riskScore,
        status:            'draft',
        created_by:        user.id,
        created_by_email:  user.email,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log
    await supabase.from('audit_log').insert({
      actor_id:    user.id,
      actor_email: user.email,
      action:      'rfq.created',
      resource_type: 'omega_x_rfq',
      resource_id: rfq.id,
      metadata:    { title, product_name, quantity },
    }).then(() => {});

    return NextResponse.json({ rfq, action: 'created' });
  }

  // ── Add supplier bid response ──────────────────────────────────────────────
  if (action === 'add_response') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { rfq_id, supplier_name, supplier_contact, unit_price, lead_time_days, moq, payment_terms, notes } = body;
    if (!rfq_id || !supplier_name || !unit_price) {
      return NextResponse.json({ error: 'rfq_id, supplier_name, unit_price required' }, { status: 400 });
    }

    const { data: rfq } = await supabase.from('omega_x_rfqs').select('*').eq('id', rfq_id).single();
    if (!rfq) return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });

    const scored = await scoreSupplierBid(rfq as Record<string, unknown>, {
      supplier_name, unit_price, lead_time_days, moq, payment_terms, notes
    });

    const { data: response, error } = await supabase
      .from('omega_x_rfq_responses')
      .insert({
        rfq_id, supplier_name, supplier_contact: supplier_contact ?? null,
        unit_price,
        total_price: unit_price * (rfq.quantity ?? 1),
        lead_time_days: lead_time_days ?? null,
        moq: moq ?? null,
        payment_terms: payment_terms ?? 'Net30',
        notes: notes ?? null,
        ai_score:    scored.score,
        ai_analysis: scored.analysis,
        status:      'pending',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update rfq responded_count + status
    const { data: allResponses } = await supabase.from('omega_x_rfq_responses').select('id').eq('rfq_id', rfq_id);
    await supabase.from('omega_x_rfqs').update({
      responded_count: (allResponses ?? []).length,
      status: 'responses_received',
      updated_at: new Date().toISOString(),
    }).eq('id', rfq_id);

    // Re-rank all responses for this RFQ by ai_score desc
    const { data: allForRanking } = await supabase.from('omega_x_rfq_responses').select('id,ai_score').eq('rfq_id', rfq_id).order('ai_score', { ascending: false });
    for (let i = 0; i < (allForRanking ?? []).length; i++) {
      await supabase.from('omega_x_rfq_responses').update({ rank: i + 1 }).eq('id', allForRanking![i].id);
    }

    return NextResponse.json({ response, score: scored.score, action: 'response_added' });
  }

  // ── AI comparison of all bids ─────────────────────────────────────────────
  if (action === 'ai_compare') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { rfq_id } = body;
    if (!rfq_id) return NextResponse.json({ error: 'rfq_id required' }, { status: 400 });

    const [rfqRes, respRes] = await Promise.all([
      supabase.from('omega_x_rfqs').select('*').eq('id', rfq_id).single(),
      supabase.from('omega_x_rfq_responses').select('*').eq('rfq_id', rfq_id).order('rank', { ascending: true }),
    ]);

    const rfq = rfqRes.data;
    const responses = respRes.data ?? [];
    if (!rfq || responses.length === 0) return NextResponse.json({ error: 'No data' }, { status: 404 });

    const bidsText = responses.map((r, i) =>
      `${i + 1}. ${r.supplier_name}: €${r.unit_price}/un, ${r.lead_time_days}d, MOQ ${r.moq ?? '—'}, score AI: ${r.ai_score ?? '?'}/100`
    ).join('\n');

    const comparison = await callClaude(
      'És um director de procurement de merchandising corporativo. Analisa propostas e faz recomendação clara. Responde em português, estruturado.',
      `RFQ: ${rfq.product_name} (qty: ${rfq.quantity}, target: €${rfq.target_unit_price ?? 'N/D'}/un, prazo: ${rfq.deadline ?? 'flexível'}).

Propostas recebidas:
${bidsText}

Análise: 1) Melhor proposta geral (e porquê) 2) Melhor preço 3) Menor risco 4) Estratégia de negociação recomendada 5) Poupança potencial estimada. Máximo 200 palavras.`,
      600,
    );

    // Store AI comparison in RFQ metadata
    await supabase.from('omega_x_rfqs').update({
      ai_recommendations: { ...((rfq.ai_recommendations as Record<string, unknown>) ?? {}), comparison, compared_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq('id', rfq_id);

    return NextResponse.json({ comparison, top_response: responses[0] ?? null });
  }

  // ── Award to supplier ─────────────────────────────────────────────────────
  if (action === 'award') {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { rfq_id, response_id, supplier_name, final_unit_price, final_total } = body;
    if (!rfq_id || !supplier_name) return NextResponse.json({ error: 'rfq_id, supplier_name required' }, { status: 400 });

    const { data: rfq } = await supabase.from('omega_x_rfqs').select('*').eq('id', rfq_id).single();
    if (!rfq) return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });

    const targetTotal = Number(rfq.target_total ?? 0);
    const awardedTotal = Number(final_total ?? (final_unit_price ? final_unit_price * rfq.quantity : 0));
    const savings = Math.max(0, targetTotal - awardedTotal);
    const savingsPct = targetTotal > 0 ? (savings / targetTotal) * 100 : 0;

    const { data: updated, error } = await supabase
      .from('omega_x_rfqs')
      .update({
        status: 'awarded', winner_supplier: supplier_name,
        final_unit_price: final_unit_price ?? null,
        final_total: awardedTotal || null,
        savings_amount: savings, savings_pct: savingsPct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rfq_id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update response status
    if (response_id) {
      await supabase.from('omega_x_rfq_responses').update({ status: 'accepted' }).eq('id', response_id);
      await supabase.from('omega_x_rfq_responses').update({ status: 'rejected' }).eq('rfq_id', rfq_id).neq('id', response_id);
    }

    // Update procurement memory
    const { data: existing } = await supabase.from('omega_x_proc_memory').select('*').eq('supplier_name', supplier_name).maybeSingle();
    if (existing) {
      await supabase.from('omega_x_proc_memory').update({
        total_rfqs:     (existing.total_rfqs ?? 0) + 1,
        total_awarded:  (existing.total_awarded ?? 0) + 1,
        best_price_achieved: existing.best_price_achieved
          ? Math.min(existing.best_price_achieved, Number(final_unit_price ?? 99999))
          : Number(final_unit_price ?? null),
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('supplier_name', supplier_name);
    } else {
      await supabase.from('omega_x_proc_memory').insert({
        supplier_name, total_rfqs: 1, total_awarded: 1,
        best_price_achieved: final_unit_price ?? null,
        last_interaction: new Date().toISOString(),
      });
    }

    // Audit
    await supabase.from('audit_log').insert({
      actor_id: user.id, actor_email: user.email, action: 'rfq.awarded',
      resource_type: 'omega_x_rfq', resource_id: rfq_id,
      metadata: { supplier_name, savings, savings_pct: savingsPct },
    }).then(() => {});

    return NextResponse.json({ rfq: updated, savings, savings_pct: savingsPct, action: 'awarded' });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    const { rfq_id, reason } = body;
    if (!rfq_id) return NextResponse.json({ error: 'rfq_id required' }, { status: 400 });
    const { data: updated, error } = await supabase
      .from('omega_x_rfqs')
      .update({ status: 'cancelled', metadata: { cancel_reason: reason ?? null }, updated_at: new Date().toISOString() })
      .eq('id', rfq_id)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rfq: updated, action: 'cancelled' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
