'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | '12m';

interface Kpis {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  conversionRate: number;
  activeClients: number;
  pendingApprovals: number;
}

interface RevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

interface OrderByStatus {
  status: string;
  count: number;
  amount: number;
}

interface TopProduct {
  title: string;
  quantity: number;
  revenue: number;
}

interface TopClient {
  name: string;
  company: string;
  orders: number;
  revenue: number;
}

interface RecentOrder {
  id: string;
  ref: string;
  clientName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  orders: number;
}

interface DashboardData {
  kpis: Kpis;
  revenueByDay: RevenueByDay[];
  ordersByStatus: OrderByStatus[];
  topProducts: TopProduct[];
  topClients: TopClient[];
  recentOrders: RecentOrder[];
  monthlyTrend: MonthlyTrend[];
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchDashboard(range: Range): Promise<DashboardData> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/api/v1/analytics/dashboard?range=${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<DashboardData>;
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  created: '#64748b',
  paid: '#3b82f6',
  approved: '#22c55e',
  producing: '#f59e0b',
  shipped: '#a855f7',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  created: 'Criado',
  paid: 'Pago',
  approved: 'Aprovado',
  producing: 'Produção',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? '#64748b';
}
function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ h = 'h-6', w = 'w-full' }: { h?: string; w?: string }) {
  return (
    <div
      className={`${h} ${w} rounded-lg animate-pulse`}
      style={{ background: 'linear-gradient(90deg, #0f2035 0%, #1a2f48 50%, #0f2035 100%)' }}
    />
  );
}

// ─── Line Chart ──────────────────────────────────────────────────────────────

function LineChart({
  data,
  width = 600,
  height = 200,
}: {
  data: RevenueByDay[];
  width?: number;
  height?: number;
}) {
  if (!data.length) return <div className="h-full flex items-center justify-center text-[#4d6a87] text-sm">Sem dados</div>;

  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 32;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const values = data.map((d) => d.revenue);
  const maxV = Math.max(...values, 1);
  const minV = 0;

  const toX = (i: number): number => padL + (i / (data.length - 1 || 1)) * chartW;
  const toY = (v: number): number => padT + chartH - ((v - minV) / (maxV - minV || 1)) * chartH;

  const points = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`).join(' ');
  const areaPath = `M ${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} ` +
    data.map((d, i) => `L ${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`).join(' ') +
    ` L ${toX(data.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} Z`;

  // Y axis ticks
  const yTicks = 4;
  const yLabels: number[] = [];
  for (let i = 0; i <= yTicks; i++) {
    yLabels.push(Math.round((maxV / yTicks) * i));
  }

  // X axis labels — show every Nth label
  const xInterval = data.length <= 7 ? 1 : data.length <= 30 ? 5 : 14;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(77,163,255,0.35)" />
          <stop offset="100%" stopColor="rgba(77,163,255,0)" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v) => (
        <line
          key={v}
          x1={padL}
          y1={toY(v)}
          x2={padL + chartW}
          y2={toY(v)}
          stroke="#1a2f48"
          strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#lineGrad)" />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#4da3ff"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + tooltips */}
      {data.map((d, i) => (
        <g key={d.date}>
          <circle
            cx={toX(i)}
            cy={toY(d.revenue)}
            r="3"
            fill="#4da3ff"
            stroke="#07111f"
            strokeWidth="1.5"
          />
          <title>{`${d.date}: ${formatCurrency(d.revenue)} (${d.orders} enc.)`}</title>
        </g>
      ))}

      {/* Y axis labels */}
      {yLabels.map((v) => (
        <text
          key={v}
          x={padL - 6}
          y={toY(v) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#4d6a87"
        >
          {v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}
        </text>
      ))}

      {/* X axis labels */}
      {data.map((d, i) => {
        if (i % xInterval !== 0 && i !== data.length - 1) return null;
        const label = d.date.slice(5).replace('-', '/');
        return (
          <text
            key={d.date}
            x={toX(i)}
            y={padT + chartH + 18}
            textAnchor="middle"
            fontSize="9"
            fill="#4d6a87"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Monthly Bar Chart ────────────────────────────────────────────────────────

function MonthlyBarChart({ data }: { data: MonthlyTrend[] }) {
  if (!data.length) return <div className="h-full flex items-center justify-center text-[#4d6a87] text-sm">Sem dados</div>;

  const width = 600;
  const height = 180;
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxV = Math.max(...data.map((d) => d.revenue), 1);
  const barW = Math.max((chartW / data.length) * 0.6, 4);
  const gap = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = (d.revenue / maxV) * chartH;
        const x = padL + i * gap + gap / 2 - barW / 2;
        const y = padT + chartH - bh;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={bh} rx="3" fill="#4da3ff" opacity="0.8">
              <title>{`${d.month}: ${formatCurrency(d.revenue)} (${d.orders} enc.)`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={padT + chartH + 14}
              textAnchor="middle"
              fontSize="9"
              fill="#4d6a87"
            >
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}
      {/* Y axis */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const v = maxV * pct;
        const y = padT + chartH - pct * chartH;
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1a2f48" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#4d6a87">
              {v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v.toFixed(0)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: OrderByStatus[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <div className="h-full flex items-center justify-center text-[#4d6a87] text-sm">Sem dados</div>;

  const cx = 80;
  const cy = 80;
  const r = 60;
  const inner = 36;

  let angle = -Math.PI / 2;

  function arc(startAngle: number, endAngle: number, color: string, label: string): JSX.Element {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + inner * Math.cos(startAngle);
    const iy1 = cy + inner * Math.sin(startAngle);
    const ix2 = cx + inner * Math.cos(endAngle);
    const iy2 = cy + inner * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      `A ${inner} ${inner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      'Z',
    ].join(' ');
    return (
      <path key={label} d={d} fill={color} opacity="0.9">
        <title>{label}</title>
      </path>
    );
  }

  const paths: JSX.Element[] = [];
  for (const d of data) {
    const span = (d.count / total) * 2 * Math.PI;
    paths.push(arc(angle, angle + span, statusColor(d.status), `${statusLabel(d.status)}: ${d.count}`));
    angle += span;
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" width="160" height="160" className="flex-shrink-0">
        {paths}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#f0f6ff">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#4d6a87">
          TOTAL
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs min-w-0">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: statusColor(d.status) }}
            />
            <span className="text-[#8ba8c7] truncate">{statusLabel(d.status)}</span>
            <span className="ml-auto text-white font-semibold tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HBarChart({ data }: { data: TopProduct[] }) {
  if (!data.length) return <div className="text-[#4d6a87] text-sm">Sem dados</div>;
  const maxR = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="flex flex-col gap-2">
      {data.slice(0, 8).map((d) => {
        const pct = (d.revenue / maxR) * 100;
        return (
          <div key={d.title} className="flex items-center gap-3">
            <span className="text-xs text-[#8ba8c7] w-32 truncate flex-shrink-0" title={d.title}>
              {d.title}
            </span>
            <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#0f2035' }}>
              <div
                className="h-full rounded-md transition-all duration-700"
                style={{ width: `${pct.toFixed(1)}%`, background: 'linear-gradient(90deg,#3b82f6,#4da3ff)' }}
              />
            </div>
            <span className="text-xs text-white tabular-nums w-20 text-right flex-shrink-0">
              {formatCurrency(d.revenue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  warn,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  warn?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{
        background: '#0b1526',
        borderColor: warn ? 'rgba(239,68,68,0.4)' : '#1a2f48',
      }}
    >
      {warn && (
        <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.3)' }} />
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#4d6a87' }}>
          {label}
        </span>
        <span className="text-base" role="img" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: warn ? '#ef4444' : color }}>
        {value}
      </p>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {statusLabel(status)}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboard(r);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
    intervalRef.current = setInterval(() => load(range), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [range, load]);

  const kpis = data?.kpis;
  const RANGE_LABELS: Record<Range, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '12m': '12 meses' };

  return (
    <div style={{ minHeight: '100vh', background: '#07111f' }} className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
          <p className="text-sm mt-1" style={{ color: '#4d6a87' }}>
            Painel de desempenho · Auto-actualiza a cada 60s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '12m'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: range === r ? '#4da3ff' : '#0b1526',
                color: range === r ? '#07111f' : '#8ba8c7',
                border: `1px solid ${range === r ? '#4da3ff' : '#1a2f48'}`,
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(range)}
            className="ml-2 px-3 py-1.5 rounded-lg border text-sm transition-all"
            style={{ borderColor: '#1a2f48', color: '#8ba8c7', background: '#0b1526' }}
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
        >
          {error}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {loading || !kpis ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
              <Skeleton h="h-3" w="w-20" />
              <div className="mt-3"><Skeleton h="h-7" w="w-28" /></div>
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Receita Total" value={formatCurrency(kpis.totalRevenue)} icon="💰" color="#63e6be" />
            <KpiCard label="Encomendas" value={String(kpis.totalOrders)} icon="📦" color="#4da3ff" />
            <KpiCard label="Ticket Médio" value={formatCurrency(kpis.avgOrderValue)} icon="📊" color="#a78bfa" />
            <KpiCard label="Taxa Conversão" value={`${kpis.conversionRate.toFixed(1)}%`} icon="🎯" color="#fbbf24" />
            <KpiCard label="Clientes Ativos" value={String(kpis.activeClients)} icon="👥" color="#74e7ff" />
            <KpiCard
              label="Aprovações"
              value={String(kpis.pendingApprovals)}
              icon="⚠️"
              color="#f97316"
              warn={kpis.pendingApprovals > 0}
            />
          </>
        )}
      </div>

      {/* Revenue by Day */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ background: '#0b1526', borderColor: '#1a2f48' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
          Receita Diária — {RANGE_LABELS[range]}
        </h3>
        {loading || !data ? (
          <Skeleton h="h-48" />
        ) : (
          <LineChart data={data.revenueByDay} height={200} />
        )}
      </div>

      {/* Orders by Status + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div
          className="rounded-xl border p-6"
          style={{ background: '#0b1526', borderColor: '#1a2f48' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
            Distribuição por Estado
          </h3>
          {loading || !data ? (
            <Skeleton h="h-40" />
          ) : (
            <DonutChart data={data.ordersByStatus} />
          )}
        </div>

        <div
          className="rounded-xl border p-6"
          style={{ background: '#0b1526', borderColor: '#1a2f48' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
            Tendência Mensal — 12 meses
          </h3>
          {loading || !data ? (
            <Skeleton h="h-40" />
          ) : (
            <MonthlyBarChart data={data.monthlyTrend} />
          )}
        </div>
      </div>

      {/* Top Products */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ background: '#0b1526', borderColor: '#1a2f48' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
          Top Produtos por Receita
        </h3>
        {loading || !data ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-5" />)}
          </div>
        ) : (
          <HBarChart data={data.topProducts} />
        )}
      </div>

      {/* Top Clients + Recent Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Clients */}
        <div
          className="rounded-xl border p-6"
          style={{ background: '#0b1526', borderColor: '#1a2f48' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
            Top Clientes
          </h3>
          {loading || !data ? (
            <Skeleton h="h-48" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#4d6a87' }}>
                    <th className="text-left pb-3 font-medium">Cliente</th>
                    <th className="text-left pb-3 font-medium">Empresa</th>
                    <th className="text-right pb-3 font-medium">Enc.</th>
                    <th className="text-right pb-3 font-medium">Receita</th>
                    <th className="text-right pb-3 font-medium">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients.map((c, i) => (
                    <tr
                      key={`${c.name}-${i}`}
                      className="border-t"
                      style={{ borderColor: '#0f2035' }}
                    >
                      <td className="py-2.5 text-white font-medium">{c.name}</td>
                      <td className="py-2.5" style={{ color: '#4d6a87' }}>{c.company || '—'}</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: '#8ba8c7' }}>{c.orders}</td>
                      <td className="py-2.5 text-right tabular-nums text-white font-semibold">{formatCurrency(c.revenue)}</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: '#4da3ff' }}>
                        {formatCurrency(c.orders > 0 ? c.revenue / c.orders : 0)}
                      </td>
                    </tr>
                  ))}
                  {!data.topClients.length && (
                    <tr><td colSpan={5} className="py-6 text-center" style={{ color: '#4d6a87' }}>Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div
          className="rounded-xl border p-6"
          style={{ background: '#0b1526', borderColor: '#1a2f48' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#8ba8c7' }}>
            Encomendas Recentes
          </h3>
          {loading || !data ? (
            <Skeleton h="h-48" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#4d6a87' }}>
                    <th className="text-left pb-3 font-medium">Ref</th>
                    <th className="text-left pb-3 font-medium">Cliente</th>
                    <th className="text-left pb-3 font-medium">Estado</th>
                    <th className="text-right pb-3 font-medium">Valor</th>
                    <th className="text-right pb-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-t"
                      style={{ borderColor: '#0f2035' }}
                    >
                      <td className="py-2.5 font-mono font-semibold" style={{ color: '#4da3ff' }}>{o.ref}</td>
                      <td className="py-2.5 text-white truncate max-w-[120px]">{o.clientName}</td>
                      <td className="py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="py-2.5 text-right tabular-nums text-white font-semibold">{formatCurrency(o.totalAmount)}</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: '#4d6a87' }}>
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {!data.recentOrders.length && (
                    <tr><td colSpan={5} className="py-6 text-center" style={{ color: '#4d6a87' }}>Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
