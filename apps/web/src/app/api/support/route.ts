import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S11: Enterprise Operations — Support Center ──────────────
//
// Ticket management, incident tracking, SLA escalation engine.
// Clients submit and track support tickets.
// Admins see all tickets, triage, escalate, resolve.
//
// GET  /api/support?status=open|resolved|all&limit=20
// POST /api/support  { subject, body, priority, category, entityId? }
// PATCH /api/support/:id  { status, assignee, resolution, priority }
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
const VALID_CATEGORIES = ['order', 'quote', 'billing', 'product', 'artwork', 'technical', 'other'] as const;
const VALID_STATUSES   = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;

type TicketPriority = typeof VALID_PRIORITIES[number];
type TicketCategory = typeof VALID_CATEGORIES[number];
type TicketStatus   = typeof VALID_STATUSES[number];

// SLA response targets (hours) by priority
const SLA_TARGETS: Record<TicketPriority, { first_response: number; resolution: number }> = {
  critical: { first_response: 1,  resolution: 4  },
  high:     { first_response: 4,  resolution: 24 },
  normal:   { first_response: 8,  resolution: 72 },
  low:      { first_response: 24, resolution: 168 },
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const params = request.nextUrl.searchParams;
    const statusFilter = params.get('status') ?? 'open';
    const limit = Math.min(parseInt(params.get('limit') ?? '20'), 100);

    let query = supabase
      .from('support_tickets')
      .select('id, subject, body, priority, category, status, created_at, updated_at, actor_id, actor_email, assignee_email, resolution, entity_id, sla_due_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!isAdmin) query = query.eq('actor_id', user.id);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ tickets: [], total: 0, note: 'support_tickets table pending' });
      }
      throw error;
    }

    // Compute SLA breach for each open ticket
    const now = Date.now();
    const enriched = (data ?? []).map(ticket => {
      const slaDue = ticket.sla_due_at ? new Date(ticket.sla_due_at).getTime() : null;
      const breached = slaDue && now > slaDue && !['resolved', 'closed'].includes(ticket.status);
      const hoursElapsed = (now - new Date(ticket.created_at).getTime()) / 3600000;
      const slaTargets = SLA_TARGETS[(ticket.priority as TicketPriority) ?? 'normal'];
      return {
        ...ticket,
        slaBreached: !!breached,
        hoursOpen: Math.round(hoursElapsed),
        slaTargets,
      };
    });

    return NextResponse.json({
      tickets: enriched,
      total: enriched.length,
      isAdmin,
      slaTargets: SLA_TARGETS,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[support] GET error:', error);
    return NextResponse.json({ error: 'Support center unavailable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      subject?: string;
      body?: string;
      priority?: string;
      category?: string;
      entity_id?: string;
    };

    // Validate
    if (!body.subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 });
    if (!body.body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });

    const priority = (VALID_PRIORITIES.includes(body.priority as TicketPriority) ? body.priority : 'normal') as TicketPriority;
    const category = (VALID_CATEGORIES.includes(body.category as TicketCategory) ? body.category : 'other') as TicketCategory;

    // Compute SLA due date
    const slaTarget = SLA_TARGETS[priority];
    const slaDueAt = new Date(Date.now() + slaTarget.first_response * 3600000).toISOString();

    const ticket = {
      subject:     body.subject.trim().slice(0, 200),
      body:        body.body.trim().slice(0, 5000),
      priority,
      category,
      status:      'open' as TicketStatus,
      actor_id:    user.id,
      actor_email: user.email ?? '',
      entity_id:   body.entity_id ?? null,
      sla_due_at:  slaDueAt,
    };

    const { data, error } = await supabase.from('support_tickets').insert(ticket).select().single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ ok: true, logged: false, reason: 'table_pending', ticket });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, ticket: data }, { status: 201 });

  } catch (error) {
    console.error('[support] POST error:', error);
    return NextResponse.json({ error: 'Ticket creation failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await request.json() as {
      id?: string;
      status?: string;
      priority?: string;
      assignee_email?: string;
      resolution?: string;
    };

    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status && VALID_STATUSES.includes(body.status as TicketStatus)) update.status = body.status;
    if (body.priority && VALID_PRIORITIES.includes(body.priority as TicketPriority)) update.priority = body.priority;
    if (body.assignee_email) update.assignee_email = body.assignee_email;
    if (body.resolution) update.resolution = body.resolution.slice(0, 2000);

    const { data, error } = await supabase.from('support_tickets').update(update).eq('id', body.id).select().single();

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ok: true, logged: false, reason: 'table_pending' });
      throw error;
    }

    return NextResponse.json({ ok: true, ticket: data });

  } catch (error) {
    console.error('[support] PATCH error:', error);
    return NextResponse.json({ error: 'Ticket update failed' }, { status: 500 });
  }
}
