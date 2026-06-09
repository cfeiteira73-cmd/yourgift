import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S9: OLAP Event Platform ─────────────────────────────────────────
//
// Append-only event store for business intelligence. Ingests structured events
// from all OS modules, computes rollups, powers the funnel + time-series views.
//
// GET  ?mode=summary            — top-level event metrics (last N days)
// GET  ?mode=events             — paginated event log with filters
// GET  ?mode=rollups            — pre-computed metric rollups (daily/monthly)
// GET  ?mode=funnel             — quote→order conversion funnel
// POST { action:'track' }       — ingest one or batch of events
// POST { action:'compute_rollup' } — aggregate event_type into rollup table
// POST { action:'query' }       — ad-hoc group-by query
//
// ─────────────────────────────────────────────────────────────────────────────


export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'summary';

  // ── Summary ───────────────────────────────────────────────────────────────
  if (mode === 'summary') {
    const days = parseInt(searchParams.get('days') ?? '30');
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [totalRes, byTypeRes, revenueRes] = await Promise.all([
      supabase.from('omega_x_analytics_events')
        .select('id', { count: 'exact', head: true })
        .gte('occurred_at', since),
      supabase.from('omega_x_analytics_events')
        .select('event_type')
        .gte('occurred_at', since),
      supabase.from('omega_x_analytics_events')
        .select('revenue')
        .gte('occurred_at', since)
        .not('revenue', 'is', null),
    ]);

    const typeBreakdown: Record<string, number> = {};
    for (const e of (byTypeRes.data ?? [])) {
      typeBreakdown[e.event_type] = (typeBreakdown[e.event_type] ?? 0) + 1;
    }

    const totalRevenue = (revenueRes.data ?? []).reduce(
      (s: number, e: { revenue: number | null }) => s + Number(e.revenue ?? 0), 0
    );

    return NextResponse.json({
      total_events: totalRes.count ?? 0,
      revenue_tracked: totalRevenue,
      event_types: typeBreakdown,
      period_days: days,
    });
  }

  // ── Event log ─────────────────────────────────────────────────────────────
  if (mode === 'events') {
    const eventType = searchParams.get('event_type');
    const entityType = searchParams.get('entity_type');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let q = supabase.from('omega_x_analytics_events')
      .select('id, event_type, entity_type, entity_id, properties, revenue, occurred_at')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) q = q.eq('event_type', eventType);
    if (entityType) q = q.eq('entity_type', entityType);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [], limit, offset });
  }

  // ── Rollups ───────────────────────────────────────────────────────────────
  if (mode === 'rollups') {
    const metric = searchParams.get('metric');
    const dimension = searchParams.get('dimension') ?? 'daily';
    const periods = parseInt(searchParams.get('periods') ?? '30');

    let q = supabase.from('omega_x_analytics_rollups')
      .select('metric, dimension, period, value, count, computed_at')
      .eq('dimension', dimension)
      .order('period', { ascending: false })
      .limit(periods);

    if (metric) q = q.eq('metric', metric);
    const { data } = await q;
    return NextResponse.json({ rollups: data ?? [], dimension });
  }

  // ── Funnel ────────────────────────────────────────────────────────────────
  if (mode === 'funnel') {
    const days = parseInt(searchParams.get('days') ?? '30');
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const steps = ['quote_created', 'quote_proposed', 'quote_accepted', 'order_created', 'order_delivered'];

    const counts = await Promise.all(
      steps.map(step =>
        supabase.from('omega_x_analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', step)
          .gte('occurred_at', since)
      )
    );

    const funnel = steps.map((step, i) => {
      const current = counts[i].count ?? 0;
      const prev = i === 0 ? current : (counts[i - 1].count ?? 0);
      return {
        step,
        count: current,
        conversion_from_prev: prev === 0 ? 0 : Math.round((current / prev) * 100),
      };
    });

    return NextResponse.json({ funnel, period_days: days });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[events] GET error:', error);
    return NextResponse.json({ error: 'Events unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Track event(s) ────────────────────────────────────────────────────────
  if (action === 'track') {
    const rawEvents: Array<Record<string, unknown>> = Array.isArray(body.events)
      ? body.events
      : [{ event_type: body.event_type, entity_type: body.entity_type,
           entity_id: body.entity_id, properties: body.properties ?? {},
           revenue: body.revenue ?? null }];

    const toInsert = rawEvents.map(e => ({
      event_type: String(e.event_type ?? ''),
      entity_type: e.entity_type != null ? String(e.entity_type) : null,
      entity_id: e.entity_id != null ? String(e.entity_id) : null,
      user_id: user.id,
      properties: (e.properties as Record<string, unknown>) ?? {},
      revenue: e.revenue != null ? Number(e.revenue) : null,
      occurred_at: e.occurred_at != null ? String(e.occurred_at) : new Date().toISOString(),
    }));

    const { error } = await supabase.from('omega_x_analytics_events').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tracked: toInsert.length, action: 'tracked' });
  }

  // ── Compute rollup ────────────────────────────────────────────────────────
  if (action === 'compute_rollup') {
    const { metric, dimension = 'daily', period } = body as {
      metric?: string; dimension?: string; period?: string;
    };
    if (!metric || !period) {
      return NextResponse.json({ error: 'metric and period required' }, { status: 400 });
    }

    const base = dimension === 'daily' ? new Date(period) : new Date(`${period}-01`);
    const end = new Date(base);
    if (dimension === 'daily') end.setDate(end.getDate() + 1);
    else end.setMonth(end.getMonth() + 1);

    const { data: evts } = await supabase.from('omega_x_analytics_events')
      .select('revenue')
      .eq('event_type', metric)
      .gte('occurred_at', base.toISOString())
      .lt('occurred_at', end.toISOString());

    const count = (evts ?? []).length;
    const value = (evts ?? []).reduce(
      (s: number, e: { revenue: number | null }) => s + Number(e.revenue ?? 0), 0
    ) || count;

    const { data } = await supabase.from('omega_x_analytics_rollups')
      .upsert({ metric, dimension, period, value, count }, { onConflict: 'metric,dimension,period' })
      .select().single();

    return NextResponse.json({ rollup: data, action: 'computed' });
  }

  // ── Ad-hoc query ──────────────────────────────────────────────────────────
  if (action === 'query') {
    const { event_type, entity_type, since_days = 30, group_by } = body as {
      event_type?: string; entity_type?: string; since_days?: number; group_by?: string;
    };
    const since = new Date(Date.now() - since_days * 86400000).toISOString();

    let q = supabase.from('omega_x_analytics_events')
      .select('event_type, entity_type, revenue, occurred_at')
      .gte('occurred_at', since);

    if (event_type) q = q.eq('event_type', event_type);
    if (entity_type) q = q.eq('entity_type', entity_type);

    const { data, error } = await q.limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results = data ?? [];
    if (!group_by) return NextResponse.json({ results, count: results.length });

    type EvRow = { event_type: string; entity_type: string | null; revenue: number | null; occurred_at: string };
    const grouped: Record<string, { count: number; revenue: number }> = {};
    for (const e of results as EvRow[]) {
      const key = group_by === 'day'
        ? e.occurred_at.split('T')[0]
        : group_by === 'type'
          ? e.event_type
          : (e.entity_type ?? 'unknown');
      if (!grouped[key]) grouped[key] = { count: 0, revenue: 0 };
      grouped[key].count++;
      grouped[key].revenue += Number(e.revenue ?? 0);
    }

    return NextResponse.json({ grouped, total: results.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[events] POST error:', error);
    return NextResponse.json({ error: 'Events action failed' }, { status: 500 });
  }
}
