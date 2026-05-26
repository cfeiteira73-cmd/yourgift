'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantBreakdownEntry {
  tenantId: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  totalOpex: number;
  ebitda: number;
  orderCount: number;
}

interface Consolidation {
  id: string;
  periodLabel: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: string | number;
  totalCogs: string | number;
  grossProfit: string | number;
  grossMarginPct: string | number;
  totalOpex: string | number;
  ebitda: string | number;
  ebitdaMarginPct: string | number;
  tenantBreakdown: TenantBreakdownEntry[];
  bySupplier: Record<string, number>;
  byCategory: Record<string, number>;
  byDepartment: Record<string, number>;
  tenantCount: number;
  orderCount: number;
  computedAt: string;
  computedBy: string;
}

interface BudgetAnomaly {
  id: string;
  tenantId: string;
  companyId?: string;
  department?: string;
  anomalyType: string;
  severity: string;
  detectedAt: string;
  periodStart: string;
  periodEnd: string;
  expectedValue?: string | number | null;
  actualValue: string | number;
  deviationPct?: string | number | null;
  description: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
}

interface AnomalyStats {
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(v: string | number | undefined | null): number {
  return Number(v ?? 0);
}

function fmt(v: string | number | undefined | null, decimals = 0): string {
  return n(v).toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: string | number | undefined | null): string {
  return `${n(v).toFixed(1)}%`;
}

function fmtEur(v: string | number | undefined | null): string {
  return `€${fmt(v)}`;
}

function getAuthHeaders(): Record<string, string> {
  let token = '';
  try {
    token = localStorage.getItem('adminToken') ?? '';
  } catch {
    // ignore
  }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Severity / type colors ────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#4da3ff',
};

const TYPE_COLOR: Record<string, string> = {
  overspend: '#ef4444',
  underspend: '#4da3ff',
  spike: '#f97316',
  unusual_supplier: '#a78bfa',
  freq_increase: '#fbbf24',
};

const TYPE_LABEL: Record<string, string> = {
  overspend: 'Overspend',
  underspend: 'Underspend',
  spike: 'Spike',
  unusual_supplier: 'Unusual Supplier',
  freq_increase: 'Freq Increase',
};

// ── Mini bar chart (SVG) ──────────────────────────────────────────────────────

function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (entries.length === 0) return <p style={{ color: '#4d6a87', fontSize: 12 }}>No data</p>;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 100,
              fontSize: 11,
              color: '#8ba8c7',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {key}
          </span>
          <svg width={120} height={14} style={{ flexShrink: 0 }}>
            <rect
              x={0}
              y={2}
              width={Math.round((val / max) * 120)}
              height={10}
              rx={3}
              fill="#4da3ff"
              opacity={0.7}
            />
          </svg>
          <span style={{ fontSize: 11, color: '#8ba8c7', flexShrink: 0 }}>€{fmt(val)}</span>
        </div>
      ))}
    </div>
  );
}

// ── P&L Waterfall (SVG) ───────────────────────────────────────────────────────

function PLWaterfall({ c }: { c: Consolidation }) {
  const rev = n(c.totalRevenue);
  const cogs = n(c.totalCogs);
  const gp = n(c.grossProfit);
  const opex = n(c.totalOpex);
  const ebitda = n(c.ebitda);

  if (rev === 0) return <p style={{ color: '#4d6a87', fontSize: 12 }}>No data to display</p>;

  const W = 480;
  const H = 200;
  const barW = 60;
  const gap = 20;
  const maxVal = Math.max(rev, 1);

  type Bar = { label: string; value: number; color: string; sub?: string };
  const bars: Bar[] = [
    { label: 'Revenue', value: rev, color: '#22c55e' },
    { label: '– COGS', value: cogs, color: '#ef4444', sub: 'deducted' },
    { label: 'Gross Profit', value: gp, color: '#14b8a6' },
    { label: '– OpEx', value: opex, color: '#f97316', sub: 'deducted' },
    { label: 'EBITDA', value: Math.max(ebitda, 0), color: '#4da3ff' },
  ];

  const chartH = H - 40;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {bars.map((bar, i) => {
        const bh = Math.max((bar.value / maxVal) * chartH, 2);
        const x = i * (barW + gap) + 20;
        const y = chartH - bh + 10;
        return (
          <g key={bar.label}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={bar.color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={H - 2}
              textAnchor="middle"
              fontSize={10}
              fill="#8ba8c7"
            >
              {bar.label}
            </text>
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill={bar.color}
            >
              {fmtEur(bar.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: '#0b1526',
        border: '1px solid #1a2f48',
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 160,
        flex: 1,
      }}
    >
      <p style={{ fontSize: 11, color: '#4d6a87', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#f0f6ff', lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#4d6a87', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConsolidationPage() {
  const [tab, setTab] = useState<'pl' | 'anomalies'>('pl');
  const [latest, setLatest] = useState<Consolidation | null>(null);
  const [history, setHistory] = useState<Consolidation[]>([]);
  const [anomalies, setAnomalies] = useState<BudgetAnomaly[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [runningMonth, setRunningMonth] = useState(false);
  const [runningQuarter, setRunningQuarter] = useState(false);
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConsolidation = useCallback(async () => {
    try {
      const [latestRes, histRes] = await Promise.all([
        fetch(`${API}/api/v1/consolidation/latest`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/v1/consolidation?limit=12`, { headers: getAuthHeaders() }),
      ]);
      if (latestRes.ok) {
        const d: Consolidation | null = await latestRes.json() as Consolidation | null;
        setLatest(d);
      }
      if (histRes.ok) {
        const d: Consolidation[] = await histRes.json() as Consolidation[];
        setHistory(d);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const loadAnomalies = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`${API}/api/v1/consolidation/anomalies?limit=50`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/v1/consolidation/anomalies/stats`, { headers: getAuthHeaders() }),
      ]);
      if (aRes.ok) setAnomalies(await aRes.json() as BudgetAnomaly[]);
      if (sRes.ok) setStats(await sRes.json() as AnomalyStats);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void loadConsolidation();
    void loadAnomalies();
    const interval = setInterval(() => {
      void loadConsolidation();
      void loadAnomalies();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadConsolidation, loadAnomalies]);

  async function runConsolidation(type: 'month' | 'quarter') {
    if (type === 'month') setRunningMonth(true);
    else setRunningQuarter(true);
    try {
      const res = await fetch(`${API}/api/v1/consolidation/run/${type}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadConsolidation();
    } catch (e) {
      setError(String(e));
    } finally {
      if (type === 'month') setRunningMonth(false);
      else setRunningQuarter(false);
    }
  }

  async function acknowledge(id: string) {
    setAckLoading(id);
    try {
      const res = await fetch(`${API}/api/v1/consolidation/anomalies/${id}/acknowledge`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ acknowledgedBy: 'admin' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadAnomalies();
    } catch (e) {
      setError(String(e));
    } finally {
      setAckLoading(null);
    }
  }

  const tenantBreakdown: TenantBreakdownEntry[] = latest
    ? (Array.isArray(latest.tenantBreakdown) ? latest.tenantBreakdown : [])
    : [];
  const sortedTenants = [...tenantBreakdown].sort((a, b) => b.revenue - a.revenue);

  return (
    <div style={{ background: '#07111f', minHeight: '100vh', padding: '24px 28px', color: '#f0f6ff' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', marginBottom: 4 }}>
          Financial Consolidation
        </h1>
        <p style={{ fontSize: 13, color: '#4d6a87' }}>
          Platform-wide P&amp;L cockpit + Budget Anomaly Intelligence
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#1a0a0a',
            border: '1px solid #7f1d1d',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#fca5a5',
          }}
        >
          {error}{' '}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ marginLeft: 8, color: '#4d6a87', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1a2f48' }}>
        {(['pl', 'anomalies'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #4da3ff' : '2px solid transparent',
              color: tab === t ? '#4da3ff' : '#4d6a87',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {t === 'pl' ? 'Platform P&L Consolidation' : 'Budget Anomaly Intelligence'}
          </button>
        ))}
      </div>

      {/* ── TAB 1: P&L ─────────────────────────────────────────────────────── */}
      {tab === 'pl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Run buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => void runConsolidation('month')}
              disabled={runningMonth}
              style={{
                padding: '9px 18px',
                background: '#4da3ff',
                color: '#07111f',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: runningMonth ? 'not-allowed' : 'pointer',
                opacity: runningMonth ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {runningMonth ? (
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              ) : null}
              Run Month Consolidation
            </button>
            <button
              type="button"
              onClick={() => void runConsolidation('quarter')}
              disabled={runningQuarter}
              style={{
                padding: '9px 18px',
                background: '#0b1526',
                color: '#4da3ff',
                border: '1px solid #1a2f48',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: runningQuarter ? 'not-allowed' : 'pointer',
                opacity: runningQuarter ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {runningQuarter ? (
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              ) : null}
              Run Quarter Consolidation
            </button>
          </div>

          {/* KPI cards */}
          {latest ? (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <KpiCard
                  label="Total Revenue"
                  value={fmtEur(latest.totalRevenue)}
                  sub={`${latest.tenantCount} tenants · ${latest.orderCount} orders`}
                  accent="#22c55e"
                />
                <KpiCard
                  label="Gross Margin"
                  value={fmtPct(latest.grossMarginPct)}
                  sub={`Gross profit ${fmtEur(latest.grossProfit)}`}
                  accent="#14b8a6"
                />
                <KpiCard
                  label="EBITDA"
                  value={fmtEur(latest.ebitda)}
                  sub={`OpEx ${fmtEur(latest.totalOpex)}`}
                  accent="#4da3ff"
                />
                <KpiCard
                  label="EBITDA Margin"
                  value={fmtPct(latest.ebitdaMarginPct)}
                  sub={`Period: ${latest.periodLabel}`}
                  accent="#a78bfa"
                />
              </div>

              {/* P&L Waterfall */}
              <div
                style={{
                  background: '#0b1526',
                  border: '1px solid #1a2f48',
                  borderRadius: 12,
                  padding: '20px 24px',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: '#8ba8c7', marginBottom: 16 }}>
                  P&amp;L Waterfall — {latest.periodLabel}
                </p>
                <PLWaterfall c={latest} />
              </div>

              {/* Dimension breakdowns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { title: 'By Supplier', data: latest.bySupplier },
                  { title: 'By Category', data: latest.byCategory },
                  { title: 'By Department', data: latest.byDepartment },
                ].map(({ title, data }) => (
                  <div
                    key={title}
                    style={{
                      background: '#0b1526',
                      border: '1px solid #1a2f48',
                      borderRadius: 12,
                      padding: '16px 18px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#8ba8c7',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        marginBottom: 12,
                      }}
                    >
                      {title}
                    </p>
                    <BarChart data={typeof data === 'object' && data !== null ? (data as Record<string, number>) : {}} />
                  </div>
                ))}
              </div>

              {/* Tenant breakdown */}
              {sortedTenants.length > 0 && (
                <div
                  style={{
                    background: '#0b1526',
                    border: '1px solid #1a2f48',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2f48' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#8ba8c7' }}>Tenant Breakdown</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                          {['Tenant ID', 'Revenue', 'COGS', 'Gross Profit', 'EBITDA', 'Orders'].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '10px 16px',
                                textAlign: h === 'Tenant ID' ? 'left' : 'right',
                                color: '#4d6a87',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontSize: 11,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTenants.map((t, i) => (
                          <tr
                            key={t.tenantId}
                            style={{
                              borderBottom: i < sortedTenants.length - 1 ? '1px solid #1a2f48' : 'none',
                              background: i % 2 === 1 ? '#0d1f3a18' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '10px 16px', color: '#f0f6ff', fontFamily: 'monospace', fontSize: 11 }}>
                              {t.tenantId.slice(0, 8)}…
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#22c55e' }}>
                              {fmtEur(t.revenue)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444' }}>
                              {fmtEur(t.cogs)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#14b8a6' }}>
                              {fmtEur(t.grossProfit)}
                            </td>
                            <td
                              style={{
                                padding: '10px 16px',
                                textAlign: 'right',
                                color: n(t.ebitda) >= 0 ? '#4da3ff' : '#f87171',
                              }}
                            >
                              {fmtEur(t.ebitda)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#8ba8c7' }}>
                              {t.orderCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                background: '#0b1526',
                border: '1px solid #1a2f48',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: '#4d6a87',
                fontSize: 14,
              }}
            >
              No consolidation data. Run a consolidation to get started.
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div
              style={{
                background: '#0b1526',
                border: '1px solid #1a2f48',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2f48' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#8ba8c7' }}>Consolidation History</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                      {['Period', 'Type', 'Revenue', 'EBITDA', 'Margin %', 'Tenants', 'Orders', 'Computed At'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px',
                            textAlign: ['Period', 'Type', 'Computed At'].includes(h) ? 'left' : 'right',
                            color: '#4d6a87',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c, i) => (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: i < history.length - 1 ? '1px solid #1a2f48' : 'none',
                        }}
                      >
                        <td style={{ padding: '10px 16px', color: '#f0f6ff', fontWeight: 600 }}>
                          {c.periodLabel}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#8ba8c7' }}>{c.periodType}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#22c55e' }}>
                          {fmtEur(c.totalRevenue)}
                        </td>
                        <td
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            color: n(c.ebitda) >= 0 ? '#4da3ff' : '#f87171',
                          }}
                        >
                          {fmtEur(c.ebitda)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#8ba8c7' }}>
                          {fmtPct(c.ebitdaMarginPct)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#8ba8c7' }}>
                          {c.tenantCount}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#8ba8c7' }}>
                          {c.orderCount}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#4d6a87', fontSize: 11 }}>
                          {new Date(c.computedAt).toLocaleString('pt-PT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Anomalies ───────────────────────────────────────────────── */}
      {tab === 'anomalies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats row */}
          {stats && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Total Anomalies" value={String(stats.total)} />
              <KpiCard
                label="Unacknowledged"
                value={String(stats.unacknowledged)}
                accent={stats.unacknowledged > 0 ? '#ef4444' : '#22c55e'}
              />
              {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
                <KpiCard
                  key={s}
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  value={String(stats.bySeverity[s] ?? 0)}
                  accent={SEVERITY_COLOR[s]}
                />
              ))}
            </div>
          )}

          {/* Anomaly list */}
          {anomalies.length === 0 ? (
            <div
              style={{
                background: '#0b1526',
                border: '1px solid #1a2f48',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: '#4d6a87',
                fontSize: 14,
              }}
            >
              No anomalies detected. The platform looks healthy.
            </div>
          ) : (
            <div
              style={{
                background: '#0b1526',
                border: '1px solid #1a2f48',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                      {['Severity', 'Type', 'Tenant', 'Description', 'Actual', 'Expected', 'Deviation', 'Detected', 'Status'].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: '10px 14px',
                              textAlign: 'left',
                              color: '#4d6a87',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              fontSize: 10,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a, i) => (
                      <tr
                        key={a.id}
                        style={{
                          borderBottom: i < anomalies.length - 1 ? '1px solid #1a2f48' : 'none',
                          opacity: a.isAcknowledged ? 0.5 : 1,
                        }}
                      >
                        {/* Severity badge */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: `${SEVERITY_COLOR[a.severity] ?? '#4d6a87'}22`,
                              color: SEVERITY_COLOR[a.severity] ?? '#4d6a87',
                              border: `1px solid ${SEVERITY_COLOR[a.severity] ?? '#4d6a87'}44`,
                            }}
                          >
                            {a.severity}
                          </span>
                        </td>
                        {/* Type */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: TYPE_COLOR[a.anomalyType] ?? '#8ba8c7',
                              fontWeight: 600,
                            }}
                          >
                            {TYPE_LABEL[a.anomalyType] ?? a.anomalyType}
                          </span>
                        </td>
                        {/* Tenant */}
                        <td
                          style={{
                            padding: '10px 14px',
                            fontFamily: 'monospace',
                            fontSize: 10,
                            color: '#4d6a87',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.tenantId.slice(0, 8)}…
                        </td>
                        {/* Description */}
                        <td
                          style={{
                            padding: '10px 14px',
                            color: '#8ba8c7',
                            maxWidth: 300,
                            fontSize: 11,
                          }}
                        >
                          {a.description}
                        </td>
                        {/* Actual */}
                        <td style={{ padding: '10px 14px', color: '#f0f6ff', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {fmtEur(a.actualValue)}
                        </td>
                        {/* Expected */}
                        <td style={{ padding: '10px 14px', color: '#8ba8c7', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {a.expectedValue != null ? fmtEur(a.expectedValue) : '—'}
                        </td>
                        {/* Deviation */}
                        <td
                          style={{
                            padding: '10px 14px',
                            color: n(a.deviationPct) > 0 ? '#ef4444' : '#22c55e',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                          }}
                        >
                          {a.deviationPct != null ? `${n(a.deviationPct).toFixed(1)}%` : '—'}
                        </td>
                        {/* Detected */}
                        <td style={{ padding: '10px 14px', color: '#4d6a87', fontSize: 10, whiteSpace: 'nowrap' }}>
                          {new Date(a.detectedAt).toLocaleString('pt-PT')}
                        </td>
                        {/* Acknowledge */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {a.isAcknowledged ? (
                            <span style={{ color: '#22c55e', fontSize: 12 }}>
                              ✓ {a.acknowledgedBy ?? 'admin'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={ackLoading === a.id}
                              onClick={() => void acknowledge(a.id)}
                              style={{
                                padding: '4px 10px',
                                background: '#0d1f3a',
                                border: '1px solid #1a3a5c',
                                borderRadius: 6,
                                color: '#4da3ff',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: ackLoading === a.id ? 'not-allowed' : 'pointer',
                                opacity: ackLoading === a.id ? 0.6 : 1,
                              }}
                            >
                              {ackLoading === a.id ? '...' : 'Acknowledge'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
