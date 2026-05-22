'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { API_BASE, getAdminToken, timeAgo, formatDateTime } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncLog {
  id: string;
  supplier: string;
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
  createdAt: string;
}

interface SupplierStat {
  supplier: string;
  products: number;
  variants: number;
  lastSync: SyncLog | null;
}

interface SyncResult {
  productsUpserted?: number;
  variantsUpserted?: number;
  stockUpdated?: number;
  durationMs?: number;
  message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPLIER_META: Record<string, { label: string; color: string; description: string }> = {
  midocean: {
    label: 'Midocean',
    color: '#4da3ff',
    description: 'Catálogo europeu premium — +2400 produtos, 12K+ variantes.',
  },
  pf_concept: {
    label: 'PF Concept',
    color: '#a78bfa',
    description: 'Especialista em brindes corporativos — cobertura ibérica.',
  },
  stricker: {
    label: 'Stricker',
    color: '#34d399',
    description: 'Fornecedor complementar — têxteis e acessórios.',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReliabilityBar({ score }: { score: number }) {
  const filled = Math.round(score / 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-1.5 rounded-sm ${
              i < filled ? 'bg-[#4ade80]' : 'bg-[#1a2f48]'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-[#4ade80] tabular-nums">{score}%</span>
    </div>
  );
}

function SyncErrorBadge({ errors }: { errors: string[] }) {
  const [open, setOpen] = useState(false);
  if (!errors.length) return <span className="text-[#4ade80]">0</span>;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[#f87171] hover:underline"
      >
        {errors.length}
      </button>
      {open && (
        <div className="absolute z-20 left-0 top-6 w-72 bg-[#07111f] border border-[#1a2f48] rounded-xl p-3 shadow-xl text-xs text-[#f87171] space-y-1 max-h-40 overflow-y-auto">
          {errors.map((e, i) => (
            <p key={i} className="font-mono break-words">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSuppliersPage() {
  const [stats, setStats] = useState<SupplierStat[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult | null>>({});

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/suppliers/stats`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/suppliers/sync-logs?limit=50`, { headers: authHeaders() }),
      ]);
      const [statsData, logsData] = await Promise.all([statsRes.json(), logsRes.json()]);
      setStats(Array.isArray(statsData) ? (statsData as SupplierStat[]) : []);
      setSyncLogs(Array.isArray(logsData) ? (logsData as SyncLog[]) : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async (supplierKey: string) => {
    const endpoint = supplierKey === 'pf_concept' ? 'pf-concept' : supplierKey;
    setSyncing(supplierKey);
    setSyncResults((prev) => ({ ...prev, [supplierKey]: null }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/suppliers/sync/${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json() as SyncResult;
      setSyncResults((prev) => ({ ...prev, [supplierKey]: data }));
      await load();
    } catch {
      setSyncResults((prev) => ({ ...prev, [supplierKey]: { message: 'Erro de ligação' } }));
    } finally {
      setSyncing(null);
    }
  };

  // KPI totals
  const kpis = useMemo(() => {
    const totalProducts = stats.reduce((s, st) => s + st.products, 0);
    const totalVariants = stats.reduce((s, st) => s + st.variants, 0);
    const latestSync = stats
      .map((st) => st.lastSync?.createdAt)
      .filter(Boolean)
      .sort()
      .pop();
    return { totalProducts, totalVariants, totalSuppliers: stats.length, latestSync };
  }, [stats]);

  // Reliability per supplier
  const reliability = useMemo(() => {
    const result: Record<string, number> = {};
    for (const sup of Object.keys(SUPPLIER_META)) {
      const logs = syncLogs.filter((l) => l.supplier === sup);
      if (!logs.length) { result[sup] = 0; continue; }
      const ok = logs.filter((l) => l.errors.length === 0).length;
      result[sup] = Math.round((ok / logs.length) * 100);
    }
    return result;
  }, [syncLogs]);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <div className="h-8 w-48 bg-[#0b1526] rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-32 bg-[#0b1526] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[#0b1526] border border-[#1a2f48] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-[#0b1526] border border-[#1a2f48] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Fornecedores</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {stats.length} fornecedores · {kpis.totalProducts.toLocaleString('pt-PT')} produtos
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

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Fornecedores', value: kpis.totalSuppliers, suffix: '' },
          { label: 'Total Produtos', value: kpis.totalProducts.toLocaleString('pt-PT'), suffix: '' },
          { label: 'Total Variantes', value: kpis.totalVariants.toLocaleString('pt-PT'), suffix: '' },
          { label: 'Último Sync', value: kpis.latestSync ? timeAgo(kpis.latestSync) : '—', suffix: '' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
            <p className="text-xl font-black text-white tabular-nums">{kpi.value}</p>
            <p className="text-xs text-[#4d6a87] mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-2 xl:grid-cols-3">
        {Object.entries(SUPPLIER_META).map(([key, meta]) => {
          const stat = stats.find((s) => s.supplier === key);
          const logs = syncLogs.filter((l) => l.supplier === key).slice(0, 5);
          const isSyncing = syncing === key;
          const syncResult = syncResults[key];
          const rel = reliability[key] ?? 0;
          const isAvailable = key !== 'stricker';

          return (
            <div key={key} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 flex flex-col gap-4">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black text-white tracking-wide uppercase" style={{ color: meta.color }}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-[#4d6a87] mt-0.5 max-w-[220px]">{meta.description}</p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    stat && stat.products > 0
                      ? 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20'
                      : 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20'
                  }`}
                >
                  {stat && stat.products > 0 ? 'Activo' : 'Sem dados'}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-6">
                <div>
                  <p className="text-lg font-black text-white tabular-nums">
                    {stat ? stat.products.toLocaleString('pt-PT') : '—'}
                  </p>
                  <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest">Produtos</p>
                </div>
                <div>
                  <p className="text-lg font-black text-white tabular-nums">
                    {stat ? stat.variants.toLocaleString('pt-PT') : '—'}
                  </p>
                  <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest">Variantes</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#8ba8c7]">
                    {stat?.lastSync ? timeAgo(stat.lastSync.createdAt) : '—'}
                  </p>
                  <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest">Último sync</p>
                </div>
              </div>

              {/* Reliability */}
              <div>
                <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest mb-1.5">Fiabilidade</p>
                <ReliabilityBar score={rel} />
              </div>

              {/* Recent sync logs */}
              {logs.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest mb-2">Sync logs recentes</p>
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs">
                        <span className={log.errors.length === 0 ? 'text-[#4ade80]' : 'text-[#fbbf24]'}>
                          {log.errors.length === 0 ? '✓' : '⚠'}
                        </span>
                        <span className="text-[#4d6a87] tabular-nums w-20 flex-shrink-0">
                          {timeAgo(log.createdAt)}
                        </span>
                        <span className="text-[#8ba8c7]">
                          {log.productsUpserted} prods · {log.errors.length} erros · {log.durationMs}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync result feedback */}
              {syncResult && (
                <div className={`rounded-lg border px-3 py-2 text-xs font-mono ${
                  syncResult.message
                    ? 'bg-[#f87171]/5 border-[#f87171]/20 text-[#f87171]'
                    : 'bg-[#4ade80]/5 border-[#4ade80]/20 text-[#4ade80]'
                }`}>
                  {syncResult.message
                    ? syncResult.message
                    : `${syncResult.productsUpserted ?? '?'} produtos · ${syncResult.variantsUpserted ?? '?'} variantes · ${syncResult.durationMs ?? '?'}ms`}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {isAvailable && (
                  <button
                    type="button"
                    onClick={() => handleSync(key)}
                    disabled={!!syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 border border-[#4da3ff]/20 text-[#4da3ff] text-xs font-medium hover:bg-[#4da3ff]/20 transition-all disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
                        </svg>
                        A sincronizar...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M10 6A4 4 0 1 1 6 2c1.2 0 2.3.5 3.1 1.3L11 1v3H8" />
                        </svg>
                        Sync Now
                      </>
                    )}
                  </button>
                )}
                <a
                  href={`/products?supplier=${key}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-xs hover:text-white hover:bg-[#102131] transition-all"
                >
                  Ver produtos →
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync History Table */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Histórico de Sincronização</h2>
        <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Fornecedor', 'Produtos', 'Variantes', 'Stock', 'Erros', 'Duração', 'Data'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => {
                const meta = SUPPLIER_META[log.supplier];
                return (
                  <tr key={log.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-sm" style={{ color: meta?.color ?? '#8ba8c7' }}>
                        {meta?.label ?? log.supplier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8ba8c7] tabular-nums">{log.productsUpserted}</td>
                    <td className="px-4 py-3 text-[#8ba8c7] tabular-nums">{log.variantsUpserted}</td>
                    <td className="px-4 py-3 text-[#8ba8c7] tabular-nums">{log.stockUpdated}</td>
                    <td className="px-4 py-3">
                      <SyncErrorBadge errors={log.errors} />
                    </td>
                    <td className="px-4 py-3 text-[#4d6a87] tabular-nums">{log.durationMs}ms</td>
                    <td className="px-4 py-3 text-[#4d6a87] tabular-nums" title={formatDateTime(log.createdAt)}>
                      {timeAgo(log.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {syncLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#4d6a87]">
                    Nenhum sync registado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
