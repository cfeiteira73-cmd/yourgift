'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Types ──────────────────────────────────────────────────────────────────

interface PLSummary {
  tenantId: string;
  period: { from: string; to: string };
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMarginPct: number;
  orderCount: number;
}

interface DeferredRevenueSummary {
  count: number;
  totalDeferred: number;
  entries: AccrualEntry[];
}

interface AccruedExpensesSummary {
  count: number;
  totalAccrued: number;
}

interface AccrualEntry {
  id: string;
  referenceId: string;
  entryType: string;
  amount: number;
  recognitionDate?: string;
  description?: string;
}

interface RecognitionEntry {
  id: string;
  referenceId: string;
  amount: number;
  recognitionDate: string;
  description?: string;
}

interface ClientMargin {
  clientId: string;
  revenue: number;
  cogs: number;
  totalAllocatedCosts: number;
  grossProfit: number;
  netMargin: number;
  marginPct: number;
  orderCount: number;
}

interface DepartmentCosts {
  byDept: Record<string, number>;
  total: number;
}

interface PlatformOverhead {
  totalPlatformCost: number;
  avgPerOrder: number;
  orderCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: authHeader() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#8ba8c7] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#f0f6ff]">{value}</p>
      {sub && <p className="text-xs text-[#4d6a87] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Tab 1: P&L Intelligence ────────────────────────────────────────────────

function PLTab() {
  const [pl, setPl] = useState<PLSummary | null>(null);
  const [deferred, setDeferred] = useState<DeferredRevenueSummary | null>(null);
  const [schedule, setSchedule] = useState<RecognitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = now.toISOString().split('T')[0];
      const schedTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [plData, deferData, schedData] = await Promise.all([
        apiFetch<PLSummary>(`/api/v1/financial-intelligence/tenant/default/pl?from=${from}&to=${to}`),
        apiFetch<DeferredRevenueSummary>(`/api/v1/financial-intelligence/deferred-revenue`),
        apiFetch<RecognitionEntry[]>(`/api/v1/financial-intelligence/recognition-schedule?from=${from}&to=${schedTo}`),
      ]);
      setPl(plData);
      setDeferred(deferData);
      setSchedule(schedData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="text-[#8ba8c7] py-12 text-center text-sm">Loading P&L data…</div>;
  if (error) return <div className="text-red-400 py-12 text-center text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Gross Margin"
          value={pl ? fmtPct(pl.grossMarginPct) : '—'}
          sub="Revenue minus COGS"
        />
        <KpiCard
          label="EBITDA Margin"
          value={pl ? fmtPct(pl.ebitdaMarginPct) : '—'}
          sub="After OpEx"
        />
        <KpiCard
          label="Deferred Revenue"
          value={deferred ? fmt(deferred.totalDeferred) : '—'}
          sub={`${deferred?.count ?? 0} pending entries`}
        />
      </div>

      {/* P&L Table */}
      {pl && (
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1a2f48]">
            <h3 className="text-sm font-semibold text-[#f0f6ff]">P&L Summary — Current Month</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Line Item</th>
                <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Amount</th>
                <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Revenue', value: pl.revenue, pct: 100 },
                { label: 'COGS (–)', value: -pl.cogs, pct: -(pl.revenue > 0 ? (pl.cogs / pl.revenue) * 100 : 0) },
                { label: 'Gross Profit', value: pl.grossProfit, pct: pl.grossMarginPct, bold: true },
                { label: 'Operating Expenses (–)', value: -pl.totalOpex, pct: -(pl.revenue > 0 ? (pl.totalOpex / pl.revenue) * 100 : 0) },
                { label: 'EBITDA', value: pl.ebitda, pct: pl.ebitdaMarginPct, bold: true, accent: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors">
                  <td className={`px-5 py-3 ${row.bold ? 'font-semibold text-[#f0f6ff]' : 'text-[#8ba8c7]'}`}>
                    {row.label}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono ${
                    row.accent ? 'text-[#4da3ff] font-bold' :
                    row.value < 0 ? 'text-red-400' : 'text-[#f0f6ff]'
                  }`}>
                    {fmt(row.value)}
                  </td>
                  <td className={`px-5 py-3 text-right text-xs ${row.pct < 0 ? 'text-red-400' : 'text-[#8ba8c7]'}`}>
                    {fmtPct(row.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-2.5 text-xs text-[#4d6a87]">
            {pl.orderCount} orders · Period: {pl.period.from.toString().slice(0, 10)} → {pl.period.to.toString().slice(0, 10)}
          </div>
        </div>
      )}

      {/* Recognition Schedule */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1a2f48]">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Revenue Recognition Schedule — Next 30 Days</h3>
        </div>
        {schedule.length === 0 ? (
          <p className="text-[#4d6a87] text-sm px-5 py-6">No scheduled recognitions in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Recognition Date</th>
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Order ID</th>
                <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Amount</th>
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry.id} className="border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors">
                  <td className="px-5 py-3 text-[#4da3ff] font-mono text-xs">
                    {entry.recognitionDate ? new Date(entry.recognitionDate).toLocaleDateString('pt-PT') : '—'}
                  </td>
                  <td className="px-5 py-3 text-[#8ba8c7] font-mono text-xs truncate max-w-[120px]">
                    {entry.referenceId.slice(0, 8)}…
                  </td>
                  <td className="px-5 py-3 text-right text-[#f0f6ff] font-mono">{fmt(entry.amount)}</td>
                  <td className="px-5 py-3 text-[#8ba8c7] text-xs truncate max-w-[200px]">
                    {entry.description ?? '—'}
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

// ── Tab 2: Client Margin Ranking ───────────────────────────────────────────

function MarginBadge({ pct }: { pct: number }) {
  const color = pct >= 30
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : pct >= 15
    ? 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${color}`}>
      {fmtPct(pct)}
    </span>
  );
}

function ClientMarginTab() {
  const [ranking, setRanking] = useState<ClientMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ClientMargin[]>(`/api/v1/financial-intelligence/platform/margin-ranking?limit=10`);
      setRanking(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="text-[#8ba8c7] py-12 text-center text-sm">Loading margin data…</div>;
  if (error) return <div className="text-red-400 py-12 text-center text-sm">{error}</div>;

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1a2f48]">
        <h3 className="text-sm font-semibold text-[#f0f6ff]">Top Clients by Net Margin</h3>
        <p className="text-xs text-[#4d6a87] mt-0.5">COGS at 60% of revenue + allocated platform & fulfillment costs</p>
      </div>
      {ranking.length === 0 ? (
        <p className="text-[#4d6a87] text-sm px-5 py-6">No data yet — orders needed.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium w-10">#</th>
              <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Client ID</th>
              <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Revenue</th>
              <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Net Margin</th>
              <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Margin %</th>
              <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Orders</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, i) => (
              <tr key={row.clientId} className="border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors">
                <td className="px-5 py-3 text-[#4d6a87] font-mono text-xs">{i + 1}</td>
                <td className="px-5 py-3 text-[#f0f6ff] font-mono text-xs">{row.clientId.slice(0, 16)}…</td>
                <td className="px-5 py-3 text-right text-[#f0f6ff] font-mono">{fmt(row.revenue)}</td>
                <td className={`px-5 py-3 text-right font-mono ${row.netMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(row.netMargin)}
                </td>
                <td className="px-5 py-3 text-right">
                  <MarginBadge pct={row.marginPct} />
                </td>
                <td className="px-5 py-3 text-right text-[#8ba8c7]">{row.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab 3: Accrual Tracker ─────────────────────────────────────────────────

function AccrualTab() {
  const [deferred, setDeferred] = useState<DeferredRevenueSummary | null>(null);
  const [accrued, setAccrued] = useState<AccruedExpensesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deferData, accData] = await Promise.all([
        apiFetch<DeferredRevenueSummary>(`/api/v1/financial-intelligence/deferred-revenue`),
        apiFetch<AccruedExpensesSummary>(`/api/v1/financial-intelligence/accrued-expenses`),
      ]);
      setDeferred(deferData);
      setAccrued(accData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="text-[#8ba8c7] py-12 text-center text-sm">Loading accrual data…</div>;
  if (error) return <div className="text-red-400 py-12 text-center text-sm">{error}</div>;

  const totalDeferred = deferred?.totalDeferred ?? 0;
  const totalAccrued = accrued?.totalAccrued ?? 0;
  const grandTotal = totalDeferred + totalAccrued;
  const deferredWidth = grandTotal > 0 ? (totalDeferred / grandTotal) * 100 : 50;
  const accruedWidth = grandTotal > 0 ? (totalAccrued / grandTotal) * 100 : 50;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8ba8c7] mb-1">Deferred Revenue</p>
          <p className="text-2xl font-bold text-[#4da3ff]">{fmt(totalDeferred)}</p>
          <p className="text-xs text-[#4d6a87] mt-0.5">{deferred?.count ?? 0} pending entries · revenue not yet recognized</p>
        </div>
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8ba8c7] mb-1">Accrued Expenses</p>
          <p className="text-2xl font-bold text-amber-400">{fmt(totalAccrued)}</p>
          <p className="text-xs text-[#4d6a87] mt-0.5">{accrued?.count ?? 0} outstanding · not yet settled</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-5">
        <h3 className="text-sm font-semibold text-[#f0f6ff] mb-4">Deferred vs Accrued — Balance</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-[#8ba8c7] mb-1">
              <span>Deferred Revenue</span>
              <span>{fmt(totalDeferred)}</span>
            </div>
            <div className="h-5 rounded-full bg-[#07111f] overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0" y="0" width={deferredWidth} height="100" fill="#4da3ff" rx="4" />
              </svg>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#8ba8c7] mb-1">
              <span>Accrued Expenses</span>
              <span>{fmt(totalAccrued)}</span>
            </div>
            <div className="h-5 rounded-full bg-[#07111f] overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0" y="0" width={accruedWidth} height="100" fill="#f59e0b" rx="4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-4 text-xs text-[#8ba8c7]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#4da3ff] inline-block" />
            Deferred Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            Accrued Expenses
          </span>
        </div>
      </div>

      {/* Deferred entries list */}
      {(deferred?.entries ?? []).length > 0 && (
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1a2f48]">
            <h3 className="text-sm font-semibold text-[#f0f6ff]">Pending Deferred Revenue Entries</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Reference</th>
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Type</th>
                <th className="text-right px-5 py-2.5 text-[#8ba8c7] font-medium">Amount</th>
                <th className="text-left px-5 py-2.5 text-[#8ba8c7] font-medium">Recognition Date</th>
              </tr>
            </thead>
            <tbody>
              {(deferred?.entries ?? []).slice(0, 10).map((e) => (
                <tr key={e.id} className="border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-[#f0f6ff]">{e.referenceId.slice(0, 12)}…</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
                      {e.entryType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[#f0f6ff]">{fmt(e.amount)}</td>
                  <td className="px-5 py-3 text-xs text-[#8ba8c7]">
                    {e.recognitionDate ? new Date(e.recognitionDate).toLocaleDateString('pt-PT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Cost Allocation ─────────────────────────────────────────────────

function CostAllocationTab() {
  const [deptCosts, setDeptCosts] = useState<DepartmentCosts | null>(null);
  const [overhead, setOverhead] = useState<PlatformOverhead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = now.toISOString().split('T')[0];

      const [deptData, ohData] = await Promise.all([
        apiFetch<DepartmentCosts>(`/api/v1/financial-intelligence/department-costs?from=${from}&to=${to}`),
        apiFetch<PlatformOverhead>(`/api/v1/financial-intelligence/platform/cost-overhead?months=3`),
      ]);
      setDeptCosts(deptData);
      setOverhead(ohData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="text-[#8ba8c7] py-12 text-center text-sm">Loading cost data…</div>;
  if (error) return <div className="text-red-400 py-12 text-center text-sm">{error}</div>;

  const deptEntries = Object.entries(deptCosts?.byDept ?? {}).sort((a, b) => b[1] - a[1]);
  const total = deptCosts?.total ?? 0;

  const DEPT_COLORS: Record<string, string> = {
    tech: '#4da3ff',
    operations: '#34d399',
    marketing: '#a78bfa',
    sales: '#f59e0b',
    unallocated: '#4d6a87',
  };

  return (
    <div className="space-y-6">
      {/* Overhead KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Total Platform Cost (3M)"
          value={overhead ? fmt(overhead.totalPlatformCost) : '—'}
          sub="8% rate on order value"
        />
        <KpiCard
          label="Avg Cost / Order"
          value={overhead ? fmt(overhead.avgPerOrder) : '—'}
          sub="Platform allocation avg"
        />
        <KpiCard
          label="Orders Allocated"
          value={overhead ? String(overhead.orderCount) : '—'}
          sub="Last 3 months"
        />
      </div>

      {/* Department cost breakdown */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-5">
        <h3 className="text-sm font-semibold text-[#f0f6ff] mb-1">Department Cost Breakdown — Current Month</h3>
        <p className="text-xs text-[#4d6a87] mb-4">Proportional width = share of total allocated costs</p>

        {deptEntries.length === 0 ? (
          <p className="text-[#4d6a87] text-sm">No allocations this period.</p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="flex h-8 rounded-lg overflow-hidden mb-5 gap-0.5">
              {deptEntries.map(([dept, amount]) => {
                const pct = total > 0 ? (amount / total) * 100 : 0;
                const color = DEPT_COLORS[dept] ?? '#4d6a87';
                return (
                  <div
                    key={dept}
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    className="flex items-center justify-center overflow-hidden transition-all"
                    title={`${dept}: ${fmt(amount)} (${fmtPct(pct)})`}
                  >
                    {pct > 8 && (
                      <span className="text-[10px] font-bold text-white/80 truncate px-1">{dept}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend + amounts */}
            <div className="space-y-2">
              {deptEntries.map(([dept, amount]) => {
                const pct = total > 0 ? (amount / total) * 100 : 0;
                const color = DEPT_COLORS[dept] ?? '#4d6a87';
                return (
                  <div key={dept} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-[#8ba8c7] w-28 capitalize">{dept}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#07111f] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-sm font-mono text-[#f0f6ff] w-24 text-right">{fmt(amount)}</span>
                    <span className="text-xs text-[#4d6a87] w-12 text-right">{fmtPct(pct)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[#1a2f48] flex justify-between text-sm">
              <span className="text-[#8ba8c7] font-medium">Total Allocated</span>
              <span className="font-bold text-[#f0f6ff] font-mono">{fmt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'pl' | 'margins' | 'accruals' | 'costs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pl', label: 'P&L Intelligence' },
  { id: 'margins', label: 'Client Margin Ranking' },
  { id: 'accruals', label: 'Accrual Tracker' },
  { id: 'costs', label: 'Cost Allocation' },
];

export default function FinancialIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('pl');

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f0f6ff]">
      {/* Header */}
      <div className="border-b border-[#1a2f48] bg-[#0b1526] px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4da3ff]/10 border border-[#4da3ff]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#4da3ff" strokeWidth="1.5" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f0f6ff]">Financial Intelligence</h1>
            <p className="text-xs text-[#4d6a87]">Accruals · Cost Allocation · Margin Analysis · P&L</p>
          </div>
          <span className="ml-auto text-[10px] text-[#4d6a87] font-mono">Auto-refresh 30s</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20'
                  : 'text-[#8ba8c7] hover:bg-[#07111f] hover:text-[#f0f6ff] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {activeTab === 'pl' && <PLTab />}
        {activeTab === 'margins' && <ClientMarginTab />}
        {activeTab === 'accruals' && <AccrualTab />}
        {activeTab === 'costs' && <CostAllocationTab />}
      </div>
    </div>
  );
}
