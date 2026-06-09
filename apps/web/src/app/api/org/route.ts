import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S15: Global Org & RBAC Engine ───────────────────────────────────
//
// Tenant-scoped organisation management: custom roles, member provisioning,
// SSO configuration, permission enforcement, and access governance.
//
// GET  ?mode=overview           — tenant overview: members, roles, SSO status
// GET  ?mode=members            — member list with role info
// GET  ?mode=roles              — custom role definitions + permissions
// GET  ?mode=sso                — SSO config for current tenant
// POST { action:'invite_member' } — invite user to org with role
// POST { action:'update_member' } — change member role/status
// POST { action:'remove_member' } — deactivate org member
// POST { action:'create_role' }   — define custom role with permissions
// POST { action:'update_role' }   — modify role permissions
// POST { action:'delete_role' }   — remove custom (non-system) role
// POST { action:'upsert_sso' }    — save SSO config for tenant
// POST { action:'toggle_sso' }    — enable/disable SSO
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
  const mode = searchParams.get('mode') ?? 'overview';
  const tenantId = searchParams.get('tenant_id');

  // ── Overview ──────────────────────────────────────────────────────────────
  if (mode === 'overview') {
    const [tenants, members, roles, sso] = await Promise.all([
      supabase.from('tenants').select('id, slug, name, plan, is_active, max_users, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('omega_x_org_members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('omega_x_org_roles')
        .select('id', { count: 'exact', head: true }),
      supabase.from('omega_x_sso_configs')
        .select('tenant_id, provider, enabled'),
    ]);

    const ssoEnabled = (sso.data ?? []).filter(s => s.enabled).length;

    return NextResponse.json({
      tenants: tenants.data ?? [],
      stats: {
        tenant_count: (tenants.data ?? []).length,
        active_members: members.count ?? 0,
        custom_roles: roles.count ?? 0,
        sso_enabled: ssoEnabled,
      },
      sso_configs: sso.data ?? [],
    });
  }

  // ── Members ───────────────────────────────────────────────────────────────
  if (mode === 'members') {
    let q = supabase.from('omega_x_org_members')
      .select('*, omega_x_org_roles(name, slug, permissions)')
      .order('created_at', { ascending: false });
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    return NextResponse.json({ members: data ?? [] });
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  if (mode === 'roles') {
    let q = supabase.from('omega_x_org_roles')
      .select('*')
      .order('is_system', { ascending: false });
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    return NextResponse.json({ roles: data ?? [] });
  }

  // ── SSO config ────────────────────────────────────────────────────────────
  if (mode === 'sso') {
    if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
    const { data } = await supabase.from('omega_x_sso_configs')
      .select('*').eq('tenant_id', tenantId).maybeSingle();
    return NextResponse.json({ sso: data ?? null });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[org] GET error:', error);
    return NextResponse.json({ error: 'Org unavailable' }, { status: 500 });
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

  // ── Invite member ─────────────────────────────────────────────────────────
  if (action === 'invite_member') {
    const { tenant_id, user_id, email, display_name, role_id, role_slug = 'member' } = body;
    if (!tenant_id || !email) {
      return NextResponse.json({ error: 'tenant_id and email required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('omega_x_org_members').upsert({
      tenant_id, user_id: user_id ?? null, email, display_name,
      role_id: role_id ?? null, role_slug,
      status: 'invited',
      invited_by: user.email,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,user_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data, action: 'invited' });
  }

  // ── Update member ─────────────────────────────────────────────────────────
  if (action === 'update_member') {
    const { id, role_id, role_slug, status } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (role_id !== undefined) updates.role_id = role_id;
    if (role_slug !== undefined) updates.role_slug = role_slug;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase.from('omega_x_org_members')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data, action: 'updated' });
  }

  // ── Remove member ─────────────────────────────────────────────────────────
  if (action === 'remove_member') {
    const { id } = body;
    const { data, error } = await supabase.from('omega_x_org_members')
      .update({ status: 'deactivated' }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data, action: 'removed' });
  }

  // ── Create role ───────────────────────────────────────────────────────────
  if (action === 'create_role') {
    const { tenant_id, name, slug, description, permissions = [] } = body;
    if (!tenant_id || !name || !slug) {
      return NextResponse.json({ error: 'tenant_id, name, slug required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('omega_x_org_roles').insert({
      tenant_id, name, slug, description, permissions,
      is_system: false, created_by: user.email,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ role: data, action: 'created' });
  }

  // ── Update role ───────────────────────────────────────────────────────────
  if (action === 'update_role') {
    const { id, name, description, permissions } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Cannot modify system roles' permissions
    const { data: existing } = await supabase.from('omega_x_org_roles')
      .select('is_system').eq('id', id).single();
    if (existing?.is_system && permissions !== undefined) {
      return NextResponse.json({ error: 'Cannot modify system role permissions' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (permissions !== undefined) updates.permissions = permissions;

    const { data, error } = await supabase.from('omega_x_org_roles')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ role: data, action: 'updated' });
  }

  // ── Delete role ───────────────────────────────────────────────────────────
  if (action === 'delete_role') {
    const { id } = body;
    const { data: role } = await supabase.from('omega_x_org_roles')
      .select('is_system').eq('id', id).single();
    if (role?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system role' }, { status: 403 });
    }
    const { error } = await supabase.from('omega_x_org_roles').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: 'deleted' });
  }

  // ── Upsert SSO config ─────────────────────────────────────────────────────
  if (action === 'upsert_sso') {
    const { tenant_id, provider, client_id, discovery_url, metadata_xml, attribute_map, domain_hints } = body;
    if (!tenant_id || !provider) {
      return NextResponse.json({ error: 'tenant_id and provider required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('omega_x_sso_configs').upsert({
      tenant_id, provider, client_id, discovery_url, metadata_xml,
      attribute_map: attribute_map ?? {},
      domain_hints: domain_hints ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sso: data, action: 'saved' });
  }

  // ── Toggle SSO ────────────────────────────────────────────────────────────
  if (action === 'toggle_sso') {
    const { tenant_id, enabled } = body;
    const { data, error } = await supabase.from('omega_x_sso_configs')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sso: data, action: enabled ? 'sso_enabled' : 'sso_disabled' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[org] POST error:', error);
    return NextResponse.json({ error: 'Org action failed' }, { status: 500 });
  }
}
