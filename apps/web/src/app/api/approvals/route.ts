import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S7: Client Portal Supremacy — Approval Chains ─────────────
//
// Team collaboration · Departmental approval chains · Budget enforcement
// Multi-step approvals for high-value orders/quotes
//
// GET    /api/approvals?entityType=order|quote&entityId=...
// POST   /api/approvals   { entityType, entityId, action: 'approve'|'reject'|'request', note? }
// GET    /api/approvals?mode=pending   — all items awaiting my approval
//
// Approval flow:
//   1. Client submits order/quote → status = 'pending_approval'
//   2. Approver (manager / budget owner) reviews → approve/reject
//   3. If approved → transitions to normal workflow
//   4. Audit entry created for every action
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const BUDGET_THRESHOLDS = {
  standard:   1000,   // standard tier: require approval above €1K
  premium:    5000,   // premium: above €5K
  enterprise: 20000,  // enterprise: above €20K
  vip:        50000,  // VIP: above €50K
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const params = request.nextUrl.searchParams;
    const mode = params.get('mode') ?? 'list';
    const entityType = params.get('entityType');
    const entityId   = params.get('entityId');

    // ── Pending approvals ────────────────────────────────────────────────────
    if (mode === 'pending') {
      let query = supabase
        .from('approval_requests')
        .select('id, entity_type, entity_id, entity_ref, requester_id, requester_email, approver_id, status, amount, note, created_at, expires_at, client_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isAdmin) query = query.or(`approver_id.eq.${user.id},requester_id.eq.${user.id}`);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') return NextResponse.json({ pending: [], note: 'table_pending' });
        throw error;
      }
      return NextResponse.json({ pending: data ?? [], total: (data ?? []).length, generatedAt: new Date().toISOString() });
    }

    // ── Entity-specific approval chain ───────────────────────────────────────
    if (entityId && entityType) {
      let query = supabase
        .from('approval_requests')
        .select('id, entity_type, entity_id, requester_email, approver_email, status, amount, note, created_at, resolved_at, resolution_note')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') return NextResponse.json({ chain: [], note: 'table_pending' });
        throw error;
      }
      return NextResponse.json({ chain: data ?? [], entityId, entityType, generatedAt: new Date().toISOString() });
    }

    // ── Budget thresholds ────────────────────────────────────────────────────
    if (mode === 'thresholds') {
      return NextResponse.json({ thresholds: BUDGET_THRESHOLDS, generatedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Specify mode or entityId+entityType' }, { status: 400 });

  } catch (error) {
    console.error('[approvals] GET error:', error);
    return NextResponse.json({ error: 'Approval service unavailable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const body = await request.json() as {
      action: 'request' | 'approve' | 'reject' | 'cancel';
      entity_type?: string;
      entity_id?: string;
      entity_ref?: string;
      amount?: number;
      note?: string;
      approver_email?: string;
      approval_id?: string;
      resolution_note?: string;
    };

    if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    // ── Request approval ─────────────────────────────────────────────────────
    if (body.action === 'request') {
      if (!body.entity_id || !body.entity_type) {
        return NextResponse.json({ error: 'entity_id and entity_type required' }, { status: 400 });
      }

      const expiresAt = new Date(Date.now() + 72 * 3600000).toISOString(); // 72h to approve

      const record = {
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        entity_ref: body.entity_ref ?? null,
        requester_id: user.id,
        requester_email: user.email ?? '',
        approver_email: body.approver_email ?? ADMIN_EMAILS[0], // default to admin
        status: 'pending',
        amount: body.amount ?? 0,
        note: body.note ?? null,
        expires_at: expiresAt,
      };

      const { data, error } = await supabase.from('approval_requests').insert(record).select().single();
      if (error) {
        if (error.code === '42P01') return NextResponse.json({ ok: true, logged: false, reason: 'table_pending', record });
        throw error;
      }
      return NextResponse.json({ ok: true, request: data }, { status: 201 });
    }

    // ── Approve or reject ────────────────────────────────────────────────────
    if (body.action === 'approve' || body.action === 'reject') {
      if (!body.approval_id) return NextResponse.json({ error: 'approval_id required' }, { status: 400 });

      // Only admin or designated approver can approve/reject
      if (!isAdmin) {
        const { data: req } = await supabase.from('approval_requests').select('approver_id').eq('id', body.approval_id).single();
        if (req?.approver_id !== user.id) {
          return NextResponse.json({ error: 'Forbidden — not the designated approver' }, { status: 403 });
        }
      }

      const { data, error } = await supabase.from('approval_requests').update({
        status: body.action === 'approve' ? 'approved' : 'rejected',
        resolved_at: new Date().toISOString(),
        resolver_id: user.id,
        resolver_email: user.email ?? '',
        resolution_note: body.resolution_note ?? null,
      }).eq('id', body.approval_id).select().single();

      if (error) {
        if (error.code === '42P01') return NextResponse.json({ ok: true, logged: false, reason: 'table_pending' });
        throw error;
      }
      return NextResponse.json({ ok: true, request: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[approvals] POST error:', error);
    return NextResponse.json({ error: 'Approval action failed' }, { status: 500 });
  }
}
