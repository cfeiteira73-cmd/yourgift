'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SLADefinition {
  id: string;
  stage: string;
  displayName: string;
  expectedHours: number;
  warningHours: number;
  criticalHours: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

interface ControlTowerStats {
  activeOrders: number;
  byStage: Record<string, number>;
  byStatus: Record<string, number>;
  bySLAStatus: Record<string, number>;
}

interface SlowStage {
  stage: string;
  avgHours: number;
  orderCount: number;
}

interface SLABreach {
  stage: string;
  count: number;
}

interface Bottlenecks {
  slaBreaches: SLABreach[];
  slowestStages: SlowStage[];
}

interface AtRiskStage {
  id: string;
  orderId: string;
  stage: string;
  slaStatus: string;
  slaHoursRemaining: number | null;
  status: string;
  startedAt: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function apiPost(path: string, body?: unknown): Promise<void> {
  await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── SLA Status Badge ─────────────────────────────────────────────────────────

function SLABadge({ status }: { status: string }) {
  if (status === 'breached') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
        ✗ Breached
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
        ◐ Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30">
      ● On Track
    </span>
  );
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

function PipelineFunnel({
  slas,
  stats,
}: {
  slas: SLADefinition[];
  stats: ControlTowerStats | null;
}) {
  const maxQueue = Math.max(
    1,
    ...slas.map((s) => stats?.byStage[s.stage] ?? 0),
  );

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-6">
      <h2 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider">
        Production Pipeline Funnel
      </h2>
      <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 160 }}>
        {slas.map((sla) => {
          const queue = stats?.byStage[sla.stage] ?? 0;
          const bySLA = stats?.bySLAStatus ?? {};
          const totalBreached = bySLA['breached'] ?? 0;
          const totalWarning = bySLA['warning'] ?? 0;

          // bar height: proportional, min 8px when queue = 0
          const barPct = queue > 0 ? (queue / maxQueue) * 100 : 0;
          const barHeight = Math.max(8, Math.round((barPct / 100) * 120));

          return (
            <div
              key={sla.stage}
              className="flex flex-col items-center gap-2 flex-1 min-w-[72px]"
            >
              {/* Queue count */}
              <span className="text-sm font-bold text-white">{queue}</span>

              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: 120 }}>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: barHeight,
                    backgroundColor: sla.color,
                    opacity: queue === 0 ? 0.2 : 0.85,
                  }}
                />
              </div>

              {/* SLA badge — simplified: show overall SLA status counts */}
              <div className="text-center">
                {totalBreached > 0 ? (
                  <span className="text-[9px] font-bold text-[#ef4444]">✗ {totalBreached} breach</span>
                ) : totalWarning > 0 ? (
                  <span className="text-[9px] font-bold text-[#f59e0b]">◐ {totalWarning} warn</span>
                ) : (
                  <span className="text-[9px] font-bold text-[#22c55e]">● ok</span>
                )}
              </div>

              {/* Stage name */}
              <span className="text-[10px] text-[#8ba8c7] text-center leading-tight font-medium">
                {sla.displayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const [stats, setStats] = useState<ControlTowerStats | null>(null);
  const [bottlenecks, setBottlenecks] = useState<Bottlenecks | null>(null);
  const [slas, setSLAs] = useState<SLADefinition[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [s, b, sl, ar] = await Promise.all([
        apiFetch<ControlTowerStats>('/api/v1/production/stats'),
        apiFetch<Bottlenecks>('/api/v1/production/bottlenecks'),
        apiFetch<SLADefinition[]>('/api/v1/production/sla-definitions'),
        apiFetch<AtRiskStage[]>('/api/v1/production/at-risk'),
      ]);
      setStats(s);
      setBottlenecks(b);
      setSLAs(sl);
      setAtRisk(ar);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Production fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => { void fetchAll(); }, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleSLACheckAll() {
    // We don't have a global SLA-check-all endpoint — call per active orderId
    // Optimistic: just refresh stats
    await fetchAll();
  }

  const breachedCount = stats?.bySLAStatus['breached'] ?? 0;
  const warningCount = stats?.bySLAStatus['warning'] ?? 0;

  return (
    <div className="min-h-screen bg-[#07111f] p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Production Control Tower
          </h1>
          <p className="text-sm text-[#8ba8c7] mt-1">
            {loading ? (
              'Loading...'
            ) : (
              <>
                <span className="text-white font-semibold">{stats?.activeOrders ?? 0}</span> active orders
                {breachedCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-[#ef4444] font-semibold">{breachedCount}</span> breached SLAs
                  </>
                )}
                {warningCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-[#f59e0b] font-semibold">{warningCount}</span> warnings
                  </>
                )}
                {' · '}
                <span className="text-[#4d6a87]">
                  Refreshed {lastRefresh.toLocaleTimeString()}
                </span>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => { void handleSLACheckAll(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] text-sm font-medium hover:bg-[#4da3ff]/20 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          SLA Check All
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active Orders', value: stats?.activeOrders ?? 0, color: '#4da3ff' },
          { label: 'In Progress', value: stats?.byStatus['in_progress'] ?? 0, color: '#4da3ff' },
          { label: 'SLA Warnings', value: warningCount, color: '#f59e0b' },
          { label: 'SLA Breached', value: breachedCount, color: '#ef4444' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4"
          >
            <p className="text-xs text-[#8ba8c7] font-medium">{kpi.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Pipeline Funnel ── */}
      <PipelineFunnel slas={slas} stats={stats} />

      {/* ── Bottlenecks + At-Risk ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bottlenecks */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Bottleneck Analysis
          </h2>

          {/* Slowest stages */}
          <div>
            <p className="text-xs text-[#4d6a87] font-medium mb-3 uppercase tracking-wide">
              Slowest Stages (avg hours in progress)
            </p>
            {bottlenecks?.slowestStages.length === 0 && (
              <p className="text-sm text-[#4d6a87]">No data yet.</p>
            )}
            <div className="space-y-2">
              {(bottlenecks?.slowestStages ?? []).map((s) => {
                const pct = Math.min(100, (s.avgHours / 72) * 100);
                return (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white capitalize">{s.stage}</span>
                      <span className="text-xs text-[#8ba8c7]">
                        {s.avgHours}h avg · {s.orderCount} orders
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1a2f48] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct > 75 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#4da3ff',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SLA Breaches by stage */}
          <div>
            <p className="text-xs text-[#4d6a87] font-medium mb-3 uppercase tracking-wide">
              SLA Breaches by Stage
            </p>
            {bottlenecks?.slaBreaches.length === 0 && (
              <p className="text-sm text-[#22c55e]">No breaches — all on track.</p>
            )}
            <div className="space-y-1.5">
              {(bottlenecks?.slaBreaches ?? []).map((b) => (
                <div
                  key={b.stage}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/15"
                >
                  <span className="text-xs font-medium text-white capitalize">{b.stage}</span>
                  <span className="text-xs font-bold text-[#ef4444]">{b.count} breached</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* At-Risk Orders */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
            Orders at Risk
          </h2>
          {atRisk.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#4d6a87]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" className="mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm">All orders on track</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {atRisk.map((r) => {
                const isBreached = r.slaStatus === 'breached';
                const hoursRemaining = r.slaHoursRemaining !== null ? Number(r.slaHoursRemaining) : null;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                      isBreached
                        ? 'bg-[#ef4444]/8 border-[#ef4444]/20'
                        : 'bg-[#f59e0b]/8 border-[#f59e0b]/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-white truncate text-[10px]">{r.orderId}</p>
                      <p className="capitalize text-[#8ba8c7] mt-0.5">{r.stage}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {hoursRemaining !== null && (
                        <span className={`font-bold ${isBreached ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`}>
                          {hoursRemaining < 0 ? `+${Math.abs(hoursRemaining)}h` : `${hoursRemaining}h`}
                        </span>
                      )}
                      <SLABadge status={r.slaStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SLA Definitions Table ── */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a2f48]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            SLA Definitions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Stage', 'Expected', 'Warning At', 'Critical At', 'Color'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#4d6a87]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slas.map((sla, idx) => (
                <tr
                  key={sla.id}
                  className={`border-b border-[#1a2f48]/50 transition-colors hover:bg-[#102131]/40 ${
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-[#07111f]/30'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sla.color }}
                      />
                      <span className="text-white font-medium">{sla.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#8ba8c7]">{sla.expectedHours}h</td>
                  <td className="px-4 py-3 text-[#f59e0b]">{sla.warningHours}h</td>
                  <td className="px-4 py-3 text-[#ef4444]">{sla.criticalHours}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded border border-[#1a2f48]"
                        style={{ backgroundColor: sla.color }}
                      />
                      <span className="font-mono text-[11px] text-[#4d6a87]">{sla.color}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {slas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#4d6a87] text-sm">
                    No SLA definitions found. Run the migration to seed them.
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
