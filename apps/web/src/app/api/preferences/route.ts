import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S18: UX Preferences & Command History ──────────────────────────
//
// Per-user UX preferences (theme, density, pinned pages, shortcuts, dashboard
// widget layout) and command palette history for instant recall.
//
// GET  (no params)               — load current user's preferences
// POST { action:'save' }         — upsert preferences
// POST { action:'pin_page' }     — add page to pinned list
// POST { action:'unpin_page' }   — remove page from pinned list
// POST { action:'track_command' }— record command palette usage
// POST { action:'clear_history' }— clear command history
// GET  ?mode=commands            — recent + frequent commands
//
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode');

  // ── Command history ───────────────────────────────────────────────────────
  if (mode === 'commands') {
    const { data } = await supabase.from('omega_x_command_history')
      .select('command, label, href, action_type, used_count, last_used')
      .eq('user_id', user.id)
      .order('last_used', { ascending: false })
      .limit(20);
    return NextResponse.json({ commands: data ?? [] });
  }

  // ── Preferences ───────────────────────────────────────────────────────────
  const { data } = await supabase.from('omega_x_user_preferences')
    .select('*').eq('user_id', user.id).maybeSingle();

  // Return defaults if not set yet
  const defaults = {
    user_id: user.id,
    theme: 'dark',
    density: 'comfortable',
    language: 'pt',
    nav_collapsed: false,
    pinned_pages: [],
    shortcuts: {},
    dashboard_widgets: {},
    notifications: {},
    tour_completed: [],
  };

  return NextResponse.json({ preferences: data ?? defaults });
  } catch (error) {
    console.error('[preferences] GET error:', error);
    return NextResponse.json({ error: 'Preferences unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Save preferences ──────────────────────────────────────────────────────
  if (action === 'save') {
    const { theme, density, language, nav_collapsed, pinned_pages,
      shortcuts, dashboard_widgets, notifications, tour_completed } = body;

    const updates: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (theme !== undefined) updates.theme = theme;
    if (density !== undefined) updates.density = density;
    if (language !== undefined) updates.language = language;
    if (nav_collapsed !== undefined) updates.nav_collapsed = nav_collapsed;
    if (pinned_pages !== undefined) updates.pinned_pages = pinned_pages;
    if (shortcuts !== undefined) updates.shortcuts = shortcuts;
    if (dashboard_widgets !== undefined) updates.dashboard_widgets = dashboard_widgets;
    if (notifications !== undefined) updates.notifications = notifications;
    if (tour_completed !== undefined) updates.tour_completed = tour_completed;

    const { data, error } = await supabase.from('omega_x_user_preferences')
      .upsert(updates, { onConflict: 'user_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ preferences: data, action: 'saved' });
  }

  // ── Pin page ──────────────────────────────────────────────────────────────
  if (action === 'pin_page') {
    const { href } = body;
    const { data: existing } = await supabase.from('omega_x_user_preferences')
      .select('pinned_pages').eq('user_id', user.id).maybeSingle();

    const current: string[] = (existing?.pinned_pages as string[]) ?? [];
    if (!current.includes(href)) current.push(href);

    const { data, error } = await supabase.from('omega_x_user_preferences')
      .upsert({ user_id: user.id, pinned_pages: current, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pinned_pages: data.pinned_pages, action: 'pinned' });
  }

  // ── Unpin page ────────────────────────────────────────────────────────────
  if (action === 'unpin_page') {
    const { href } = body;
    const { data: existing } = await supabase.from('omega_x_user_preferences')
      .select('pinned_pages').eq('user_id', user.id).maybeSingle();

    const current: string[] = ((existing?.pinned_pages as string[]) ?? []).filter(p => p !== href);

    const { data, error } = await supabase.from('omega_x_user_preferences')
      .upsert({ user_id: user.id, pinned_pages: current, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pinned_pages: data.pinned_pages, action: 'unpinned' });
  }

  // ── Track command ─────────────────────────────────────────────────────────
  if (action === 'track_command') {
    const { command, label, href, action_type = 'navigate' } = body;
    if (!command) return NextResponse.json({ error: 'command required' }, { status: 400 });

    // Upsert with increment on used_count
    const { data: existing } = await supabase.from('omega_x_command_history')
      .select('id, used_count').eq('user_id', user.id).eq('command', command).maybeSingle();

    if (existing) {
      await supabase.from('omega_x_command_history')
        .update({ used_count: (existing.used_count ?? 1) + 1, last_used: new Date().toISOString(), label, href })
        .eq('id', existing.id);
    } else {
      await supabase.from('omega_x_command_history')
        .insert({ user_id: user.id, command, label, href, action_type, used_count: 1 });
    }

    return NextResponse.json({ action: 'tracked' });
  }

  // ── Clear history ─────────────────────────────────────────────────────────
  if (action === 'clear_history') {
    await supabase.from('omega_x_command_history').delete().eq('user_id', user.id);
    return NextResponse.json({ action: 'cleared' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[preferences] POST error:', error);
    return NextResponse.json({ error: 'Preferences action failed' }, { status: 500 });
  }
}
