import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Margin Intelligence API ────────────────────────────────
//
// X6 Executive Superintelligence: Profitability & margin leak detection.
// X5 Customer OS: Upsell opportunity identification.
//
// GET  ?mode=leaks          — margin leak detection (orders below target margin)
// GET  ?mode=upsells        — upsell opportunities per client (AI-powered)
// GET  ?mode=profitability  — product/category profitability breakdown
// GET  ?mode=client&id=     — per-client margin & upsell analysis
//
// Admin-only endpoint.
//
// Margin calculation:
//   margin = (unit_price - cost_price) / unit_price × 100
//   Target margin: 35% default (configurable via products.target_margin_pct)
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

const DEFAULT_TARGET_MARGIN = 35; // percent

// ── Margin leak detection ─────────────────────────────────────────────────────

async function detectMarginLeaks(db: ReturnType<typeof getAdminDb>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: items } = await db!
    .from('order_items')
    .select(`
      id, quantity, unit_price,
      orders!inner(id, ref, client_id, status, created_at),
      products(id, title, category, cost_price, target_margin_pct)
    `)
    .gte('orders.created_at', thirtyDaysAgo)
    .in('orders.status', ['confirmed', 'shipped', 'delivered'])
    .not('products.cost_price', 'is', null)
    .limit(500);

  type ItemWithDetails = {
    id: string;
    quantity: number;
    unit_price: number;
    orders: { id: string; ref: string; client_id: string; status: string; created_at: string } | null;
    products: { id: string; title: string; category?: string; cost_price: number; target_margin_pct?: number | null } | null;
  };

  const leaks: Array<{
    orderId: string;
    orderRef: string;
    clientId: string;
    productId: string;
    productTitle: string;
    category: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    actualMarginPct: number;
    targetMarginPct: number;
    marginGapPct: number;
    leakAmount: number;
    severity: 'critical' | 'warning';
  }> = [];

  for (const item of (items ?? []) as ItemWithDetails[]) {
    if (!item.products?.cost_price || !item.unit_price) continue;
    const costPrice = item.products.cost_price;
    const unitPrice = item.unit_price;
    const targetMargin = item.products.target_margin_pct ?? DEFAULT_TARGET_MARGIN;
    const actualMargin = unitPrice > 0 ? ((unitPrice - costPrice) / unitPrice) * 100 : 0;
    const marginGap = targetMargin - actualMargin;

    if (marginGap > 5) { // Only surface if >5pp below target
      const leakAmount = ((marginGap / 100) * unitPrice) * item.quantity;
      leaks.push({
        orderId: item.orders?.id ?? '',
        orderRef: item.orders?.ref ?? '',
        clientId: item.orders?.client_id ?? '',
        productId: item.products.id,
        productTitle: item.products.title,
        category: item.products.category ?? 'outro',
        quantity: item.quantity,
        unitPrice,
        costPrice,
        actualMarginPct: Math.round(actualMargin * 10) / 10,
        targetMarginPct: targetMargin,
        marginGapPct: Math.round(marginGap * 10) / 10,
        leakAmount: Math.round(leakAmount * 100) / 100,
        severity: marginGap > 15 ? 'critical' : 'warning',
      });
    }
  }

  leaks.sort((a, b) => b.leakAmount - a.leakAmount);

  const totalLeakAmount = leaks.reduce((s, l) => s + l.leakAmount, 0);
  const criticalCount = leaks.filter(l => l.severity === 'critical').length;

  return {
    leaks: leaks.slice(0, 20),
    summary: {
      totalLeaks: leaks.length,
      totalLeakAmount: Math.round(totalLeakAmount * 100) / 100,
      criticalCount,
      warningCount: leaks.length - criticalCount,
    },
  };
}

// ── Product profitability breakdown ──────────────────────────────────────────

async function getProductProfitability(db: ReturnType<typeof getAdminDb>) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: items } = await db!
    .from('order_items')
    .select(`
      quantity, unit_price,
      orders!inner(status, created_at),
      products(id, title, category, cost_price, target_margin_pct)
    `)
    .gte('orders.created_at', ninetyDaysAgo)
    .in('orders.status', ['confirmed', 'shipped', 'delivered'])
    .limit(1000);

  type ProfItem = {
    quantity: number;
    unit_price: number;
    orders: { status: string; created_at: string } | null;
    products: { id: string; title: string; category?: string; cost_price?: number; target_margin_pct?: number | null } | null;
  };

  const catMap: Record<string, {
    category: string; revenue: number; cost: number; units: number; products: Set<string>;
  }> = {};

  const productMap: Record<string, {
    id: string; title: string; category: string;
    revenue: number; cost: number; units: number;
  }> = {};

  for (const item of (items ?? []) as ProfItem[]) {
    if (!item.products) continue;
    const cat = item.products.category ?? 'outro';
    const revenue = (item.quantity ?? 0) * (item.unit_price ?? 0);
    const cost = (item.quantity ?? 0) * (item.products.cost_price ?? item.unit_price * 0.6);

    if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, cost: 0, units: 0, products: new Set() };
    catMap[cat].revenue += revenue;
    catMap[cat].cost += cost;
    catMap[cat].units += item.quantity ?? 0;
    catMap[cat].products.add(item.products.id);

    const pk = item.products.id;
    if (!productMap[pk]) productMap[pk] = { id: pk, title: item.products.title, category: cat, revenue: 0, cost: 0, units: 0 };
    productMap[pk].revenue += revenue;
    productMap[pk].cost += cost;
    productMap[pk].units += item.quantity ?? 0;
  }

  const categories = Object.values(catMap).map(c => ({
    category: c.category,
    revenue: Math.round(c.revenue * 100) / 100,
    cost: Math.round(c.cost * 100) / 100,
    grossProfit: Math.round((c.revenue - c.cost) * 100) / 100,
    marginPct: c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 1000) / 10 : 0,
    units: c.units,
    productCount: c.products.size,
  })).sort((a, b) => b.grossProfit - a.grossProfit);

  const topProducts = Object.values(productMap)
    .map(p => ({
      ...p,
      grossProfit: Math.round((p.revenue - p.cost) * 100) / 100,
      marginPct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 10);

  return { categories, topProducts };
}

// ── Upsell opportunity engine ─────────────────────────────────────────────────

async function detectUpsellOpportunities(db: ReturnType<typeof getAdminDb>) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  // Clients who haven't ordered in 30+ days but ordered in past 90d
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: recentClients } = await db!
    .from('orders')
    .select('client_id, total_amount, created_at, order_items(products(category, title))')
    .gte('created_at', ninetyDaysAgo)
    .in('status', ['delivered', 'shipped', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(200);

  type RecentOrder = {
    client_id: string;
    total_amount: number;
    created_at: string;
    order_items: Array<{ products: { category?: string; title?: string } | null }>;
  };

  // Group by client
  const clientActivity: Record<string, {
    lastOrder: string;
    totalSpend: number;
    categories: Set<string>;
    orderCount: number;
  }> = {};

  for (const order of (recentClients ?? []) as RecentOrder[]) {
    const cid = order.client_id;
    if (!clientActivity[cid]) clientActivity[cid] = { lastOrder: order.created_at, totalSpend: 0, categories: new Set(), orderCount: 0 };
    clientActivity[cid].totalSpend += order.total_amount ?? 0;
    clientActivity[cid].orderCount++;
    if (new Date(order.created_at) > new Date(clientActivity[cid].lastOrder)) {
      clientActivity[cid].lastOrder = order.created_at;
    }
    for (const item of order.order_items ?? []) {
      if (item.products?.category) clientActivity[cid].categories.add(item.products.category);
    }
  }

  // Identify upsell signals
  const opportunities: Array<{
    clientId: string;
    type: 'dormant' | 'category_expansion' | 'volume_growth';
    signal: string;
    daysSinceLastOrder: number;
    totalSpend90d: number;
    topCategory: string;
  }> = [];

  for (const [cid, activity] of Object.entries(clientActivity)) {
    const daysSince = Math.round((Date.now() - new Date(activity.lastOrder).getTime()) / 86400000);
    const topCat = Array.from(activity.categories)[0] ?? 'outro';

    if (daysSince >= 30 && daysSince < 75) {
      opportunities.push({
        clientId: cid,
        type: 'dormant',
        signal: `${daysSince} dias sem encomenda`,
        daysSinceLastOrder: daysSince,
        totalSpend90d: activity.totalSpend,
        topCategory: topCat,
      });
    }

    if (activity.categories.size === 1 && activity.orderCount >= 3) {
      opportunities.push({
        clientId: cid,
        type: 'category_expansion',
        signal: `Compra apenas ${topCat} — potencial de cross-sell`,
        daysSinceLastOrder: daysSince,
        totalSpend90d: activity.totalSpend,
        topCategory: topCat,
      });
    }
  }

  // Enrich with client names
  const clientIds = [...new Set(opportunities.map(o => o.clientId))].slice(0, 30);
  const { data: clientDetails } = await db!
    .from('clients')
    .select('id, name, company, tier')
    .in('id', clientIds);

  const clientLookup = Object.fromEntries((clientDetails ?? []).map(c => [c.id, c]));

  const enriched = opportunities
    .slice(0, 20)
    .map(opp => ({
      ...opp,
      clientName: clientLookup[opp.clientId]?.name ?? clientLookup[opp.clientId]?.company ?? 'Cliente',
      clientTier: clientLookup[opp.clientId]?.tier ?? 'standard',
    }))
    .sort((a, b) => b.totalSpend90d - a.totalSpend90d);

  return { opportunities: enriched, count: enriched.length };
}

// ── AI upsell recommendation for specific client ──────────────────────────────

async function generateUpsellRecommendation(
  clientName: string,
  topCategory: string,
  totalSpend: number,
  daysSince: number
): Promise<string> {
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
        max_tokens: 150,
        system: 'És um account manager especialista em merchandising B2B. Gera mensagens de upsell concisas e personalizadas em português. Máximo: 2 frases.',
        messages: [{
          role: 'user',
          content: `Cliente: ${clientName}. Última compra: ${daysSince} dias. Categoria principal: ${topCategory}. Spend 90d: €${totalSpend.toFixed(0)}. Gera uma mensagem de reengagement acionável.`,
        }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'leaks';

  try {
    if (mode === 'leaks') {
      const result = await detectMarginLeaks(db);
      return NextResponse.json({ ...result, generatedAt: new Date().toISOString() });
    }

    if (mode === 'profitability') {
      const result = await getProductProfitability(db);
      return NextResponse.json({ ...result, generatedAt: new Date().toISOString() });
    }

    if (mode === 'upsells') {
      const result = await detectUpsellOpportunities(db);
      return NextResponse.json({ ...result, generatedAt: new Date().toISOString() });
    }

    if (mode === 'client') {
      const clientId = req.nextUrl.searchParams.get('id');
      if (!clientId) return NextResponse.json({ error: 'Missing client id' }, { status: 400 });

      const { data: client } = await db!.from('clients')
        .select('id, name, company, tier, budget_limit')
        .eq('id', clientId)
        .single();

      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: clientOrders } = await db!.from('orders')
        .select('total_amount, created_at, order_items(quantity, unit_price, products(category, cost_price))')
        .eq('client_id', clientId)
        .gte('created_at', ninetyDaysAgo)
        .in('status', ['confirmed', 'shipped', 'delivered']);

      type ClientOrder = {
        total_amount: number;
        created_at: string;
        order_items: Array<{ quantity: number; unit_price: number; products: { category?: string; cost_price?: number } | null }>;
      };

      let revenue = 0, cost = 0;
      const catMap: Record<string, number> = {};
      for (const order of (clientOrders ?? []) as ClientOrder[]) {
        revenue += order.total_amount ?? 0;
        for (const item of order.order_items ?? []) {
          cost += (item.quantity ?? 0) * (item.products?.cost_price ?? item.unit_price * 0.6);
          const cat = item.products?.category ?? 'outro';
          catMap[cat] = (catMap[cat] ?? 0) + (item.quantity ?? 0) * (item.unit_price ?? 0);
        }
      }

      const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'outro';
      const orders = clientOrders ?? [];
      const lastOrderDate = orders.length > 0 ? orders.sort((a: ClientOrder, b: ClientOrder) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at : null;
      const daysSince = lastOrderDate ? Math.round((Date.now() - new Date(lastOrderDate).getTime()) / 86400000) : 999;

      const marginPct = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
      const aiRecommendation = await generateUpsellRecommendation(
        client.name ?? client.company ?? 'Cliente',
        topCategory,
        revenue,
        daysSince
      );

      return NextResponse.json({
        client: { id: client.id, name: client.name, company: client.company, tier: client.tier },
        margin: {
          revenue90d: Math.round(revenue * 100) / 100,
          cost90d: Math.round(cost * 100) / 100,
          grossProfit90d: Math.round((revenue - cost) * 100) / 100,
          marginPct: Math.round(marginPct * 10) / 10,
          targetMarginPct: DEFAULT_TARGET_MARGIN,
          belowTarget: marginPct < DEFAULT_TARGET_MARGIN,
        },
        activity: {
          orders90d: orders.length,
          daysSinceLastOrder: daysSince,
          topCategory,
        },
        aiRecommendation,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[margin-intelligence]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
