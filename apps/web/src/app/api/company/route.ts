import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { parseBody, OrgActionSchema } from '@/lib/schemas';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

// ── Multi-user Company Membership API ─────────────────────────────────────────
//
// Allows B2B clients to invite team members to their company account.
// Built on the company_members table (migration below).
//
// GET  ?mode=members              — list members of the caller's company
// GET  ?mode=invites              — pending invites for caller's company
// POST { action:'invite_member', email, role }    — invite by email
// POST { action:'remove_member', memberId }       — remove member
// POST { action:'update_member_role', memberId, role }
// POST { action:'accept_invite', token }          — accept invite (unauthenticated-friendly)
//
// Schema (create in Supabase):
//   company_members (
//     id          uuid PK default gen_random_uuid(),
//     company_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
//     user_id     uuid REFERENCES auth.users(id),
//     email       text NOT NULL,
//     role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
//     status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','removed')),
//     invited_by  uuid REFERENCES auth.users(id),
//     invite_token text UNIQUE,
//     invite_expires_at timestamptz,
//     joined_at   timestamptz,
//     created_at  timestamptz DEFAULT now(),
//     updated_at  timestamptz DEFAULT now()
//   );
//   CREATE INDEX ON company_members(company_id);
//   CREATE INDEX ON company_members(email);
//   CREATE UNIQUE INDEX ON company_members(company_id, email) WHERE status != 'removed';
//
// ─────────────────────────────────────────────────────────────────────────────

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/** Generate a secure invite token */
function genToken(email: string, companyId: string): string {
  const raw = `${email}:${companyId}:${Date.now()}:${Math.random()}`;
  return createHash('sha256').update(raw).digest('hex');
}

/** Get the authenticated user's client (company) record */
async function getCallerClient(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('clients')
    .select('id, name, company, tier')
    .eq('auth_user_id', userId)
    .single();
  return data as { id: string; name: string | null; company: string | null; tier: string | null } | null;
}

/** Check if caller is admin of their company */
async function isMemberAdmin(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return (data as { role: string } | null)?.role === 'admin';
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await getCallerClient(supabase, user.id);
  if (!client) return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });

  const mode = req.nextUrl.searchParams.get('mode') ?? 'members';

  try {
    if (mode === 'members') {
      const { data: members } = await supabase
        .from('company_members')
        .select('id, email, role, status, joined_at, created_at')
        .eq('company_id', client.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      return NextResponse.json({
        companyId: client.id,
        companyName: client.company ?? client.name,
        members: members ?? [],
        total: (members ?? []).length,
      });
    }

    if (mode === 'invites') {
      const { data: invites } = await supabase
        .from('company_members')
        .select('id, email, role, invite_expires_at, created_at')
        .eq('company_id', client.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return NextResponse.json({ invites: invites ?? [] });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[company GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = parseBody(OrgActionSchema, rawBody);
  if (!parsed.ok) return parsed.response;

  const action = parsed.data;
  const db = getAdminDb() ?? supabase;

  try {
    // ── accept_invite — can be called before login, just needs token ──────────
    if (action.action === 'accept_invite') {
      const { token } = action;
      const { data: invite } = await db
        .from('company_members')
        .select('id, company_id, email, role, status, invite_expires_at')
        .eq('invite_token', token)
        .single();

      if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
      const inv = invite as { id: string; company_id: string; email: string; role: string; status: string; invite_expires_at: string | null };
      if (inv.status !== 'pending') return NextResponse.json({ error: 'Invite already used' }, { status: 409 });
      if (inv.invite_expires_at && new Date(inv.invite_expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
      }

      await db.from('company_members').update({
        status: 'active',
        user_id: user.id,
        joined_at: new Date().toISOString(),
        invite_token: null,
        updated_at: new Date().toISOString(),
      }).eq('id', inv.id);

      return NextResponse.json({ ok: true, companyId: inv.company_id, role: inv.role });
    }

    // All other actions require caller to have a client profile
    const client = await getCallerClient(supabase, user.id);
    if (!client) return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });

    // ── invite_member ─────────────────────────────────────────────────────────
    if (action.action === 'invite_member') {
      const { email, role } = action;

      // Check caller is admin (or the company owner = only member)
      const { count: memberCount } = await db
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', client.id)
        .eq('status', 'active');

      if ((memberCount ?? 0) > 0) {
        const isAdmin = await isMemberAdmin(supabase, client.id, user.id);
        if (!isAdmin) return NextResponse.json({ error: 'Only admins can invite members' }, { status: 403 });
      }

      // Check for existing active invite
      const { data: existing } = await db
        .from('company_members')
        .select('id, status')
        .eq('company_id', client.id)
        .eq('email', email.toLowerCase())
        .single();

      if (existing && (existing as { status: string }).status !== 'removed') {
        return NextResponse.json({ error: 'User already a member or has pending invite' }, { status: 409 });
      }

      const token = genToken(email, client.id);
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); // 7 days

      await db.from('company_members').upsert({
        company_id: client.id,
        email: email.toLowerCase(),
        role,
        status: 'pending',
        invited_by: user.id,
        invite_token: token,
        invite_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,email' });

      await db.from('omega_final_audit_log').insert({
        entity_type: 'company',
        entity_id: client.id,
        action: 'member_invited',
        performed_by: user.id,
        metadata: { email, role, token_prefix: token.slice(0, 8) },
      });

      // Send invite email via Resend
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt'}/join?token=${token}`;
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'YourGift <noreply@yourgift.pt>',
              to: [email],
              subject: `Convite para a empresa ${client.company ?? 'YourGift'}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2>Convite para a equipa</h2>
                <p>Foi convidado para juntar-se à empresa <strong>${client.company ?? 'YourGift'}</strong> na plataforma YourGift como <strong>${role}</strong>.</p>
                <p><a href="${inviteUrl}" style="background:#4da3ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Aceitar convite</a></p>
                <p style="color:#666;font-size:12px">Este convite expira em 7 dias. Se não esperava este convite, pode ignorar este email.</p>
              </div>`,
            }),
          });
        } catch (emailErr) {
          console.warn('[company invite] Email failed (non-blocking):', emailErr);
        }
      }

      return NextResponse.json({
        ok: true,
        inviteToken: token,
        expiresAt,
        inviteUrl,
      });
    }

    // ── remove_member ─────────────────────────────────────────────────────────
    if (action.action === 'remove_member') {
      const { memberId } = action;
      const isAdmin = await isMemberAdmin(supabase, client.id, user.id);
      if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

      const { error } = await db.from('company_members')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('company_id', client.id); // ensure it belongs to caller's company

      if (error) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

      await db.from('omega_final_audit_log').insert({
        entity_type: 'company',
        entity_id: client.id,
        action: 'member_removed',
        performed_by: user.id,
        metadata: { memberId },
      });

      return NextResponse.json({ ok: true });
    }

    // ── update_member_role ────────────────────────────────────────────────────
    if (action.action === 'update_member_role') {
      const { memberId, role } = action;
      const isAdmin = await isMemberAdmin(supabase, client.id, user.id);
      if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

      await db.from('company_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('company_id', client.id);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[company POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
