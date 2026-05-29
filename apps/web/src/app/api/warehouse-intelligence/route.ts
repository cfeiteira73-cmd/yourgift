import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Warehouse Intelligence API ─────────────────────────────
//
// X11 Warehouse & IoT Intelligence: Predictive restock, inventory movement
// analytics, stock velocity, supplier lead time optimization, and
// warehouse capacity intelligence.
//
// GET  ?mode=restock          — items predicted to run out in next 30 days
// GET  ?mode=velocity         — stock movement velocity per product/category
// GET  ?mode=capacity         — warehouse capacity utilisation
// GET  ?mode=dead_stock       — items with 0 movement in 60+ days
// GET  ?mode=alerts           — active inventory alerts with AI priority
// POST { action:'adjust_stock', productId, delta, reason } — manual stock adj
// POST { action:'set_reorder_point', productId, point }    — set reorder trigger
// POST { action:'receive_shipment', items }                — log incoming stock
//
// Restock prediction model:
//   avg_daily_velocity = units_sold_30d / 30
//   days_until_stockout = current_stock / avg_daily_velocity
//   restock_urgency = lead_time_days - days_until_stockout
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type InventoryItem = {
  id: string;
  product_id: string;
  quantity: number;
  reserved_quantity?: number;
  reorder_point?: number;
  products?: {
    id: string;
    title: string;
    category?: string;
    images?: string[];
    supplier_lead_time_days?: number;
  } | null;
};

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'restock';

  try {
    if (mode === 'restock') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // Current stock levels
      const { data: inventory } = await db
        .from('inventory')
        .select('id, product_id, quantity, reserved_quantity, reorder_point, products(id, title, category, images, supplier_lead_time_days)')
        .gt('quantity', 0)
        .limit(200);

      // Sales velocity last 30d
      const { data: salesData } = await db
        .from('order_items')
        .select('product_id, quantity')
        .gte('orders.created_at', thirtyDaysAgo)
        .in('orders.status', ['confirmed', 'shipped', 'delivered'])
        .limit(1000);

      type SalesItem = { product_id: string; quantity: number };
      const salesMap: Record<string, number> = {};
      for (const item of (salesData ?? []) as SalesItem[]) {
        salesMap[item.product_id] = (salesMap[item.product_id] ?? 0) + (item.quantity ?? 0);
      }

      const predictions = (inventory ?? [] as InventoryItem[]).map(item => {
        const inv = item as InventoryItem;
        const productId = inv.product_id;
        const available = (inv.quantity ?? 0) - (inv.reserved_quantity ?? 0);
        const sold30d = salesMap[productId] ?? 0;
        const avgDailyVelocity = sold30d / 30;
        const daysUntilStockout = avgDailyVelocity > 0 ? Math.floor(available / avgDailyVelocity) : 999;
        const leadTimeDays = inv.products?.supplier_lead_time_days ?? 14;
        const reorderPoint = inv.reorder_point ?? Math.ceil(avgDailyVelocity * leadTimeDays * 1.2); // 20% safety stock
        const urgency = leadTimeDays - daysUntilStockout; // positive = must reorder NOW

        return {
          productId,
          productTitle: inv.products?.title ?? 'Produto',
          category: inv.products?.category ?? 'outro',
          currentStock: inv.quantity,
          available,
          reserved: inv.reserved_quantity ?? 0,
          sold30d,
          avgDailyVelocity: Math.round(avgDailyVelocity * 100) / 100,
          daysUntilStockout,
          leadTimeDays,
          reorderPoint,
          urgencyScore: urgency,
          action: urgency > 7 ? 'ORDER_NOW' : urgency > 0 ? 'ORDER_SOON' : 'MONITOR',
          suggestedOrderQty: Math.max(0, Math.ceil(avgDailyVelocity * 45)), // 45 days stock
        };
      })
      .filter(p => p.daysUntilStockout < 45 && p.sold30d > 0)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);

      return NextResponse.json({
        predictions: predictions.slice(0, 20),
        critical: predictions.filter(p => p.action === 'ORDER_NOW').length,
        warning: predictions.filter(p => p.action === 'ORDER_SOON').length,
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'velocity') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

      const [recent, prior] = await Promise.all([
        db.from('order_items')
          .select('product_id, quantity, products(id, title, category)')
          .gte('orders.created_at', thirtyDaysAgo)
          .in('orders.status', ['confirmed', 'shipped', 'delivered'])
          .limit(1000),
        db.from('order_items')
          .select('product_id, quantity')
          .gte('orders.created_at', sixtyDaysAgo)
          .lt('orders.created_at', thirtyDaysAgo)
          .in('orders.status', ['confirmed', 'shipped', 'delivered'])
          .limit(1000),
      ]);

      type VelocityItem = { product_id: string; quantity: number; products?: { id: string; title: string; category?: string } | null };
      const recentMap: Record<string, { title: string; category: string; qty: number }> = {};
      for (const item of (recent.data ?? []) as VelocityItem[]) {
        const pid = item.product_id;
        if (!recentMap[pid]) recentMap[pid] = { title: item.products?.title ?? pid, category: item.products?.category ?? 'outro', qty: 0 };
        recentMap[pid].qty += item.quantity ?? 0;
      }

      const priorMap: Record<string, number> = {};
      for (const item of (prior.data ?? []) as VelocityItem[]) {
        priorMap[item.product_id] = (priorMap[item.product_id] ?? 0) + (item.quantity ?? 0);
      }

      const velocity = Object.entries(recentMap).map(([pid, data]) => {
        const priorQty = priorMap[pid] ?? 0;
        const change = priorQty > 0 ? ((data.qty - priorQty) / priorQty) * 100 : 100;
        return {
          productId: pid,
          title: data.title,
          category: data.category,
          units30d: data.qty,
          unitsPrior30d: priorQty,
          velocityChange: Math.round(change),
          trend: change > 20 ? 'accelerating' : change < -20 ? 'decelerating' : 'stable',
        };
      }).sort((a, b) => b.units30d - a.units30d);

      return NextResponse.json({ velocity: velocity.slice(0, 20), generatedAt: new Date().toISOString() });
    }

    if (mode === 'dead_stock') {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

      const { data: allStock } = await db
        .from('inventory')
        .select('product_id, quantity, updated_at, products(id, title, category, price_from)')
        .gt('quantity', 0)
        .limit(200);

      // Products with no sales in 60d
      const { data: activePids } = await db
        .from('order_items')
        .select('product_id')
        .gte('orders.created_at', sixtyDaysAgo)
        .limit(500);

      const activeSet = new Set((activePids ?? []).map(i => (i as { product_id: string }).product_id));

      type StockItem = { product_id: string; quantity: number; updated_at?: string; products?: { id: string; title: string; category?: string; price_from?: number } | null };
      const deadStock = (allStock ?? [] as StockItem[])
        .filter(item => !activeSet.has((item as StockItem).product_id))
        .map(item => ({
          productId: (item as StockItem).product_id,
          title: (item as StockItem).products?.title ?? 'Produto',
          category: (item as StockItem).products?.category ?? 'outro',
          quantity: (item as StockItem).quantity,
          estimatedValue: ((item as StockItem).quantity ?? 0) * ((item as StockItem).products?.price_from ?? 0),
          lastMovement: (item as StockItem).updated_at,
        }))
        .sort((a, b) => b.estimatedValue - a.estimatedValue);

      const totalDeadValue = deadStock.reduce((s, i) => s + i.estimatedValue, 0);

      return NextResponse.json({
        deadStock: deadStock.slice(0, 20),
        totalDeadValue: Math.round(totalDeadValue * 100) / 100,
        count: deadStock.length,
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'alerts') {
      const { data: alerts } = await db
        .from('inventory_alerts')
        .select('id, product_id, alert_type, message, created_at, products(title, category)')
        .order('created_at', { ascending: false })
        .limit(30);

      type Alert = { alert_type: string };
      const critical = (alerts ?? []).filter(a => (a as Alert).alert_type === 'out_of_stock').length;
      const warning = (alerts ?? []).filter(a => (a as Alert).alert_type === 'low_stock').length;

      return NextResponse.json({
        alerts: alerts ?? [],
        summary: { critical, warning, total: (alerts ?? []).length },
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'capacity') {
      const { data: totalStock } = await db
        .from('inventory')
        .select('quantity, products(category)');

      type StockRow = { quantity: number; products?: { category?: string } | null };
      const byCategory: Record<string, number> = {};
      let totalUnits = 0;

      for (const row of (totalStock ?? []) as StockRow[]) {
        const cat = row.products?.category ?? 'outro';
        byCategory[cat] = (byCategory[cat] ?? 0) + (row.quantity ?? 0);
        totalUnits += row.quantity ?? 0;
      }

      const WAREHOUSE_CAPACITY = 50000; // units — configurable
      const utilizationPct = Math.round((totalUnits / WAREHOUSE_CAPACITY) * 100);

      return NextResponse.json({
        totalUnits,
        capacityUnits: WAREHOUSE_CAPACITY,
        utilizationPct,
        byCategory,
        status: utilizationPct > 90 ? 'critical' : utilizationPct > 75 ? 'warning' : 'ok',
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[warehouse-intelligence GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body.action as string;

  try {
    if (action === 'adjust_stock') {
      const { productId, delta, reason } = body as { productId?: string; delta?: number; reason?: string };
      if (!productId || delta === undefined) return NextResponse.json({ error: 'Missing productId or delta' }, { status: 400 });

      const { data: inv } = await db.from('inventory').select('id, quantity').eq('product_id', productId).single();
      if (!inv) return NextResponse.json({ error: 'Inventory record not found' }, { status: 404 });

      const newQty = Math.max(0, ((inv as { quantity: number }).quantity ?? 0) + delta);
      await db.from('inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('product_id', productId);

      await db.from('omega_final_audit_log').insert({
        entity_type: 'inventory',
        entity_id: productId,
        action: 'stock_adjusted',
        performed_by: user.id,
        metadata: { delta, reason: reason ?? 'manual', previous: (inv as { quantity: number }).quantity, new: newQty },
      });

      return NextResponse.json({ ok: true, newQuantity: newQty });
    }

    if (action === 'set_reorder_point') {
      const { productId, point } = body as { productId?: string; point?: number };
      if (!productId || point === undefined) return NextResponse.json({ error: 'Missing productId or point' }, { status: 400 });

      await db.from('inventory').update({ reorder_point: point }).eq('product_id', productId);
      await db.from('omega_final_audit_log').insert({
        entity_type: 'inventory',
        entity_id: productId,
        action: 'reorder_point_set',
        performed_by: user.id,
        metadata: { reorder_point: point },
      });

      return NextResponse.json({ ok: true, reorderPoint: point });
    }

    if (action === 'receive_shipment') {
      const { items } = body as { items?: Array<{ productId: string; quantity: number; supplierName?: string }> };
      if (!items?.length) return NextResponse.json({ error: 'Missing items' }, { status: 400 });

      const results = [];
      for (const item of items) {
        const { data: inv } = await db.from('inventory').select('id, quantity').eq('product_id', item.productId).single();
        if (!inv) { results.push({ productId: item.productId, status: 'not_found' }); continue; }

        const newQty = ((inv as { quantity: number }).quantity ?? 0) + item.quantity;
        await db.from('inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('product_id', item.productId);

        await db.from('omega_final_audit_log').insert({
          entity_type: 'inventory',
          entity_id: item.productId,
          action: 'shipment_received',
          performed_by: user.id,
          metadata: { received: item.quantity, supplier: item.supplierName, new_total: newQty },
        });

        results.push({ productId: item.productId, received: item.quantity, newTotal: newQty, status: 'ok' });
      }

      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[warehouse-intelligence POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
