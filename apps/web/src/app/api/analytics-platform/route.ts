import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Analytics Platform API ─────────────────────────────────
//
// X12 Global Analytics Platform: Cohort analysis, funnel analytics,
// financial integrity checks, LTV modelling, and platform-wide KPI reporting.
//
// GET  ?mode=cohort          — client cohort retention analysis
// GET  ?mode=funnel          — quote-to-order conversion funnel
// GET  ?mode=ltv             — client lifetime value distribution
// GET  ?mode=financial       — financial integrity: reconciliation gaps
// GET  ?mode=platform_kpis   — unified platform KPI report (all modules)
// GET  ?mode=revenue_mix     — revenue breakdown by client tier, category, country
//
// Admin-only endpoint.
//
// ─────────────────────────────────────────────────────────────────────────────


function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// ── Cohort retention analysis ─────────────────────────────────────────────────

async function getCohortRetention(db: ReturnType<typeof getAdminDb>) {
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

  const { data: clients } = await db!
    .from('clients')
    .select('id, created_at, tier')
    .gte('created_at', sixMonthsAgo)
    .order('created_at', { ascending: true });

  const { data: allOrders } = await db!
    .from('orders')
    .select('client_id, created_at, total_amount')
    .gte('created_at', sixMonthsAgo)
    .in('status', ['confirmed', 'shipped', 'delivered'])
    .order('created_at', { ascending: true });

  type Client = { id: string; created_at: string; tier?: string };
  type Order = { client_id: string; created_at: string; total_amount: number };

  // Group clients into monthly cohorts
  const cohorts: Record<string, { clientIds: string[]; month: string }> = {};
  for (const client of (clients ?? []) as Client[]) {
    const month = client.created_at.slice(0, 7); // YYYY-MM
    if (!cohorts[month]) cohorts[month] = { clientIds: [], month };
    cohorts[month].clientIds.push(client.id);
  }

  // For each cohort, check activity in subsequent months
  const ordersByClient: Record<string, string[]> = {};
  for (const order of (allOrders ?? []) as Order[]) {
    if (!ordersByClient[order.client_id]) ordersByClient[order.client_id] = [];
    ordersByClient[order.client_id].push(order.created_at.slice(0, 7));
  }

  const cohortData = Object.entries(cohorts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // Last 6 cohorts
    .map(([month, { clientIds }]) => {
      const size = clientIds.length;
      if (size === 0) return null;

      // Retention for months 0-5 after cohort month
      const retention = [0, 1, 2, 3, 4, 5].map(offset => {
        const targetMonth = new Date(month + '-01');
        targetMonth.setMonth(targetMonth.getMonth() + offset);
        const tm = targetMonth.toISOString().slice(0, 7);
        const active = clientIds.filter(cid => (ordersByClient[cid] ?? []).includes(tm)).length;
        return { month: tm, retained: active, rate: Math.round((active / size) * 100) };
      });

      return { cohortMonth: month, size, retention };
    })
    .filter(Boolean);

  return cohortData;
}

// ── Quote → Order conversion funnel ──────────────────────────────────────────

async function getConversionFunnel(db: ReturnType<typeof getAdminDb>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [totalQuotes, sentQuotes, approvedQuotes, convertedOrders] = await Promise.all([
    db!.from('quotes').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    db!.from('quotes').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo).neq('status', 'draft'),
    db!.from('quotes').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo).in('status', ['approved', 'accepted']),
    db!.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo).neq('status', 'cancelled'),
  ]);

  const total = totalQuotes.count ?? 0;
  const sent = sentQuotes.count ?? 0;
  const approved = approvedQuotes.count ?? 0;
  const converted = convertedOrders.count ?? 0;

  return {
    stages: [
      { stage: 'Criados', count: total, pct: 100, dropoff: 0 },
      { stage: 'Enviados', count: sent, pct: total > 0 ? Math.round((sent / total) * 100) : 0, dropoff: total - sent },
      { stage: 'Aprovados', count: approved, pct: total > 0 ? Math.round((approved / total) * 100) : 0, dropoff: sent - approved },
      { stage: 'Convertidos', count: converted, pct: total > 0 ? Math.round((converted / total) * 100) : 0, dropoff: approved - converted },
    ],
    overallConversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
  };
}

// ── Client LTV distribution ───────────────────────────────────────────────────

async function getLTVDistribution(db: ReturnType<typeof getAdminDb>) {
  const { data: clientRevenue } = await db!
    .from('orders')
    .select('client_id, total_amount')
    .in('status', ['confirmed', 'shipped', 'delivered'])
    .limit(2000);

  type OrderRevenue = { client_id: string; total_amount: number };
  const ltvMap: Record<string, number> = {};
  for (const order of (clientRevenue ?? []) as OrderRevenue[]) {
    ltvMap[order.client_id] = (ltvMap[order.client_id] ?? 0) + (order.total_amount ?? 0);
  }

  const ltvValues = Object.values(ltvMap).sort((a, b) => a - b);
  if (!ltvValues.length) return { distribution: [], avgLTV: 0, medianLTV: 0, top10pctLTV: 0 };

  const avgLTV = ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length;
  const medianLTV = ltvValues[Math.floor(ltvValues.length / 2)];
  const top10idx = Math.floor(ltvValues.length * 0.9);
  const top10pctLTV = ltvValues[top10idx] ?? ltvValues[ltvValues.length - 1];

  // Bucket into tiers
  const buckets = [
    { label: '< €500', min: 0, max: 500 },
    { label: '€500–€2k', min: 500, max: 2000 },
    { label: '€2k–€10k', min: 2000, max: 10000 },
    { label: '€10k–€50k', min: 10000, max: 50000 },
    { label: '> €50k', min: 50000, max: Infinity },
  ].map(b => ({
    ...b,
    count: ltvValues.filter(v => v >= b.min && v < b.max).length,
    pct: Math.round((ltvValues.filter(v => v >= b.min && v < b.max).length / ltvValues.length) * 100),
  }));

  return {
    distribution: buckets,
    avgLTV: Math.round(avgLTV * 100) / 100,
    medianLTV: Math.round(medianLTV * 100) / 100,
    top10pctLTV: Math.round(top10pctLTV * 100) / 100,
    totalClients: ltvValues.length,
  };
}

// ── Financial integrity check ─────────────────────────────────────────────────

async function getFinancialIntegrity(db: ReturnType<typeof getAdminDb>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [orders, invoices, payments] = await Promise.all([
    db!.from('orders').select('id, total_amount, payment_status').gte('created_at', thirtyDaysAgo).in('status', ['confirmed', 'shipped', 'delivered']),
    db!.from('invoices').select('id, total_amount, status, order_id').gte('created_at', thirtyDaysAgo),
    db!.from('payments').select('id, amount, status, order_id').gte('created_at', thirtyDaysAgo).eq('status', 'succeeded'),
  ]);

  type OrderRow = { id: string; total_amount: number; payment_status: string };
  type InvoiceRow = { id: string; total_amount: number; status: string; order_id?: string };
  type PaymentRow = { id: string; amount: number; status: string; order_id?: string };

  const orderRevenue = (orders.data ?? [] as OrderRow[]).reduce((s, o) => s + ((o as OrderRow).total_amount ?? 0), 0);
  const invoicedRevenue = (invoices.data ?? [] as InvoiceRow[]).reduce((s, i) => s + ((i as InvoiceRow).total_amount ?? 0), 0);
  const collectedRevenue = (payments.data ?? [] as PaymentRow[]).reduce((s, p) => s + ((p as PaymentRow).amount ?? 0), 0);

  // Orders without invoices
  const invoicedOrderIds = new Set((invoices.data ?? []).map(i => (i as InvoiceRow).order_id));
  const ordersWithoutInvoice = (orders.data ?? [] as OrderRow[]).filter(o => !invoicedOrderIds.has((o as OrderRow).id));

  // Payments without matching orders
  const orderIds = new Set((orders.data ?? []).map(o => (o as OrderRow).id));
  const orphanPayments = (payments.data ?? [] as PaymentRow[]).filter(p => (p as PaymentRow).order_id && !orderIds.has((p as PaymentRow).order_id ?? ''));

  const reconciliationGap = Math.abs(invoicedRevenue - collectedRevenue);
  const integrityScore = Math.max(0, 100 - (ordersWithoutInvoice.length * 5) - (orphanPayments.length * 3) - (reconciliationGap > 1000 ? 10 : 0));

  return {
    revenue: {
      ordered: Math.round(orderRevenue * 100) / 100,
      invoiced: Math.round(invoicedRevenue * 100) / 100,
      collected: Math.round(collectedRevenue * 100) / 100,
      reconciliationGap: Math.round(reconciliationGap * 100) / 100,
    },
    issues: {
      ordersWithoutInvoice: ordersWithoutInvoice.length,
      orphanPayments: orphanPayments.length,
      collectionRate: invoicedRevenue > 0 ? Math.round((collectedRevenue / invoicedRevenue) * 100) : 100,
    },
    integrityScore,
    status: integrityScore >= 95 ? 'clean' : integrityScore >= 80 ? 'review' : 'action_required',
  };
}

// ── Revenue mix ───────────────────────────────────────────────────────────────

async function getRevenueMix(db: ReturnType<typeof getAdminDb>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: orders } = await db!
    .from('orders')
    .select('total_amount, clients!inner(tier), order_items(unit_price, quantity, products(category))')
    .gte('created_at', thirtyDaysAgo)
    .in('status', ['confirmed', 'shipped', 'delivered'])
    .limit(200);

  type MixOrder = {
    total_amount: number;
    clients: { tier?: string } | null;
    order_items: Array<{ unit_price: number; quantity: number; products: { category?: string } | null }>;
  };

  const byTier: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const order of (orders ?? []) as MixOrder[]) {
    const tier = order.clients?.tier ?? 'standard';
    byTier[tier] = (byTier[tier] ?? 0) + (order.total_amount ?? 0);

    for (const item of order.order_items ?? []) {
      const cat = item.products?.category ?? 'outro';
      byCategory[cat] = (byCategory[cat] ?? 0) + (item.unit_price ?? 0) * (item.quantity ?? 0);
    }
  }

  const totalRevenue = Object.values(byTier).reduce((a, b) => a + b, 0);

  return {
    byTier: Object.entries(byTier).map(([tier, revenue]) => ({
      tier, revenue: Math.round(revenue * 100) / 100,
      pct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue),
    byCategory: Object.entries(byCategory).map(([cat, revenue]) => ({
      category: cat, revenue: Math.round(revenue * 100) / 100,
      pct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'platform_kpis';

  try {
    if (mode === 'cohort') {
      const data = await getCohortRetention(db);
      return NextResponse.json({ cohorts: data, generatedAt: new Date().toISOString() });
    }

    if (mode === 'funnel') {
      const data = await getConversionFunnel(db);
      return NextResponse.json({ ...data, generatedAt: new Date().toISOString() });
    }

    if (mode === 'ltv') {
      const data = await getLTVDistribution(db);
      return NextResponse.json({ ...data, generatedAt: new Date().toISOString() });
    }

    if (mode === 'financial') {
      const data = await getFinancialIntegrity(db);
      return NextResponse.json({ ...data, generatedAt: new Date().toISOString() });
    }

    if (mode === 'revenue_mix') {
      const data = await getRevenueMix(db);
      return NextResponse.json({ ...data, generatedAt: new Date().toISOString() });
    }

    if (mode === 'platform_kpis') {
      // Run all in parallel for the unified KPI report
      const [funnel, ltv, financial, revMix] = await Promise.all([
        getConversionFunnel(db),
        getLTVDistribution(db),
        getFinancialIntegrity(db),
        getRevenueMix(db),
      ]);

      return NextResponse.json({
        funnel,
        ltv,
        financial,
        revenueMix: revMix,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[analytics-platform GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
