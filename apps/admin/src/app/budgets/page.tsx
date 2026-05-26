'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

interface Budget {
  id: string;
  name: string;
  companyId: string;
  company?: { name: string };
  departmentId?: string;
  department?: { name: string };
  period: 'monthly' | 'quarterly' | 'yearly';
  periodStart?: string;
  periodEnd?: string;
  limitAmount: number;
  spentAmount?: number;
  alertThreshold?: number;
  isActive: boolean;
  createdAt: string;
}

interface CreateBudgetForm {
  name: string;
  companyId: string;
  departmentId: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  periodStart: string;
  periodEnd: string;
  limitAmount: string;
  alertThreshold: string;
}

const EMPTY_FORM: CreateBudgetForm = {
  name: '',
  companyId: '',
  departmentId: '',
  period: 'monthly',
  periodStart: '',
  periodEnd: '',
  limitAmount: '',
  alertThreshold: '80',
};

function ProgressBar({ allocated, spent }: { allocated: number; spent: number }) {
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
  const color =
    pct > 90 ? 'bg-[#f87171]' : pct > 70 ? 'bg-[#f59e0b]' : 'bg-[#63e6be]';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-[#102131] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-[#8ba8c7] w-8 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

const SELECT_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`;

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateBudgetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/budgets?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setBudgets(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let arr = budgets;
    if (statusFilter === 'active') arr = arr.filter((b) => b.isActive);
    if (statusFilter === 'inactive') arr = arr.filter((b) => !b.isActive);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.company?.name?.toLowerCase().includes(q) ||
          b.department?.name?.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [budgets, statusFilter, search]);

  const totalAllocated = useMemo(() => filtered.reduce((s, b) => s + (b.limitAmount ?? 0), 0), [filtered]);
  const totalSpent = useMemo(() => filtered.reduce((s, b) => s + (b.spentAmount ?? 0), 0), [filtered]);
  const utilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          limitAmount: parseFloat(form.limitAmount),
          alertThreshold: parseFloat(form.alertThreshold),
          departmentId: form.departmentId || undefined,
          periodStart: form.periodStart || undefined,
          periodEnd: form.periodEnd || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Erro ao criar budget');
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err: any) {
      setSaveError(err.message ?? 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este budget?')) return;
    const token = getAdminToken();
    await fetch(`${API_BASE}/api/v1/budgets/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    await load();
  }

  const kpiCards = [
    { label: 'Total Budgets', value: loading ? '—' : filtered.length.toString(), sub: 'registados', icon: '💰' },
    { label: 'Total Alocado', value: loading ? '—' : formatCurrency(totalAllocated), sub: 'limite total', icon: '📊' },
    { label: 'Total Gasto', value: loading ? '—' : formatCurrency(totalSpent), sub: 'consumido', icon: '💸' },
    {
      label: 'Utilização',
      value: loading ? '—' : `${utilization.toFixed(1)}%`,
      sub: utilization > 90 ? 'crítico' : utilization > 70 ? 'atenção' : 'saudável',
      accent: utilization > 90 ? 'text-[#f87171]' : utilization > 70 ? 'text-[#f59e0b]' : 'text-[#63e6be]',
      icon: '📈',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Budgets</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} budgets`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-white text-sm font-semibold hover:bg-[#3b8de0] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Novo Budget
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#4d6a87] font-medium uppercase tracking-wider">{card.label}</p>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className={`text-xl font-black tabular-nums ${card.accent ?? 'text-white'}`}>{card.value}</p>
            <p className="text-xs text-[#4d6a87] mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar budgets.</p>
          <button type="button" onClick={load} className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar nome, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: SELECT_CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Todos os estados</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        {(search || statusFilter) && (
          <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); }} className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all">
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Nome', 'Empresa', 'Departamento', 'Período', 'Alocado', 'Gasto', 'Utilização', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a2f48]/50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-3 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-[#4d6a87] text-sm">
                    Nenhum budget encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const spent = b.spentAmount ?? 0;
                  return (
                    <tr key={b.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{b.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#8ba8c7] text-xs">{b.company?.name ?? b.companyId.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#8ba8c7] text-xs">{b.department?.name ?? b.departmentId?.slice(0, 8) ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#102131] text-[#8ba8c7] border border-[#1a2f48] capitalize">
                          {b.period}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                        {formatCurrency(b.limitAmount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#8ba8c7]">
                        {formatCurrency(spent)}
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar allocated={b.limitAmount} spent={spent} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${b.isActive ? 'bg-[#063e1f] text-[#63e6be] border-[#063e1f]' : 'bg-[#102131] text-[#4d6a87] border-[#1a2f48]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-[#63e6be]' : 'bg-[#4d6a87]'}`} />
                          {b.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            className="text-xs text-[#4d6a87] hover:text-[#4da3ff] font-medium transition-colors"
                            onClick={() => alert('Editar — em breve')}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[#4d6a87] hover:text-[#f87171] font-medium transition-colors"
                            onClick={() => handleDelete(b.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1a2f48] bg-[#0b1526] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
              <h2 className="text-base font-black text-white">Novo Budget</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#4d6a87] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {saveError && (
                <div className="rounded-lg bg-[#2a0a0a]/50 border border-[#f87171]/20 px-3 py-2 text-xs text-[#f87171]">
                  {saveError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Nome *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Marketing Q1 2026"
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Company ID *</label>
                  <input
                    required
                    type="text"
                    value={form.companyId}
                    onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                    placeholder="UUID da empresa"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Department ID</label>
                  <input
                    type="text"
                    value={form.departmentId}
                    onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Período *</label>
                <select
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as CreateBudgetForm['period'] }))}
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: SELECT_CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Data Início</label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Data Fim</label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Limite (€) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.limitAmount}
                    onChange={(e) => setForm((f) => ({ ...f, limitAmount: e.target.value }))}
                    placeholder="5000.00"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Alerta (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.alertThreshold}
                    onChange={(e) => setForm((f) => ({ ...f, alertThreshold: e.target.value }))}
                    placeholder="80"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm font-medium hover:bg-[#102131] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#4da3ff] text-white text-sm font-semibold hover:bg-[#3b8de0] disabled:opacity-50 transition-all"
                >
                  {saving ? 'A criar...' : 'Criar Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
