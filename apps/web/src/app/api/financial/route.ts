import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA PROTOCOL — S8: Financial Intelligence Supremacy ────────────────────
//
// Margin leak detection · Profitability engine · Cashflow forecasting
// Fraud pattern detection · Revenue reconciliation
//
// GET /api/financial?period=30d|90d|12m&mode=overview|margins|cashflow|fraud
//
// ─────────────────────────────────────────────────────────────────────────────


// ── Margin assumptions (configurable per product category in future) ──────────
const ASSUMED_COGS_RATE = 0.62; // 62% cost of goods sold → 38% gross margin
const TARGET_MARGIN_PCT = 38;
const MARGIN_ALERT_THRESHOLD = 28; // below this = margin leak alert

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = isAdminEmail(user.email);
    const params = request.nextUrl.searchParams;
    const period = params.get('period') ?? '30d';
    const mode = params.get('mode') ?? 'overview';

    let days: number;
    if (period === '7d') days = 7;
    else if (period === '30d') days = 30;
    else if (period === '90d') days = 90;
    else days = 365;

    const rangeStart = new Date(Date.now() - days * 86400000).toISOString();
    const prevStart = new Date(Date.now() - 2 * days * 86400000).toISOString();

    // Resolve client scope
    let clientId: string | null = null;
    if (!isAdmin) {
      const { data: c } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      clientId = c?.id ?? null;
      if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── Fetch orders ──────────────────────────────────────────────────────────
    let currentQ = supabase.from('orders').select('id, ref, status, total_amount, created_at, updated_at, client_id, clients(name)').gte('created_at', rangeStart).order('created_at', { ascending: false });
    let prevQ    = supabase.from('orders').select('id, status, total_amount, created_at').gte('created_at', prevStart).lt('created_at', rangeStart);
    let invoicesQ = supabase.from('invoices').select('id, amount, status, due_date, paid_at, client_id').gte('created_at', rangeStart).limit(200);

    if (clientId) {
      currentQ    = currentQ.eq('client_id', clientId);
      prevQ       = prevQ.eq('client_id', clientId);
      invoicesQ   = invoicesQ.eq('client_id', clientId);
    }

    const [currentRes, prevRes, invoicesRes] = await Promise.all([
      currentQ.limit(500),
      prevQ.limit(500),
      invoicesQ,
    ]);

    type OrderRow = { id: string; ref: string; status: string; total_amount: number | null; created_at: string; updated_at: string; client_id: string | null; clients?: { name: string | null } | null };
    type InvoiceRow = { id: string; amount: number | null; status: string; due_date: string | null; paid_at: string | null; client_id: string | null };

    const currentOrders = (currentRes.data ?? []) as unknown as OrderRow[];
    const prevOrders    = (prevRes.data ?? []) as unknown as OrderRow[];
    const invoices      = ((invoicesRes.data ?? []) as unknown as InvoiceRow[]);

    // ── Revenue computation ───────────────────────────────────────────────────
    const validCurrent = currentOrders.filter(o => !['cancelled', 'draft'].includes(o.status) && o.total_amount != null);
    const validPrev    = prevOrders.filter(o => !['cancelled', 'draft'].includes(o.status) && o.total_amount != null);

    const currentRevenue = validCurrent.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const prevRevenue    = validPrev.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const revenueGrowth  = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // ── Gross margin (estimated) ──────────────────────────────────────────────
    const estimatedCogs = currentRevenue * ASSUMED_COGS_RATE;
    const grossMargin   = currentRevenue - estimatedCogs;
    const grossMarginPct = currentRevenue > 0 ? (grossMargin / currentRevenue) * 100 : 0;

    // ── Margin leak detection ─────────────────────────────────────────────────
    const marginLeaks: Array<{ id: string; ref: string; revenue: number; estimatedMargin: number; marginPct: number; flag: string }> = [];

    if (mode === 'margins' || mode === 'overview') {
      // Flag orders with very low margin signals (e.g., discount applied = lower unit value)
      const avgOrderValue = validCurrent.length > 0 ? currentRevenue / validCurrent.length : 0;

      for (const order of validCurrent) {
        if (!order.total_amount) continue;
        // Heuristic: orders significantly below average may indicate heavy discounts
        const relativeValue = order.total_amount / Math.max(avgOrderValue, 1);
        const orderMarginPct = relativeValue < 0.5 ? MARGIN_ALERT_THRESHOLD - 8 : grossMarginPct;

        if (orderMarginPct < MARGIN_ALERT_THRESHOLD) {
          marginLeaks.push({
            id: order.id,
            ref: order.ref,
            revenue: order.total_amount,
            estimatedMargin: Math.round(order.total_amount * (orderMarginPct / 100)),
            marginPct: Math.round(orderMarginPct),
            flag: orderMarginPct < 20 ? 'critical' : 'warning',
          });
        }
      }
    }

    // ── Cashflow forecast ─────────────────────────────────────────────────────
    const cashflowForecast: Array<{ period: string; expected: number; invoiced: number; collected: number; gap: number }> = [];

    if (mode === 'cashflow' || mode === 'overview') {
      // Weekly buckets for next 8 weeks based on active order pipeline
      const activeOrders = currentOrders.filter(o => ['confirmed', 'producing', 'shipped'].includes(o.status));
      const activeValue  = activeOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
      const weeklyRun    = validCurrent.length > 0 ? currentRevenue / (days / 7) : 0;

      // Invoice stats
      const invoicedTotal   = invoices.reduce((s, inv) => s + (inv.amount ?? 0), 0);
      const collectedTotal  = invoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + (inv.amount ?? 0), 0);
      const overdueTotal    = invoices.filter(inv => {
        if (inv.status === 'paid' || !inv.due_date) return false;
        return new Date(inv.due_date) < new Date();
      }).reduce((s, inv) => s + (inv.amount ?? 0), 0);

      for (let w = 1; w <= 8; w++) {
        const expected   = Math.round(weeklyRun + (w <= 4 ? activeValue / 8 : 0));
        const collected  = w === 1 ? Math.round(collectedTotal / (days / 7)) : 0;
        const invoiced   = Math.round(invoicedTotal / (days / 7));
        cashflowForecast.push({
          period: `Sem. ${w}`,
          expected,
          invoiced,
          collected,
          gap: expected - collected,
        });
      }

      if (mode === 'cashflow') {
        return NextResponse.json({
          cashflowForecast,
          activeValue: Math.round(activeValue),
          invoicedTotal: Math.round(invoicedTotal),
          collectedTotal: Math.round(collectedTotal),
          overdueTotal: Math.round(overdueTotal),
          collectionRate: invoicedTotal > 0 ? Math.round((collectedTotal / invoicedTotal) * 100) : 100,
          weeklyRunRate: Math.round(weeklyRun),
          generatedAt: new Date().toISOString(),
        });
      }
    }

    // ── Fraud / anomaly patterns ──────────────────────────────────────────────
    const fraudSignals: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high'; count: number }> = [];

    if (mode === 'fraud') {
      // Pattern 1: Multiple orders from same client same day (unusual burst)
      const clientOrderCount: Record<string, number> = {};
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (const order of currentOrders) {
        if (new Date(order.created_at) >= today && order.client_id) {
          clientOrderCount[order.client_id] = (clientOrderCount[order.client_id] ?? 0) + 1;
        }
      }
      const burstClients = Object.entries(clientOrderCount).filter(([, count]) => count >= 5);
      if (burstClients.length > 0) {
        fraudSignals.push({
          type: 'order_burst',
          description: `${burstClients.length} cliente(s) com ≥5 encomendas hoje — padrão incomum`,
          severity: 'medium',
          count: burstClients.length,
        });
      }

      // Pattern 2: High-value cancelled orders (potential abuse)
      const highValueCancelled = currentOrders.filter(o => o.status === 'cancelled' && (o.total_amount ?? 0) > 5000);
      if (highValueCancelled.length > 0) {
        fraudSignals.push({
          type: 'high_value_cancellation',
          description: `${highValueCancelled.length} encomenda(s) de alto valor canceladas — requer revisão`,
          severity: highValueCancelled.length >= 3 ? 'high' : 'medium',
          count: highValueCancelled.length,
        });
      }

      return NextResponse.json({
        fraudSignals,
        totalOrders: currentOrders.length,
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Revenue timeline (daily buckets) ──────────────────────────────────────
    const buckets = Math.min(days, 30);
    const bucketSize = Math.ceil(days / buckets);
    const revenueTimeline = Array.from({ length: buckets }, (_, i) => {
      const bStart = new Date(Date.now() - (buckets - i) * bucketSize * 86400000);
      const bEnd   = new Date(Date.now() - (buckets - i - 1) * bucketSize * 86400000);
      const rev    = validCurrent.filter(o => new Date(o.created_at) >= bStart && new Date(o.created_at) < bEnd).reduce((s, o) => s + (o.total_amount ?? 0), 0);
      return { label: bStart.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }), revenue: Math.round(rev) };
    });

    // ── Top clients by revenue (admin) ────────────────────────────────────────
    const topClients: Array<{ name: string; revenue: number; orders: number }> = [];
    if (isAdmin) {
      const clientMap: Record<string, { name: string; revenue: number; orders: number }> = {};
      for (const order of validCurrent) {
        const name = (order.clients as { name?: string | null } | null)?.name ?? 'Unknown';
        const cid = order.client_id ?? 'unknown';
        if (!clientMap[cid]) clientMap[cid] = { name, revenue: 0, orders: 0 };
        clientMap[cid].revenue += order.total_amount ?? 0;
        clientMap[cid].orders += 1;
      }
      topClients.push(...Object.values(clientMap).map(c => ({ ...c, revenue: Math.round(c.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8));
    }

    return NextResponse.json({
      period,
      scope: isAdmin ? 'platform' : 'client',
      summary: {
        currentRevenue: Math.round(currentRevenue),
        prevRevenue: Math.round(prevRevenue),
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        grossMargin: Math.round(grossMargin),
        grossMarginPct: Math.round(grossMarginPct * 10) / 10,
        targetMarginPct: TARGET_MARGIN_PCT,
        marginHealth: grossMarginPct >= TARGET_MARGIN_PCT ? 'healthy' : grossMarginPct >= MARGIN_ALERT_THRESHOLD ? 'at_risk' : 'critical',
        totalOrders: validCurrent.length,
        cancellationRate: currentOrders.length > 0 ? Math.round((currentOrders.filter(o => o.status === 'cancelled').length / currentOrders.length) * 100) : 0,
      },
      revenueTimeline,
      marginLeaks: marginLeaks.slice(0, 10),
      cashflowForecast,
      topClients,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[financial] error:', error);
    return NextResponse.json({ error: 'Financial intelligence unavailable' }, { status: 500 });
  }
}
