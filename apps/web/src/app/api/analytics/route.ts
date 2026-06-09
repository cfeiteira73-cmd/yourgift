import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── Phase 12: Advanced Analytics API ─────────────────────────────────────────
//
// Provides comprehensive platform analytics:
// - Revenue velocity (daily/weekly/monthly trends)
// - Client acquisition and retention metrics
// - Order pipeline throughput
// - Quote conversion funnel
// - Product category performance
// - SLA compliance rates
//
// GET /api/analytics?period=30d|90d|12m&scope=platform|client
// ─────────────────────────────────────────────────────────────────────────────


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const period = params.get('period') ?? '30d';
    const scope = params.get('scope') ?? 'auto';

    const isAdmin = isAdminEmail(user.email);
    const effectiveScope = scope === 'auto' ? (isAdmin ? 'platform' : 'client') : scope;

    // Non-admin cannot request platform scope
    if (effectiveScope === 'platform' && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Time range ──────────────────────────────────────────────────────────
    const now = new Date();
    let days: number;
    if (period === '7d') days = 7;
    else if (period === '30d') days = 30;
    else if (period === '90d') days = 90;
    else days = 365; // 12m
    const rangeStart = new Date(now.getTime() - days * 86400000).toISOString();

    // ── Queries ─────────────────────────────────────────────────────────────
    let clientId: string | null = null;

    if (effectiveScope === 'client') {
      const { data: clientData } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      clientId = clientData?.id ?? null;
      if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build base queries
    let ordersQuery = supabase.from('orders').select('id, status, total_amount, created_at, client_id').gte('created_at', rangeStart);
    let quotesQuery = supabase.from('quotes').select('id, status, total_amount, created_at, client_id').gte('created_at', rangeStart);

    if (clientId) {
      ordersQuery = ordersQuery.eq('client_id', clientId);
      quotesQuery = quotesQuery.eq('client_id', clientId);
    }

    const [ordersRes, quotesRes, clientsRes, alertsRes, slaRes] = await Promise.all([
      ordersQuery.order('created_at', { ascending: true }),
      quotesQuery.order('created_at', { ascending: true }),
      effectiveScope === 'platform'
        ? supabase.from('clients').select('id, tier, created_at').gte('created_at', rangeStart)
        : Promise.resolve({ data: [] }),
      effectiveScope === 'platform'
        ? supabase.from('inventory_alerts').select('alert_type, resolved, created_at').gte('created_at', rangeStart)
        : Promise.resolve({ data: [] }),
      supabase.from('sla_definitions').select('stage, expected_hours, warning_hours, critical_hours').eq('is_active', true),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ id: string; status: string; total_amount: number | null; created_at: string; client_id: string | null }>;
    const quotes = (quotesRes.data ?? []) as Array<{ id: string; status: string; total_amount: number | null; created_at: string; client_id: string | null }>;
    const clients = (clientsRes.data ?? []) as Array<{ id: string; tier: string; created_at: string }>;
    const alerts = (alertsRes.data ?? []) as Array<{ alert_type: string; resolved: boolean; created_at: string }>;
    const slaMap = Object.fromEntries(((slaRes.data ?? []) as Array<{ stage: string; expected_hours: number; warning_hours: number; critical_hours: number }>).map(s => [s.stage, s]));

    // ── Revenue velocity (daily buckets) ────────────────────────────────────
    const validOrders = orders.filter(o => o.status !== 'cancelled' && o.total_amount != null);
    const buckets = Math.min(days, 30); // max 30 data points
    const bucketSize = Math.ceil(days / buckets);
    const revenueTimeline = Array.from({ length: buckets }, (_, i) => {
      const bucketStart = new Date(now.getTime() - (buckets - i) * bucketSize * 86400000);
      const bucketEnd = new Date(now.getTime() - (buckets - i - 1) * bucketSize * 86400000);
      const label = bucketStart.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' });
      const revenue = validOrders
        .filter(o => {
          const d = new Date(o.created_at);
          return d >= bucketStart && d < bucketEnd;
        })
        .reduce((s, o) => s + (o.total_amount ?? 0), 0);
      const count = validOrders.filter(o => {
        const d = new Date(o.created_at);
        return d >= bucketStart && d < bucketEnd;
      }).length;
      return { label, revenue: Math.round(revenue), count };
    });

    // ── Order pipeline status breakdown ─────────────────────────────────────
    const statusMap: Record<string, number> = {};
    const statusRevMap: Record<string, number> = {};
    for (const o of orders) {
      statusMap[o.status] = (statusMap[o.status] ?? 0) + 1;
      statusRevMap[o.status] = (statusRevMap[o.status] ?? 0) + (o.total_amount ?? 0);
    }
    const pipeline = Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
      revenue: Math.round(statusRevMap[status] ?? 0),
    })).sort((a, b) => b.count - a.count);

    // ── Quote conversion funnel ──────────────────────────────────────────────
    const totalQuotes = quotes.length;
    const quotePipeline = {
      total: totalQuotes,
      pending: quotes.filter(q => ['submitted', 'pricing', 'proposed'].includes(q.status)).length,
      approved: quotes.filter(q => q.status === 'approved').length,
      converted: quotes.filter(q => q.status === 'converted').length,
      rejected: quotes.filter(q => q.status === 'rejected').length,
      conversionRate: totalQuotes > 0 ? Math.round((quotes.filter(q => q.status === 'converted').length / totalQuotes) * 100) : 0,
      totalPipelineValue: Math.round(quotes.reduce((s, q) => s + (q.total_amount ?? 0), 0)),
    };

    // ── Revenue summary ─────────────────────────────────────────────────────
    const totalRevenue = validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
    const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const deliveryRate = orders.length > 0 ? Math.round((deliveredOrders / orders.length) * 100) : 0;

    // ── Client metrics (platform only) ─────────────────────────────────────
    const clientMetrics = effectiveScope === 'platform' ? {
      newClients: clients.length,
      byTier: Object.fromEntries(
        ['standard', 'premium', 'enterprise', 'vip'].map(tier => [
          tier,
          clients.filter(c => c.tier === tier).length,
        ])
      ),
      acquisitionByWeek: Array.from({ length: Math.min(Math.ceil(days / 7), 12) }, (_, i) => {
        const wStart = new Date(now.getTime() - (Math.min(Math.ceil(days / 7), 12) - i) * 7 * 86400000);
        const wEnd = new Date(now.getTime() - (Math.min(Math.ceil(days / 7), 12) - i - 1) * 7 * 86400000);
        return {
          week: wStart.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' }),
          count: clients.filter(c => new Date(c.created_at) >= wStart && new Date(c.created_at) < wEnd).length,
        };
      }),
    } : null;

    // ── Inventory alerts summary (platform only) ─────────────────────────────
    const alertMetrics = effectiveScope === 'platform' ? {
      total: alerts.length,
      critical: alerts.filter(a => a.alert_type === 'out_of_stock').length,
      lowStock: alerts.filter(a => a.alert_type === 'low_stock').length,
      resolved: alerts.filter(a => a.resolved).length,
    } : null;

    // ── SLA compliance (if sla data available) ──────────────────────────────
    // For active orders, estimate compliance using created_at vs expected_hours
    const activeWithSla = orders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status));
    const slaCompliance = activeWithSla.length > 0 ? (() => {
      let onTime = 0;
      let atRisk = 0;
      let violated = 0;
      for (const o of activeWithSla) {
        const hoursElapsed = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
        const stageSla = slaMap[o.status];
        if (stageSla) {
          if (hoursElapsed >= stageSla.critical_hours) violated++;
          else if (hoursElapsed >= stageSla.warning_hours) atRisk++;
          else onTime++;
        } else {
          onTime++; // No SLA defined = assume on-time
        }
      }
      return {
        onTime,
        atRisk,
        violated,
        complianceRate: activeWithSla.length > 0 ? Math.round((onTime / activeWithSla.length) * 100) : 100,
      };
    })() : { onTime: 0, atRisk: 0, violated: 0, complianceRate: 100 };

    return NextResponse.json({
      scope: effectiveScope,
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue: Math.round(totalRevenue),
        avgOrderValue: Math.round(avgOrderValue),
        totalOrders: orders.length,
        activeOrders,
        deliveredOrders,
        deliveryRate,
        totalQuotes,
      },
      revenueTimeline,
      pipeline,
      quotes: quotePipeline,
      slaCompliance,
      clients: clientMetrics,
      alerts: alertMetrics,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 500 });
  }
}
