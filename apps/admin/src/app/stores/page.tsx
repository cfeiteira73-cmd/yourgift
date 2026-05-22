'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, API_BASE, getAdminToken } from '@/lib/utils';

interface Store {
  id: string;
  name: string;
  slug: string;
  companyId: string;
  company?: { name: string };
  primaryColor?: string;
  monthlyBudget?: number;
  isActive: boolean;
  productCount?: number;
  allowedEmails?: string[];
  createdAt: string;
}

interface CreateStoreForm {
  name: string;
  companyId: string;
  slug: string;
  primaryColor: string;
  monthlyBudget: string;
  allowedEmails: string;
}

const EMPTY_FORM: CreateStoreForm = {
  name: '',
  companyId: '',
  slug: '',
  primaryColor: '#4da3ff',
  monthlyBudget: '',
  allowedEmails: '',
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function StoreCard({ store, onManage, onEmployees }: { store: Store; onManage: (s: Store) => void; onEmployees: (s: Store) => void }) {
  const color = store.primaryColor ?? '#4da3ff';
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden hover:border-[#4da3ff]/30 transition-all group">
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <p className="font-black text-white text-sm truncate">{store.name}</p>
            <p className="text-xs text-[#4d6a87] truncate mt-0.5">{store.company?.name ?? store.companyId.slice(0, 8)}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${
              store.isActive
                ? 'bg-[#063e1f] text-[#63e6be] border-[#063e1f]'
                : 'bg-[#102131] text-[#4d6a87] border-[#1a2f48]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${store.isActive ? 'bg-[#63e6be]' : 'bg-[#4d6a87]'}`} />
            {store.isActive ? 'Ativa' : 'Inativa'}
          </span>
        </div>

        {/* Slug */}
        <div className="flex items-center gap-1.5 mb-4">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round">
            <path d="M5 2H3a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V7M9 1h2m0 0v2m0-2L6 6" />
          </svg>
          <span className="text-[11px] font-mono text-[#4d6a87] truncate">/{store.slug}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-[#102131] border border-[#1a2f48] px-3 py-2">
            <p className="text-[9px] text-[#4d6a87] uppercase tracking-wider font-semibold mb-0.5">Produtos</p>
            <p className="text-sm font-black text-white tabular-nums">{store.productCount ?? 0}</p>
          </div>
          <div className="rounded-lg bg-[#102131] border border-[#1a2f48] px-3 py-2">
            <p className="text-[9px] text-[#4d6a87] uppercase tracking-wider font-semibold mb-0.5">Budget/mês</p>
            <p className="text-sm font-black text-white tabular-nums">
              {store.monthlyBudget ? formatCurrency(store.monthlyBudget) : '—'}
            </p>
          </div>
        </div>

        {/* Allowed emails count */}
        {(store.allowedEmails?.length ?? 0) > 0 && (
          <p className="text-[11px] text-[#4d6a87] mb-4">
            {store.allowedEmails!.length} email{store.allowedEmails!.length !== 1 ? 's' : ''} autorizados
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onManage(store)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-white text-xs font-semibold hover:bg-[#3b8de0] transition-colors"
          >
            Gerir
          </button>
          <button
            type="button"
            onClick={() => onEmployees(store)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-xs font-semibold text-center hover:bg-[#102131] hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="5" r="2.5" />
              <path d="M1 13c0-2.8 2.2-5 5-5h.5M13 11v4M11 13h4" />
            </svg>
            Colaboradores
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="h-1.5 skeleton" />
      <div className="p-5 space-y-3">
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/2" />
        <div className="skeleton h-3 rounded w-24 mt-2" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="skeleton h-12 rounded-lg" />
          <div className="skeleton h-12 rounded-lg" />
        </div>
        <div className="skeleton h-8 rounded-lg mt-2" />
      </div>
    </div>
  );
}

const SELECT_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`;

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateStoreForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/stores?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setStores(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let arr = stores;
    if (statusFilter === 'active') arr = arr.filter((s) => s.isActive);
    if (statusFilter === 'inactive') arr = arr.filter((s) => !s.isActive);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.slug?.toLowerCase().includes(q) ||
          s.company?.name?.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [stores, statusFilter, search]);

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug === '' || f.slug === slugify(f.name) ? slugify(name) : f.slug,
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const token = getAdminToken();
      const allowedEmails = form.allowedEmails
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const res = await fetch(`${API_BASE}/api/v1/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          companyId: form.companyId,
          slug: form.slug,
          primaryColor: form.primaryColor,
          monthlyBudget: form.monthlyBudget ? parseFloat(form.monthlyBudget) : undefined,
          allowedEmails: allowedEmails.length > 0 ? allowedEmails : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Erro ao criar loja');
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

  function handleManage(store: Store) {
    alert(`Gestão da loja "${store.name}" — em breve`);
  }

  function handleEmployees(store: Store) {
    router.push(`/stores/${store.id}/employees`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Lojas de Empresa</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} loja${filtered.length !== 1 ? 's' : ''}`}
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
          Nova Loja
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar lojas.</p>
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
            placeholder="Pesquisar nome, slug..."
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
          <option value="">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
        {(search || statusFilter) && (
          <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); }} className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all">
            Limpar
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
          ? (
            <div className="col-span-full rounded-xl border border-dashed border-[#1a2f48] p-16 text-center">
              <p className="text-3xl mb-3 text-[#4d6a87]">🏪</p>
              <p className="text-sm text-[#4d6a87]">Nenhuma loja encontrada</p>
              <p className="text-xs text-[#4d6a87] mt-1">Crie a primeira loja com o botão acima</p>
            </div>
          )
          : filtered.map((store) => (
            <StoreCard key={store.id} store={store} onManage={handleManage} onEmployees={handleEmployees} />
          ))
        }
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1a2f48] bg-[#0b1526] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
              <h2 className="text-base font-black text-white">Nova Loja</h2>
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
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Acme Corp Store"
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">
                  Slug *
                  <span className="ml-2 text-[#4d6a87] font-normal normal-case">auto-gerado a partir do nome</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[#4d6a87] text-sm">/</span>
                  <input
                    required
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="acme-corp-store"
                    className="flex-1 px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors font-mono"
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Cor Principal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                      className="w-10 h-9 rounded-lg border border-[#1a2f48] bg-[#07111f] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.primaryColor}
                      onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                      placeholder="#4da3ff"
                      className="flex-1 px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">Budget Mensal (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthlyBudget}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))}
                    placeholder="1000.00"
                    className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">
                  Emails Autorizados
                  <span className="ml-2 text-[#4d6a87] font-normal normal-case">separados por vírgula</span>
                </label>
                <textarea
                  rows={3}
                  value={form.allowedEmails}
                  onChange={(e) => setForm((f) => ({ ...f, allowedEmails: e.target.value }))}
                  placeholder="joao@empresa.pt, maria@empresa.pt"
                  className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors resize-none"
                />
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
                  {saving ? 'A criar...' : 'Criar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
