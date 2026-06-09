import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA PROTOCOL — S12: Security + Governance — Immutable Audit Log ────────
//
// Every privileged action is logged to the audit trail.
// Admins can read all entries; clients can read only their own.
// Entries are write-once (append only) — never updated or deleted via API.
//
// GET  /api/audit?limit=50&since=ISO&actor=user_id&action=order_created
// GET  /api/audit?mode=trail&limit=50&offset=0&result=error  (activity page)
// GET  /api/audit?mode=stats                                 (activity page stats)
// POST /api/audit  { action, entityType, entityId, metadata? }
//
// ─────────────────────────────────────────────────────────────────────────────


// Allowed action types — strict allowlist prevents injection
const ALLOWED_ACTIONS = new Set([
  'order_created', 'order_status_changed', 'order_cancelled',
  'quote_submitted', 'quote_approved', 'quote_rejected', 'quote_converted',
  'invoice_paid', 'client_profile_updated', 'artwork_uploaded', 'artwork_approved',
  'settings_changed', 'login', 'logout', 'export_requested',
  'integration_tested', 'integration_toggled', 'supplier_scored',
  'cockpit_viewed', 'report_generated', 'portal_error',
  'ai_request', 'webhook_registered', 'webhook_deleted', 'rate_limit_exceeded',
  'payment_initiated', 'payment_confirmed', 'dispute_opened', 'dispute_resolved',
]);

type AuditEntry = {
  id?: string;
  actor_id: string;
  actor_email: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  created_at?: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = isAdminEmail(user.email);
    const params  = request.nextUrl.searchParams;
    const mode    = params.get('mode') ?? 'list';

    // ── Mode: stats (for Activity Stream sidebar) ───────────────────────────
    if (mode === 'stats') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekAgo    = new Date(Date.now() - 7 * 86400000);

      const [todayRes, weekRes, topRes] = await Promise.all([
        supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('audit_log').select('action').gte('created_at', weekAgo.toISOString()).limit(500),
      ]);

      if (topRes.error?.code === '42P01') {
        return NextResponse.json({ today: 0, week: 0, top_actions: [], results: { success: 0, error: 0 } });
      }

      // Compute top actions + error count from raw data
      const actionCounts: Record<string, number> = {};
      let errorCount = 0;
      for (const row of topRes.data ?? []) {
        actionCounts[row.action] = (actionCounts[row.action] ?? 0) + 1;
        if (row.action === 'portal_error') errorCount++;
      }
      const top_actions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const weekTotal = weekRes.count ?? 0;

      return NextResponse.json({
        today: todayRes.count ?? 0,
        week: weekTotal,
        top_actions,
        results: { success: weekTotal - errorCount, error: errorCount },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Mode: trail (for Activity Stream list, with offset pagination) ──────
    if (mode === 'trail') {
      const limit  = Math.min(parseInt(params.get('limit') ?? '50'), 200);
      const offset = Math.max(parseInt(params.get('offset') ?? '0'), 0);
      const resultFilter = params.get('result'); // 'error' filter (future: portal_error action)

      let query = supabase
        .from('audit_log')
        .select('id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (!isAdmin) query = query.eq('actor_id', user.id);
      if (resultFilter === 'error') query = query.eq('action', 'portal_error');

      const { data, error, count } = await query;
      if (error) {
        if (error.code === '42P01') return NextResponse.json({ trail: [], total: 0 });
        throw error;
      }

      // Map actor_email → user_email; add synthetic result/duration_ms fields
      const trail = (data ?? []).map(e => ({
        ...e,
        user_email: e.actor_email,
        result: e.action === 'portal_error' ? 'error' : 'success',
        duration_ms: null,
      }));

      return NextResponse.json({ trail, total: count ?? 0, generatedAt: new Date().toISOString() });
    }

    // ── Mode: export CSV (admin only) ────────────────────────────────────────
    if (mode === 'export') {
      if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

      const since    = params.get('since') ?? new Date(Date.now() - 90 * 86400000).toISOString();
      const action   = params.get('action');

      let query = supabase
        .from('audit_log')
        .select('id, actor_email, action, entity_type, entity_id, metadata, ip, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000); // Max 5000 rows per export

      if (action) query = query.eq('action', action);

      const { data, error: exportErr } = await query;
      if (exportErr) {
        if (exportErr.code === '42P01') return new Response('No audit data', { status: 404 });
        throw exportErr;
      }

      const rows = data ?? [];
      const header = 'id,timestamp,actor_email,action,entity_type,entity_id,ip,metadata\n';
      const csvRows = rows.map(r =>
        [
          r.id,
          r.created_at,
          `"${(r.actor_email ?? '').replace(/"/g, '""')}"`,
          r.action,
          r.entity_type ?? '',
          r.entity_id ?? '',
          r.ip ?? '',
          `"${JSON.stringify(r.metadata ?? {}).replace(/"/g, '""')}"`,
        ].join(',')
      ).join('\n');

      const filename = `yourgift-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response(header + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── Default mode: list (for Audit Trail page) ────────────────────────────
    const limit       = Math.min(parseInt(params.get('limit') ?? '50'), 200);
    const since       = params.get('since') ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const action      = params.get('action');
    const actorFilter = params.get('actor');

    if (actorFilter && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('audit_log')
      .select('id, actor_id, actor_email, action, entity_type, entity_id, metadata, ip, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!isAdmin) query = query.eq('actor_id', user.id);
    if (action) query = query.eq('action', action);
    if (actorFilter) query = query.eq('actor_id', actorFilter);

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ entries: [], total: 0, note: 'audit_log table not yet created' });
      }
      throw error;
    }

    return NextResponse.json({
      entries: data ?? [],
      total: (data ?? []).length,
      isAdmin,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[audit] GET error:', error);
    return NextResponse.json({ error: 'Audit log unavailable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as Partial<AuditEntry> & { action?: string };

    // Validate action
    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    const entry: AuditEntry = {
      actor_id:    user.id,
      actor_email: user.email ?? '',
      action:      body.action,
      entity_type: body.entity_type,
      entity_id:   body.entity_id,
      metadata:    body.metadata,
      ip:          request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      user_agent:  request.headers.get('user-agent') ?? undefined,
    };

    // Attempt insert — graceful fallback if table doesn't exist
    const { error } = await supabase.from('audit_log').insert(entry);

    if (error) {
      if (error.code === '42P01') {
        // Table not created yet — acknowledge without error (idempotent)
        return NextResponse.json({ ok: true, logged: false, reason: 'table_pending' });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, logged: true });

  } catch (error) {
    console.error('[audit] POST error:', error);
    return NextResponse.json({ error: 'Audit logging failed' }, { status: 500 });
  }
}
