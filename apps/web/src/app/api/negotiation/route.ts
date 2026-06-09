import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S2: Autonomous Negotiation System ───────────────────────────────
//
// AI-powered supplier negotiation agents with memory, strategy generation,
// round tracking, outcome prediction, and leverage scoring.
//
// GET  ?rfqId=...                    — negotiation thread for RFQ
// GET  ?mode=leverage&supplier=...   — supplier leverage score
// GET  ?mode=simulate&rfqId=...      — negotiation outcome simulation
// POST { action:'start', rfqId, responseId, targetPrice } — open negotiation
// POST { action:'round', sessionId, supplierOffer, notes }— log new round
// POST { action:'accept', sessionId }                     — accept outcome
// POST { action:'generate_message', sessionId }           — AI draft message
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 512): Promise<string> {
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

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode');
  const rfqId = searchParams.get('rfqId');
  const supplier = searchParams.get('supplier');

  // ── Negotiation thread ───────────────────────────────────────────────────
  if (rfqId && !mode) {
    const [sessRes, rfqRes] = await Promise.all([
      supabase.from('omega_x_negotiations').select('*').eq('rfq_id', rfqId).order('created_at', { ascending: true }),
      supabase.from('omega_x_rfqs').select('title,product_name,quantity,target_unit_price,winner_supplier,status').eq('id', rfqId).single(),
    ]);
    return NextResponse.json({
      sessions:  sessRes.data ?? [],
      rfq:       rfqRes.data ?? null,
    });
  }

  // ── Leverage score ───────────────────────────────────────────────────────
  if (mode === 'leverage' && supplier) {
    const { data: mem } = await supabase.from('omega_x_proc_memory').select('*').eq('supplier_name', supplier).maybeSingle();
    const { data: rfqs } = await supabase.from('omega_x_rfqs').select('winner_supplier,savings_pct').eq('winner_supplier', supplier);

    const wins = rfqs?.length ?? 0;
    const avgSavings = wins > 0
      ? (rfqs ?? []).reduce((s, r) => s + Number(r.savings_pct ?? 0), 0) / wins
      : 0;
    const winRate = mem ? (mem.total_rfqs > 0 ? (mem.total_awarded / mem.total_rfqs) * 100 : 0) : 0;

    // Leverage score: higher = we have more leverage (supplier depends on us more)
    let leverage = 50;
    if (winRate > 60) leverage += 15; // supplier wins most deals = they want our business
    if (avgSavings > 10) leverage += 10; // we achieve good savings = they negotiate
    if ((mem?.total_rfqs ?? 0) > 5) leverage += 10; // long relationship
    leverage = Math.min(100, leverage);

    const aiStrategy = await callClaude(
      'És um especialista em negociação de procurement B2B. Responde em português, conciso.',
      `Fornecedor: ${supplier}. Leverage score: ${leverage}/100. Win rate nosso: ${wins} contratos. Poupança média: ${avgSavings.toFixed(1)}%. Dá 2 táticas de negociação concretas para este fornecedor (máximo 2 frases cada).`,
      300,
    );

    return NextResponse.json({
      supplier,
      leverage_score: leverage,
      win_count:      wins,
      avg_savings_pct: avgSavings,
      win_rate:       winRate,
      memory:         mem ?? null,
      ai_strategy:    aiStrategy || null,
    });
  }

  // ── Simulation ───────────────────────────────────────────────────────────
  if (mode === 'simulate' && rfqId) {
    const { data: rfq } = await supabase.from('omega_x_rfqs').select('*').eq('id', rfqId).single();
    const { data: responses } = await supabase.from('omega_x_rfq_responses').select('*').eq('rfq_id', rfqId).order('ai_score', { ascending: false }).limit(3);

    if (!rfq || !responses?.length) return NextResponse.json({ error: 'Insufficient data for simulation' }, { status: 404 });

    const simText = await callClaude(
      'És um simulador de negociação de procurement. Responde em JSON com os campos indicados.',
      `RFQ: ${rfq.product_name} (qty ${rfq.quantity}, target €${rfq.target_unit_price ?? 'N/D'}/un).
Top propostas: ${responses.map(r => `${r.supplier_name} €${r.unit_price}/un (score ${r.ai_score})`).join(', ')}.
Simula: { "best_case_savings_pct": number, "realistic_savings_pct": number, "worst_case_savings_pct": number, "recommended_opening_offer": number, "walk_away_price": number, "predicted_rounds": number, "win_probability": number, "top_supplier": "name" }`,
      400,
    );

    let simulation: Record<string, unknown> = {};
    try { simulation = JSON.parse(simText); } catch { /* use empty */ }

    return NextResponse.json({ simulation, rfq_id: rfqId });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Start negotiation ────────────────────────────────────────────────────
  if (action === 'start') {
    const { rfq_id, response_id, supplier_name, target_price, notes } = body;
    if (!rfq_id || !supplier_name) return NextResponse.json({ error: 'rfq_id and supplier_name required' }, { status: 400 });

    const { data: rfq } = await supabase.from('omega_x_rfqs').select('*').eq('id', rfq_id).single();
    const { data: response } = response_id
      ? await supabase.from('omega_x_rfq_responses').select('*').eq('id', response_id).single()
      : { data: null };

    // Generate AI opening strategy
    const aiStrategy = await callClaude(
      'És um director de procurement a negociar com fornecedores. Responde em português.',
      `Vais negociar com ${supplier_name} para: ${rfq?.product_name ?? 'produto'} (qty: ${rfq?.quantity ?? 1}).
Proposta do fornecedor: €${response?.unit_price ?? '?'}/un, ${response?.lead_time_days ?? '?'} dias.
Nosso target: €${target_price ?? rfq?.target_unit_price ?? '?'}/un.
Dá: 1) Estratégia de abertura (1 frase) 2) Alavancas de negociação (2 pontos) 3) Linha de saída (1 frase). Máximo 100 palavras.`,
      400,
    );

    // AI opening message draft
    const aiMessage = await callClaude(
      'Escreves emails de negociação de procurement em nome do YourGift. Tom: profissional, directo, respeitoso.',
      `Email de abertura de negociação para ${supplier_name}, produto: ${rfq?.product_name}, qty: ${rfq?.quantity}, proposta deles: €${response?.unit_price ?? '?'}/un. Nosso target: €${target_price ?? '?'}/un. Escreve um email de 3 parágrafos (agradecimento, proposta/justificação, próximos passos). Máximo 150 palavras.`,
      500,
    );

    // Create negotiation session
    const { data: session, error } = await supabase
      .from('omega_x_negotiations')
      .insert({
        rfq_id, response_id: response_id ?? null,
        supplier_name,
        round: 1,
        our_target_price:  target_price ?? rfq?.target_unit_price ?? null,
        our_position:      { target_price, notes },
        supplier_offer:    response?.unit_price ?? null,
        supplier_position: { initial_offer: response?.unit_price },
        ai_strategy:       aiStrategy || null,
        ai_message:        aiMessage || null,
        outcome:           'ongoing',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update RFQ status to negotiating
    await supabase.from('omega_x_rfqs').update({ status: 'negotiating', updated_at: new Date().toISOString() }).eq('id', rfq_id);
    if (response_id) await supabase.from('omega_x_rfq_responses').update({ status: 'shortlisted' }).eq('id', response_id);

    return NextResponse.json({ session, ai_strategy: aiStrategy, ai_message: aiMessage, action: 'negotiation_started' });
  }

  // ── Log new negotiation round ─────────────────────────────────────────────
  if (action === 'round') {
    const { rfq_id, supplier_name, supplier_offer, our_counter, notes } = body;
    if (!rfq_id || !supplier_name) return NextResponse.json({ error: 'rfq_id and supplier_name required' }, { status: 400 });

    // Get latest round number
    const { data: prev } = await supabase.from('omega_x_negotiations')
      .select('round').eq('rfq_id', rfq_id).eq('supplier_name', supplier_name)
      .order('round', { ascending: false }).limit(1).maybeSingle();

    const nextRound = (prev?.round ?? 0) + 1;

    // AI counter-strategy
    const aiStrategy = await callClaude(
      'És um negociador de procurement experiente. Responde em português.',
      `Ronda ${nextRound} com ${supplier_name}. Oferta deles: €${supplier_offer}/un. Nossa contra-proposta: €${our_counter ?? '?'}/un. Notas: ${notes ?? 'N/A'}. Dá: 1) Táctica para esta ronda (1 frase) 2) Mensagem de resposta (2-3 frases concisas). Total máximo 80 palavras.`,
      350,
    );

    const { data: session, error } = await supabase
      .from('omega_x_negotiations')
      .insert({
        rfq_id, supplier_name,
        round: nextRound,
        our_target_price: our_counter ?? null,
        our_position: { counter: our_counter, notes },
        supplier_offer: supplier_offer ?? null,
        supplier_position: { offer: supplier_offer },
        ai_strategy: aiStrategy || null,
        outcome: 'ongoing',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session, ai_strategy: aiStrategy, action: 'round_logged' });
  }

  // ── Accept outcome ────────────────────────────────────────────────────────
  if (action === 'accept') {
    const { rfq_id, supplier_name, final_price, session_id } = body;
    if (!rfq_id || !supplier_name) return NextResponse.json({ error: 'rfq_id and supplier_name required' }, { status: 400 });

    // Get RFQ to calculate savings
    const { data: rfq } = await supabase.from('omega_x_rfqs').select('target_unit_price,quantity').eq('id', rfq_id).single();
    const target = Number(rfq?.target_unit_price ?? 0);
    const final  = Number(final_price ?? 0);
    const savings = target > 0 && final > 0 ? Math.max(0, (target - final) * (rfq?.quantity ?? 1)) : 0;

    if (session_id) {
      await supabase.from('omega_x_negotiations').update({
        outcome: 'accepted',
        savings_achieved: savings,
        notes: `Negociação concluída. Preço final: €${final}/un`,
      }).eq('id', session_id);
    }

    // Update all ongoing sessions for this RFQ+supplier
    await supabase.from('omega_x_negotiations')
      .update({ outcome: 'accepted', savings_achieved: savings })
      .eq('rfq_id', rfq_id).eq('supplier_name', supplier_name).eq('outcome', 'ongoing');

    // Update procurement memory
    const { data: mem } = await supabase.from('omega_x_proc_memory').select('*').eq('supplier_name', supplier_name).maybeSingle();
    const newWinRate = mem ? ((mem.total_awarded ?? 0) + 1) / Math.max((mem.total_rfqs ?? 1), 1) * 100 : 100;
    await supabase.from('omega_x_proc_memory').upsert({
      supplier_name,
      total_rfqs:           (mem?.total_rfqs ?? 0) + 1,
      total_awarded:        (mem?.total_awarded ?? 0) + 1,
      negotiation_win_rate: newWinRate,
      last_interaction:     new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'supplier_name' });

    return NextResponse.json({ savings, final_price, action: 'accepted' });
  }

  // ── Generate AI negotiation message ──────────────────────────────────────
  if (action === 'generate_message') {
    const { rfq_id, supplier_name, our_position, supplier_offer, context } = body;

    const message = await callClaude(
      'Escreves comunicações de negociação de procurement em nome do YourGift. Tom: profissional, amigável mas firme. Responde em português.',
      `Negociação com ${supplier_name}, produto: ${context?.product_name ?? 'produto'}, qty: ${context?.quantity ?? '?'}.
Posição actual nossa: €${our_position?.price ?? '?'}/un.
Última oferta fornecedor: €${supplier_offer ?? '?'}/un.
Contexto: ${context?.notes ?? 'N/A'}.
Escreve um email de negociação de 2-3 parágrafos. Máximo 120 palavras. Não incluas assunto.`,
      450,
    );

    return NextResponse.json({ message: message || 'Não foi possível gerar mensagem.', action: 'message_generated' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
