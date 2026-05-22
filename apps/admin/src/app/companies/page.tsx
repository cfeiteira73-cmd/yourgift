'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DepartmentSummary {
  id: string;
  name: string;
}

interface CompanySummary {
  id: string;
  name: string;
  nif: string | null;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  tier: string;
  billingEmail: string | null;
  shippingAddress: unknown;
  createdAt: string;
  updatedAt: string;
  clientCount: number;
  orderCount: number;
  activeStoreCount: number;
  totalSpent: number;
  departments: DepartmentSummary[];
  budgetUtilization: number;
}

interface ClientSummary {
  id: string;
  name: string;
  email: string;
  tier: string;
  createdAt: string;
  _count: { orders: number };
}

interface DepartmentDetail {
  id: string;
  name: string;
  headEmail: string | null;
  createdAt: string;
}

interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface BudgetDetail {
  id: string;
  name: string;
  period: string;
  limitAmount: number;
  spentAmount: number;
  alertThreshold: number;
  periodStart: string;
  periodEnd: string;
}

interface OrderSummary {
  id: string;
  ref: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
}

interface CompanyDetail extends CompanySummary {
  clients: ClientSummary[];
  departments: DepartmentDetail[];
  companyStores: StoreDetail[];
  budgets: BudgetDetail[];
  orders: OrderSummary[];
  totalSpent: number;
}

interface KpiStats {
  totalCompanies: number;
  totalClients: number;
  totalRevenue: number;
  activeStores: number;
}

interface CompanyFormData {
  name: string;
  nif: string;
  domain: string;
  tier: string;
  billingEmail: string;
  primaryColor: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIERS = ['standard', 'premium', 'enterprise'] as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

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

// ─── Budget Utilization Bar ───────────────────────────────────────────────────

function BudgetBar({ utilization }: { utilization: number }) {
  const pct = Math.min(utilization * 100, 100);
  const color =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 70
        ? 'bg-yellow-500'
        : 'bg-[#4da3ff]';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#4d6a87] uppercase tracking-wide">Budget utilizado</span>
        <span className={`text-[10px] font-bold tabular-nums ${pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-[#4da3ff]'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Company Detail Modal ─────────────────────────────────────────────────────

type DetailTab = 'overview' | 'clients' | 'departments' | 'stores' | 'budgets';

function CompanyDetailModal({
  companyId,
  onClose,
  onEdit,
}: {
  companyId: string;
  onClose: () => void;
  onEdit: (company: CompanyDetail) => void;
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>('overview');

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    setLoading(true);
    fetch(`${API_BASE}/api/v1/companies/${companyId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: CompanyDetail) => {
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
  }, [companyId]);

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: `Clientes ${detail ? `(${detail._count?.clients ?? detail.clients?.length ?? 0})` : ''}` },
    { id: 'departments', label: 'Dep.' },
    { id: 'stores', label: 'Lojas' },
    { id: 'budgets', label: 'Budgets' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[90vh] bg-[#0b1526] border border-[#1a2f48] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a2f48] flex-shrink-0">
            <p className="text-sm font-semibold text-[#8ba8c7] uppercase tracking-widest">
              Detalhe da Empresa
            </p>
            <div className="flex items-center gap-2">
              {detail && (
                <button
                  type="button"
                  onClick={() => onEdit(detail)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-xs font-medium hover:bg-[#102131] hover:text-white transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M8 1.5a1.5 1.5 0 0 1 2.5 2L3 11l-2.5.5.5-2.5L8 1.5z" />
                  </svg>
                  Editar
                </button>
              )}
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
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detail ? (
              <div className="px-6 py-5 space-y-5">
                {/* Company identity */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0"
                    style={{
                      backgroundColor: detail.primaryColor
                        ? detail.primaryColor + '33'
                        : '#1a2f48',
                      color: detail.primaryColor ?? '#8ba8c7',
                    }}
                  >
                    {getInitials(detail.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{detail.name}</h2>
                    <p className="text-sm text-[#8ba8c7] truncate">{detail.domain ?? detail.billingEmail ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <TierBadge tier={detail.tier} />
                      {detail.nif && (
                        <span className="text-xs text-[#4d6a87]">NIF {detail.nif}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Clientes', value: String(detail.clientCount) },
                    { label: 'Pedidos', value: String(detail.orderCount) },
                    { label: 'Lojas', value: String(detail.activeStoreCount) },
                    { label: 'Total gasto', value: formatCurrency(detail.totalSpent) },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 text-center">
                      <p className="text-base font-black text-white tabular-nums truncate">{s.value}</p>
                      <p className="text-[10px] text-[#4d6a87] mt-0.5 uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-0.5 bg-[#07111f] border border-[#1a2f48] rounded-lg p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        tab === t.id
                          ? 'bg-[#0d1f3a] text-[#4da3ff] border border-[#1a3a5c]'
                          : 'text-[#8ba8c7] hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {tab === 'overview' && (
                  <div className="space-y-4">
                    {/* Recent orders */}
                    {detail.orders.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">
                          Últimas encomendas
                        </p>
                        <div className="space-y-1.5">
                          {detail.orders.slice(0, 5).map((o) => (
                            <div
                              key={o.id}
                              className="flex items-center gap-3 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2"
                            >
                              <Link
                                href={`/orders/${o.id}`}
                                className="font-mono text-xs text-[#4da3ff] hover:text-[#74e7ff] transition-colors flex-shrink-0"
                              >
                                {o.ref}
                              </Link>
                              <div className="flex-1">
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

                    {/* Budget utilization */}
                    {detail.budgets.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">
                          Budgets ativos
                        </p>
                        <div className="space-y-2">
                          {detail.budgets.slice(0, 3).map((b) => {
                            const pct = b.limitAmount > 0 ? (b.spentAmount / b.limitAmount) * 100 : 0;
                            return (
                              <div key={b.id} className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-white">{b.name}</span>
                                  <span className="text-xs text-[#8ba8c7] tabular-nums">
                                    {formatCurrency(b.spentAmount)} / {formatCurrency(b.limitAmount)}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-[#4da3ff]'}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'clients' && (
                  <div className="space-y-2">
                    {detail.clients.length === 0 ? (
                      <p className="text-sm text-[#4d6a87] text-center py-8">Nenhum cliente associado</p>
                    ) : (
                      detail.clients.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2.5"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#1a2f48] flex items-center justify-center text-xs font-black text-[#8ba8c7] flex-shrink-0">
                            {getInitials(c.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{c.name}</p>
                            <p className="text-xs text-[#4d6a87] truncate">{c.email}</p>
                          </div>
                          <TierBadge tier={c.tier} />
                          <span className="text-xs text-[#8ba8c7] tabular-nums flex-shrink-0">
                            {c._count.orders} pedidos
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'departments' && (
                  <div className="space-y-2">
                    {detail.departments.length === 0 ? (
                      <p className="text-sm text-[#4d6a87] text-center py-8">Nenhum departamento</p>
                    ) : (
                      detail.departments.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{d.name}</p>
                            {d.headEmail && (
                              <p className="text-xs text-[#4d6a87]">{d.headEmail}</p>
                            )}
                          </div>
                          <span className="text-xs text-[#4d6a87]">{formatDate(d.createdAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'stores' && (
                  <div className="space-y-2">
                    {detail.companyStores.length === 0 ? (
                      <p className="text-sm text-[#4d6a87] text-center py-8">Nenhuma loja</p>
                    ) : (
                      detail.companyStores.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{s.name}</p>
                            <p className="text-xs text-[#4d6a87] font-mono">/{s.slug}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.isActive ? 'bg-green-900/30 text-green-400' : 'bg-[#1a2f48] text-[#4d6a87]'}`}
                          >
                            {s.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'budgets' && (
                  <div className="space-y-3">
                    {detail.budgets.length === 0 ? (
                      <p className="text-sm text-[#4d6a87] text-center py-8">Nenhum budget</p>
                    ) : (
                      detail.budgets.map((b) => {
                        const pct =
                          b.limitAmount > 0 ? (b.spentAmount / b.limitAmount) * 100 : 0;
                        return (
                          <div key={b.id} className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-sm font-semibold text-white">{b.name}</p>
                                <p className="text-xs text-[#4d6a87] mt-0.5">
                                  {b.period} · {formatDate(b.periodStart)} – {formatDate(b.periodEnd)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-white tabular-nums">
                                  {formatCurrency(b.spentAmount)}
                                </p>
                                <p className="text-xs text-[#4d6a87] tabular-nums">
                                  de {formatCurrency(b.limitAmount)}
                                </p>
                              </div>
                            </div>
                            <div className="h-2 bg-[#1a2f48] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-[#4da3ff]'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p
                              className={`text-[10px] mt-1 tabular-nums text-right ${pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-[#4d6a87]'}`}
                            >
                              {pct.toFixed(0)}% utilizado
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-[#4d6a87] text-sm">
                Não foi possível carregar a empresa.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

const DEFAULT_FORM: CompanyFormData = {
  name: '',
  nif: '',
  domain: '',
  tier: 'standard',
  billingEmail: '',
  primaryColor: '#4da3ff',
};

function CompanyModal({
  mode,
  initialData,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initialData?: Partial<CompanyFormData> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CompanyFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof CompanyFormData, value: string) {
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
          ? `${API_BASE}/api/v1/companies`
          : `${API_BASE}/api/v1/companies/${initialData?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body: Record<string, unknown> = { name: form.name, tier: form.tier };
      if (form.nif) body['nif'] = form.nif;
      if (form.domain) body['domain'] = form.domain;
      if (form.billingEmail) body['billingEmail'] = form.billingEmail;
      if (form.primaryColor) body['primaryColor'] = form.primaryColor;

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
          className="pointer-events-auto w-full max-w-md bg-[#0b1526] border border-[#1a2f48] rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a2f48]">
            <h2 className="text-base font-bold text-white">
              {mode === 'create' ? 'Nova Empresa' : 'Editar Empresa'}
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
                  Domínio
                </label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => set('domain', e.target.value)}
                  placeholder="empresa.pt"
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
                  Cor Primária
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[#1a2f48] bg-[#07111f] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    placeholder="#4da3ff"
                    className="flex-1 px-3 py-2.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                  Email de Faturação
                </label>
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={(e) => set('billingEmail', e.target.value)}
                  placeholder="financeiro@empresa.pt"
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
                {saving ? 'A guardar...' : mode === 'create' ? 'Criar Empresa' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onManage,
  onEdit,
}: {
  company: CompanySummary;
  onManage: () => void;
  onEdit: () => void;
}) {
  const color = company.primaryColor ?? '#4d6a87';

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 hover:border-[#2a4a6a] transition-all group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
          style={{ backgroundColor: color + '22', color }}
        >
          {getInitials(company.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-white truncate">{company.name}</h3>
            <TierBadge tier={company.tier} />
          </div>
          {company.domain && (
            <p className="text-xs text-[#4d6a87] truncate mt-0.5">{company.domain}</p>
          )}
          {company.nif && (
            <p className="text-xs text-[#4d6a87] mt-0.5">NIF {company.nif}</p>
          )}
          {company.billingEmail && (
            <p className="text-xs text-[#4d6a87] truncate mt-0.5">{company.billingEmail}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Clientes', value: String(company.clientCount) },
          { label: 'Pedidos', value: String(company.orderCount) },
          { label: 'Lojas', value: String(company.activeStoreCount) },
          { label: 'Gasto', value: formatCurrency(company.totalSpent).replace('€', '€ ') },
        ].map((s) => (
          <div key={s.label} className="bg-[#07111f] border border-[#1a2f48]/60 rounded-lg p-2 text-center">
            <p className="text-sm font-black text-white tabular-nums truncate">{s.value}</p>
            <p className="text-[9px] text-[#4d6a87] mt-0.5 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Departments */}
      {company.departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {company.departments.slice(0, 3).map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#1a2f48] text-[#8ba8c7]"
            >
              {d.name}
            </span>
          ))}
          {company.departments.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#1a2f48] text-[#4d6a87]">
              +{company.departments.length - 3} mais
            </span>
          )}
        </div>
      )}

      {/* Budget bar */}
      <BudgetBar utilization={company.budgetUtilization} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onManage}
          className="flex-1 py-2 rounded-lg bg-[#0d1f3a] border border-[#1a3a5c] text-[#4da3ff] text-xs font-semibold hover:bg-[#102131] hover:text-[#74e7ff] transition-all"
        >
          Gerir
        </button>
        <Link
          href={`/stores?companyId=${company.id}`}
          className="flex-1 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-xs font-semibold text-center hover:bg-[#102131] hover:text-white transition-all"
        >
          Lojas
        </Link>
        <Link
          href={`/budgets?companyId=${company.id}`}
          className="flex-1 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-xs font-semibold text-center hover:bg-[#102131] hover:text-white transition-all"
        >
          Budgets
        </Link>
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          className="p-2 rounded-lg border border-[#1a2f48] text-[#4d6a87] hover:bg-[#102131] hover:text-[#4da3ff] transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 3 3L4 12l-3 .5.5-3L8.5 1.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [stats, setStats] = useState<KpiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    data?: Partial<CompanyFormData> & { id?: string };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [companiesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/companies`, { headers }),
        fetch(`${API_BASE}/api/v1/companies/stats`, { headers }),
      ]);
      const [companiesData, statsData] = await Promise.all([
        companiesRes.json() as Promise<CompanySummary[]>,
        statsRes.json() as Promise<KpiStats>,
      ]);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
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
    let result = companies;
    if (tierFilter) result = result.filter((c) => c.tier === tierFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.domain ?? '').toLowerCase().includes(q) ||
          (c.nif ?? '').includes(q) ||
          (c.billingEmail ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [companies, tierFilter, search]);

  function openEditFromDetail(company: CompanyDetail) {
    setSelectedCompanyId(null);
    setModal({
      mode: 'edit',
      data: {
        id: company.id,
        name: company.name,
        nif: company.nif ?? '',
        domain: company.domain ?? '',
        tier: company.tier,
        billingEmail: company.billingEmail ?? '',
        primaryColor: company.primaryColor ?? '#4da3ff',
      },
    });
  }

  function openEdit(company: CompanySummary) {
    setModal({
      mode: 'edit',
      data: {
        id: company.id,
        name: company.name,
        nif: company.nif ?? '',
        domain: company.domain ?? '',
        tier: company.tier,
        billingEmail: company.billingEmail ?? '',
        primaryColor: company.primaryColor ?? '#4da3ff',
      },
    });
  }

  return (
    <div>
      {/* Detail modal */}
      {selectedCompanyId && (
        <CompanyDetailModal
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onEdit={openEditFromDetail}
        />
      )}

      {/* Create/Edit modal */}
      {modal && (
        <CompanyModal
          mode={modal.mode}
          initialData={modal.data}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Empresas</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} empresas`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6.5 1v11M1 6.5h11" />
          </svg>
          Nova Empresa
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar empresas.</p>
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
          <KpiCard label="Total Empresas" value={String(stats.totalCompanies)} />
          <KpiCard
            label="Clientes B2B"
            value={String(stats.totalClients)}
            sub="em empresas ativas"
          />
          <KpiCard label="Receita B2B" value={formatCurrency(stats.totalRevenue)} />
          <KpiCard
            label="Lojas Ativas"
            value={String(stats.activeStores)}
            sub="company stores"
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
            placeholder="Pesquisar nome, domínio, NIF..."
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

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl text-center py-16 text-[#4d6a87]">
          <svg className="mx-auto mb-3 opacity-30" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="10" width="32" height="26" rx="2" />
            <path d="M10 10V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" />
            <path d="M15 20h10M20 16v8" />
          </svg>
          <p className="text-sm font-medium">Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onManage={() => setSelectedCompanyId(company.id)}
              onEdit={() => openEdit(company)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
