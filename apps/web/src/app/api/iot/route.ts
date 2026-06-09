import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S4: IoT Device Hub ──────────────────────────────────────────────
//
// Device registry, real-time telemetry ingestion, and fleet health monitoring
// for printers, scanners, scales, cameras, conveyors and robotic units.
//
// GET  ?mode=devices            — all registered devices with status
// GET  ?mode=telemetry&id=      — recent telemetry for a device
// GET  ?mode=fleet              — fleet health summary
// POST { action:'register' }    — register new device
// POST { action:'ping' }        — device heartbeat (updates status + last_ping)
// POST { action:'telemetry' }   — ingest telemetry reading(s)
// POST { action:'update_status' } — manual status update / maintenance flag
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
  const mode = searchParams.get('mode') ?? 'devices';

  if (mode === 'fleet') {
    const { data } = await supabase.from('omega_x_iot_devices').select('status, device_type');
    const devices = data ?? [];
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const d of devices) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      byType[d.device_type] = (byType[d.device_type] ?? 0) + 1;
    }
    const online = byStatus.online ?? 0;
    const total = devices.length;
    return NextResponse.json({
      total, online, offline: byStatus.offline ?? 0,
      error: byStatus.error ?? 0, maintenance: byStatus.maintenance ?? 0,
      health_pct: total > 0 ? Math.round((online / total) * 100) : 100,
      by_type: byType,
    });
  }

  if (mode === 'devices') {
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    let q = supabase.from('omega_x_iot_devices').select('*').order('updated_at', { ascending: false });
    if (type) q = q.eq('device_type', type);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return NextResponse.json({ devices: data ?? [] });
  }

  if (mode === 'telemetry') {
    const id = searchParams.get('id');
    const metric = searchParams.get('metric');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    let q = supabase.from('omega_x_iot_telemetry')
      .select('id, metric, value, unit, payload, recorded_at')
      .eq('device_id', id)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (metric) q = q.eq('metric', metric);
    const { data } = await q;
    return NextResponse.json({ telemetry: data ?? [], device_id: id });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[iot] GET error:', error);
    return NextResponse.json({ error: 'Iot unavailable' }, { status: 500 });
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

  if (action === 'register') {
    const { device_id, device_type, label, location, warehouse_id, firmware_version, metadata } = body;
    if (!device_id || !device_type || !label) {
      return NextResponse.json({ error: 'device_id, device_type, label required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('omega_x_iot_devices').upsert({
      device_id, device_type, label, location, warehouse_id: warehouse_id ?? null,
      firmware_version, metadata: metadata ?? {}, status: 'offline',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'device_id' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ device: data, action: 'registered' });
  }

  if (action === 'ping') {
    const { device_id } = body;
    if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('omega_x_iot_devices')
      .update({ status: 'online', last_ping: now, updated_at: now })
      .eq('device_id', device_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ device: data, action: 'pinged' });
  }

  if (action === 'telemetry') {
    const readings: Array<Record<string, unknown>> = Array.isArray(body.readings)
      ? body.readings
      : [{ device_id: body.device_id, metric: body.metric, value: body.value, unit: body.unit, payload: body.payload ?? {} }];

    const toInsert = readings.map(r => ({
      device_id: String(r.device_id ?? ''),
      metric: String(r.metric ?? ''),
      value: r.value != null ? Number(r.value) : null,
      unit: r.unit ? String(r.unit) : null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      recorded_at: r.recorded_at ? String(r.recorded_at) : new Date().toISOString(),
    }));

    const { error } = await supabase.from('omega_x_iot_telemetry').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ingested: toInsert.length, action: 'telemetry_ingested' });
  }

  if (action === 'update_status') {
    const { device_id, status } = body;
    const { data, error } = await supabase.from('omega_x_iot_devices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('device_id', device_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ device: data, action: 'status_updated' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[iot] POST error:', error);
    return NextResponse.json({ error: 'Iot action failed' }, { status: 500 });
  }
}
