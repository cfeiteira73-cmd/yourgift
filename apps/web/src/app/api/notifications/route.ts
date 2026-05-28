import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA FINAL — Unified Notification Center ─────────────────────────────────
//
// Persistent, typed, prioritised notifications for all platform events.
// Powers the realtime bell icon + dropdown in PortalLayout.
//
// GET  ?mode=list              — unread + recent notifications
// GET  ?mode=unread_count      — fast unread badge count
// GET  ?mode=all               — all notifications (paginated)
// POST { action:'create' }     — create notification (internal use)
// POST { action:'read' }       — mark notification as read
// POST { action:'read_all' }   — mark all as read
// POST { action:'dismiss' }    — dismiss notification
// POST { action:'broadcast' }  — send to all admins
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
  const mode = searchParams.get('mode') ?? 'list';
  const email = user.email ?? '';

  if (mode === 'unread_count') {
    const { count } = await supabase.from('omega_final_notifications')
      .select('id', { count: 'exact', head: true })
      .or(`user_email.eq.${email},user_email.is.null`)
      .is('read_at', null)
      .is('dismissed_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    return NextResponse.json({ count: count ?? 0 });
  }

  if (mode === 'list') {
    const { data } = await supabase.from('omega_final_notifications')
      .select('*')
      .or(`user_email.eq.${email},user_email.is.null`)
      .is('dismissed_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ notifications: data ?? [] });
  }

  if (mode === 'all') {
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
    const offset = parseInt(searchParams.get('offset') ?? '0');
    const category = searchParams.get('category');
    const type = searchParams.get('type');

    let q = supabase.from('omega_final_notifications')
      .select('*', { count: 'exact' })
      .or(`user_email.eq.${email},user_email.is.null`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (category) q = q.eq('category', category);
    if (type) q = q.eq('type', type);

    const { data, count } = await q;
    return NextResponse.json({ notifications: data ?? [], total: count ?? 0, offset, limit });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[notifications] GET error:', error);
    return NextResponse.json({ error: 'Notifications unavailable' }, { status: 500 });
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
    const {
      user_email, type = 'info', category, title, message,
      action_url, action_label, priority = 0, source, metadata, expires_at,
    } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_final_notifications').insert({
      user_email: user_email ?? null,
      type, category, title, message,
      action_url, action_label, priority, source, metadata: metadata ?? {},
      expires_at: expires_at ?? null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data, action: 'created' });
  }

  if (action === 'read') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_final_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id).is('read_at', null).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data, action: 'read' });
  }

  if (action === 'read_all') {
    const email = user.email ?? '';
    await supabase.from('omega_final_notifications')
      .update({ read_at: new Date().toISOString() })
      .or(`user_email.eq.${email},user_email.is.null`)
      .is('read_at', null);
    return NextResponse.json({ action: 'all_read' });
  }

  if (action === 'dismiss') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_final_notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data, action: 'dismissed' });
  }

  if (action === 'broadcast') {
    const { type = 'alert', category, title, message, action_url, action_label, priority = 2, source } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    // Broadcast = user_email NULL (all admins see it)
    const { data, error } = await supabase.from('omega_final_notifications').insert({
      user_email: null, type, category, title, message,
      action_url, action_label, priority, source, metadata: {},
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data, action: 'broadcast' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[notifications] POST error:', error);
    return NextResponse.json({ error: 'Notifications action failed' }, { status: 500 });
  }
}
