import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S12: Security + Governance — Immutable Audit Log ────────
//
// Every privileged action is logged to the audit trail.
// Admins can read all entries; clients can read only their own.
// Entries are write-once (append only) — never updated or deleted via API.
//
// GET  /api/audit?limit=50&since=ISO&actor=user_id&action=order_created
// POST /api/audit  { action, entityType, entityId, metadata? }
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// Allowed action types — strict allowlist prevents injection
const ALLOWED_ACTIONS = new Set([
  'order_created', 'order_status_changed', 'order_cancelled',
  'quote_submitted', 'quote_approved', 'quote_rejected', 'quote_converted',
  'invoice_paid', 'client_profile_updated', 'artwork_uploaded', 'artwork_approved',
  'settings_changed', 'login', 'logout', 'export_requested',
  'integration_tested', 'integration_toggled', 'supplier_scored',
  'cockpit_viewed', 'report_generated', 'portal_error',
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

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const params  = request.nextUrl.searchParams;
    const limit   = Math.min(parseInt(params.get('limit') ?? '50'), 200);
    const since   = params.get('since') ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const action  = params.get('action');
    const actorFilter = params.get('actor');

    // Only admins can query arbitrary actors
    if (actorFilter && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try to query audit_log table (graceful fallback if not yet created)
    let query = supabase
      .from('audit_log')
      .select('id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Scope to current user for non-admins
    if (!isAdmin) query = query.eq('actor_id', user.id);

    // Optional filters
    if (action) query = query.eq('action', action);
    if (actorFilter) query = query.eq('actor_id', actorFilter);

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet — return empty gracefully
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
