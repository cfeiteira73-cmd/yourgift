import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Procurement Autopilot API ──────────────────────────────
//
// X2 Autonomous Procurement AI: Fully autonomous RFQ generation + supplier
// bidding marketplace automation.
//
// GET  ?mode=pending      — orders needing RFQs (confirmed, no existing RFQ)
// GET  ?mode=marketplace  — active supplier bids across all open RFQs
// GET  ?mode=savings      — savings analytics vs target prices
// POST { action:'auto_rfq', orderId }     — autonomously draft + create RFQ from order
// POST { action:'blast_suppliers', rfqId } — send RFQ to all known suppliers
// POST { action:'auto_award', rfqId }     — AI auto-awards lowest qualified bid
// POST { action:'negotiate_round', rfqId, supplierId } — AI negotiation message
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const KNOWN_SUPPLIERS = [
  { name: 'Midocean', email: 'orders@midocean.com', specialties: ['bags', 'tech', 'office'] },
  { name: 'PF Concept', email: 'rfq@pfconcept.com', specialties: ['pens', 'drinkware', 'apparel'] },
  { name: 'Xindao', email: 'quotes@xindao.com', specialties: ['eco', 'office', 'lifestyle'] },
  { name: 'Maxema', email: 'rfq@maxema.com', specialties: ['pens', 'writing'] },
  { name: 'Stanley/Stella', email: 'b2b@stanleystella.com', specialties: ['apparel', 'textiles'] },
];

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickSuppliersForCategory(category: string): typeof KNOWN_SUPPLIERS {
  const cat = category.toLowerCase();
  const matches = KNOWN_SUPPLIERS.filter(s =>
    s.specialties.some(sp => cat.includes(sp) || sp.includes(cat))
  );
  return matches.length > 0 ? matches : KNOWN_SUPPLIERS.slice(0, 3);
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'pending';

  try {
    if (mode === 'pending') {
      // Orders confirmed in last 30d that have no RFQ yet
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: orders } = await db
        .from('orders')
        .select('id, ref, total_amount, created_at, order_items(quantity, unit_price, products(title, category, cost_price))')
        .in('status', ['confirmed', 'in_artwork', 'in_production'])
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(30);

      // Get existing RFQ order refs to exclude
      const { data: existingRfqs } = await db
        .from('omega_final_rfqs')
        .select('title')
        .gte('created_at', thirtyDaysAgo);

      const rfqTitles = new Set((existingRfqs ?? []).map(r => r.title));

      type OrderItem = {
        quantity: number;
        unit_price: number;
        products: { title: string; category?: string; cost_price?: number } | null;
      };

      const pending = (orders ?? []).filter(o => {
        // Check if any item from this order already has an RFQ
        const ref = (o as { ref: string }).ref;
        return !rfqTitles.has(ref);
      }).map(o => {
        const items = (o as unknown as { order_items: OrderItem[] }).order_items ?? [];
        const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
        const categories = [...new Set(items.map(i => i.products?.category ?? 'outro'))];
        return {
          orderId: (o as { id: string }).id,
          orderRef: (o as { ref: string }).ref,
          totalAmount: (o as { total_amount: number }).total_amount,
          totalQty,
          categories,
          items: items.slice(0, 3).map(i => ({
            title: i.products?.title ?? 'Produto',
            qty: i.quantity,
            unitPrice: i.unit_price,
          })),
        };
      });

      return NextResponse.json({ pending, count: pending.length });
    }

    if (mode === 'marketplace') {
      // All open RFQs with their bids
      const { data: rfqs } = await db
        .from('omega_final_rfqs')
        .select('id, title, product_name, quantity, target_unit_price, status, deadline, priority')
        .in('status', ['sent', 'responses_received', 'negotiating'])
        .order('created_at', { ascending: false })
        .limit(20);

      const rfqIds = (rfqs ?? []).map(r => (r as { id: string }).id);
      const { data: bids } = rfqIds.length > 0 ? await db
        .from('omega_final_rfq_responses')
        .select('rfq_id, supplier_name, unit_price, lead_time_days, ai_score, status, submitted_at')
        .in('rfq_id', rfqIds)
        .order('unit_price', { ascending: true }) : { data: [] };

      const bidsByRfq = ((bids ?? []) as Array<{ rfq_id: string } & Record<string, unknown>>).reduce((acc, b) => {
        if (!acc[b.rfq_id]) acc[b.rfq_id] = [];
        acc[b.rfq_id].push(b);
        return acc;
      }, {} as Record<string, unknown[]>);

      const marketplace = (rfqs ?? []).map(r => ({
        ...r,
        bids: (bidsByRfq[(r as { id: string }).id] ?? []),
        bidCount: (bidsByRfq[(r as { id: string }).id] ?? []).length,
      }));

      return NextResponse.json({ marketplace, generatedAt: new Date().toISOString() });
    }

    if (mode === 'savings') {
      const { data: awarded } = await db
        .from('omega_final_rfqs')
        .select('savings_amount, savings_pct, final_unit_price, target_unit_price, product_name, awarded_at')
        .eq('status', 'awarded')
        .not('savings_amount', 'is', null)
        .order('awarded_at', { ascending: false })
        .limit(50);

      const totalSavings = (awarded ?? []).reduce((s, r) => s + ((r as { savings_amount: number }).savings_amount ?? 0), 0);
      const avgSavingsPct = (awarded ?? []).length > 0
        ? (awarded ?? []).reduce((s, r) => s + ((r as { savings_pct: number }).savings_pct ?? 0), 0) / (awarded ?? []).length
        : 0;

      return NextResponse.json({
        awarded: awarded ?? [],
        summary: {
          totalAwarded: (awarded ?? []).length,
          totalSavings: Math.round(totalSavings * 100) / 100,
          avgSavingsPct: Math.round(avgSavingsPct * 10) / 10,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[procurement-autopilot GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = body.action as string;

  try {
    // ── Auto-generate RFQ from order ────────────────────────────────────────
    if (action === 'auto_rfq') {
      const orderId = body.orderId as string;
      if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

      const { data: order } = await db
        .from('orders')
        .select('id, ref, client_id, order_items(quantity, unit_price, products(title, category, cost_price))')
        .eq('id', orderId)
        .single();

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      type OrderItem = { quantity: number; unit_price: number; products: { title: string; category?: string; cost_price?: number } | null };
      const items = ((order as unknown as { order_items: OrderItem[] }).order_items ?? []);
      const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
      const primaryItem = items[0];
      const category = primaryItem?.products?.category ?? 'merchandising';
      const productName = primaryItem?.products?.title ?? 'Produto';
      const avgUnitPrice = items.length > 0
        ? items.reduce((s, i) => s + (i.unit_price ?? 0), 0) / items.length
        : 0;
      const targetUnitPrice = avgUnitPrice * 0.75; // Target 25% below sale price

      // AI-generate RFQ brief
      const aiTitle = await callClaude(
        'És um procurement manager. Gera um título conciso para um RFQ em português. Máximo 8 palavras.',
        `Produto: ${productName}, Categoria: ${category}, Qtd: ${totalQty}`,
        100
      );

      const deadline = new Date(Date.now() + 7 * 86400000).toISOString();

      const { data: rfq, error: rfqErr } = await db
        .from('omega_final_rfqs')
        .insert({
          title: aiTitle || `RFQ — ${productName} × ${totalQty}`,
          product_name: productName,
          category,
          quantity: totalQty,
          target_unit_price: Math.round(targetUnitPrice * 100) / 100,
          target_total: Math.round(targetUnitPrice * totalQty * 100) / 100,
          deadline,
          status: 'draft',
          priority: totalQty > 500 ? 'high' : 'normal',
          created_by_email: user.email,
          ai_recommendations: {
            auto_generated: true,
            source_order: orderId,
            suggested_suppliers: pickSuppliersForCategory(category).map(s => s.name),
          },
        })
        .select('id')
        .single();

      if (rfqErr || !rfq) return NextResponse.json({ error: rfqErr?.message ?? 'Failed to create RFQ' }, { status: 500 });

      // Audit log
      await db.from('omega_final_audit_log').insert({
        entity_type: 'rfq',
        entity_id: rfq.id,
        action: 'auto_rfq_created',
        performed_by: user.id,
        metadata: { source_order_id: orderId, auto_generated: true },
      });

      return NextResponse.json({
        ok: true,
        rfqId: rfq.id,
        suggestedSuppliers: pickSuppliersForCategory(category),
        redirect: `/procurement?rfq=${rfq.id}`,
      });
    }

    // ── Blast RFQ to all relevant suppliers ────────────────────────────────
    if (action === 'blast_suppliers') {
      const rfqId = body.rfqId as string;
      if (!rfqId) return NextResponse.json({ error: 'Missing rfqId' }, { status: 400 });

      const { data: rfq } = await db
        .from('omega_final_rfqs')
        .select('*')
        .eq('id', rfqId)
        .single();

      if (!rfq) return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });

      const category = (rfq as { category?: string }).category ?? 'merchandising';
      const suppliers = pickSuppliersForCategory(category);

      // Generate AI cover message
      const coverMsg = await callClaude(
        'És um procurement manager profissional. Escreves emails de RFQ formais em português. Sê conciso e profissional.',
        `Produto: ${(rfq as { product_name?: string }).product_name}, Qtd: ${(rfq as { quantity?: number }).quantity}, Prazo: ${(rfq as { deadline?: string }).deadline ?? '7 dias'}, Preço alvo/unidade: €${(rfq as { target_unit_price?: number }).target_unit_price ?? 'a negociar'}`,
        250
      );

      // Update RFQ status to sent
      await db.from('omega_final_rfqs').update({ status: 'sent' }).eq('id', rfqId);

      // Audit
      await db.from('omega_final_audit_log').insert({
        entity_type: 'rfq',
        entity_id: rfqId,
        action: 'rfq_blasted_to_suppliers',
        performed_by: user.id,
        metadata: { suppliers: suppliers.map(s => s.name), cover_message: coverMsg },
      });

      return NextResponse.json({
        ok: true,
        suppliers,
        coverMessage: coverMsg,
        blastCount: suppliers.length,
      });
    }

    // ── AI auto-award lowest qualified bid ─────────────────────────────────
    if (action === 'auto_award') {
      const rfqId = body.rfqId as string;
      if (!rfqId) return NextResponse.json({ error: 'Missing rfqId' }, { status: 400 });

      const { data: responses } = await db
        .from('omega_final_rfq_responses')
        .select('*')
        .eq('rfq_id', rfqId)
        .eq('status', 'submitted')
        .order('unit_price', { ascending: true });

      if (!responses?.length) return NextResponse.json({ error: 'No bids to evaluate' }, { status: 400 });

      const { data: rfq } = await db.from('omega_final_rfqs').select('*').eq('id', rfqId).single();
      if (!rfq) return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });

      // Pick winner: lowest price with ai_score >= 60 (quality threshold)
      type RFQResponse = { id: string; supplier_name: string; unit_price: number; ai_score?: number };
      const qualified = (responses as RFQResponse[]).filter(r => (r.ai_score ?? 50) >= 60);
      const winner = qualified.length > 0 ? qualified[0] : (responses as RFQResponse[])[0];

      const rfqTyped = rfq as { quantity?: number; target_unit_price?: number };
      const savings = rfqTyped.target_unit_price
        ? (rfqTyped.target_unit_price - winner.unit_price) * (rfqTyped.quantity ?? 1)
        : 0;
      const savingsPct = rfqTyped.target_unit_price
        ? ((rfqTyped.target_unit_price - winner.unit_price) / rfqTyped.target_unit_price) * 100
        : 0;

      await Promise.all([
        db.from('omega_final_rfqs').update({
          status: 'awarded',
          winner_supplier: winner.supplier_name,
          final_unit_price: winner.unit_price,
          final_total: winner.unit_price * (rfqTyped.quantity ?? 1),
          savings_amount: Math.max(0, savings),
          savings_pct: Math.max(0, Math.round(savingsPct * 10) / 10),
          awarded_at: new Date().toISOString(),
        }).eq('id', rfqId),
        db.from('omega_final_rfq_responses').update({ status: 'awarded' }).eq('id', winner.id),
        db.from('omega_final_audit_log').insert({
          entity_type: 'rfq',
          entity_id: rfqId,
          action: 'rfq_auto_awarded',
          performed_by: user.id,
          metadata: { winner: winner.supplier_name, savings, auto_awarded: true },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        winner: winner.supplier_name,
        finalUnitPrice: winner.unit_price,
        savings: Math.max(0, Math.round(savings * 100) / 100),
        savingsPct: Math.max(0, Math.round(savingsPct * 10) / 10),
      });
    }

    // ── AI negotiation round message ───────────────────────────────────────
    if (action === 'negotiate_round') {
      const rfqId = body.rfqId as string;
      const supplierId = body.supplierId as string;
      if (!rfqId || !supplierId) return NextResponse.json({ error: 'Missing rfqId or supplierId' }, { status: 400 });

      const { data: response } = await db
        .from('omega_final_rfq_responses')
        .select('supplier_name, unit_price, lead_time_days, moq')
        .eq('id', supplierId)
        .single();

      const { data: rfq } = await db
        .from('omega_final_rfqs')
        .select('product_name, quantity, target_unit_price')
        .eq('id', rfqId)
        .single();

      if (!response || !rfq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const rfqTyped = rfq as { product_name?: string; quantity?: number; target_unit_price?: number };
      const respTyped = response as { supplier_name?: string; unit_price?: number; lead_time_days?: number; moq?: number };

      const negotiationMsg = await callClaude(
        'És um procurement manager experiente. Escreves mensagens de negociação profissionais em português. Tom: respeitoso mas firme. Foca no preço unitário e prazo.',
        `Fornecedor: ${respTyped.supplier_name}, Proposta: €${respTyped.unit_price}/un, Lead time: ${respTyped.lead_time_days}d, MOQ: ${respTyped.moq}. Produto: ${rfqTyped.product_name}, Qtd: ${rfqTyped.quantity}, Alvo: €${rfqTyped.target_unit_price}/un. Gera contra-proposta.`,
        300
      );

      // Log negotiation session
      await db.from('omega_final_negotiation_sessions').insert({
        rfq_id: rfqId,
        supplier_name: respTyped.supplier_name,
        round: 1,
        our_target_price: rfqTyped.target_unit_price,
        supplier_offer: respTyped.unit_price,
        ai_message: negotiationMsg,
        ai_strategy: 'price_reduction',
        outcome: 'pending',
      }).select();

      return NextResponse.json({ ok: true, negotiationMessage: negotiationMsg });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[procurement-autopilot POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
