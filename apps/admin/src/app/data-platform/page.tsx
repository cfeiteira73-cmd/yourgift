'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatCurrency, getAdminToken, API_BASE } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Granularity = 'day' | 'week' | 'month';

interface ProcurementBucket {
  period: string;
  orderCount: number;
  totalValue: number;
  avgValue: number;
  supplierCount: number;
}

interface ForecastResult {
  forecastedOrders: number;
  forecastedSpend: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'stable' | 'decreasing';
  basisDays: number;
}

interface CategoryBenchmark {
  category: string;
  avgPrice: number;
  marketRate: number;
  savingsOpportunityPct: number;
  orderCount: number;
  totalSpend: number;
}

interface SlaPerformance {
  onTimePct: number;
  avgDelayDays: number;
  p95DelayDays: number;
  bySupplier: { supplierId: string; onTimePct: number; orderCount: number }[];
}

interface OlapResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionMs: number;
  rowCount: number;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${getAdminToken()}` };
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Skeleton({ h = 'h-6', w = 'w-full' }: { h?: string; w?: string }) {
  return (
    <div
      className={`${h} ${w} rounded-lg animate-pulse`}
      style={{ background: 'linear-gradient(90deg,#0f2035 0%,#1a2f48 50%,#0f2035 100%)' }}
    />
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ background: '#0b1526', borderColor: '#1a2f48' }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-5"
        style={{ color: '#8ba8c7' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Area Chart ────────────────────────────────────────────────────────────────

function AreaChart({ data }: { data: ProcurementBucket[] }) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center" style={{ color: '#4d6a87' }}>
        No data
      </div>
    );
  }

  const W = 700;
  const H = 200;
  const pL = 56;
  const pR = 16;
  const pT = 12;
  const pB = 32;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const maxV = Math.max(...data.map((d) => d.totalValue), 1);
  const toX = (i: number) => pL + (i / (data.length - 1 || 1)) * cW;
  const toY = (v: number) => pT + cH - (v / maxV) * cH;

  const linePts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.totalValue).toFixed(1)}`).join(' ');
  const areaPath =
    `M ${toX(0).toFixed(1)},${(pT + cH).toFixed(1)} ` +
    data.map((d, i) => `L ${toX(i).toFixed(1)},${toY(d.totalValue).toFixed(1)}`).join(' ') +
    ` L ${toX(data.length - 1).toFixed(1)},${(pT + cH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => maxV * p);
  const xInterval = data.length <= 7 ? 1 : data.length <= 30 ? 4 : 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dpAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(77,163,255,0.3)" />
          <stop offset="100%" stopColor="rgba(77,163,255,0)" />
        </linearGradient>
      </defs>
      {yTicks.map((v) => (
        <line key={v} x1={pL} y1={toY(v)} x2={pL + cW} y2={toY(v)} stroke="#1a2f48" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#dpAreaGrad)" />
      <polyline points={linePts} fill="none" stroke="#4da3ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.period}>
          <circle cx={toX(i)} cy={toY(d.totalValue)} r="2.5" fill="#4da3ff" stroke="#07111f" strokeWidth="1.5" />
          <title>{`${d.period}: ${formatCurrency(d.totalValue)} | ${d.orderCount} orders`}</title>
        </g>
      ))}
      {yTicks.map((v) => (
        <text key={v} x={pL - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#4d6a87">
          {v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v.toFixed(0)}`}
        </text>
      ))}
      {data.map((d, i) => {
        if (i % xInterval !== 0 && i !== data.length - 1) return null;
        const label = d.period.slice(0, 10);
        return (
          <text key={d.period} x={toX(i)} y={pT + cH + 18} textAnchor="middle" fontSize="9" fill="#4d6a87">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Circular Gauge ────────────────────────────────────────────────────────────

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 40;
  const cx = 55;
  const cy = 55;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2f48" strokeWidth="10" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#f0f6ff">
          {pct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#4d6a87">
          {label}
        </text>
      </svg>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DataPlatformPage() {
  const [granularity, setGranularity] = useState<Granularity>('day');

  const [timeSeries, setTimeSeries] = useState<ProcurementBucket[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [categories, setCategories] = useState<CategoryBenchmark[]>([]);
  const [sla, setSla] = useState<SlaPerformance | null>(null);

  const [tsLoading, setTsLoading] = useState(true);
  const [fcLoading, setFcLoading] = useState(true);
  const [catLoading, setCatLoading] = useState(true);
  const [slaLoading, setSlaLoading] = useState(true);

  const [tsError, setTsError] = useState<string | null>(null);

  // ── OLAP Console ──────────────────────────────────────────────────────────
  const defaultQuery = JSON.stringify(
    {
      measures: ['order_count', 'spend'],
      dimensions: ['period'],
      from: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      to: new Date().toISOString(),
      limit: 50,
    },
    null,
    2,
  );
  const [queryText, setQueryText] = useState(defaultQuery);
  const [olapResult, setOlapResult] = useState<OlapResult | null>(null);
  const [olapRunning, setOlapRunning] = useState(false);
  const [olapError, setOlapError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch all panels ────────────────────────────────────────────────────

  const loadTimeSeries = useCallback(
    async (g: Granularity) => {
      setTsLoading(true);
      setTsError(null);
      const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const to = new Date().toISOString();
      try {
        const res = await apiFetch<{ buckets: ProcurementBucket[] }>(
          `/api/v1/data-platform/procurement/timeseries?granularity=${g}&from=${from}&to=${to}`,
        );
        setTimeSeries(res.buckets);
      } catch {
        setTsError('Unable to load time series');
        setTimeSeries([]);
      } finally {
        setTsLoading(false);
      }
    },
    [],
  );

  const loadForecast = useCallback(async () => {
    setFcLoading(true);
    try {
      const res = await apiFetch<ForecastResult>('/api/v1/data-platform/forecast?horizonDays=30');
      setForecast(res);
    } catch {
      setForecast(null);
    } finally {
      setFcLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await apiFetch<{ categories: CategoryBenchmark[] }>(
        '/api/v1/data-platform/categories/benchmarks',
      );
      setCategories(res.categories);
    } catch {
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadSla = useCallback(async () => {
    setSlaLoading(true);
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    try {
      const res = await apiFetch<SlaPerformance>(
        `/api/v1/data-platform/sla/performance?from=${from}&to=${to}`,
      );
      setSla(res);
    } catch {
      setSla(null);
    } finally {
      setSlaLoading(false);
    }
  }, []);

  const loadAll = useCallback(
    (g: Granularity) => {
      void loadTimeSeries(g);
      void loadForecast();
      void loadCategories();
      void loadSla();
    },
    [loadTimeSeries, loadForecast, loadCategories, loadSla],
  );

  useEffect(() => {
    loadAll(granularity);
    intervalRef.current = setInterval(() => loadAll(granularity), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [granularity, loadAll]);

  // ── OLAP console run ────────────────────────────────────────────────────

  const runOlapQuery = async () => {
    setOlapRunning(true);
    setOlapError(null);
    setOlapResult(null);
    try {
      const parsed = JSON.parse(queryText) as unknown;
      const result = await apiPost<OlapResult>('/api/v1/data-platform/olap/query', parsed);
      setOlapResult(result);
    } catch (e) {
      setOlapError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setOlapRunning(false);
    }
  };

  // ── ClickHouse export ────────────────────────────────────────────────────

  const exportClickHouse = async () => {
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    try {
      const data = await apiFetch<Record<string, unknown>[]>(
        `/api/v1/data-platform/export/clickhouse?from=${from}&to=${to}`,
      );
      const ndjson = data.map((row) => JSON.stringify(row)).join('\n');
      const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `procurement_export_${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Check console for details.');
    }
  };

  const CONF_COLOR: Record<string, string> = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#ef4444',
  };
  const TREND_ICON: Record<string, string> = {
    increasing: '↑',
    stable: '→',
    decreasing: '↓',
  };
  const TREND_COLOR: Record<string, string> = {
    increasing: '#22c55e',
    stable: '#8ba8c7',
    decreasing: '#ef4444',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07111f' }} className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Data Platform</h1>
          <p className="text-sm mt-1" style={{ color: '#4d6a87' }}>
            OLAP · Procurement Intelligence · Auto-refreshes every 60s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: granularity === g ? '#4da3ff' : '#0b1526',
                color: granularity === g ? '#07111f' : '#8ba8c7',
                border: `1px solid ${granularity === g ? '#4da3ff' : '#1a2f48'}`,
              }}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadAll(granularity)}
            className="ml-2 px-3 py-1.5 rounded-lg border text-sm transition-all"
            style={{ borderColor: '#1a2f48', color: '#8ba8c7', background: '#0b1526' }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* 1. Time Series */}
      <div className="mb-6">
        <SectionCard title={`Procurement Time Series — ${granularity}`}>
          {tsError && (
            <div
              className="text-sm rounded p-3 mb-4"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              {tsError}
            </div>
          )}
          {tsLoading ? <Skeleton h="h-48" /> : <AreaChart data={timeSeries} />}
        </SectionCard>
      </div>

      {/* 2. Forecast Panel */}
      <div className="mb-6">
        <SectionCard title="Procurement Forecast — Next 30 Days">
          {fcLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} h="h-20" />
              ))}
            </div>
          ) : forecast ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ borderColor: '#1a2f48', background: '#07111f' }}
              >
                <span className="text-xs uppercase tracking-wider" style={{ color: '#4d6a87' }}>
                  Forecasted Orders
                </span>
                <span className="text-2xl font-black text-white tabular-nums">
                  {forecast.forecastedOrders.toLocaleString()}
                </span>
                <span className="text-xs" style={{ color: '#4d6a87' }}>
                  Based on {forecast.basisDays} days
                </span>
              </div>
              <div
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ borderColor: '#1a2f48', background: '#07111f' }}
              >
                <span className="text-xs uppercase tracking-wider" style={{ color: '#4d6a87' }}>
                  Forecasted Spend
                </span>
                <span className="text-2xl font-black tabular-nums" style={{ color: '#63e6be' }}>
                  {formatCurrency(forecast.forecastedSpend)}
                </span>
              </div>
              <div
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ borderColor: '#1a2f48', background: '#07111f' }}
              >
                <span className="text-xs uppercase tracking-wider" style={{ color: '#4d6a87' }}>
                  Confidence
                </span>
                <span
                  className="text-xl font-black uppercase"
                  style={{ color: CONF_COLOR[forecast.confidence] ?? '#8ba8c7' }}
                >
                  {forecast.confidence}
                </span>
              </div>
              <div
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ borderColor: '#1a2f48', background: '#07111f' }}
              >
                <span className="text-xs uppercase tracking-wider" style={{ color: '#4d6a87' }}>
                  Trend
                </span>
                <span
                  className="text-2xl font-black"
                  style={{ color: TREND_COLOR[forecast.trend] ?? '#8ba8c7' }}
                >
                  {TREND_ICON[forecast.trend]} {forecast.trend}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#4d6a87' }}>
              Insufficient data for forecast
            </p>
          )}
        </SectionCard>
      </div>

      {/* 3. Category Benchmarks */}
      <div className="mb-6">
        <SectionCard title="Category Benchmarks">
          {catLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} h="h-8" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm" style={{ color: '#4d6a87' }}>
              No category data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#4d6a87' }}>
                    <th className="text-left pb-3 font-medium">Category</th>
                    <th className="text-right pb-3 font-medium">Avg Price</th>
                    <th className="text-right pb-3 font-medium">Market Rate</th>
                    <th className="text-right pb-3 font-medium">Savings Opp.</th>
                    <th className="text-right pb-3 font-medium">Orders</th>
                    <th className="text-right pb-3 font-medium">Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const savPct = cat.savingsOpportunityPct;
                    const savColor =
                      savPct > 20 ? '#22c55e' : savPct > 10 ? '#f59e0b' : '#8ba8c7';
                    return (
                      <tr
                        key={cat.category}
                        className="border-t"
                        style={{ borderColor: '#0f2035' }}
                      >
                        <td className="py-2.5 text-white font-medium">{cat.category}</td>
                        <td className="py-2.5 text-right tabular-nums" style={{ color: '#8ba8c7' }}>
                          {formatCurrency(cat.avgPrice)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums" style={{ color: '#4d6a87' }}>
                          {formatCurrency(cat.marketRate)}
                        </td>
                        <td
                          className="py-2.5 text-right tabular-nums font-semibold"
                          style={{ color: savColor }}
                        >
                          {savPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right tabular-nums" style={{ color: '#8ba8c7' }}>
                          {cat.orderCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-white font-semibold">
                          {formatCurrency(cat.totalSpend)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 4. SLA Performance */}
      <div className="mb-6">
        <SectionCard title="SLA Performance — Last 90 Days">
          {slaLoading ? (
            <Skeleton h="h-40" />
          ) : sla ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gauges */}
              <div className="flex flex-wrap gap-6 items-start">
                <Gauge value={sla.onTimePct} label="On-Time" color="#22c55e" />
                <div className="flex flex-col gap-3 pt-2">
                  <div>
                    <p className="text-xs" style={{ color: '#4d6a87' }}>
                      Avg Delay
                    </p>
                    <p className="text-xl font-black text-white tabular-nums">
                      {sla.avgDelayDays.toFixed(1)}d
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#4d6a87' }}>
                      p95 Delay
                    </p>
                    <p className="text-xl font-black tabular-nums" style={{ color: '#f59e0b' }}>
                      {sla.p95DelayDays.toFixed(1)}d
                    </p>
                  </div>
                </div>
              </div>

              {/* Supplier SLA table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: '#4d6a87' }}>
                      <th className="text-left pb-3 font-medium">Supplier</th>
                      <th className="text-right pb-3 font-medium">On-Time %</th>
                      <th className="text-right pb-3 font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sla.bySupplier.slice(0, 10).map((s) => (
                      <tr key={s.supplierId} className="border-t" style={{ borderColor: '#0f2035' }}>
                        <td className="py-2 text-white">{s.supplierId}</td>
                        <td
                          className="py-2 text-right tabular-nums font-semibold"
                          style={{ color: s.onTimePct >= 90 ? '#22c55e' : s.onTimePct >= 70 ? '#f59e0b' : '#ef4444' }}
                        >
                          {s.onTimePct.toFixed(1)}%
                        </td>
                        <td className="py-2 text-right tabular-nums" style={{ color: '#8ba8c7' }}>
                          {s.orderCount}
                        </td>
                      </tr>
                    ))}
                    {sla.bySupplier.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center" style={{ color: '#4d6a87' }}>
                          No delivered orders in range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#4d6a87' }}>
              No SLA data available
            </p>
          )}
        </SectionCard>
      </div>

      {/* 5. OLAP Query Console */}
      <div className="mb-6">
        <SectionCard title="OLAP Query Console">
          <p className="text-xs mb-3" style={{ color: '#4d6a87' }}>
            Dimensions: tenant · supplier · category · carrier · region · period
            &nbsp;|&nbsp;
            Measures: order_count · spend · margin · lead_time · savings
          </p>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full rounded-lg text-xs font-mono p-3 resize-y focus:outline-none"
            style={{
              background: '#07111f',
              border: '1px solid #1a2f48',
              color: '#f0f6ff',
              lineHeight: '1.6',
            }}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={runOlapQuery}
              disabled={olapRunning}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: olapRunning ? '#1a2f48' : '#4da3ff',
                color: olapRunning ? '#4d6a87' : '#07111f',
              }}
            >
              {olapRunning ? 'Running...' : 'Run Query'}
            </button>
            {olapResult && (
              <span className="text-xs" style={{ color: '#4d6a87' }}>
                {olapResult.rowCount} rows · {olapResult.executionMs}ms
              </span>
            )}
          </div>

          {olapError && (
            <div
              className="mt-3 text-xs rounded p-3"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              {olapError}
            </div>
          )}

          {olapResult && olapResult.columns.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#4d6a87' }}>
                    {olapResult.columns.map((col) => (
                      <th key={col} className="text-left pb-2 font-medium pr-4">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {olapResult.rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: '#0f2035' }}>
                      {olapResult.columns.map((col) => (
                        <td key={col} className="py-1.5 pr-4 text-white tabular-nums">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {olapResult.rows.length > 100 && (
                <p className="text-xs mt-2" style={{ color: '#4d6a87' }}>
                  Showing first 100 of {olapResult.rowCount} rows
                </p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 6. Export */}
      <div className="mb-6">
        <SectionCard title="Export">
          <p className="text-sm mb-4" style={{ color: '#8ba8c7' }}>
            Export procurement events as NDJSON (Newline-Delimited JSON) — compatible with
            ClickHouse INSERT, BigQuery streaming insert, and Snowflake COPY INTO.
          </p>
          <button
            type="button"
            onClick={exportClickHouse}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: '#1a2f48', color: '#8ba8c7', border: '1px solid #1f3855' }}
          >
            Export to ClickHouse Format (.ndjson)
          </button>
          <p className="text-xs mt-2" style={{ color: '#4d6a87' }}>
            Last 30 days · max 10,000 rows per export
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
