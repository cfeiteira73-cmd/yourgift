'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryStats {
  totalVariants: number;
  outOfStock: number;
  lowStock: number;
  activeAlerts: number;
  healthyStock: number;
}

interface InventoryAlert {
  id: string;
  alertType: string;
  currentStock: number;
  createdAt: string;
  variant: { sku: string; stock: number; color: string | null };
  product: { title: string; supplier: string; category: string };
}

interface LowStockItem {
  id: string;
  sku: string;
  stock: number;
  color: string | null;
  product: { title: string; supplier: string; category: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function StockBar({ stock }: { stock: number }) {
  const max = 200;
  const pct = Math.min((stock / max) * 100, 100);
  const color =
    stock === 0
      ? '#f87171'
      : stock <= 10
        ? '#fbbf24'
        : '#4ade80';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs font-mono tabular-nums w-8 text-right"
        style={{ color }}
      >
        {stock}
      </span>
    </div>
  );
}

function AlertTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    out_of_stock:
      'bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20',
    low_stock:
      'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20',
    reorder_triggered:
      'bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20',
  };
  const labels: Record<string, string> = {
    out_of_stock: 'Sem Stock',
    low_stock: 'Stock Baixo',
    reorder_triggered: 'Reorder',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${styles[type] ?? 'bg-[#1a2f48] text-[#8ba8c7]'}`}
    >
      {labels[type] ?? type}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  accent?: string;
  pulse?: boolean;
}

function KpiCard({ label, value, accent = '#8ba8c7', pulse = false }: KpiCardProps) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87]">
        {label}
      </p>
      <p
        className={`text-2xl font-black tabular-nums ${pulse ? 'animate-pulse' : ''}`}
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkLoading, setCheckLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  const addToast = useCallback(
    (message: string, type: Toast['type'] = 'info') => {
      const id = toastId + 1;
      setToastId(id);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [toastId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, alertsRes, lowRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/inventory/stats`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/inventory/alerts`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/inventory/low-stock`, { headers: authHeaders() }),
      ]);
      const [statsData, alertsData, lowData] = await Promise.all([
        statsRes.json() as Promise<InventoryStats>,
        alertsRes.json() as Promise<InventoryAlert[]>,
        lowRes.json() as Promise<LowStockItem[]>,
      ]);
      setStats(statsData);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setLowStock(Array.isArray(lowData) ? lowData : []);
    } catch {
      addToast('Erro ao carregar dados de inventário.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadAll();
    // Auto-refresh every 5 minutes
    const timer = setInterval(() => void loadAll(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const triggerCheck = async () => {
    setCheckLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/inventory/check`, {
        headers: authHeaders(),
      });
      const result = await res.json() as { alerts: number; reorders: number };
      addToast(
        `Check concluído — ${result.alerts} novos alertas, ${result.reorders} reorders.`,
        'success',
      );
      await loadAll();
    } catch {
      addToast('Erro ao executar check de inventário.', 'error');
    } finally {
      setCheckLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/inventory/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      if (stats) {
        setStats({ ...stats, activeAlerts: Math.max(0, stats.activeAlerts - 1) });
      }
      addToast('Alerta resolvido.', 'success');
    } catch {
      addToast('Erro ao resolver alerta.', 'error');
    }
  };

  return (
    <div className="relative">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg pointer-events-auto transition-all ${
              t.type === 'success'
                ? 'bg-[#0d2a1e] border border-[#4ade80]/30 text-[#4ade80]'
                : t.type === 'error'
                  ? 'bg-[#2a0a0a] border border-[#f87171]/30 text-[#f87171]'
                  : 'bg-[#0b1526] border border-[#4da3ff]/30 text-[#4da3ff]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Inventário</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            Monitorização de stock e alertas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all disabled:opacity-50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className={loading ? 'animate-spin' : ''}
            >
              <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
            </svg>
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void triggerCheck()}
            disabled={checkLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-all disabled:opacity-50"
          >
            {checkLoading ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="animate-spin"
              >
                <circle cx="7" cy="7" r="5.5" strokeDasharray="20 15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M7 1v3M7 10v3M1 7h3M10 7h3M3.22 3.22l2.12 2.12M8.66 8.66l2.12 2.12M3.22 10.78l2.12-2.12M8.66 5.34l2.12-2.12" />
              </svg>
            )}
            Run Check
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="Total Variantes"
          value={loading ? '—' : (stats?.totalVariants ?? 0)}
          accent="#8ba8c7"
        />
        <KpiCard
          label="Sem Stock"
          value={loading ? '—' : (stats?.outOfStock ?? 0)}
          accent={stats?.outOfStock ? '#f87171' : '#4ade80'}
          pulse={(stats?.outOfStock ?? 0) > 0}
        />
        <KpiCard
          label="Stock Baixo"
          value={loading ? '—' : (stats?.lowStock ?? 0)}
          accent={stats?.lowStock ? '#fbbf24' : '#4ade80'}
        />
        <KpiCard
          label="Alertas Activos"
          value={loading ? '—' : (stats?.activeAlerts ?? 0)}
          accent={stats?.activeAlerts ? '#f87171' : '#4ade80'}
          pulse={(stats?.activeAlerts ?? 0) > 0}
        />
        <KpiCard
          label="Stock Saudável"
          value={loading ? '—' : (stats?.healthyStock ?? 0)}
          accent="#4ade80"
        />
      </div>

      {/* Active Alerts */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f87171] animate-pulse" />
          Alertas Activos
          {alerts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20">
              {alerts.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center text-[#4d6a87] text-sm">
            A carregar...
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center">
            <p className="text-[#4ade80] text-sm font-medium">Sem alertas activos</p>
            <p className="text-[#4d6a87] text-xs mt-1">Todos os níveis de stock estão OK.</p>
          </div>
        ) : (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">SKU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Produto</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Cor</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Stock</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Tipo</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Desde</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2f48]">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-[#102131] transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#4da3ff]">{alert.variant.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium truncate max-w-[160px]">
                        {alert.product.title}
                      </p>
                      <p className="text-[#4d6a87] text-xs">{alert.product.supplier}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#8ba8c7]">{alert.variant.color ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          alert.variant.stock === 0 ? 'text-[#f87171]' : 'text-[#fbbf24]'
                        }`}
                      >
                        {alert.variant.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AlertTypeBadge type={alert.alertType} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#4d6a87] tabular-nums">
                        {formatDate(alert.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void resolveAlert(alert.id)}
                        className="text-xs text-[#4d6a87] hover:text-[#4da3ff] border border-[#1a2f48] hover:border-[#4da3ff]/40 px-2 py-1 rounded transition-all"
                      >
                        Resolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Low Stock Items */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="2" width="10" height="10" rx="1.5" />
            <path d="M5 7h4M7 5v4" />
          </svg>
          Itens com Stock Baixo
          {lowStock.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20">
              {lowStock.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center text-[#4d6a87] text-sm">
            A carregar...
          </div>
        ) : lowStock.length === 0 ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center">
            <p className="text-[#4ade80] text-sm font-medium">Nenhum item com stock baixo</p>
          </div>
        ) : (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">SKU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Produto</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Categoria</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] min-w-[140px]">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2f48]">
                {lowStock.map((item) => (
                  <tr key={item.id} className="hover:bg-[#102131] transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#4da3ff]">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium truncate max-w-[160px]">
                        {item.product.title}
                      </p>
                      {item.color && (
                        <p className="text-[#4d6a87] text-xs">{item.color}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#8ba8c7]">{item.product.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#8ba8c7]">{item.product.supplier}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <StockBar stock={item.stock} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
