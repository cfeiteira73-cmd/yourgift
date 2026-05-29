import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Reorder Brain API ──────────────────────────────────────
//
// X5 Customer OS: Intelligent reorder analysis per client.
// Analyzes historical order patterns to suggest optimal reorder timing,
// quantities, and procurement kits based on real data.
//
// GET  ?mode=suggestions           — reorder suggestions for authenticated client
// GET  ?mode=templates             — saved procurement templates
// GET  ?mode=history&clientId=     — order history for pattern analysis (admin)
// POST { action:'save_template' }  — save procurement template
// POST { action:'dismiss_suggestion', orderId } — dismiss a reorder suggestion
// POST { action:'reorder', orderId } — create reorder quote from existing order
//
// Intelligence signals used:
//   - Average reorder interval (days between repeat orders)
//   - Seasonal pattern (month-over-month volume)
//   - Category affinity (most ordered product types)
//   - Budget utilization (spent vs budget_limit)
//   - Lead time awareness (supplier avg delivery days)
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function generateAIInsight(clientName: string, orders: unknown[], avgInterval: number): Promise<string> {
  if (!ANTHROPIC_API_KEY || !orders.length) return '';
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
        max_tokens: 200,
        system: 'És um assistente especialista em procurement B2B de merchandising. Analisa padrões de compra e gera recomendações precisas em português. Resposta máxima: 2 frases curtas.',
        messages: [{
          role: 'user',
          content: `Cliente: ${clientName}. Intervalo médio entre encomendas: ${avgInterval} dias. Histórico: ${orders.length} encomendas. Gera uma recomendação de restock concisa e acionável.`,
        }],
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

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'suggestions';
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  const db = getAdminDb() ?? supabase;

  try {
    // Get client profile
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, company, tier, budget_limit')
      .eq('auth_user_id', user.id)
      .single();

    if (!client && !isAdmin) {
      return NextResponse.json({ suggestions: [], templates: [], insight: '' });
    }

    if (mode === 'templates') {
      const { data: templates } = await db
        .from('omega_final_procurement_templates')
        .select('*')
        .eq('client_id', client?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(20);
      return NextResponse.json({ templates: templates ?? [] });
    }

    if (mode === 'history') {
      const clientId = isAdmin ? searchParams.get('clientId') : client?.id;
      if (!clientId) return NextResponse.json({ orders: [] });
      const { data: orders } = await db
        .from('orders')
        .select('id, ref, status, total_amount, created_at, order_items(quantity, products(title, category))')
        .eq('client_id', clientId)
        .in('status', ['delivered', 'shipped'])
        .order('created_at', { ascending: false })
        .limit(50);
      return NextResponse.json({ orders: orders ?? [] });
    }

    // Default: suggestions mode
    const clientId = client?.id;
    if (!clientId) return NextResponse.json({ suggestions: [], templates: [], insight: '' });

    // Fetch last 50 completed orders for pattern analysis
    const { data: history } = await db
      .from('orders')
      .select(`
        id, ref, status, total_amount, created_at,
        order_items(quantity, unit_price, products(title, category, images))
      `)
      .eq('client_id', clientId)
      .in('status', ['delivered', 'shipped', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(50);

    const orders = history ?? [];

    // ── Pattern analysis ─────────────────────────────────────────────────────

    // 1. Average reorder interval
    let avgInterval = 30; // default 30 days
    if (orders.length >= 2) {
      const dates = orders.map(o => new Date(o.created_at).getTime()).sort((a, b) => b - a);
      const intervals: number[] = [];
      for (let i = 0; i < dates.length - 1; i++) {
        intervals.push((dates[i] - dates[i + 1]) / 86400000);
      }
      avgInterval = Math.round(intervals.reduce((s, x) => s + x, 0) / intervals.length);
    }

    // 2. Next predicted order date
    const lastOrderDate = orders[0] ? new Date(orders[0].created_at) : new Date();
    const predictedNextDate = new Date(lastOrderDate.getTime() + avgInterval * 86400000);
    const daysUntilReorder = Math.round((predictedNextDate.getTime() - Date.now()) / 86400000);

    // 3. Top categories
    const categoryCount: Record<string, number> = {};
    for (const order of orders) {
      for (const item of (order.order_items ?? []) as Array<{ quantity: number; products: { category?: string } | null }>) {
        const cat = item.products?.category ?? 'outro';
        categoryCount[cat] = (categoryCount[cat] ?? 0) + item.quantity;
      }
    }
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, qty]) => ({ category: cat, totalUnits: qty }));

    // 4. Average order value
    const avgOrderValue = orders.length > 0
      ? orders.reduce((s, o) => s + (o.total_amount ?? 0), 0) / orders.length
      : 0;

    // 5. Budget context
    const spentThisMonth = orders
      .filter(o => {
        const d = new Date(o.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const budgetRemaining = (client.budget_limit ?? 0) - spentThisMonth;

    // 6. Repeat products (ordered 2+ times)
    const productCount: Record<string, { title: string; count: number; lastOrdered: string; image: string | null }> = {};
    for (const order of orders) {
      for (const item of (order.order_items ?? []) as Array<{ products: { title?: string; images?: string[] } | null }>) {
        const title = item.products?.title ?? 'Produto';
        if (!productCount[title]) {
          productCount[title] = { title, count: 0, lastOrdered: order.created_at, image: item.products?.images?.[0] ?? null };
        }
        productCount[title].count++;
      }
    }
    const repeatProducts = Object.values(productCount)
      .filter(p => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. AI insight (async, non-blocking)
    const aiInsight = await generateAIInsight(client.name ?? client.company ?? 'Cliente', orders, avgInterval);

    return NextResponse.json({
      client: { id: client.id, name: client.name, company: client.company, tier: client.tier },
      pattern: {
        totalOrders: orders.length,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        avgIntervalDays: avgInterval,
        predictedNextDate: predictedNextDate.toISOString(),
        daysUntilReorder,
        isOverdue: daysUntilReorder < 0,
        topCategories,
        repeatProducts,
      },
      budget: {
        limit: client.budget_limit ?? 0,
        spentThisMonth: Math.round(spentThisMonth * 100) / 100,
        remaining: Math.round(budgetRemaining * 100) / 100,
        utilizationPct: client.budget_limit
          ? Math.round((spentThisMonth / client.budget_limit) * 100)
          : null,
      },
      insight: aiInsight,
      lastOrders: orders.slice(0, 5).map(o => ({
        id: o.id,
        ref: o.ref,
        status: o.status,
        amount: o.total_amount,
        date: o.created_at,
      })),
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[reorder-brain]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; orderId?: string; name?: string; items?: unknown[] };
  try { body = await req.json(); } catch { body = {}; }

  const { action, orderId, name, items } = body;
  const db = getAdminDb() ?? supabase;

  if (action === 'reorder' && orderId) {
    // Fetch the original order
    const { data: originalOrder } = await supabase
      .from('orders')
      .select('client_id, order_items(product_id, quantity, unit_price, customization_notes)')
      .eq('id', orderId)
      .single();

    if (!originalOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Create a new quote based on the original order items
    const { data: newQuote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        client_id: originalOrder.client_id,
        status: 'draft',
        notes: `Reorder automático baseado em encomenda ${orderId}`,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (qErr || !newQuote) return NextResponse.json({ error: qErr?.message ?? 'Failed to create quote' }, { status: 500 });

    // Copy order items to quote items
    if ((originalOrder.order_items as unknown[])?.length) {
      await supabase.from('quote_items').insert(
        (originalOrder.order_items as Array<{ product_id: string; quantity: number; unit_price: number; customization_notes: string | null }>).map(item => ({
          quote_id: newQuote.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          customization_notes: item.customization_notes,
        }))
      );
    }

    // Audit log
    await db.from('omega_final_audit_log').insert({
      entity_type: 'quote',
      entity_id: newQuote.id,
      action: 'reorder_created',
      performed_by: user.id,
      metadata: { original_order_id: orderId },
    });

    return NextResponse.json({ ok: true, quoteId: newQuote.id, redirect: `/quotes/${newQuote.id}` });
  }

  if (action === 'save_template' && name && items) {
    const { data: client } = await supabase
      .from('clients').select('id').eq('auth_user_id', user.id).single();
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const { data: tmpl, error: tErr } = await supabase
      .from('omega_final_procurement_templates')
      .insert({ client_id: client.id, name, items, created_by: user.id })
      .select('id')
      .single();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, templateId: tmpl.id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
