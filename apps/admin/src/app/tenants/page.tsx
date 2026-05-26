'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  maxUsers: number;
  maxOrdersPerMonth: number;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _count?: { memberships: number };
}

interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  isActive: boolean;
  invitedBy: string | null;
  joinedAt: string | null;
  createdAt: string;
}

interface TenantStats {
  orders: number;
  ordersThisMonth: number;
  clients: number;
  companies: number;
  members: number;
}

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  planMap: Record<string, number>;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    starter: 'bg-[#1a2f48] text-[#8ba8c7] border border-[#1a2f48]',
    growth: 'bg-[#4da3ff]/15 text-[#4da3ff] border border-[#4da3ff]/30',
    enterprise: 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${styles[plan] ?? styles['starter']}`}>
      {plan}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    admin: 'bg-[#4da3ff]/15 text-[#4da3ff] border border-[#4da3ff]/30',
    member: 'bg-[#1a2f48] text-[#8ba8c7] border border-[#1a2f48]',
    viewer: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${styles[role] ?? styles['member']}`}>
      {role}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-[#4d6a87]'}`} />
  );
}

// ─── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 90 ? '#f87171' : pct >= 70 ? '#f59e0b' : '#4da3ff';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-[#8ba8c7]">{label}</span>
        <span className="text-xs text-[#f0f6ff] font-medium">{value} / {max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1a2f48] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── New Tenant modal ─────────────────────────────────────────────────────────

interface NewTenantModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewTenantModal({ onClose, onCreated }: NewTenantModalProps) {
  const [form, setForm] = useState({ slug: '', name: '', plan: 'starter', maxUsers: 10, maxOrdersPerMonth: 500, ownerId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('adminToken') ?? '';
      const res = await fetch(`${API_BASE}/api/v1/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to create tenant');
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#f0f6ff]">New Tenant</h2>
          <button type="button" onClick={onClose} className="text-[#4d6a87] hover:text-[#8ba8c7] transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
              <path strokeLinecap="round" d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Slug <span className="text-red-400">*</span></label>
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="acme-corp"
              className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Name <span className="text-red-400">*</span></label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Corporation"
              className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Owner User ID <span className="text-red-400">*</span></label>
            <input
              required
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              placeholder="user_abc123"
              className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Plan</label>
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff] transition-colors"
            >
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Max Users</label>
              <input
                type="number"
                min={1}
                value={form.maxUsers}
                onChange={(e) => setForm({ ...form, maxUsers: Number(e.target.value) })}
                className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Max Orders/Mo</label>
              <input
                type="number"
                min={1}
                value={form.maxOrdersPerMonth}
                onChange={(e) => setForm({ ...form, maxOrdersPerMonth: Number(e.target.value) })}
                className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff] transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-[#8ba8c7] border border-[#1a2f48] hover:bg-[#1a2f48] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#4da3ff] text-[#07111f] hover:bg-[#74b8ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating…' : 'Create Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  tenant: Tenant;
  onPlanUpgrade: (plan: string) => void;
}

function DetailPanel({ tenant, onPlanUpgrade }: DetailPanelProps) {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [members, setMembers] = useState<TenantMembership[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken') ?? '';
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/api/v1/tenants/${tenant.id}/stats`, { headers }).then((r) => r.json() as Promise<TenantStats>),
      fetch(`${API_BASE}/api/v1/tenants/${tenant.id}/members`, { headers }).then((r) => r.json() as Promise<TenantMembership[]>),
    ])
      .then(([s, m]) => { setStats(s); setMembers(m); })
      .catch(() => null);
  }, [tenant.id]);

  const plans = ['starter', 'growth', 'enterprise'];

  return (
    <div className="h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusDot active={tenant.isActive} />
            <h2 className="text-lg font-bold text-[#f0f6ff]">{tenant.name}</h2>
            <PlanBadge plan={tenant.plan} />
          </div>
          <p className="text-xs text-[#4d6a87] font-mono">{tenant.slug}</p>
        </div>
        <p className="text-xs text-[#4d6a87]">Created {new Date(tenant.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Orders', value: stats.orders },
            { label: 'This Month', value: stats.ordersThisMonth },
            { label: 'Clients', value: stats.clients },
            { label: 'Members', value: stats.members },
          ].map((s) => (
            <div key={s.label} className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-[#f0f6ff]">{s.value}</p>
              <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Usage bar */}
      {stats && (
        <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-4">
          <p className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide mb-3">Usage</p>
          <UsageBar value={stats.ordersThisMonth} max={tenant.maxOrdersPerMonth} label="Orders this month" />
          <div className="mt-3">
            <UsageBar value={stats.members} max={tenant.maxUsers} label="Active members" />
          </div>
        </div>
      )}

      {/* Plan upgrade */}
      <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-4">
        <p className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide mb-3">Change Plan</p>
        <div className="flex gap-2 flex-wrap">
          {plans.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPlanUpgrade(p)}
              disabled={tenant.plan === p}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tenant.plan === p
                  ? 'bg-[#1a2f48] text-[#4d6a87] cursor-not-allowed'
                  : 'border border-[#1a2f48] text-[#8ba8c7] hover:bg-[#1a2f48] hover:text-[#f0f6ff]'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Members table */}
      <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a2f48]">
          <p className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Members</p>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-xs text-[#4d6a87] text-center">No active members</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  <th className="px-4 py-2.5 text-left font-semibold text-[#4d6a87] uppercase tracking-wide">User ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#4d6a87] uppercase tracking-wide">Role</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#4d6a87] uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-[#1a2f48]/50 last:border-0 hover:bg-[#0b1526]/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[#8ba8c7] truncate max-w-[160px]">{m.userId}</td>
                    <td className="px-4 py-2.5"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-2.5 text-[#4d6a87]">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken') ?? '';
      const headers = { Authorization: `Bearer ${token}` };
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/tenants?all=true`, { headers }),
        fetch(`${API_BASE}/api/v1/tenants/platform-stats`, { headers }),
      ]);
      const [t, s] = await Promise.all([
        tRes.json() as Promise<Tenant[]>,
        sRes.json() as Promise<PlatformStats>,
      ]);
      setTenants(t);
      setPlatformStats(s);
      if (!selectedTenant && t.length > 0) setSelectedTenant(t[0] ?? null);
    } catch {
      // silently fail — page shows empty state
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handlePlanUpgrade(plan: string) {
    if (!selectedTenant) return;
    const token = localStorage.getItem('adminToken') ?? '';
    await fetch(`${API_BASE}/api/v1/tenants/${selectedTenant.id}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    await load();
    // refresh selected tenant
    const updated = tenants.find((t) => t.id === selectedTenant.id);
    if (updated) setSelectedTenant({ ...updated, plan });
  }

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#f0f6ff] mb-1">Tenants</h1>
          <p className="text-sm text-[#8ba8c7]">Multi-tenant organisation management</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-medium hover:bg-[#74b8ff] transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New Tenant
        </button>
      </div>

      {/* Platform stats bar */}
      {platformStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#f0f6ff]">{platformStats.totalTenants}</p>
            <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">Total</p>
          </div>
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-emerald-400">{platformStats.activeTenants}</p>
            <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">Active</p>
          </div>
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#8ba8c7]">{platformStats.planMap['starter'] ?? 0}</p>
            <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">Starter</p>
          </div>
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#4da3ff]">{platformStats.planMap['growth'] ?? 0}</p>
            <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">Growth</p>
          </div>
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#f59e0b]">{platformStats.planMap['enterprise'] ?? 0}</p>
            <p className="text-[10px] text-[#4d6a87] uppercase tracking-wide mt-0.5">Enterprise</p>
          </div>
        </div>
      )}

      {/* Split layout */}
      <div className="flex gap-5 h-[calc(100vh-260px)] min-h-[400px]">
        {/* Left: tenant list */}
        <div className="w-[35%] flex-shrink-0 bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1a2f48]">
            <p className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wide">
              {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && tenants.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tenants.length === 0 ? (
              <p className="px-4 py-8 text-xs text-[#4d6a87] text-center">No tenants found</p>
            ) : (
              tenants.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTenant(t)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a2f48]/50 last:border-0 transition-colors ${
                    selectedTenant?.id === t.id ? 'bg-[#0d1f3a]' : 'hover:bg-[#102131]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot active={t.isActive} />
                      <span className="text-sm font-medium text-[#f0f6ff] truncate">{t.name}</span>
                    </div>
                    <PlanBadge plan={t.plan} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#4d6a87]">{t.slug}</span>
                    <span className="text-[11px] text-[#4d6a87]">
                      {t._count?.memberships ?? 0} member{(t._count?.memberships ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 overflow-hidden">
          {selectedTenant ? (
            <DetailPanel
              key={selectedTenant.id}
              tenant={selectedTenant}
              onPlanUpgrade={handlePlanUpgrade}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-[#4d6a87]">Select a tenant to view details</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewTenantModal
          onClose={() => setShowModal(false)}
          onCreated={() => { void load(); }}
        />
      )}
    </div>
  );
}
