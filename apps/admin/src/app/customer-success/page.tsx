'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('adminToken') ?? '';
}

async function apiFetch<T>(path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PlatformHealth {
  totalCompanies: number;
  avgHealthScore: number;
  avgExpansionProb: number;
  byRisk: Record<string, number>;
  decliningSpend: number;
}

interface CSHealthScore {
  id: string;
  companyId: string;
  healthScore: string | number;
  churnRisk: string;
  spendTrend: string;
  lastOrderDaysAgo: number | null;
  ordersLast30d: number;
  totalLifetimeSpend: string | number;
  computedAt: string;
}

interface CohortData {
  count: number;
  avgHealthScore: number;
  avgLtv: number;
}

interface ExpansionSignal {
  id: string;
  companyId: string;
  signalType: string;
  description: string;
  recommendedAction: string;
  confidence: string | number;
  opportunityValue: string | number | null;
  isActioned: boolean;
  createdAt: string;
}

interface SignalStats {
  total: number;
  unactioned: number;
  byType: Record<string, number>;
}

interface InventoryForecast {
  id: string;
  productId: string;
  currentStock: number;
  avgDailyConsumption: string | number;
  daysUntilDepletion: number | null;
  forecastedDemand30d: number;
  confidence: string | number;
  alertSeverity: string;
  isAlertActive: boolean;
}

interface DepletionSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  healthyCount: number;
}

// ── Health Score Gauge ────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#4da3ff' : pct >= 25 ? '#f59e0b' : '#ef4444';
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-2">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1a2f48" strokeWidth="4" />
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
          {Math.round(pct)}
        </text>
      </svg>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

const CHURN_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626',
};
const CHURN_BG: Record<string, string> = {
  low: '#22c55e1a', medium: '#f59e0b1a', high: '#ef44441a', critical: '#dc26261a',
};

function ChurnBadge({ risk }: { risk: string }) {
  return (
    <span style={{ color: CHURN_COLORS[risk] ?? '#8ba8c7', background: CHURN_BG[risk] ?? '#1a2f48' }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize">
      {risk}
    </span>
  );
}

const TREND_COLORS: Record<string, string> = {
  growing: '#22c55e', stable: '#4da3ff', declining: '#ef4444',
};
function TrendChip({ trend }: { trend: string }) {
  return (
    <span style={{ color: TREND_COLORS[trend] ?? '#8ba8c7' }} className="text-xs font-medium">
      {trend === 'growing' ? '↑' : trend === 'declining' ? '↓' : '→'} {trend}
    </span>
  );
}

const SIGNAL_COLORS: Record<string, string> = {
  upsell: '#a855f7', cross_sell: '#4da3ff', volume_increase: '#22c55e',
  new_category: '#06b6d4', onboarding_gap: '#f59e0b',
};
function SignalChip({ type }: { type: string }) {
  return (
    <span style={{ color: SIGNAL_COLORS[type] ?? '#8ba8c7', background: `${SIGNAL_COLORS[type] ?? '#8ba8c7'}1a` }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
      {type.replace(/_/g, ' ')}
    </span>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#4da3ff',
};
function SeverityBadge({ sev }: { sev: string }) {
  return (
    <span style={{ color: SEVERITY_COLORS[sev] ?? '#8ba8c7', background: `${SEVERITY_COLORS[sev] ?? '#8ba8c7'}1a` }}
      className="px-2 py-0.5 rounded-full text-xs font-bold uppercase">
      {sev}
    </span>
  );
}

// ── Tab 1: Health Intelligence ────────────────────────────────────────────────

function HealthTab() {
  const [platform, setPlatform] = useState<PlatformHealth | null>(null);
  const [cohorts, setCohorts] = useState<Record<string, CohortData>>({});
  const [scoreboard, setScoreboard] = useState<CSHealthScore[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, c, s] = await Promise.all([
        apiFetch<PlatformHealth>('/api/v1/customer-success/health/platform'),
        apiFetch<Record<string, CohortData>>('/api/v1/customer-success/health/churn-cohorts'),
        apiFetch<CSHealthScore[]>('/api/v1/customer-success/health/scoreboard?limit=50'),
      ]);
      setPlatform(p);
      setCohorts(c);
      setScoreboard(s);
    } catch { /* silently ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRefreshAll() {
    setRefreshing(true);
    try { await apiFetch('/api/v1/customer-success/health/refresh-all', 'POST'); await load(); }
    catch { /* ignore */ }
    setRefreshing(false);
  }

  async function handleComputeOne(companyId: string) {
    try { await apiFetch(`/api/v1/customer-success/health/company/${companyId}`); await load(); }
    catch { /* ignore */ }
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const RISK_ORDER = ['critical', 'high', 'medium', 'low'] as const;

  return (
    <div className="space-y-6">
      {/* Platform stats */}
      {platform && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Companies', value: platform.totalCompanies },
            { label: 'Avg Health Score', value: `${platform.avgHealthScore}/100` },
            { label: 'Critical Churn Risk', value: platform.byRisk['critical'] ?? 0, danger: true },
            { label: 'Declining Spend', value: platform.decliningSpend, warn: true },
          ].map(({ label, value, danger, warn }) => (
            <div key={label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
              <p className="text-[#8ba8c7] text-xs mb-1">{label}</p>
              <p className={`text-2xl font-bold ${danger ? 'text-[#ef4444]' : warn ? 'text-[#f59e0b]' : 'text-white'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Churn cohorts */}
      <div>
        <h3 className="text-white font-semibold text-sm mb-3">Churn Risk Cohorts</h3>
        <div className="grid grid-cols-4 gap-4">
          {RISK_ORDER.map(risk => {
            const c = cohorts[risk];
            return (
              <div key={risk} style={{ borderColor: CHURN_COLORS[risk] + '40' }}
                className="rounded-xl border bg-[#0b1526] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ background: CHURN_COLORS[risk] }} className="w-2 h-2 rounded-full" />
                  <span style={{ color: CHURN_COLORS[risk] }} className="text-xs font-bold uppercase">{risk}</span>
                </div>
                {c ? (
                  <>
                    <p className="text-white font-bold text-xl">{c.count} <span className="text-[#8ba8c7] text-xs font-normal">companies</span></p>
                    <p className="text-[#8ba8c7] text-xs mt-1">Avg score: {c.avgHealthScore}</p>
                    <p className="text-[#8ba8c7] text-xs">Avg LTV: €{c.avgLtv.toLocaleString()}</p>
                  </>
                ) : (
                  <p className="text-[#4d6a87] text-sm">No data</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scoreboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Health Scoreboard (worst first)</h3>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 text-xs font-semibold hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing...' : 'Refresh All Scores'}
          </button>
        </div>
        <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48] bg-[#07111f]">
                {['Company ID', 'Health Score', 'Churn Risk', 'Spend Trend', 'Last Order', 'Orders/30d', 'LTV', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2f48]">
              {scoreboard.map(row => (
                <tr key={row.id} className="hover:bg-[#0d1f3a]/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#8ba8c7]">{row.companyId.slice(0, 8)}…</td>
                  <td className="px-4 py-3"><HealthGauge score={Number(row.healthScore)} /></td>
                  <td className="px-4 py-3"><ChurnBadge risk={row.churnRisk} /></td>
                  <td className="px-4 py-3"><TrendChip trend={row.spendTrend} /></td>
                  <td className="px-4 py-3 text-[#8ba8c7] text-xs">
                    {row.lastOrderDaysAgo !== null ? `${row.lastOrderDaysAgo}d ago` : '—'}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{row.ordersLast30d}</td>
                  <td className="px-4 py-3 text-[#8ba8c7] text-xs">€{Number(row.totalLifetimeSpend).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleComputeOne(row.companyId)}
                      className="px-2 py-1 rounded text-xs text-[#4da3ff] hover:bg-[#4da3ff]/10 transition-colors"
                    >
                      Compute
                    </button>
                  </td>
                </tr>
              ))}
              {scoreboard.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#4d6a87] text-sm">No health scores yet — run Refresh All</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Expansion Signals ──────────────────────────────────────────────────

function ExpansionTab() {
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [signals, setSignals] = useState<ExpansionSignal[]>([]);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [st, sg] = await Promise.all([
        apiFetch<SignalStats>('/api/v1/customer-success/expansion/stats'),
        apiFetch<ExpansionSignal[]>('/api/v1/customer-success/expansion/signals?limit=50'),
      ]);
      setStats(st);
      setSignals(sg);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(id: string) {
    try {
      await apiFetch(`/api/v1/customer-success/expansion/signals/${id}/action`, 'PATCH');
      setActioned(prev => new Set(Array.from(prev).concat(id)));
    } catch { /* ignore */ }
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const SIGNAL_TYPES = ['upsell', 'cross_sell', 'volume_increase', 'new_category', 'onboarding_gap'];

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
            <p className="text-[#8ba8c7] text-xs mb-1">Total Signals</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-[#f59e0b]/30 bg-[#0b1526] p-4">
            <p className="text-[#8ba8c7] text-xs mb-1">Unactioned</p>
            <p className="text-2xl font-bold text-[#f59e0b]">{stats.unactioned}</p>
          </div>
          {SIGNAL_TYPES.map(type => (
            <div key={type} style={{ borderColor: `${SIGNAL_COLORS[type]}40` }} className="rounded-xl border bg-[#0b1526] p-4">
              <p className="text-[#8ba8c7] text-xs mb-1 capitalize">{type.replace(/_/g, ' ')}</p>
              <p style={{ color: SIGNAL_COLORS[type] }} className="text-2xl font-bold">
                {stats.byType[type] ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Signals table */}
      <div>
        <h3 className="text-white font-semibold text-sm mb-3">Active Signals</h3>
        <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48] bg-[#07111f]">
                {['Type', 'Company', 'Description', 'Recommended Action', 'Confidence', 'Opportunity', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2f48]">
              {signals.map(sig => {
                const done = actioned.has(sig.id) || sig.isActioned;
                return (
                  <tr key={sig.id} className={`transition-colors ${done ? 'opacity-50' : 'hover:bg-[#0d1f3a]/50'}`}>
                    <td className="px-4 py-3"><SignalChip type={sig.signalType} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-[#8ba8c7]">{sig.companyId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-[#8ba8c7] text-xs max-w-xs">{sig.description}</td>
                    <td className="px-4 py-3 text-[#8ba8c7] text-xs max-w-xs">{sig.recommendedAction}</td>
                    <td className="px-4 py-3 text-white text-xs font-semibold">
                      {Math.round(Number(sig.confidence) * 100)}%
                    </td>
                    <td className="px-4 py-3 text-[#22c55e] text-xs font-semibold">
                      {sig.opportunityValue !== null ? `€${Number(sig.opportunityValue).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {done ? (
                        <span className="text-[#22c55e] text-xs font-semibold">✓ Done</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAction(sig.id)}
                          className="px-2 py-1 rounded text-xs bg-[#4da3ff]/10 text-[#4da3ff] hover:bg-[#4da3ff]/20 transition-colors"
                        >
                          Action
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {signals.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#4d6a87] text-sm">No active signals</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Inventory Intelligence ─────────────────────────────────────────────

function InventoryTab() {
  const [summary, setSummary] = useState<DepletionSummary | null>(null);
  const [alerts, setAlerts] = useState<InventoryForecast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        apiFetch<DepletionSummary>('/api/v1/customer-success/inventory/summary'),
        apiFetch<InventoryForecast[]>('/api/v1/customer-success/inventory/alerts'),
      ]);
      setSummary(s);
      setAlerts(a);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await apiFetch('/api/v1/customer-success/inventory/refresh', 'POST'); await load(); }
    catch { /* ignore */ }
    setRefreshing(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const SUMMARY_ITEMS = [
    { key: 'critical', label: 'Critical', color: '#dc2626' },
    { key: 'high', label: 'High', color: '#ef4444' },
    { key: 'medium', label: 'Medium', color: '#f59e0b' },
    { key: 'low', label: 'Low', color: '#4da3ff' },
    { key: 'healthyCount', label: 'Healthy', color: '#22c55e' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          {SUMMARY_ITEMS.map(({ key, label, color }) => (
            <div key={key} style={{ borderColor: color + '40' }} className="rounded-xl border bg-[#0b1526] p-4">
              <p className="text-[#8ba8c7] text-xs mb-1">{label}</p>
              <p style={{ color }} className="text-2xl font-bold">{summary[key]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Active Inventory Alerts</h3>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 text-xs font-semibold hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Forecasts'}
          </button>
        </div>
        <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48] bg-[#07111f]">
                {['Product ID', 'Current Stock', 'Avg Daily', 'Days Until Depletion', 'Forecasted 30d', 'Confidence', 'Severity'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2f48]">
              {alerts.map(row => (
                <tr key={row.id} className="hover:bg-[#0d1f3a]/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#8ba8c7]">{row.productId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-white font-semibold">{row.currentStock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#8ba8c7] text-xs">{Number(row.avgDailyConsumption).toFixed(1)}/day</td>
                  <td className="px-4 py-3">
                    {row.daysUntilDepletion !== null ? (
                      <span style={{ color: SEVERITY_COLORS[row.alertSeverity] ?? '#8ba8c7' }} className="font-bold">
                        {row.daysUntilDepletion}d
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#8ba8c7] text-xs">{row.forecastedDemand30d}</td>
                  <td className="px-4 py-3 text-[#8ba8c7] text-xs">{Math.round(Number(row.confidence) * 100)}%</td>
                  <td className="px-4 py-3"><SeverityBadge sev={row.alertSeverity} /></td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#4d6a87] text-sm">No active inventory alerts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'health', label: 'Health Intelligence' },
  { id: 'expansion', label: 'Expansion Signals' },
  { id: 'inventory', label: 'Inventory Intelligence' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CustomerSuccessPage() {
  const [activeTab, setActiveTab] = useState<TabId>('health');

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setActiveTab(t => t); // trigger re-render to propagate to child via key
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Customer Success Intelligence</h1>
        <p className="text-[#8ba8c7] text-sm mt-1">Health scores · Expansion signals · Inventory forecasts</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-[#4da3ff] text-[#07111f]'
                : 'text-[#8ba8c7] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab}>
        {activeTab === 'health' && <HealthTab />}
        {activeTab === 'expansion' && <ExpansionTab />}
        {activeTab === 'inventory' && <InventoryTab />}
      </div>
    </div>
  );
}
