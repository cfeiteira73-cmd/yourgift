'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, springSnappy } from '@/lib/motion';

// ── OMEGA X — S15: Org & RBAC Management ─────────────────────────────────────

type Tenant = {
  id: string; slug: string; name: string;
  plan: string; is_active: boolean; max_users: number; created_at: string;
};

type Member = {
  id: string; tenant_id: string; email: string; display_name: string | null;
  role_slug: string; status: string; invited_by: string | null; last_seen: string | null;
  omega_x_org_roles: { name: string; slug: string; permissions: string[] } | null;
};

type Role = {
  id: string; tenant_id: string; name: string; slug: string;
  description: string | null; permissions: string[];
  is_system: boolean; created_by: string | null;
};

type SSOConfig = {
  tenant_id: string; provider: string; enabled: boolean;
  client_id: string | null; discovery_url: string | null; domain_hints: string[] | null;
};

type Overview = {
  tenants: Tenant[];
  stats: { tenant_count: number; active_members: number; custom_roles: number; sso_enabled: number };
  sso_configs: SSOConfig[];
};

const PLAN_COLOR: Record<string, string> = {
  starter: 'bg-white/5 text-white/40',
  growth: 'bg-blue-500/20 text-blue-300',
  pro: 'bg-violet-500/20 text-violet-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  invited: 'bg-amber-400',
  suspended: 'bg-red-400',
  deactivated: 'bg-white/20',
};

export default function OrgPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sso, setSso] = useState<SSOConfig | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [view, setView] = useState<'overview' | 'members' | 'roles' | 'sso'>('overview');
  const [loading, setLoading] = useState(true);

  // Role creation form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', slug: '', description: '', permissions: '' });
  const [submitting, setSubmitting] = useState(false);

  // SSO form
  const [ssoForm, setSsoForm] = useState({ provider: 'google', client_id: '', discovery_url: '' });

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/org?mode=overview');
      if (res.ok) {
        const d = await res.json();
        setOverview(d);
        if (!selectedTenant && d.tenants.length > 0) setSelectedTenant(d.tenants[0]);
      }
    } catch { /* ignore */ }
  }, [selectedTenant]);

  const loadMembers = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch(`/api/org?mode=members&tenant_id=${tenantId}`);
      if (res.ok) { const d = await res.json(); setMembers(d.members ?? []); }
    } catch { /* ignore */ }
  }, []);

  const loadRoles = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch(`/api/org?mode=roles&tenant_id=${tenantId}`);
      if (res.ok) { const d = await res.json(); setRoles(d.roles ?? []); }
    } catch { /* ignore */ }
  }, []);

  const loadSSO = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch(`/api/org?mode=sso&tenant_id=${tenantId}`);
      if (res.ok) { const d = await res.json(); setSso(d.sso); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedTenant) return;
    if (view === 'members') loadMembers(selectedTenant.id);
    if (view === 'roles') loadRoles(selectedTenant.id);
    if (view === 'sso') loadSSO(selectedTenant.id);
  }, [view, selectedTenant, loadMembers, loadRoles, loadSSO]);

  async function createRole() {
    if (!selectedTenant || !roleForm.name || !roleForm.slug) return;
    setSubmitting(true);
    try {
      const permissions = roleForm.permissions.split(',').map(p => p.trim()).filter(Boolean);
      await fetch('/api/org', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_role', tenant_id: selectedTenant.id,
          ...roleForm, permissions }),
      });
      setShowRoleForm(false);
      setRoleForm({ name: '', slug: '', description: '', permissions: '' });
      await loadRoles(selectedTenant.id);
    } finally { setSubmitting(false); }
  }

  async function deleteRole(roleId: string) {
    await fetch('/api/org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_role', id: roleId }),
    });
    if (selectedTenant) await loadRoles(selectedTenant.id);
  }

  async function removeMember(memberId: string) {
    await fetch('/api/org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', id: memberId }),
    });
    if (selectedTenant) await loadMembers(selectedTenant.id);
  }

  async function saveSSO() {
    if (!selectedTenant) return;
    setSubmitting(true);
    try {
      await fetch('/api/org', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_sso', tenant_id: selectedTenant.id, ...ssoForm }),
      });
      await loadSSO(selectedTenant.id);
    } finally { setSubmitting(false); }
  }

  async function toggleSSO(enabled: boolean) {
    if (!selectedTenant) return;
    await fetch('/api/org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_sso', tenant_id: selectedTenant.id, enabled }),
    });
    await loadSSO(selectedTenant.id);
  }

  if (loading) return null;

  const stats = overview?.stats;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-lg font-semibold text-white">Organização & RBAC</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {stats?.tenant_count ?? 0} tenants · {stats?.active_members ?? 0} membros activos · {stats?.custom_roles ?? 0} roles custom
          </p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'members', 'roles', 'sso'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
                view === v ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40 hover:text-white/70'}`}>
              {v === 'sso' ? 'SSO' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant selector (when not overview) */}
      {view !== 'overview' && overview && overview.tenants.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {overview.tenants.map(t => (
            <button key={t.id} onClick={() => setSelectedTenant(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedTenant?.id === t.id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40 hover:text-white/60'}`}>
              {t.name}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${PLAN_COLOR[t.plan] ?? 'bg-white/5 text-white/40'}`}>
                {t.plan}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Overview */}
      {view === 'overview' && overview && (
        <motion.div {...fadeUp} className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Tenants', v: stats?.tenant_count ?? 0, color: 'text-white/80' },
              { l: 'Membros activos', v: stats?.active_members ?? 0, color: 'text-emerald-300' },
              { l: 'Roles custom', v: stats?.custom_roles ?? 0, color: 'text-violet-300' },
              { l: 'SSO activos', v: stats?.sso_enabled ?? 0, color: 'text-blue-300' },
            ].map((s, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-white/5 bg-white/3 p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.v}</p>
                <p className="text-xs text-white/40 mt-1">{s.l}</p>
              </motion.div>
            ))}
          </div>

          {/* Tenant list */}
          <div className="grid grid-cols-3 gap-4">
            {overview.tenants.map((tenant, i) => {
              const tenantSSO = overview.sso_configs.find(s => s.tenant_id === tenant.id);
              return (
                <motion.div key={tenant.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-white/5 bg-white/3 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white/90">{tenant.name}</p>
                      <p className="text-xs text-white/30 font-mono mt-0.5">{tenant.slug}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${PLAN_COLOR[tenant.plan] ?? 'bg-white/5 text-white/40'}`}>
                      {tenant.plan}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { l: 'Utilizadores max', v: tenant.max_users },
                      { l: 'SSO', v: tenantSSO ? (tenantSSO.enabled ? `✓ ${tenantSSO.provider}` : `✗ ${tenantSSO.provider}`) : '—' },
                      { l: 'Estado', v: tenant.is_active ? '✓ Activo' : '✗ Suspenso' },
                    ].map(item => (
                      <div key={item.l} className="flex justify-between text-xs">
                        <span className="text-white/30">{item.l}</span>
                        <span className="text-white/60">{item.v}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Members */}
      {view === 'members' && (
        <motion.div {...fadeUp} className="space-y-2">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-sm text-white/50">Nenhum membro neste tenant</p>
            </div>
          ) : members.map((m, i) => (
            <motion.div key={m.id} {...fadeUp} transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/5 bg-white/3 p-4 flex items-center gap-4">
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? 'bg-white/20'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">
                  {m.display_name ?? m.email}
                </p>
                <p className="text-xs text-white/40 truncate">{m.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-violet-300">{m.omega_x_org_roles?.name ?? m.role_slug}</p>
                <p className="text-xs text-white/30 capitalize mt-0.5">{m.status}</p>
              </div>
              {m.status !== 'deactivated' && (
                <button onClick={() => removeMember(m.id)}
                  className="text-red-400/60 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                  Remove
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Roles */}
      {view === 'roles' && (
        <motion.div {...fadeUp} className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowRoleForm(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors">
              + Criar Role
            </button>
          </div>

          {roles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">🛡</p>
              <p className="text-sm text-white/50">Nenhum role definido para este tenant</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {roles.map((role, i) => (
                <motion.div key={role.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl border p-5 ${role.is_system ? 'border-amber-500/20 bg-amber-500/3' : 'border-white/5 bg-white/3'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white/90">{role.name}</p>
                        {role.is_system && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">sistema</span>
                        )}
                      </div>
                      <p className="text-xs text-white/30 font-mono mt-0.5">{role.slug}</p>
                    </div>
                    {!role.is_system && (
                      <button onClick={() => deleteRole(role.id)}
                        className="text-red-400/50 hover:text-red-400 text-xs hover:bg-red-500/10 rounded px-1.5 py-0.5 transition-colors">
                        delete
                      </button>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-white/40 mb-3">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 8).map(p => (
                      <span key={p} className="px-1.5 py-0.5 text-xs bg-white/5 rounded text-white/40 font-mono">{p}</span>
                    ))}
                    {role.permissions.length > 8 && (
                      <span className="text-xs text-white/25">+{role.permissions.length - 8}</span>
                    )}
                    {role.permissions.length === 0 && (
                      <span className="text-xs text-white/20 italic">Sem permissões definidas</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Create role form */}
          <AnimatePresence>
            {showRoleForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={e => { if (e.target === e.currentTarget) setShowRoleForm(false); }}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
                  className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                  <h2 className="text-sm font-semibold text-white">Criar Role</h2>
                  <input value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nome *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
                  <input value={roleForm.slug} onChange={e => setRoleForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    placeholder="slug (snake_case) *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none font-mono" />
                  <input value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descrição" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
                  <div>
                    <label className="text-xs text-white/30 mb-1.5 block">Permissões (separadas por vírgula)</label>
                    <textarea value={roleForm.permissions} onChange={e => setRoleForm(p => ({ ...p, permissions: e.target.value }))}
                      placeholder="orders:read, quotes:write, clients:read" rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none resize-none font-mono" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowRoleForm(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors">Cancelar</button>
                    <button onClick={createRole} disabled={!roleForm.name || !roleForm.slug || submitting}
                      className="flex-1 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors disabled:opacity-40">
                      {submitting ? 'A criar...' : 'Criar Role'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* SSO */}
      {view === 'sso' && selectedTenant && (
        <motion.div {...fadeUp} className="max-w-lg space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white/90">SSO — {selectedTenant.name}</p>
              {sso && (
                <button onClick={() => toggleSSO(!sso.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${sso.enabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sso.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              )}
            </div>

            {sso ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-white/40">Provider</span><span className="text-white/70 capitalize">{sso.provider}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Estado</span><span className={sso.enabled ? 'text-emerald-400' : 'text-white/40'}>{sso.enabled ? 'Activo' : 'Inactivo'}</span></div>
                {sso.domain_hints && sso.domain_hints.length > 0 && (
                  <div className="flex justify-between"><span className="text-white/40">Domínios</span><span className="text-white/60">{sso.domain_hints.join(', ')}</span></div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40">Nenhuma config SSO para este tenant</p>
            )}

            <div className="border-t border-white/5 pt-4 space-y-3">
              <p className="text-xs text-white/50 font-medium">Configurar SSO</p>
              <select value={ssoForm.provider} onChange={e => setSsoForm(p => ({ ...p, provider: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                {['google', 'microsoft', 'okta', 'auth0', 'saml', 'custom'].map(p => (
                  <option key={p} value={p} className="bg-[#1a1a1a] capitalize">{p}</option>
                ))}
              </select>
              <input value={ssoForm.client_id} onChange={e => setSsoForm(p => ({ ...p, client_id: e.target.value }))}
                placeholder="Client ID" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none font-mono" />
              <input value={ssoForm.discovery_url} onChange={e => setSsoForm(p => ({ ...p, discovery_url: e.target.value }))}
                placeholder="Discovery / Metadata URL" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <button onClick={saveSSO} disabled={submitting}
                className="w-full py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40">
                {submitting ? 'A guardar...' : 'Guardar Config SSO'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
