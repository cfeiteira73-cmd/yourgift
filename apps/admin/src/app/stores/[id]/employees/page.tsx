'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE, getAdminToken, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreEmployee {
  id: string;
  storeId: string;
  email: string;
  name: string;
  department: string | null;
  allowance: number;
  spent: number;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  primaryColor?: string;
}

interface AddEmployeeForm {
  name: string;
  email: string;
  department: string;
  allowance: string;
}

const EMPTY_FORM: AddEmployeeForm = {
  name: '',
  email: '',
  department: '',
  allowance: '0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StoreEmployeesPage() {
  const params = useParams<{ id: string }>();
  const storeId = params.id;

  const [store, setStore] = useState<Store | null>(null);
  const [employees, setEmployees] = useState<StoreEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddEmployeeForm>(EMPTY_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAllowance, setEditAllowance] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [search, setSearch] = useState('');

  // ── Load store and employees ───────────────────────────────────────────────

  const loadStore = useCallback(async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/company-stores/${storeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json() as Store;
      setStore(data);
    } catch {
      // non-critical
    }
  }, [storeId]);

  const loadEmployees = useCallback(async (slug: string) => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(slug)}/employees`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as StoreEmployee[];
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  useEffect(() => {
    if (store?.slug) {
      loadEmployees(store.slug);
    }
  }, [store, loadEmployees]);

  // ── Add employee ──────────────────────────────────────────────────────────

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setAddSaving(true);
    setAddError('');
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(store.slug)}/employees`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: addForm.name.trim(),
            email: addForm.email.trim().toLowerCase(),
            department: addForm.department.trim() || undefined,
            allowance: addForm.allowance ? parseFloat(addForm.allowance) : 0,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Erro ao adicionar colaborador');
      }
      setShowAddModal(false);
      setAddForm(EMPTY_FORM);
      await loadEmployees(store.slug);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setAddSaving(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggleActive(emp: StoreEmployee) {
    if (!store) return;
    try {
      const token = getAdminToken();
      await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(store.slug)}/employees/${emp.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ isActive: !emp.isActive }),
        },
      );
      await loadEmployees(store.slug);
    } catch {
      // silent
    }
  }

  // ── Save allowance ────────────────────────────────────────────────────────

  async function handleSaveAllowance(emp: StoreEmployee) {
    if (!store) return;
    setEditSaving(true);
    try {
      const token = getAdminToken();
      await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(store.slug)}/employees/${emp.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ allowance: parseFloat(editAllowance) || 0 }),
        },
      );
      setEditingId(null);
      await loadEmployees(store.slug);
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  }

  const accent = store?.primaryColor ?? '#4da3ff';

  const filtered = search
    ? employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.email.toLowerCase().includes(search.toLowerCase()) ||
          (e.department ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : employees;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-[#4d6a87]">
        <Link href="/stores" className="hover:text-white transition-colors">
          Lojas
        </Link>
        <span>/</span>
        <span className="text-white font-semibold">{store?.name ?? storeId}</span>
        <span>/</span>
        <span>Colaboradores</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Colaboradores
          </h1>
          {store && (
            <p className="text-sm text-[#4d6a87] mt-1">
              Loja{' '}
              <span className="text-[#8ba8c7] font-mono">/{store.slug}</span>
              {' · '}
              {loading ? '—' : `${filtered.length} colaborador${filtered.length !== 1 ? 'es' : ''}`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all"
          style={{ background: accent }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Adicionar Colaborador
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar colaboradores.</p>
          {store && (
            <button type="button" onClick={() => loadEmployees(store.slug)} className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors">
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5l3 3" />
        </svg>
        <input
          type="text"
          placeholder="Pesquisar nome, email, departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#4d6a87] text-sm">A carregar colaboradores...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-3xl mb-3 text-[#4d6a87]">👥</p>
            <p className="text-sm text-[#4d6a87]">
              {search ? 'Nenhum resultado encontrado' : 'Ainda não há colaboradores nesta loja'}
            </p>
            {!search && (
              <p className="text-xs text-[#4d6a87] mt-1">
                Adicione o primeiro colaborador com o botão acima
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1a2f48] bg-[#07111f]/50">
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Nome / Email</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Dept.</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Saldo (€)</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Gasto (€)</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Restante</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Último acesso</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Estado</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#4d6a87]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, idx) => {
                  const remaining = Math.max(0, emp.allowance - emp.spent);
                  const isEditing = editingId === emp.id;

                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors ${idx === filtered.length - 1 ? 'border-b-0' : ''}`}
                    >
                      {/* Name / email */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{emp.name}</p>
                        <p className="text-xs text-[#4d6a87] mt-0.5">{emp.email}</p>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-4 text-[#8ba8c7]">
                        {emp.department ?? <span className="text-[#4d6a87]">—</span>}
                      </td>

                      {/* Allowance — inline edit */}
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAllowance}
                              onChange={(e) => setEditAllowance(e.target.value)}
                              className="w-24 px-2 py-1 bg-[#07111f] border border-[#4da3ff]/50 rounded text-white text-sm text-right focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveAllowance(emp)}
                              disabled={editSaving}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-[#4da3ff] text-white hover:bg-[#3b8de0] disabled:opacity-50 transition-colors"
                            >
                              {editSaving ? '...' : '✓'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded text-[11px] text-[#4d6a87] hover:text-white border border-[#1a2f48] transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(emp.id);
                              setEditAllowance(emp.allowance.toString());
                            }}
                            className="font-bold text-white hover:text-[#4da3ff] transition-colors cursor-pointer group"
                            title="Clique para editar"
                          >
                            {formatCurrency(emp.allowance)}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-[#4da3ff] transition-opacity">✎</span>
                          </button>
                        )}
                      </td>

                      {/* Spent */}
                      <td className="px-5 py-4 text-right text-[#8ba8c7]">
                        {formatCurrency(emp.spent)}
                      </td>

                      {/* Remaining */}
                      <td className="px-5 py-4 text-right">
                        <span
                          className="font-bold tabular-nums"
                          style={{
                            color:
                              emp.allowance === 0
                                ? '#4d6a87'
                                : remaining < emp.allowance * 0.1
                                ? '#f87171'
                                : remaining < emp.allowance * 0.3
                                ? '#fb923c'
                                : '#63e6be',
                          }}
                        >
                          {emp.allowance === 0 ? '—' : formatCurrency(remaining)}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-5 py-4 text-[#4d6a87] text-xs whitespace-nowrap">
                        {formatDate(emp.lastLoginAt)}
                      </td>

                      {/* Status toggle */}
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(emp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer hover:opacity-80 ${
                            emp.isActive
                              ? 'bg-[#063e1f] text-[#63e6be] border-[#063e1f]'
                              : 'bg-[#102131] text-[#4d6a87] border-[#1a2f48]'
                          }`}
                          title={emp.isActive ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-[#63e6be]' : 'bg-[#4d6a87]'}`} />
                          {emp.isActive ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(emp.id);
                            setEditAllowance(emp.allowance.toString());
                          }}
                          className="text-xs text-[#4d6a87] hover:text-[#4da3ff] transition-colors px-2 py-1 rounded hover:bg-[#102131]"
                        >
                          Editar saldo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1a2f48] bg-[#0b1526] shadow-2xl overflow-hidden">
            {/* Color bar */}
            <div className="h-1" style={{ background: accent }} />

            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
              <h2 className="text-base font-black text-white">Adicionar Colaborador</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#4d6a87] hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              {addError && (
                <div className="rounded-lg bg-[#2a0a0a]/50 border border-[#f87171]/20 px-3 py-2 text-xs text-[#f87171]">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Nome *</label>
                  <input
                    required
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="João Silva"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Departamento</label>
                  <input
                    type="text"
                    value={addForm.department}
                    onChange={(e) => setAddForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="Marketing"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Email *</label>
                <input
                  required
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@empresa.pt"
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">
                  Saldo Mensal (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.allowance}
                  onChange={(e) => setAddForm((f) => ({ ...f, allowance: e.target.value }))}
                  placeholder="100.00"
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
                <p className="text-[11px] text-[#4d6a87]">
                  0 = sem limite de saldo
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddForm(EMPTY_FORM); setAddError(''); }}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm font-medium hover:bg-[#102131] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-all"
                  style={{ background: accent }}
                >
                  {addSaving ? 'A adicionar...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
