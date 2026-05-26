'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, API_BASE, getAdminToken } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  supplierRef?: string;
  supplier?: string;
  category?: string;
  basePrice: number;
  images?: string[];
  variants?: { price: number; stock?: number; label?: string }[];
  inStock?: boolean;
  stockTotal?: number;
}

const STOCK_STATUS = {
  in_stock: { label: 'Em stock', bg: 'bg-[#063e1f]', text: 'text-[#63e6be]', dot: 'bg-[#63e6be]' },
  low: { label: 'Stock baixo', bg: 'bg-[#2a1f00]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  out: { label: 'Sem stock', bg: 'bg-[#2a0a0a]', text: 'text-[#f87171]', dot: 'bg-[#f87171]' },
};

function getStockStatus(product: Product): keyof typeof STOCK_STATUS {
  const total = product.stockTotal ?? product.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0;
  if (total === 0 && product.inStock === false) return 'out';
  if (total > 0 && total < 50) return 'low';
  if (product.inStock === false) return 'out';
  return 'in_stock';
}

const MARGIN = 0.35; // 35% sell margin on top of base

function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0];
  const minPrice = product.variants?.reduce(
    (min, v) => Math.min(min, v.price ?? Infinity),
    Infinity
  ) ?? product.basePrice;
  const finalPrice = isFinite(minPrice) ? minPrice : product.basePrice;
  const sellPrice = finalPrice * (1 + MARGIN);
  const stockStatus = getStockStatus(product);
  const s = STOCK_STATUS[stockStatus];
  const variantCount = product.variants?.length ?? 0;

  const supplierColor: Record<string, string> = {
    midocean: 'bg-[#0d1f3a] text-[#4da3ff] border-[#1a3a5c]',
    'pf-concept': 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
    pfconcept: 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
    stricker: 'bg-[#1a0f3a] text-[#a78bfa] border-[#2a1f4a]',
  };
  const supplierCls =
    supplierColor[(product.supplier ?? '').toLowerCase()] ??
    'bg-[#102131] text-[#8ba8c7] border-[#1a2f48]';

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden hover:border-[#4da3ff]/30 transition-all group">
      {/* Image */}
      <div className="aspect-square bg-[#102131] overflow-hidden relative">
        {image ? (
          <img
            src={image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-[#4d6a87]">
            🎁
          </div>
        )}
        {/* Stock badge overlay */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${s.bg} ${s.text}`}
            style={{ borderColor: `${s.dot.replace('bg-[', '').replace(']', '')}30` }}
          >
            <span className={`w-1 h-1 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[10px] text-[#4d6a87] font-mono mb-0.5">
          {product.supplierRef ?? product.id.slice(0, 8)}
        </p>
        <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-2">
          {product.title}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.supplier && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${supplierCls}`}>
              {product.supplier.toUpperCase()}
            </span>
          )}
          {product.category && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#102131] text-[#4d6a87] border border-[#1a2f48]">
              {product.category}
            </span>
          )}
          {variantCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#102131] text-[#4d6a87] border border-[#1a2f48]">
              {variantCount} var.
            </span>
          )}
        </div>

        {/* Pricing */}
        {finalPrice > 0 && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-[#4d6a87]">Custo</p>
              <p className="text-xs font-bold text-white tabular-nums">
                {formatCurrency(finalPrice)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#4d6a87]">Venda (+{(MARGIN * 100).toFixed(0)}%)</p>
              <p className="text-xs font-bold text-[#63e6be] tabular-nums">
                {formatCurrency(sellPrice)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="aspect-square skeleton" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-2.5 w-20 rounded" />
        <div className="skeleton h-3 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-4 w-16 rounded mt-3" />
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const [result, setResult] = useState<{ data: Product[]; total: number }>({
    data: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 48;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products?limit=500`);
      const data = await res.json();
      setResult({ data: data.data ?? data ?? [], total: data.total ?? 0 });
    } catch {
      setResult({ data: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(result.data.map((p) => p.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [result.data]);

  const suppliers = useMemo(() => {
    const set = new Set(result.data.map((p) => p.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [result.data]);

  const filtered = useMemo(() => {
    let arr = result.data;
    if (supplierFilter) arr = arr.filter((p) => p.supplier === supplierFilter);
    if (categoryFilter) arr = arr.filter((p) => p.category === categoryFilter);
    if (stockFilter) {
      arr = arr.filter((p) => getStockStatus(p) === stockFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.supplierRef?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [result.data, supplierFilter, categoryFilter, stockFilter, search]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const resetPage = () => setPage(0);

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/suppliers/midocean/sync`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setSyncResult(data);
      await load();
    } catch {
      setSyncResult({ error: true });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Produtos</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} produtos`}
            {result.total > 0 && !loading && ` · ${result.total} em catálogo`}
          </p>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-white text-sm font-semibold hover:bg-[#3b8de0] disabled:opacity-50 transition-all flex-shrink-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={syncing ? 'animate-spin' : ''}
          >
            <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
          </svg>
          {syncing ? 'A sincronizar...' : 'Sync Midocean'}
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div
          className={`rounded-xl p-4 mb-6 text-sm border ${
            syncResult.error
              ? 'bg-[#2a0a0a]/50 text-[#f87171] border-[#f87171]/20'
              : 'bg-[#062515]/50 text-[#63e6be] border-[#63e6be]/20'
          }`}
        >
          {syncResult.error ? (
            <span>⚠ Erro durante a sincronização. Verifique os logs.</span>
          ) : (
            <span>
              ✓ {syncResult.productsUpserted ?? '?'} produtos ·{' '}
              {syncResult.variantsUpserted ?? '?'} variantes ·{' '}
              {syncResult.durationMs ?? '?'}ms
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]"
            width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar produto, ref..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); resetPage(); }}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Categoria</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={supplierFilter}
          onChange={(e) => { setSupplierFilter(e.target.value); resetPage(); }}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Fornecedor</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={stockFilter}
          onChange={(e) => { setStockFilter(e.target.value); resetPage(); }}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Stock</option>
          <option value="in_stock">Em stock</option>
          <option value="low">Stock baixo</option>
          <option value="out">Sem stock</option>
        </select>

        {(search || categoryFilter || supplierFilter || stockFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setCategoryFilter(''); setSupplierFilter(''); setStockFilter(''); resetPage(); }}
            className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {loading
          ? Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)
          : paged.length === 0
          ? (
            <div className="col-span-full rounded-xl border border-dashed border-[#1a2f48] p-16 text-center">
              <p className="text-3xl mb-3 text-[#4d6a87]">🎁</p>
              <p className="text-sm text-[#4d6a87]">Nenhum produto encontrado</p>
              <p className="text-xs text-[#4d6a87] mt-1">Ajuste os filtros ou sincronize o catálogo</p>
            </div>
          )
          : paged.map((product) => <ProductCard key={product.id} product={product} />)
        }
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
          >
            ‹ Anterior
          </button>
          <span className="text-xs text-[#4d6a87] px-3">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
          >
            Próxima ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
