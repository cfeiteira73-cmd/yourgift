import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA PROTOCOL — S4: Artwork Intelligence — Approval Engine ───────────────
//
// Manages artwork submissions, version history, and approval chains.
// Admin can approve/reject/request-revision; clients can submit new versions.
// Tables: artwork_submissions, artwork_versions, artwork_comments
//
// GET  ?mode=list                — list submissions (admin=all, client=own)
// GET  ?mode=detail&id=...       — single submission with versions + comments
// POST { action:'submit', ...}   — new submission or new version
// POST { action:'approve', ...}  — admin approval
// POST { action:'revision', ...} — admin requests revision
// POST { action:'reject', ...}   — admin rejection
// POST { action:'comment', ...}  — add comment to submission
//
// ─────────────────────────────────────────────────────────────────────────────


const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:             ['submitted'],
  submitted:         ['in_review', 'approved', 'revision_requested', 'rejected'],
  in_review:         ['approved', 'revision_requested', 'rejected'],
  revision_requested:['submitted'],
  approved:          [],
  rejected:          [],
};

// Graceful table existence check
async function tableExists(supabase: Awaited<ReturnType<typeof createClient>>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select('id').limit(1);
  return !error || error.code !== '42P01';
}

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';
  const id   = searchParams.get('id');

  // ── Detail view ────────────────────────────────────────────────────────────
  if (mode === 'detail' && id) {
    const exists = await tableExists(supabase, 'artwork_submissions');
    if (!exists) return NextResponse.json({ submission: null, reason: 'table_pending' });

    const subQuery = supabase
      .from('artwork_submissions')
      .select('*')
      .eq('id', id);
    if (!isAdmin) subQuery.eq('submitted_by', user.id);

    const { data: sub, error: subErr } = await subQuery.single();
    if (subErr || !sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [versionsRes, commentsRes] = await Promise.all([
      supabase.from('artwork_versions').select('*').eq('submission_id', id).order('version_number', { ascending: true }),
      supabase.from('artwork_comments').select('*').eq('submission_id', id).order('created_at', { ascending: true }),
    ]);

    return NextResponse.json({
      submission: sub,
      versions:  versionsRes.data ?? [],
      comments:  commentsRes.data ?? [],
    });
  }

  // ── List view ──────────────────────────────────────────────────────────────
  const exists = await tableExists(supabase, 'artwork_submissions');
  if (!exists) return NextResponse.json({ submissions: [], reason: 'table_pending' });

  const statusFilter = searchParams.get('status');
  let query = supabase
    .from('artwork_submissions')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .limit(50);

  if (!isAdmin) query = query.eq('submitted_by', user.id);
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ submissions: data ?? [], total: count ?? 0, isAdmin });
  } catch (error) {
    console.error('[artwork] GET error:', error);
    return NextResponse.json({ error: 'Artwork service unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Submit new artwork or new version ──────────────────────────────────────
  if (action === 'submit') {
    const { order_id, title, file_url, file_type, file_size, notes, parent_id } = body;
    if (!file_url || !title) return NextResponse.json({ error: 'file_url and title required' }, { status: 400 });

    // Get client record
    const { data: client } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();

    if (parent_id) {
      // New version of existing submission
      const { data: parent } = await supabase.from('artwork_submissions').select('version_count').eq('id', parent_id).single();
      const nextVersion = ((parent?.version_count ?? 1)) + 1;

      // Insert version record
      await supabase.from('artwork_versions').insert({
        submission_id: parent_id,
        version_number: nextVersion,
        file_url, file_type, file_size,
        uploaded_by: user.id,
        notes,
      });

      // Update parent submission
      const { data: updated, error } = await supabase
        .from('artwork_submissions')
        .update({ status: 'submitted', version_count: nextVersion, file_url, updated_at: new Date().toISOString() })
        .eq('id', parent_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ submission: updated, action: 'new_version' });
    }

    // Brand new submission
    const { data: submission, error } = await supabase
      .from('artwork_submissions')
      .insert({
        order_id: order_id ?? null,
        client_id: client?.id ?? null,
        submitted_by: user.id,
        submitter_email: user.email,
        title,
        file_url,
        file_type: file_type ?? 'image/png',
        file_size: file_size ?? 0,
        notes: notes ?? '',
        status: 'submitted',
        version_count: 1,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Insert first version record
    await supabase.from('artwork_versions').insert({
      submission_id: submission.id,
      version_number: 1,
      file_url,
      file_type: file_type ?? 'image/png',
      file_size: file_size ?? 0,
      uploaded_by: user.id,
      notes,
    });

    return NextResponse.json({ submission, action: 'created' });
  }

  // ── Admin-only actions ─────────────────────────────────────────────────────
  if (['approve', 'revision', 'reject'].includes(action)) {
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { submission_id, note } = body;
    if (!submission_id) return NextResponse.json({ error: 'submission_id required' }, { status: 400 });

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested';

    // Validate transition
    const { data: current } = await supabase.from('artwork_submissions').select('status').eq('id', submission_id).single();
    const allowed = STATUS_TRANSITIONS[current?.status ?? ''] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: `Cannot transition from ${current?.status} to ${newStatus}` }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('artwork_submissions')
      .update({
        status: newStatus,
        review_note: note ?? null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-comment for admin actions
    if (note) {
      await supabase.from('artwork_comments').insert({
        submission_id,
        author_id: user.id,
        author_email: user.email,
        content: `[${newStatus.toUpperCase()}] ${note}`,
        is_admin: true,
      });
    }

    return NextResponse.json({ submission: updated, action: newStatus });
  }

  // ── Add comment ────────────────────────────────────────────────────────────
  if (action === 'comment') {
    const { submission_id, content } = body;
    if (!submission_id || !content?.trim()) return NextResponse.json({ error: 'submission_id and content required' }, { status: 400 });

    const { data: comment, error } = await supabase
      .from('artwork_comments')
      .insert({
        submission_id,
        author_id: user.id,
        author_email: user.email,
        content: content.trim(),
        is_admin: isAdmin,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment, action: 'commented' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[artwork] POST error:', error);
    return NextResponse.json({ error: 'Artwork action failed' }, { status: 500 });
  }
}
