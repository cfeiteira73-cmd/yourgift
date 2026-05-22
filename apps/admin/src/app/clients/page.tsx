'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentOrder {
  id: string;
  ref: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  supplier: string | null;
}

interface ClientCompanyRef {
  id: string;
  name: string;
  tier: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

interface Client {
  id: string;
  email: string;
  name: string;
  company: string | null;
  nif: string | null;
  tier: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  quoteCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  companyName: string | null;
  companyTier: string | null;
}

interface ClientDetail extends Client {
  companyRef: ClientCompanyRef | null;
  orders: RecentOrder[];
  avgOrderValue: number;
}

interface KpiStats {
  totalClients: number;
  activeClients: number;
  totalRevenue: number;
  avgLtv: number;
}

interface ClientFormData {
  name: string;
  email: string;
  company: string;
  nif: string;
  tier: string;
  companyId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIERS = ['standard', 'premium', 'enterprise'] as const;
type Tier = typeof TIERS[number];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const TIER_AVATAR_BG: Record<string, string> = {
  standard: 'bg-[#1a2f48]',
  premium: 'bg-blue-900/60',
  enterprise: 'bg-yellow-900/50',
};

const TIER_AVATAR_TEXT: Record<string, string> = {
  standard: 'text-[#8ba8c7]',
  premium: 'text-blue-300',
  enterprise: 'text-yellow-300',
};

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'premium') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-900/40 text-blue-400 border border-blue-800">
        Premium
      </span>
    );
  }
  if (tier === 'enterprise') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-yellow-900/30 text-yellow-400 border border-yellow-700">
        Enterprise
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#1a2f48] text-[#8ba8c7]">
      Standard
    </span>
  );
}

function StatusBadgeSmall({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: 'bg-[#1a2f48] text-[#8ba8c7]',
    paid: 'bg-blue-900/40 text-blue-400',
    approved: 'bg-indigo-900/40 text-indigo-400',
    producing: 'bg-orange-900/40 text-orange-400',
    shipped: 'bg-cyan-900/40 text-cyan-400',
    delivered: 'bg-green-900/40 text-green-400',
    cancelled: 'bg-red-900/30 text-red-400',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${map[status] ?? 'bg-[#1a2f48] text-[#8ba8c7]'}`}
    >
      {status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">
        {label}
      </p>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#4d6a87] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Client Detail Slide-over ────────────────────────────────────────────────

function ClientSlideOver({
  clientId,
  onClose,
  onEdit,
}: {
  clientId: string;
  onClose: () => void;
  onEdit: (client: ClientDetail) => void;
}) {
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    setLoading(true);
    fetch(`${API_BASE}/api/v1/clients/${clientId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: ClientDetail) => {
        if (!cancelled) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-[#0b1526] border-l border-[#1a2f48] z-50 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a2f48]">
          <p className="text-sm font-semibold text-[#8ba8c7] uppercase tracking-widest">
            Detalhe do Cliente
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6a87] hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <div className="px-6 py-5 space-y-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0 ${TIER_AVATAR_BG[detail.tier] ?? 'bg-[#1a2f48]'} ${TIER_AVATAR_TEXT[detail.tier] ?? 'text-[#8ba8c7]'}`}
                >
                  {getInitials(detail.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{detail.name}</h2>
                  <p className="text-sm text-[#8ba8c7] truncate">{detail.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TierBadge tier={detail.tier} />
                    {detail.nif && (
                      <span className="text-xs text-[#4d6a87]">NIF {detail.nif}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(detail)}
                  className="flex-shrink-0 text-[#4d6a87] hover:text-[#4da3ff] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M11 2.5a1.5 1.5 0 0 1 2.12 2.12L4.5 13.24l-3 .76.76-3L11 2.5z" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-[#4d6a87]">
                Membro desde {formatDate(detail.createdAt)}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 text-center">
                  <p className="text-xl font-black text-white tabular-nums">{detail.orderCount}</p>
                  <p className="text-[10px] text-[#4d6a87] mt-0.5 uppercase tracking-wide">Pedidos</p>
                </div>
                <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 text-center">
                  <p className="text-base font-black text-white tabular-nums truncate">{formatCurrency(detail.totalSpent)}</p>
                  <p className="text-[10px] text-[#4d6a87] mt-0.5 uppercase tracking-wide">Total gasto</p>
                </div>
                <div className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 text-center">
                  <p className="text-base font-black text-white tabular-nums truncate">{formatCurrency(detail.avgOrderValue)}</p>
                  <p className="text-[10px] text-[#4d6a87] mt-0.5 uppercase tracking-wide">Avg order</p>
                </div>
              </div>

              {/* Company */}
              {detail.companyRef && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">
                    Empresa
                  </p>
                  <div className="flex items-center gap-3 bg-[#07111f] border border-[#1a2f48] rounded-lg px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{
                        backgroundColor: detail.companyRef.primaryColor
                          ? detail.companyRef.primaryColor + '33'
                          : '#1a2f48',
                        color: detail.companyRef.primaryColor ?? '#8ba8c7',
                      }}
                    >
                      {getInitials(detail.companyRef.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {detail.companyRef.name}
                      </p>
                      {detail.companyRef.domain && (
                        <p className="text-xs text-[#4d6a87] truncate">
                          {detail.companyRef.domain}
                        </p>
                      )}
                    </div>
                    <TierBadge tier={detail.companyRef.tier} />
                  </div>
                </div>
              )}

              {/* Recent orders */}
              {detail.orders.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">
                    Últimas encomendas
                  </p>
                  <div className="space-y-2">
                    {detail.orders.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center gap-3 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2.5"
                      >
                        <Link
                          href={`/orders/${o.id}`}
                          className="font-mono text-xs text-[#4da3ff] hover:text-[#74e7ff] transition-colors flex-shrink-0"
                        >
                          {o.ref}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <StatusBadgeSmall status={o.status} />
                        </div>
                        <span className="text-xs font-semibold text-white tabular-nums flex-shrink-0">
                          {o.totalAmount ? formatCurrency(o.totalAmount) : '—'}
                        </span>
                        <span className="text-[10px] text-[#4d6a87] flex-shrink-0">
                          {formatDate(o.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <Link
                href={`/orders?clientId=${detail.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[#1a3a5c] text-[#4da3ff] text-sm font-medium hover:bg-[#0d1f3a] transition-all"
              >
                Ver todos os pedidos
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 6h8M7 3l3 3-3 3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-[#4d6a87] text-sm">
              Não foi possível carregar o cliente.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Create / Edit Modal ─────────────────────────────────────────────────────

const DEFAULT_FORM: ClientFormData = {
  name: '',
  email: '',
  company: '',
  nif: '',
  tier: 'standard',
  companyId: '',
};

function ClientModal({
  mode,
  initialData,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initialData?: Partial<ClientFormData> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClientFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof ClientFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = getAdminToken();
      const url =
        mode === 'create'
          ? `${API_BASE}/api/v1/clients`
          : `${API_BASE}/api/v1/clients/${initialData?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        tier: form.tier,
      };
      if (form.company) body['company'] = form.company;
      if (form.nif) body['nif'] = form.nif;
      if (form.companyId) body['companyId'] = form.companyId;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Erro ao guardar');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-[#0b1526] border border-[#1a2f48] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a2f48]">
            <h2 className="text-base font-bold text-white">
              {mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[#4d6a87] hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <p className="text-xs text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Nome *
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="João Silva"
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Email *
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="joao@empresa.pt"
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Empresa
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  placeholder="Empresa Lda."
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  NIF
                </label>
                <input
                  type="text"
                  value={form.nif}
                  onChange={(e) => set('nif', e.target.value)}
                  placeholder="500 000 000"
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Tier
                </label>
                <select
                  value={form.tier}
                  onChange={(e) => set('tier', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none cursor-pointer"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Company ID
                </label>
                <input
                  type="text"
                  value={form.companyId}
                  onChange={(e) => set('companyId', e.target.value)}
                  placeholder="UUID (opcional)"
                  className="w-full px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm font-medium hover:border-[#4d6a87] hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'A guardar...' : mode === 'create' ? 'Criar Cliente' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<KpiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    data?: Partial<ClientFormData> & { id?: string };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [clientsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/clients`, { headers }),
        fetch(`${API_BASE}/api/v1/clients/stats`, { headers }),
      ]);
      const [clientsData, statsData] = await Promise.all([
        clientsRes.json() as Promise<Client[]>,
        statsRes.json() as Promise<KpiStats>,
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setStats(statsData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let result = clients;
    if (tierFilter) result = result.filter((c) => c.tier === tierFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q) ||
          (c.companyName ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [clients, tierFilter, search]);

  function exportCsv() {
    const rows = [
      ['Nome', 'Email', 'Empresa', 'Tier', 'Pedidos', 'Total Gasto', 'Último Pedido', 'Membro desde'],
      ...filtered.map((c) => [
        c.name,
        c.email,
        c.companyName ?? c.company ?? '',
        c.tier,
        String(c.orderCount),
        String(c.totalSpent),
        c.lastOrderAt ? formatDate(c.lastOrderAt) : '',
        formatDate(c.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEdit(client: Client | ClientDetail) {
    setSelectedClientId(null);
    setModal({
      mode: 'edit',
      data: {
        id: client.id,
        name: client.name,
        email: client.email,
        company: client.company ?? '',
        nif: client.nif ?? '',
        tier: client.tier,
        companyId: client.companyId ?? '',
      },
    });
  }

  return (
    <div>
      {/* Slide-over */}
      {selectedClientId && (
        <ClientSlideOver
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onEdit={openEdit}
        />
      )}

      {/* Modal */}
      {modal && (
        <ClientModal
          mode={modal.mode}
          initialData={modal.data}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Clientes</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} clientes`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6.5 1v8M4 7l2.5 3L9 7" />
              <path d="M1 10v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" />
            </svg>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 1v11M1 6.5h11" />
            </svg>
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar clientes.</p>
          <button
            type="button"
            onClick={load}
            className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total Clientes"
            value={String(stats.totalClients)}
          />
          <KpiCard
            label="Ativos (90 dias)"
            value={String(stats.activeClients)}
            sub={`${stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}% do total`}
          />
          <KpiCard
            label="Receita Total"
            value={formatCurrency(stats.totalRevenue)}
          />
          <KpiCard
            label="LTV Médio"
            value={formatCurrency(stats.avgLtv)}
            sub="por cliente"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar nome, email, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-lg p-1">
          {(['', ...TIERS] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tierFilter === t
                  ? 'bg-[#0d1f3a] text-[#4da3ff] border border-[#1a3a5c]'
                  : 'text-[#8ba8c7] hover:text-white'
              }`}
            >
              {t === '' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {(search || tierFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setTierFilter(''); }}
            className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#4d6a87]">
            <svg className="mx-auto mb-3 opacity-30" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="20" cy="13" r="8" />
              <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" />
            </svg>
            <p className="text-sm font-medium">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['CLIENTE', 'EMPRESA', 'TIER', 'PEDIDOS', 'TOTAL GASTO', 'ÚLTIMO PEDIDO', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-[#1a2f48]/50 hover:bg-[#0d1f3a]/40 transition-colors group"
                  >
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${TIER_AVATAR_BG[client.tier] ?? 'bg-[#1a2f48]'} ${TIER_AVATAR_TEXT[client.tier] ?? 'text-[#8ba8c7]'}`}
                        >
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate max-w-[160px]">
                            {client.name}
                          </p>
                          <p className="text-xs text-[#4d6a87] truncate max-w-[160px]">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#8ba8c7] truncate max-w-[140px] block">
                        {client.companyName ?? client.company ?? '—'}
                      </span>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3">
                      <TierBadge tier={client.tier} />
                    </td>

                    {/* Orders */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-white tabular-nums font-semibold">
                        {client.orderCount}
                      </span>
                    </td>

                    {/* Total Spent */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {formatCurrency(client.totalSpent)}
                      </span>
                    </td>

                    {/* Last Order */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#4d6a87] tabular-nums">
                        {client.lastOrderAt ? formatDate(client.lastOrderAt) : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* View detail */}
                        <button
                          type="button"
                          title="Ver detalhe"
                          onClick={() => setSelectedClientId(client.id)}
                          className="p-1.5 rounded-md text-[#4d6a87] hover:text-[#4da3ff] hover:bg-[#0d1f3a] transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="7" cy="7" r="2.5" />
                            <path d="M1 7c1.5-3.5 9.5-3.5 12 0-2.5 3.5-10.5 3.5-12 0" />
                          </svg>
                        </button>
                        {/* Edit */}
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => openEdit(client)}
                          className="p-1.5 rounded-md text-[#4d6a87] hover:text-[#4da3ff] hover:bg-[#0d1f3a] transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M9.5 2a1.5 1.5 0 0 1 2.5 2L4 12l-3 1 1-3 7.5-8z" />
                          </svg>
                        </button>
                        {/* Orders */}
                        <Link
                          href={`/orders?clientId=${client.id}`}
                          title="Ver encomendas"
                          className="p-1.5 rounded-md text-[#4d6a87] hover:text-[#4da3ff] hover:bg-[#0d1f3a] transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="2" y="2" width="10" height="11" rx="1.5" />
                            <path d="M4 5h6M4 7.5h6M4 10h4" />
                          </svg>
                        </Link>
                      </div>
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
