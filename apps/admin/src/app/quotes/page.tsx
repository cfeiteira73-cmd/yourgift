'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

interface QuoteItem {
  id: string;
  productId?: string;
  title: string;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
}

interface Quote {
  id: string;
  ref: string;
  status: 'draft' | 'submitted' | 'pricing' | 'approved' | 'rejected' | 'converted';
  totalAmount?: number;
  clientId?: string;
  client?: { name?: string; email?: string; company?: string };
  companyId?: string;
  company?: { name?: string };
  items?: QuoteItem[];
  eventDate?: string;
  createdAt: string;
  updatedAt?: string;
}

interface PricingForm {
  [itemId: string]: { unitCost: string; unitPrice: string };
}

const ALL_STATUSES = ['draft', 'submitted', 'pricing', 'approved', 'rejected', 'converted'] as const;

const STATUS_META: Record<Quote['status'], { label: string; bg: string; text: string; border: string }> = {
  draft:     { label: 'Rascunho',   bg: 'bg-[#102131]',  text: 'text-[#8ba8c7]', border: 'border-[#1a2f48]' },
  submitted: { label: 'Submetido',  bg: 'bg-[#0d1f3a]',  text: 'text-[#4da3ff]', border: 'border-[#1a3a5c]' },
  pricing:   { label: 'Pricing',    bg: 'bg-[#2a1f00]',  text: 'text-[#f59e0b]', border: 'border-[#3a2f00]' },
  approved:  { label: 'Aprovado',   bg: 'bg-[#063e1f]',  text: 'text-[#63e6be]', border: 'border-[#063e1f]' },
  rejected:  { label: 'Rejeitado',  bg: 'bg-[#2a0a0a]',  text: 'text-[#f87171]', border: 'border-[#3a1515]' },
  converted: { label: 'Convertido', bg: 'bg-[#1a0f3a]',  text: 'text-[#a78bfa]', border: 'border-[#2a1f4a]' },
};

const SELECT_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`;

function StatusBadge({ status }: { status: Quote['status'] }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      {m.label}
    </span>
  );
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Quote['status'] | 'all'>('all');
  const [search, setSearch] = useState('');

  // Pricing modal
  const [pricingQuote, setPricingQuote] = useState<Quote | null>(null);
  const [pricingForm, setPricingForm] = useState<PricingForm>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/quotes?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setQuotes(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let arr = quotes;
    if (activeTab !== 'all') arr = arr.filter((q) => q.status === activeTab);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (q) =>
          q.ref?.toLowerCase().includes(s) ||
          q.client?.name?.toLowerCase().includes(s) ||
          q.client?.email?.toLowerCase().includes(s) ||
          q.company?.name?.toLowerCase().includes(s)
      );
    }
    return arr;
  }, [quotes, activeTab, search]);

  async function patchQuote(id: string, body: Record<string, unknown>) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/api/v1/quotes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Erro ao atualizar');
    }
    return res.json();
  }

  async function handleApprove(id: string) {
    if (!confirm('Aprovar este orçamento?')) return;
    await patchQuote(id, { status: 'approved' });
    await load();
  }

  async function handleReject(id: string) {
    if (!confirm('Rejeitar este orçamento?')) return;
    await patchQuote(id, { status: 'rejected' });
    await load();
  }

  async function handleConvert(id: string) {
    if (!confirm('Converter este orçamento em encomenda?')) return;
    await patchQuote(id, { status: 'converted' });
    await load();
  }

  function openPricingModal(quote: Quote) {
    const initial: PricingForm = {};
    (quote.items ?? []).forEach((item) => {
      initial[item.id] = {
        unitCost: item.unitCost?.toString() ?? '',
        unitPrice: item.unitPrice?.toString() ?? '',
      };
    });
    setPricingForm(initial);
    setPricingQuote(quote);
    setPricingError('');
  }

  async function savePricing(e: React.FormEvent) {
    e.preventDefault();
    if (!pricingQuote) return;
    setPricingSaving(true);
    setPricingError('');
    try {
      const items = (pricingQuote.items ?? []).map((item) => ({
        id: item.id,
        unitCost: parseFloat(pricingForm[item.id]?.unitCost ?? '0'),
        unitPrice: parseFloat(pricingForm[item.id]?.unitPrice ?? '0'),
      }));
      await patchQuote(pricingQuote.id, { status: 'pricing', items });
      setPricingQuote(null);
      await load();
    } catch (err: any) {
      setPricingError(err.message ?? 'Erro desconhecido');
    } finally {
      setPricingSaving(false);
    }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quotes.length };
    ALL_STATUSES.forEach((s) => { counts[s] = quotes.filter((q) => q.status === s).length; });
    return counts;
  }, [quotes]);

  const totalAmount = useMemo(() => filtered.reduce((s, q) => s + (q.totalAmount ?? 0), 0), [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Orçamentos / RFQ</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} orçamentos · ${formatCurrency(totalAmount)} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar orçamentos.</p>
          <button type="button" onClick={load} className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5l3 3" />
        </svg>
        <input
          type="text"
          placeholder="Pesquisar ref, cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#1a2f48] overflow-x-auto pb-0">
        {(['all', ...ALL_STATUSES] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'all' ? 'Todos' : STATUS_META[tab as Quote['status']].label;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                isActive
                  ? 'border-[#4da3ff] text-[#4da3ff]'
                  : 'border-transparent text-[#4d6a87] hover:text-[#8ba8c7]'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${isActive ? 'bg-[#0d1f3a] text-[#4da3ff]' : 'bg-[#102131] text-[#4d6a87]'}`}>
                {tabCounts[tab] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['REF', 'Cliente', 'Empresa', 'Itens', 'Total', 'Estado', 'Evento', 'Criado', ''].map((h) => (
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
                      <td key={j} className="px-4 py-3"><div className="skeleton h-3 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-[#4d6a87] text-sm">
                    Nenhum orçamento encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#4da3ff]">{q.ref ?? q.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white font-medium truncate max-w-[140px]">{q.client?.name ?? '—'}</p>
                      <p className="text-xs text-[#4d6a87] truncate max-w-[140px]">{q.client?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#8ba8c7] truncate max-w-[120px]">{q.company?.name ?? q.companyId?.slice(0, 8) ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs tabular-nums text-[#8ba8c7]">{q.items?.length ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                      {q.totalAmount ? formatCurrency(q.totalAmount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#4d6a87] tabular-nums">{q.eventDate ? formatDate(q.eventDate) : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#4d6a87] tabular-nums">{formatDate(q.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {q.status === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => openPricingModal(q)}
                            className="px-2.5 py-1 rounded-lg bg-[#2a1f00] text-[#f59e0b] text-xs font-semibold border border-[#3a2f00] hover:bg-[#3a2f00] transition-colors whitespace-nowrap"
                          >
                            Price It
                          </button>
                        )}
                        {q.status === 'pricing' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(q.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#063e1f] text-[#63e6be] text-xs font-semibold border border-[#063e1f] hover:bg-[#0a5528] transition-colors whitespace-nowrap"
                          >
                            Aprovar
                          </button>
                        )}
                        {q.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleConvert(q.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#1a0f3a] text-[#a78bfa] text-xs font-semibold border border-[#2a1f4a] hover:bg-[#241552] transition-colors whitespace-nowrap"
                          >
                            Converter
                          </button>
                        )}
                        {(q.status === 'pricing' || q.status === 'submitted') && (
                          <button
                            type="button"
                            onClick={() => handleReject(q.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#2a0a0a] text-[#f87171] text-xs font-semibold border border-[#3a1515] hover:bg-[#3a1515] transition-colors whitespace-nowrap"
                          >
                            Rejeitar
                          </button>
                        )}
                        {!['submitted', 'pricing', 'approved'].includes(q.status) && (
                          <span className="text-xs text-[#4d6a87]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Modal */}
      {pricingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPricingQuote(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#1a2f48] bg-[#0b1526] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
              <div>
                <h2 className="text-base font-black text-white">Pricing — {pricingQuote.ref}</h2>
                <p className="text-xs text-[#4d6a87] mt-0.5">Definir custo e preço por item</p>
              </div>
              <button type="button" onClick={() => setPricingQuote(null)} className="text-[#4d6a87] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
            <form onSubmit={savePricing} className="overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Items header */}
                <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-[#1a2f48] bg-[#07111f]">
                  <div className="col-span-4 text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider">Item</div>
                  <div className="col-span-1 text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider text-center">Qtd</div>
                  <div className="col-span-3 text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider">Custo unit. (€)</div>
                  <div className="col-span-3 text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider">Preço unit. (€)</div>
                  <div className="col-span-1 text-[10px] font-bold text-[#4d6a87] uppercase tracking-wider text-right">Margem</div>
                </div>
                {(pricingQuote.items ?? []).length === 0 ? (
                  <p className="px-6 py-8 text-center text-[#4d6a87] text-sm">Sem itens neste orçamento</p>
                ) : (
                  (pricingQuote.items ?? []).map((item) => {
                    const cost = parseFloat(pricingForm[item.id]?.unitCost ?? '0') || 0;
                    const price = parseFloat(pricingForm[item.id]?.unitPrice ?? '0') || 0;
                    const margin = cost > 0 && price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '—';
                    const marginNum = typeof margin === 'string' && margin !== '—' ? parseFloat(margin) : null;
                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-3 border-b border-[#1a2f48]/50 hover:bg-[#102131]/30 transition-colors">
                        <div className="col-span-4">
                          <p className="text-sm text-white font-medium truncate">{item.title}</p>
                          {item.productId && <p className="text-[10px] text-[#4d6a87] font-mono">{item.productId.slice(0, 8)}</p>}
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-xs tabular-nums text-[#8ba8c7]">{item.quantity}</span>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricingForm[item.id]?.unitCost ?? ''}
                            onChange={(e) => setPricingForm((f) => ({ ...f, [item.id]: { ...f[item.id], unitCost: e.target.value } }))}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-xs text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors tabular-nums"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricingForm[item.id]?.unitPrice ?? ''}
                            onChange={(e) => setPricingForm((f) => ({ ...f, [item.id]: { ...f[item.id], unitPrice: e.target.value } }))}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-[#07111f] border border-[#1a2f48] rounded-lg text-xs text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors tabular-nums"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <span className={`text-xs tabular-nums font-semibold ${marginNum !== null ? (marginNum >= 30 ? 'text-[#63e6be]' : marginNum >= 15 ? 'text-[#f59e0b]' : 'text-[#f87171]') : 'text-[#4d6a87]'}`}>
                            {margin !== '—' ? `${margin}%` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="px-6 py-4 border-t border-[#1a2f48] bg-[#07111f]">
                {pricingError && (
                  <p className="text-xs text-[#f87171] mb-3">{pricingError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPricingQuote(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm font-medium hover:bg-[#102131] transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pricingSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#4da3ff] text-white text-sm font-semibold hover:bg-[#3b8de0] disabled:opacity-50 transition-all"
                  >
                    {pricingSaving ? 'A guardar...' : 'Guardar Pricing'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
