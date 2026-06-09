import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S3: Global Inventory + Warehouse Intelligence ──────────────────
//
// Real-time inventory management with AI-powered demand forecasting,
// reorder intelligence, movement tracking, and warehouse analytics.
//
// GET  ?mode=list                        — all inventory items + warehouse summary
// GET  ?mode=item&id=...                 — single item + movement history
// GET  ?mode=warehouses                  — warehouse list with utilisation
// GET  ?mode=analytics                   — inventory KPIs + alerts
// GET  ?mode=forecast&sku=...            — AI demand forecast for SKU
// POST { action:'add_item', ... }        — create inventory item
// POST { action:'move', ... }            — log movement (receipt/dispatch/adjust)
// POST { action:'update_item', id, ... } — update item (qty, cost, location)
// POST { action:'ai_reorder' }           — AI reorder recommendations
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

function statusFromQty(qty: number, reorderPoint: number): string {
  if (qty <= 0) return 'out_of_stock';
  if (qty <= reorderPoint) return 'low_stock';
  return 'in_stock';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';

  // ── Inventory list ────────────────────────────────────────────────────────
  if (mode === 'list') {
    const [invRes, whRes] = await Promise.all([
      supabase.from('omega_x_inventory').select('*').order('updated_at', { ascending: false }),
      supabase.from('omega_x_warehouses').select('*').eq('is_active', true),
    ]);

    const items = invRes.data ?? [];
    const alerts = items.filter(i => ['low_stock','out_of_stock'].includes(i.status));
    const totalValue = items.reduce((s, i) => s + Number(i.total_value ?? 0), 0);

    return NextResponse.json({
      items,
      warehouses: whRes.data ?? [],
      summary: {
        total_items: items.length,
        total_value: totalValue,
        low_stock_count: alerts.filter(a => a.status === 'low_stock').length,
        out_of_stock_count: alerts.filter(a => a.status === 'out_of_stock').length,
        alerts,
      },
    });
  }

  // ── Single item + movement history ────────────────────────────────────────
  if (mode === 'item') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const [itemRes, movRes] = await Promise.all([
      supabase.from('omega_x_inventory').select('*').eq('id', id).single(),
      supabase.from('omega_x_inventory_movements').select('*').eq('inventory_id', id)
        .order('performed_at', { ascending: false }).limit(50),
    ]);

    return NextResponse.json({ item: itemRes.data, movements: movRes.data ?? [] });
  }

  // ── Warehouses ────────────────────────────────────────────────────────────
  if (mode === 'warehouses') {
    const { data: warehouses } = await supabase.from('omega_x_warehouses').select('*').order('name');

    // Compute utilisation per warehouse
    const { data: inv } = await supabase.from('omega_x_inventory').select('warehouse_id, quantity, unit_cost');
    const whStats: Record<string, { items: number; value: number }> = {};
    (inv ?? []).forEach(i => {
      const wid = i.warehouse_id ?? 'unassigned';
      if (!whStats[wid]) whStats[wid] = { items: 0, value: 0 };
      whStats[wid].items++;
      whStats[wid].value += Number(i.quantity ?? 0) * Number(i.unit_cost ?? 0);
    });

    return NextResponse.json({
      warehouses: (warehouses ?? []).map(w => ({
        ...w,
        stats: whStats[w.id] ?? { items: 0, value: 0 },
      })),
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  if (mode === 'analytics') {
    const { data: items } = await supabase.from('omega_x_inventory').select('*');
    const { data: movements } = await supabase.from('omega_x_inventory_movements')
      .select('movement_type, quantity, unit_cost, performed_at')
      .gte('performed_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const all = items ?? [];
    const mvs = movements ?? [];

    const totalValue = all.reduce((s, i) => s + Number(i.total_value ?? 0), 0);
    const totalReceipts = mvs.filter(m => m.movement_type === 'receipt').reduce((s, m) => s + Number(m.quantity), 0);
    const totalDispatches = mvs.filter(m => m.movement_type === 'dispatch').reduce((s, m) => s + Number(m.quantity), 0);

    const categoryBreakdown: Record<string, number> = {};
    all.forEach(i => {
      const cat = i.category ?? 'Sem categoria';
      categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + Number(i.total_value ?? 0);
    });

    const supplierBreakdown: Record<string, number> = {};
    all.forEach(i => {
      const sup = i.supplier_name ?? 'Desconhecido';
      supplierBreakdown[sup] = (supplierBreakdown[sup] ?? 0) + 1;
    });

    return NextResponse.json({
      total_value: totalValue,
      total_skus: all.length,
      total_receipts_30d: totalReceipts,
      total_dispatches_30d: totalDispatches,
      low_stock_items: all.filter(i => i.status === 'low_stock').length,
      out_of_stock_items: all.filter(i => i.status === 'out_of_stock').length,
      category_breakdown: categoryBreakdown,
      supplier_breakdown: supplierBreakdown,
    });
  }

  // ── AI Demand Forecast ────────────────────────────────────────────────────
  if (mode === 'forecast') {
    const sku = searchParams.get('sku');
    if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 });

    const { data: item } = await supabase.from('omega_x_inventory').select('*').eq('sku', sku).single();
    const { data: movements } = await supabase.from('omega_x_inventory_movements')
      .select('movement_type, quantity, performed_at').eq('inventory_id', item?.id ?? '')
      .order('performed_at', { ascending: false }).limit(90);

    const forecastText = await callClaude(
      'És um especialista em gestão de inventário e demand planning. Responde em JSON.',
      `SKU: ${sku}, Produto: ${item?.product_name ?? 'N/D'}, Stock atual: ${item?.quantity ?? 0}, Reorder point: ${item?.reorder_point ?? 0}, Lead time: ${item?.lead_time_days ?? 14} dias.
Movimentos recentes (qty por data): ${(movements ?? []).slice(0, 15).map(m => `${m.movement_type} ${m.quantity} (${new Date(m.performed_at).toLocaleDateString('pt-PT')})`).join(', ')}.
Responde: { "demand_next_30d": number, "demand_next_90d": number, "reorder_date": "YYYY-MM-DD", "suggested_reorder_qty": number, "stockout_risk_pct": number, "confidence": number, "reasoning": "string" }`,
      400,
    );

    let forecast: Record<string, unknown> = {};
    try { forecast = JSON.parse(forecastText); } catch { /* empty */ }

    // Cache forecast on item
    if (item?.id && Object.keys(forecast).length > 0) {
      await supabase.from('omega_x_inventory').update({
        ai_forecast: forecast,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
    }

    return NextResponse.json({ sku, item, forecast });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Add inventory item ────────────────────────────────────────────────────
  if (action === 'add_item') {
    const { sku, product_name, category, supplier_name, quantity, unit_cost,
            reorder_point, reorder_qty, lead_time_days, warehouse_id, location_code } = body;

    if (!sku || !product_name) return NextResponse.json({ error: 'sku and product_name required' }, { status: 400 });

    const qty = Number(quantity ?? 0);
    const rp  = Number(reorder_point ?? 0);

    const { data: item, error } = await supabase.from('omega_x_inventory').insert({
      sku, product_name, category: category ?? null,
      supplier_name: supplier_name ?? null,
      quantity: qty, reserved_qty: 0,
      unit_cost: unit_cost ? Number(unit_cost) : null,
      reorder_point: rp, reorder_qty: Number(reorder_qty ?? 0),
      lead_time_days: lead_time_days ? Number(lead_time_days) : null,
      warehouse_id: warehouse_id ?? null,
      location_code: location_code ?? null,
      status: statusFromQty(qty, rp),
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log initial receipt movement if qty > 0
    if (qty > 0 && item) {
      await supabase.from('omega_x_inventory_movements').insert({
        inventory_id: item.id,
        warehouse_id: warehouse_id ?? null,
        movement_type: 'receipt',
        quantity: qty,
        unit_cost: unit_cost ? Number(unit_cost) : null,
        reference_type: 'manual',
        notes: 'Stock inicial',
        performed_by: user.id,
      });
    }

    return NextResponse.json({ item, action: 'item_added' });
  }

  // ── Log movement ──────────────────────────────────────────────────────────
  if (action === 'move') {
    const { inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes } = body;
    if (!inventory_id || !movement_type || !quantity) {
      return NextResponse.json({ error: 'inventory_id, movement_type, quantity required' }, { status: 400 });
    }

    const { data: item } = await supabase.from('omega_x_inventory').select('*').eq('id', inventory_id).single();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const qty = Number(quantity);
    const outbound = ['dispatch','transfer','write_off'].includes(movement_type);
    const newQty = outbound ? Math.max(0, item.quantity - qty) : item.quantity + qty;
    const newStatus = statusFromQty(newQty, item.reorder_point ?? 0);

    await Promise.all([
      supabase.from('omega_x_inventory').update({
        quantity: newQty, status: newStatus, updated_at: new Date().toISOString(),
      }).eq('id', inventory_id),
      supabase.from('omega_x_inventory_movements').insert({
        inventory_id,
        warehouse_id: item.warehouse_id ?? null,
        movement_type,
        quantity: qty,
        unit_cost: unit_cost ? Number(unit_cost) : null,
        reference_type: reference_type ?? 'manual',
        reference_id: reference_id ?? null,
        notes: notes ?? null,
        performed_by: user.id,
      }),
    ]);

    return NextResponse.json({ new_qty: newQty, new_status: newStatus, action: 'movement_logged' });
  }

  // ── Update item ───────────────────────────────────────────────────────────
  if (action === 'update_item') {
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const safe: Record<string, unknown> = {};
    const allowed = ['product_name','category','supplier_name','unit_cost','reorder_point',
                     'reorder_qty','lead_time_days','warehouse_id','location_code','batch_number',
                     'expiry_date','status','metadata'];
    allowed.forEach(k => { if (updates[k] !== undefined) safe[k] = updates[k]; });
    safe.updated_at = new Date().toISOString();

    const { data: item, error } = await supabase.from('omega_x_inventory')
      .update(safe).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item, action: 'item_updated' });
  }

  // ── AI Reorder Recommendations ────────────────────────────────────────────
  if (action === 'ai_reorder') {
    const { data: items } = await supabase.from('omega_x_inventory')
      .select('sku, product_name, quantity, reorder_point, reorder_qty, lead_time_days, supplier_name, status')
      .in('status', ['low_stock', 'out_of_stock']);

    if (!items?.length) return NextResponse.json({ recommendations: [], message: 'Sem itens a reabastecer.' });

    const recText = await callClaude(
      'És um especialista em supply chain e gestão de inventário. Responde em JSON.',
      `Itens com stock baixo/esgotado: ${JSON.stringify(items.slice(0, 10))}.
Gera recomendações de reorder. Formato: { "recommendations": [{ "sku": string, "product_name": string, "action": string, "qty": number, "urgency": "high"|"medium"|"low", "reason": string }] }`,
      500,
    );

    let result: Record<string, unknown> = {};
    try { result = JSON.parse(recText); } catch { /* empty */ }

    return NextResponse.json({ recommendations: result.recommendations ?? [], item_count: items.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
