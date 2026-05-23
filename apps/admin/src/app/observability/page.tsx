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

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemHealthSnapshot {
  id: string;
  snapshotAt: string;
  totalEvents: string | number;
  eventsLastHour: number;
  dlqSize: number;
  maxConsumerLag: number;
  ordersToday: number;
  ordersInProduction: number;
  revenueToday: string | number;
  activeWorkflows: number;
  failedWorkflows: number;
  openAnomalies: number;
  apiP50Ms: number;
  apiP95Ms: number;
  apiP99Ms: number;
  errorRatePct: string | number;
  dbPoolSize: number;
  memoryMb: number;
  createdAt: string;
}

interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  byPath: Array<{
    path: string;
    avgMs: number;
    count: number;
    errorCount: number;
  }>;
}

interface EventMetric {
  eventType: string;
  count: number;
  avgMs: number;
  errorCount: number;
  successRate: number;
}

interface SystemAlert {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  metricValue: string | number | null;
  thresholdValue: string | number | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function latencyColor(ms: number): string {
  if (ms > 2000) return '#ef4444';
  if (ms > 1000) return '#f59e0b';
  return '#22c55e';
}

function errorRateColor(rate: number): string {
  if (rate > 5) return '#ef4444';
  if (rate >= 1) return '#f59e0b';
  return '#22c55e';
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#4da3ff',
};
const SEVERITY_BG: Record<string, string> = {
  critical: '#ef44441a',
  warning: '#f59e0b1a',
  info: '#4da3ff1a',
};

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <svg width="200" height="40" viewBox="0 0 200 40">
        <line x1="0" y1="20" x2="200" y2="20" stroke="#1a2f48" strokeWidth="1" />
      </svg>
    );
  }

  const max = Math.max(...values, 1);
  const W = 200;
  const H = 40;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={polyline}
        fill="none"
        stroke="#4da3ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Tab 1: System Health ──────────────────────────────────────────────────────

function HealthTab() {
  const [snapshots, setSnapshots] = useState<SystemHealthSnapshot[]>([]);
  const [taking, setTaking] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SystemHealthSnapshot[]>(
        '/api/v1/observability/snapshots?limit=24',
      );
      setSnapshots(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleTakeSnapshot() {
    setTaking(true);
    try {
      await apiFetch('/api/v1/observability/snapshots/take', 'POST');
      await load();
    } catch { /* ignore */ }
    setTaking(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const latest = snapshots[0];

  const metricCards = latest
    ? [
        {
          group: 'Event Platform',
          items: [
            {
              label: 'Total Events',
              value: Number(latest.totalEvents).toLocaleString(),
              color: 'white',
            },
            {
              label: 'Events Last Hour',
              value: latest.eventsLastHour.toLocaleString(),
              color: 'white',
            },
            {
              label: 'DLQ Size',
              value: latest.dlqSize,
              color: latest.dlqSize > 10 ? '#ef4444' : '#22c55e',
            },
            {
              label: 'Max Consumer Lag',
              value: latest.maxConsumerLag.toLocaleString(),
              color: latest.maxConsumerLag > 100 ? '#f59e0b' : '#22c55e',
            },
          ],
        },
        {
          group: 'Orders',
          items: [
            { label: 'Orders Today', value: latest.ordersToday, color: 'white' },
            { label: 'In Production', value: latest.ordersInProduction, color: '#4da3ff' },
          ],
        },
        {
          group: 'Financial',
          items: [
            {
              label: 'Revenue Today',
              value: `€${Number(latest.revenueToday).toLocaleString('en', { minimumFractionDigits: 2 })}`,
              color: '#22c55e',
            },
          ],
        },
        {
          group: 'Workflows',
          items: [
            { label: 'Active', value: latest.activeWorkflows, color: '#4da3ff' },
            {
              label: 'Failed',
              value: latest.failedWorkflows,
              color: latest.failedWorkflows > 0 ? '#ef4444' : '#22c55e',
            },
          ],
        },
        {
          group: 'API Performance',
          items: [
            {
              label: 'p50 Latency',
              value: `${latest.apiP50Ms}ms`,
              color: latencyColor(latest.apiP50Ms),
            },
            {
              label: 'p95 Latency',
              value: `${latest.apiP95Ms}ms`,
              color: latencyColor(latest.apiP95Ms),
            },
            {
              label: 'p99 Latency',
              value: `${latest.apiP99Ms}ms`,
              color: latencyColor(latest.apiP99Ms),
            },
            {
              label: 'Error Rate',
              value: `${Number(latest.errorRatePct).toFixed(1)}%`,
              color: errorRateColor(Number(latest.errorRatePct)),
            },
          ],
        },
        {
          group: 'System',
          items: [
            { label: 'Memory', value: `${latest.memoryMb} MB`, color: 'white' },
            { label: 'Open Anomalies', value: latest.openAnomalies, color: latest.openAnomalies > 0 ? '#f59e0b' : '#22c55e' },
          ],
        },
      ]
    : [];

  // Sparkline: p95 values from oldest → newest
  const p95Values = [...snapshots].reverse().map((s) => s.apiP95Ms);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm">
            Latest Snapshot{' '}
            {latest && (
              <span className="text-[#4d6a87] font-normal">{timeAgo(latest.snapshotAt)}</span>
            )}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleTakeSnapshot}
          disabled={taking}
          className="px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 text-xs font-semibold hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
        >
          {taking ? 'Taking...' : 'Take Snapshot'}
        </button>
      </div>

      {!latest && (
        <p className="text-[#4d6a87] text-sm">No snapshots yet — click "Take Snapshot".</p>
      )}

      {metricCards.map((group) => (
        <div key={group.group}>
          <h3 className="text-[#4d6a87] text-xs font-semibold uppercase tracking-wide mb-3">
            {group.group}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {group.items.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4"
              >
                <p className="text-[#8ba8c7] text-xs mb-1">{item.label}</p>
                <p
                  className="text-xl font-bold"
                  style={{ color: item.color === 'white' ? 'white' : item.color }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* p95 Sparkline */}
      {snapshots.length > 1 && (
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
          <p className="text-[#8ba8c7] text-xs mb-3">
            p95 Latency — last {snapshots.length} snapshots (ms)
          </p>
          <Sparkline values={p95Values} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#4d6a87]">oldest</span>
            <span className="text-[10px] text-[#4d6a87]">newest</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: API Performance ────────────────────────────────────────────────────

function LatencyTab() {
  const [stats, setStats] = useState<LatencyStats | null>(null);
  const [hours, setHours] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<LatencyStats>(
        `/api/v1/observability/latency?hours=${hours}`,
      );
      setStats(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [hours]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-[#8ba8c7] text-xs">Window:</span>
        {[1, 6, 24].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHours(h)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              hours === h
                ? 'bg-[#4da3ff] text-[#07111f]'
                : 'bg-[#0b1526] text-[#8ba8c7] border border-[#1a2f48] hover:text-white'
            }`}
          >
            {h}h
          </button>
        ))}
      </div>

      {loading && <p className="text-[#8ba8c7] text-sm">Loading...</p>}

      {stats && (
        <>
          {/* Big numbers */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'p50 Latency', value: `${stats.p50}ms`, color: latencyColor(stats.p50) },
              { label: 'p95 Latency', value: `${stats.p95}ms`, color: latencyColor(stats.p95) },
              { label: 'p99 Latency', value: `${stats.p99}ms`, color: latencyColor(stats.p99) },
              {
                label: 'Error Rate',
                value: `${stats.errorRate.toFixed(1)}%`,
                color: errorRateColor(stats.errorRate),
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 text-center"
                style={{ borderColor: `${color}30` }}
              >
                <p className="text-[#8ba8c7] text-xs mb-2">{label}</p>
                <p className="text-3xl font-bold" style={{ color }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* By-path table */}
          {stats.byPath.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3">By Endpoint</h3>
              <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a2f48] bg-[#07111f]">
                      {['Path', 'Avg ms', 'Requests', 'Errors', 'Error %'].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2f48]">
                    {stats.byPath.map((row) => {
                      const errPct =
                        row.count > 0
                          ? ((row.errorCount / row.count) * 100)
                          : 0;
                      const isHighErr = errPct > 5;
                      return (
                        <tr
                          key={row.path}
                          className="hover:bg-[#0d1f3a]/50 transition-colors"
                          style={isHighErr ? { background: '#ef444408' } : {}}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[#8ba8c7]">
                            {row.path}
                          </td>
                          <td
                            className="px-4 py-3 font-semibold text-xs"
                            style={{ color: latencyColor(row.avgMs) }}
                          >
                            {row.avgMs}ms
                          </td>
                          <td className="px-4 py-3 text-white text-xs">{row.count}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: row.errorCount > 0 ? '#ef4444' : '#22c55e' }}>
                            {row.errorCount}
                          </td>
                          <td
                            className="px-4 py-3 text-xs font-semibold"
                            style={{ color: errorRateColor(errPct) }}
                          >
                            {errPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stats.byPath.length === 0 && (
            <p className="text-[#4d6a87] text-sm text-center py-8">
              No request logs in the selected window.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab 3: Alerts ─────────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SystemAlert[]>('/api/v1/observability/alerts');
      setAlerts(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleResolve(id: string) {
    setResolving((prev) => new Set(Array.from(prev).concat(id)));
    try {
      await apiFetch(`/api/v1/observability/alerts/${id}/resolve`, 'POST');
      await load();
    } catch { /* ignore */ }
    setResolving((prev) => {
      const next = new Set(Array.from(prev));
      next.delete(id);
      return next;
    });
  }

  async function handleDetect() {
    setDetecting(true);
    try {
      await apiFetch('/api/v1/observability/alerts/detect', 'POST');
      await load();
    } catch { /* ignore */ }
    setDetecting(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">
          Open Alerts{' '}
          <span className="text-[#4d6a87] font-normal">({alerts.length})</span>
        </h2>
        <button
          type="button"
          onClick={handleDetect}
          disabled={detecting}
          className="px-3 py-1.5 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 text-xs font-semibold hover:bg-[#f59e0b]/20 disabled:opacity-50 transition-colors"
        >
          {detecting ? 'Detecting...' : 'Run Detection'}
        </button>
      </div>

      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: '#22c55e1a' }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              width="24"
              height="24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <p className="text-[#22c55e] font-semibold">All systems operational</p>
          <p className="text-[#4d6a87] text-xs mt-1">No open alerts detected</p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sevColor = SEVERITY_COLOR[alert.severity] ?? '#8ba8c7';
            const sevBg = SEVERITY_BG[alert.severity] ?? '#1a2f48';
            const isResolving = resolving.has(alert.id);
            return (
              <div
                key={alert.id}
                className="rounded-xl border bg-[#0b1526] p-4"
                style={{ borderColor: `${sevColor}30` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold uppercase"
                        style={{ color: sevColor, background: sevBg }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[#4d6a87] text-xs px-2 py-0.5 rounded-full border border-[#1a2f48]">
                        {alert.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[#4d6a87] text-xs ml-auto">
                        {timeAgo(alert.createdAt)}
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm">{alert.title}</p>
                    <p className="text-[#8ba8c7] text-xs mt-1">{alert.description}</p>
                    {alert.metricValue !== null && alert.thresholdValue !== null && (
                      <p className="text-[#4d6a87] text-xs mt-1">
                        Metric:{' '}
                        <span style={{ color: sevColor }}>
                          {Number(alert.metricValue).toLocaleString()}
                        </span>
                        {' '}/ Threshold:{' '}
                        <span className="text-[#8ba8c7]">
                          {Number(alert.thresholdValue).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolve(alert.id)}
                    disabled={isResolving}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 text-xs font-semibold hover:bg-[#22c55e]/20 disabled:opacity-50 transition-colors"
                  >
                    {isResolving ? '...' : 'Resolve'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'health', label: 'System Health' },
  { id: 'api', label: 'API Performance' },
  { id: 'alerts', label: 'Alerts' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState<TabId>('health');

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Observability</h1>
        <p className="text-[#8ba8c7] text-sm mt-1">
          System health · API latency · Event processing · Alerts
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] w-fit">
        {TABS.map((tab) => (
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
        {activeTab === 'api' && <LatencyTab />}
        {activeTab === 'alerts' && <AlertsTab />}
      </div>
    </div>
  );
}
