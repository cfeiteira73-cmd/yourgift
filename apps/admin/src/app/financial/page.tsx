'use client';
import { useState, useEffect, useCallback } from 'react';

interface PlatformMetrics {
  currentMonth: {
    revenue: number;
    grossMargin: number;
    avgMarginPct: number;
    activeClients: number;
    orders: number;
    avgOrderValue: number;
  };
  lastMonth: { revenue: number; grossMargin: number; avgMarginPct: number };
  revenueGrowthPct: number;
  allTime: { avgLtv: number; totalLtv: number; uniqueClients: number };
}

interface TopClient {
  clientId: string;
  ltvCumulative: number;
  totalRevenue: number;
  grossMarginPct: number;
  orderCount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: '#0b1526',
        border: '1px solid #1a2f48',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div style={{ fontSize: 13, color: '#8ba8c7', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#f0f6ff' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: '#4d6a87', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export default function FinancialPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const base =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://localhost:3001';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const mRes = await fetch(`${base}/api/v1/financial/metrics`, { headers });
      if (mRes.ok) {
        setMetrics((await mRes.json()) as PlatformMetrics);
      }
    } catch {
      // graceful — leave previous state in place
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${base}/api/v1/financial/recompute`, { method: 'POST', headers });
      await load();
    } catch {
      // graceful
    }
    setRecomputing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: '#8ba8c7' }}>
        Loading financial intelligence...
      </div>
    );
  }

  const m = metrics;

  const momRows = [
    {
      label: 'Revenue',
      current: fmt(m?.currentMonth.revenue ?? 0),
      last: fmt(m?.lastMonth.revenue ?? 0),
      delta: m?.revenueGrowthPct ?? 0,
    },
    {
      label: 'Gross Margin €',
      current: fmt(m?.currentMonth.grossMargin ?? 0),
      last: fmt(m?.lastMonth.grossMargin ?? 0),
      delta:
        m?.lastMonth.grossMargin && m.lastMonth.grossMargin > 0
          ? (((m.currentMonth.grossMargin - m.lastMonth.grossMargin) /
              m.lastMonth.grossMargin) *
              100)
          : 0,
    },
    {
      label: 'Margin %',
      current: `${(m?.currentMonth.avgMarginPct ?? 0).toFixed(1)}%`,
      last: `${(m?.lastMonth.avgMarginPct ?? 0).toFixed(1)}%`,
      delta:
        (m?.currentMonth.avgMarginPct ?? 0) - (m?.lastMonth.avgMarginPct ?? 0),
    },
  ];

  return (
    <div
      style={{
        padding: '32px 40px',
        background: '#07111f',
        minHeight: '100vh',
        color: '#f0f6ff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Financial Intelligence
          </h1>
          <p style={{ color: '#8ba8c7', margin: '4px 0 0', fontSize: 14 }}>
            Unit economics, LTV, cohort analysis — your financial moat
          </p>
        </div>
        <button
          onClick={() => void recompute()}
          disabled={recomputing}
          style={{
            background: recomputing ? '#1a2f48' : '#4da3ff',
            color: recomputing ? '#8ba8c7' : '#07111f',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: recomputing ? 'not-allowed' : 'pointer',
          }}
        >
          {recomputing ? 'Recomputing…' : '⟳ Recompute'}
        </button>
      </div>

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiCard
          label="Monthly Revenue"
          value={fmt(m?.currentMonth.revenue ?? 0)}
          sub={`${pct(m?.revenueGrowthPct ?? 0)} vs last month`}
          color={(m?.revenueGrowthPct ?? 0) >= 0 ? '#22c55e' : '#ef4444'}
        />
        <KpiCard
          label="Gross Margin"
          value={`${(m?.currentMonth.avgMarginPct ?? 0).toFixed(1)}%`}
          sub={fmt(m?.currentMonth.grossMargin ?? 0)}
          color={(m?.currentMonth.avgMarginPct ?? 0) >= 20 ? '#22c55e' : '#f59e0b'}
        />
        <KpiCard
          label="Active Clients"
          value={String(m?.currentMonth.activeClients ?? 0)}
          sub={`${m?.currentMonth.orders ?? 0} orders`}
        />
        <KpiCard
          label="Avg Order Value"
          value={fmt(m?.currentMonth.avgOrderValue ?? 0)}
        />
        <KpiCard
          label="Avg LTV"
          value={fmt(m?.allTime.avgLtv ?? 0)}
          sub={`${m?.allTime.uniqueClients ?? 0} total clients`}
          color="#4da3ff"
        />
        <KpiCard
          label="Total LTV Pool"
          value={fmt(m?.allTime.totalLtv ?? 0)}
          color="#4da3ff"
        />
      </div>

      {/* Month vs Last Month comparison */}
      <div
        style={{
          background: '#0b1526',
          border: '1px solid #1a2f48',
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <h2
          style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: '#f0f6ff' }}
        >
          Month-over-Month Comparison
        </h2>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}
        >
          {momRows.map((row) => (
            <div key={row.label}>
              <div style={{ fontSize: 12, color: '#4d6a87', marginBottom: 8 }}>
                {row.label}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}
              >
                <span style={{ fontSize: 22, fontWeight: 700 }}>{row.current}</span>
                <span style={{ fontSize: 13, color: '#8ba8c7' }}>
                  vs {row.last}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: row.delta >= 0 ? '#22c55e' : '#ef4444',
                  marginTop: 4,
                }}
              >
                {row.delta >= 0 ? '▲' : '▼'} {Math.abs(row.delta).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Revenue Bar Chart (last 6 months — placeholder bars) */}
      <div
        style={{
          background: '#0b1526',
          border: '1px solid #1a2f48',
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <h2
          style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: '#f0f6ff' }}
        >
          Revenue Trend (sample — recompute to populate)
        </h2>
        <svg
          width="100%"
          height="120"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
        >
          {([0.3, 0.5, 0.4, 0.7, 0.6, 0.9] as const).map((h, i) => (
            <rect
              key={i}
              x={i * 95 + 10}
              y={120 - h * 100}
              width={70}
              height={h * 100}
              fill={i === 5 ? '#4da3ff' : '#1a2f48'}
              rx={4}
            />
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month) => (
            <div
              key={month}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                color: '#4d6a87',
              }}
            >
              {month}
            </div>
          ))}
        </div>
      </div>

      {/* Top Clients by LTV */}
      <div
        style={{
          background: '#0b1526',
          border: '1px solid #1a2f48',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2
          style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f0f6ff' }}
        >
          Top Clients by LTV
        </h2>
        {topClients.length === 0 ? (
          <div
            style={{ textAlign: 'center', color: '#4d6a87', padding: '32px 0' }}
          >
            <div style={{ fontSize: 14 }}>No financial snapshots yet.</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              Click &ldquo;Recompute&rdquo; to generate snapshots from existing orders.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Client', 'LTV', 'This Month Revenue', 'Margin %', 'Orders'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        fontSize: 12,
                        color: '#4d6a87',
                        borderBottom: '1px solid #1a2f48',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {topClients.map((c) => (
                <tr key={c.clientId}>
                  <td
                    style={{ padding: '10px 12px', fontSize: 13, color: '#f0f6ff' }}
                  >
                    {c.clientId.slice(0, 8)}&hellip;
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#4da3ff',
                      fontWeight: 600,
                    }}
                  >
                    {fmt(c.ltvCumulative)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>
                    {fmt(c.totalRevenue)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: 13,
                      color: c.grossMarginPct >= 20 ? '#22c55e' : '#f59e0b',
                    }}
                  >
                    {c.grossMarginPct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>
                    {c.orderCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
