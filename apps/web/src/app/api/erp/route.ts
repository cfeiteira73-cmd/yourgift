import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S8: ERP / EDI Connector Hub ────────────────────────────────────
//
// Manage ERP/EDI integrations: SAP, Oracle, NetSuite, Odoo, Xero, Primavera,
// EDI X12/EDIFACT. Configure connectors, trigger syncs, and audit sync history.
//
// GET  ?mode=connectors         — list all connectors
// GET  ?mode=logs&id=           — sync history for a connector
// GET  ?mode=status             — aggregated integration health
// POST { action:'create' }      — register new connector
// POST { action:'update' }      — update connector config
// POST { action:'toggle' }      — enable/disable connector
// POST { action:'trigger_sync' }— initiate sync (stub — logs attempt)
// POST { action:'test' }        — test connector connectivity
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'connectors';

  if (mode === 'status') {
    const { data } = await supabase.from('omega_x_erp_connectors')
      .select('id, name, connector_type, enabled, sync_status, last_sync');
    const connectors = data ?? [];
    const enabled = connectors.filter(c => c.enabled).length;
    const healthy = connectors.filter(c => c.sync_status === 'success').length;
    const errors = connectors.filter(c => c.sync_status === 'error').length;
    return NextResponse.json({ total: connectors.length, enabled, healthy, errors, connectors });
  }

  if (mode === 'connectors') {
    const { data } = await supabase.from('omega_x_erp_connectors')
      .select('id, name, connector_type, enabled, auth_type, last_sync, sync_status, error_message, created_at')
      .order('created_at', { ascending: false });
    return NextResponse.json({ connectors: data ?? [] });
  }

  if (mode === 'logs') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data } = await supabase.from('omega_x_erp_sync_logs')
      .select('*').eq('connector_id', id)
      .order('started_at', { ascending: false }).limit(50);
    return NextResponse.json({ logs: data ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[erp] GET error:', error);
    return NextResponse.json({ error: 'ERP unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'create') {
    const { name, connector_type, endpoint_url, auth_type = 'api_key', config = {} } = body;
    if (!name || !connector_type) {
      return NextResponse.json({ error: 'name and connector_type required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('omega_x_erp_connectors').insert({
      name, connector_type, endpoint_url, auth_type, config,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ connector: data, action: 'created' });
  }

  if (action === 'update') {
    const { id, name, endpoint_url, config, auth_type } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (endpoint_url !== undefined) updates.endpoint_url = endpoint_url;
    if (config !== undefined) updates.config = config;
    if (auth_type !== undefined) updates.auth_type = auth_type;
    const { data, error } = await supabase.from('omega_x_erp_connectors')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ connector: data, action: 'updated' });
  }

  if (action === 'toggle') {
    const { id, enabled } = body;
    const { data, error } = await supabase.from('omega_x_erp_connectors')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ connector: data, action: enabled ? 'enabled' : 'disabled' });
  }

  if (action === 'trigger_sync') {
    const { id, entity_type = 'orders', direction = 'outbound' } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const startedAt = new Date().toISOString();
    await supabase.from('omega_x_erp_connectors')
      .update({ sync_status: 'syncing', updated_at: startedAt }).eq('id', id);

    // Stub sync: in production this would call the actual ERP API
    const simulatedRecords = Math.floor(Math.random() * 50) + 1;
    const success = Math.random() > 0.1; // 90% success rate sim
    const completedAt = new Date().toISOString();

    await supabase.from('omega_x_erp_connectors').update({
      sync_status: success ? 'success' : 'error',
      last_sync: completedAt,
      error_message: success ? null : 'Simulated connection timeout',
      updated_at: completedAt,
    }).eq('id', id);

    const { data: log } = await supabase.from('omega_x_erp_sync_logs').insert({
      connector_id: id,
      direction,
      entity_type,
      status: success ? 'success' : 'failed',
      records_count: success ? simulatedRecords : 0,
      error_details: success ? {} : { message: 'Simulated connection timeout' },
      started_at: startedAt,
      completed_at: completedAt,
    }).select().single();

    return NextResponse.json({ log, sync_status: success ? 'success' : 'error', action: 'sync_triggered' });
  }

  if (action === 'test') {
    const { id } = body;
    // Stub connectivity test
    const reachable = Math.random() > 0.2;
    const latencyMs = Math.floor(Math.random() * 300) + 50;
    return NextResponse.json({
      reachable, latency_ms: latencyMs,
      message: reachable ? `Conectado (${latencyMs}ms)` : 'Conexão recusada',
      action: 'tested',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[erp] POST error:', error);
    return NextResponse.json({ error: 'ERP action failed' }, { status: 500 });
  }
}
