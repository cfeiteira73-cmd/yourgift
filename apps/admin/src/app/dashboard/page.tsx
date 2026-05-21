'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import KpiCard from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, timeAgo, API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  supplier?: string;
  createdAt: string;
  client?: { email?: string; name?: string; company?: string };
  clientId?: string;
}

interface DashboardStats {
  revenueMtd: number;
  revenuePrevMonth: number;
  activeOrders: number;
  pendingApprovals: number;
  avgMarginPct: number;
  avgMarginPrevPct: number;
  revenueSparkline: { v: number }[];
}

interface PipelineColumn {
  status: string;
  label: string;
  color: string;
  dotColor: string;
  orders: Order[];
  totalRevenue: number;
}

interface AiInsight {
  type: 'warning' | 'info' | 'success';
  message: string;
  action?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE_STATUSES = [
  { status: 'created', label: 'CRIADO', color: 'border-[#1a2f48]', dotColor: '#4d6a87' },
  { status: 'paid', label: 'PAGO', color: 'border-[#1a3a5c]', dotColor: '#4da3ff' },
  { status: 'approved', label: 'APROVADO', color: 'border-[#2a1f4a]', dotColor: '#a78bfa' },
  { status: 'producing', label: 'PRODUÇÃO', color: 'border-[#2a1f00]', dotColor: '#f59e0b' },
  { status: 'shipped', label: 'ENVIADO', color: 'border-[#062030]', dotColor: '#74e7ff' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [ordersRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/orders?limit=100`, { headers }),
      ]);

      const ordersData = await ordersRes.json();
      const allOrders: Order[] = Array.isArray(ordersData) ? ordersData : ordersData.data ?? [];

      setOrders(allOrders);

      // Compute stats from orders
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const mtdOrders = allOrders.filter(
        (o) => new Date(o.createdAt) >= startOfMonth
      );
      const prevMonthOrders = allOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= startOfPrevMonth && d <= endOfPrevMonth;
      });

      const revenueMtd = mtdOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      const revenuePrevMonth = prevMonthOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

      const activeOrders = allOrders.filter((o) =>
        ['paid', 'approved', 'producing', 'shipped'].includes(o.status)
      ).length;

      const pendingApprovals = allOrders.filter((o) => o.status === 'paid').length;

      // Build 7-day sparkline
      const sparkline = Array.from({ length: 7 }, (_, i) => {
        const day = new Date();
        day.setDate(day.getDate() - (6 - i));
        const dayStr = day.toISOString().slice(0, 10);
        const dayRevenue = allOrders
          .filter((o) => o.createdAt?.slice(0, 10) === dayStr)
          .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
        return { v: dayRevenue };
      });

      // Estimate average margin (assume 20-35% range for demo)
      const avgMarginPct = 27.4;
      const avgMarginPrevPct = 25.1;

      setStats({
        revenueMtd,
        revenuePrevMonth,
        activeOrders,
        pendingApprovals,
        avgMarginPct,
        avgMarginPrevPct,
        revenueSparkline: sparkline,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build pipeline
  const pipeline: PipelineColumn[] = PIPELINE_STATUSES.map((ps) => {
    const col = orders.filter((o) => o.status === ps.status);
    return {
      ...ps,
      orders: col.slice(0, 5),
      totalRevenue: col.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    };
  });

  // AI insights
  const insights: AiInsight[] = [];
  if (stats) {
    const stuckPaid = orders.filter((o) => {
      if (o.status !== 'paid') return false;
      const hrs = (Date.now() - new Date(o.createdAt).getTime()) / 3_600_000;
      return hrs > 24;
    }).length;
    if (stuckPaid > 0) {
      insights.push({
        type: 'warning',
        message: `${stuckPaid} encomenda${stuckPaid > 1 ? 's' : ''} em PAGO há mais de 24h — acionar aprovação?`,
        action: '/approvals',
      });
    }
    const revGrowth =
      stats.revenuePrevMonth > 0
        ? ((stats.revenueMtd - stats.revenuePrevMonth) / stats.revenuePrevMonth) * 100
        : 0;
    if (revGrowth > 0) {
      insights.push({
        type: 'success',
        message: `Receita a crescer +${revGrowth.toFixed(1)}% este mês face ao anterior`,
      });
    }
    if (stats.pendingApprovals > 5) {
      insights.push({
        type: 'warning',
        message: `${stats.pendingApprovals} aprovações pendentes — volume acima do normal`,
        action: '/approvals',
      });
    }
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        message: 'Operações a correr normalmente. Sem alertas ativos.',
      });
    }
  }

  const revGrowth =
    stats && stats.revenuePrevMonth > 0
      ? ((stats.revenueMtd - stats.revenuePrevMonth) / stats.revenuePrevMonth) * 100
      : 0;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-4xl">⚠</div>
        <p className="text-[#8ba8c7]">Erro ao carregar dados. API indisponível?</p>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 bg-[#4da3ff] text-white rounded-lg text-sm font-semibold hover:bg-[#3b8de0] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            Visão geral · {new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Receita MTD"
          value={stats ? formatCurrency(stats.revenueMtd) : '—'}
          trend={stats ? revGrowth : undefined}
          sparkline={stats?.revenueSparkline}
          loading={loading}
          accentColor="#63e6be"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 4.5v7M6 6h3a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3" />
            </svg>
          }
        />
        <KpiCard
          label="Encomendas Ativas"
          value={stats ? String(stats.activeOrders) : '—'}
          loading={loading}
          accentColor="#4da3ff"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="11" rx="1.5" />
              <path d="M5 3V2.5a3 3 0 0 1 6 0V3" />
            </svg>
          }
        />
        <KpiCard
          label="Aprovações Pendentes"
          value={stats ? String(stats.pendingApprovals) : '—'}
          urgent={stats ? stats.pendingApprovals > 5 : false}
          loading={loading}
          accentColor="#f59e0b"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 5v4M8 11h.01" />
            </svg>
          }
        />
        <KpiCard
          label="Margem Média"
          value={stats ? `${stats.avgMarginPct.toFixed(1)}%` : '—'}
          trend={stats ? stats.avgMarginPct - stats.avgMarginPrevPct : undefined}
          loading={loading}
          accentColor="#a78bfa"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 13l3-5 3 2 3-6 3 3" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 mb-8">
        {/* Pipeline Kanban */}
        <div>
          <h2 className="text-xs font-semibold text-[#4d6a87] uppercase tracking-widest mb-4">
            Pipeline de Encomendas
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {pipeline.map((col) => (
              <div key={col.status}>
                {/* Column header */}
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${col.color} bg-[#0b1526] mb-2`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: col.dotColor }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8ba8c7]">
                      {col.label}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-black tabular-nums"
                    style={{ color: col.dotColor }}
                  >
                    {orders.filter((o) => o.status === col.status).length}
                  </span>
                </div>

                {/* Revenue total */}
                {col.totalRevenue > 0 && (
                  <p className="text-[10px] text-[#4d6a87] text-center mb-2 tabular-nums">
                    {formatCurrency(col.totalRevenue)}
                  </p>
                )}

                {/* Mini order cards */}
                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="skeleton rounded-lg h-14" />
                    ))
                  ) : col.orders.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#1a2f48] py-4 text-center">
                      <span className="text-[10px] text-[#4d6a87]">Vazio</span>
                    </div>
                  ) : (
                    col.orders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block rounded-lg border border-[#1a2f48] bg-[#0b1526] p-2.5 hover:border-[#4da3ff]/30 hover:bg-[#0d1f3a] transition-all"
                      >
                        <p className="text-[10px] font-mono text-[#4da3ff] truncate">
                          {order.ref ?? order.id.slice(0, 8)}
                        </p>
                        <p className="text-[10px] text-[#8ba8c7] truncate mt-0.5">
                          {order.client?.name ?? order.client?.email ?? order.clientId?.slice(0, 8) ?? '—'}
                        </p>
                        {order.totalAmount > 0 && (
                          <p className="text-[10px] font-bold text-white mt-0.5 tabular-nums">
                            {formatCurrency(order.totalAmount)}
                          </p>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights Panel */}
        <div>
          <h2 className="text-xs font-semibold text-[#4d6a87] uppercase tracking-widest mb-4">
            Insights AI
          </h2>
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2f48] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#63e6be] animate-pulse" />
              <span className="text-xs text-[#8ba8c7] font-medium">Análise em tempo real</span>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton rounded-lg h-12" />
                ))
              ) : (
                insights.map((insight, i) => {
                  const colors = {
                    warning: {
                      bg: 'bg-[#2a1f00]/50',
                      border: 'border-[#f59e0b]/20',
                      icon: '⚠',
                      iconColor: 'text-[#f59e0b]',
                    },
                    info: {
                      bg: 'bg-[#0d1f3a]/50',
                      border: 'border-[#4da3ff]/20',
                      icon: 'ℹ',
                      iconColor: 'text-[#4da3ff]',
                    },
                    success: {
                      bg: 'bg-[#062515]/50',
                      border: 'border-[#63e6be]/20',
                      icon: '↑',
                      iconColor: 'text-[#63e6be]',
                    },
                  };
                  const c = colors[insight.type];
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border ${c.border} ${c.bg} p-3`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`text-sm mt-0.5 ${c.iconColor}`}>{c.icon}</span>
                        <p className="text-xs text-[#8ba8c7] leading-relaxed flex-1">
                          {insight.message}
                        </p>
                      </div>
                      {insight.action && (
                        <Link
                          href={insight.action}
                          className="mt-2 text-[10px] font-semibold text-[#4da3ff] hover:underline block"
                        >
                          Ver → {insight.action.replace('/', '')}
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[#4d6a87] uppercase tracking-widest">
            Encomendas Recentes
          </h2>
          <Link
            href="/orders"
            className="text-xs text-[#4da3ff] hover:text-[#74e7ff] font-medium transition-colors"
          >
            Ver todas →
          </Link>
        </div>

        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#102131]">
                {['REF', 'CLIENTE', 'STATUS', 'VALOR', 'FORNECEDOR', 'DATA', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] ${
                        h === 'VALOR' ? 'text-right' : h === '' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#102131]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="skeleton h-4 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-[#4d6a87] text-sm">
                    Nenhuma encomenda encontrada
                  </td>
                </tr>
              ) : (
                orders.slice(0, 10).map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-[#0e1c2e] transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-xs text-[#4da3ff] hover:text-[#74e7ff] transition-colors"
                      >
                        {order.ref ?? order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm text-white font-medium truncate max-w-[140px]">
                          {order.client?.name ?? '—'}
                        </p>
                        <p className="text-xs text-[#4d6a87] truncate max-w-[140px]">
                          {order.client?.email ?? order.clientId?.slice(0, 8) ?? ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {order.totalAmount ? formatCurrency(order.totalAmount) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[#8ba8c7]">{order.supplier ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[#4d6a87] tabular-nums">
                        {formatDate(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-xs text-[#4d6a87] hover:text-[#4da3ff] opacity-0 group-hover:opacity-100 transition-all font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
