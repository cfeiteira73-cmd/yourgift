'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModelVersion {
  id: string;
  modelId: string;
  name: string;
  provider: string;
  modelRef: string;
  purpose: string;
  status: string;
  config: Record<string, unknown>;
  promotedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DriftAlert {
  id: string;
  modelVersionId: string;
  metric: string;
  driftPct: number;
  severity: string;
  sampleCount: number;
  createdAt: string;
}

interface ShadowDeployment {
  id: string;
  activeVersionId: string;
  shadowVersionId: string;
  purpose: string;
  status: string;
  totalRequests: number;
  agreementRate: number | null;
  avgLatencyDelta: number | null;
  startedAt: string;
  endedAt: string | null;
}

interface OverridePattern {
  reason: string;
  count: number;
  pct: number;
}

interface LearningSignal {
  id: string;
  aiRecommendation: string;
  humanDecision: string;
  overrideReason: string | null;
  outcome: string | null;
  outcomeNotes: string | null;
  financialImpact: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Stats {
  totalVersions: number;
  activeVersions: number;
  shadowVersions: number;
  driftAlerts: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAdminToken()}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/model-ops${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/model-ops${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function statusBadge(status: string): JSX.Element {
  const map: Record<string, { bg: string; text: string }> = {
    active:      { bg: '#14532d', text: '#4ade80' },
    shadow:      { bg: '#1e3a5f', text: '#60a5fa' },
    candidate:   { bg: '#713f12', text: '#fbbf24' },
    retired:     { bg: '#1f2937', text: '#9ca3af' },
    rolled_back: { bg: '#450a0a', text: '#f87171' },
    running:     { bg: '#1e3a5f', text: '#60a5fa' },
    completed:   { bg: '#14532d', text: '#4ade80' },
    promoted:    { bg: '#14532d', text: '#4ade80' },
    rejected:    { bg: '#450a0a', text: '#f87171' },
  };
  const style = map[status] ?? { bg: '#1f2937', text: '#9ca3af' };
  return (
    <span
      style={{ background: style.bg, color: style.text }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function severityBadge(severity: string): JSX.Element {
  const map: Record<string, { bg: string; text: string }> = {
    low:      { bg: '#14532d', text: '#4ade80' },
    medium:   { bg: '#713f12', text: '#fbbf24' },
    high:     { bg: '#7c2d12', text: '#fb923c' },
    critical: { bg: '#450a0a', text: '#f87171' },
  };
  const style = map[severity] ?? { bg: '#1f2937', text: '#9ca3af' };
  return (
    <span
      style={{ background: style.bg, color: style.text }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
    >
      {severity}
    </span>
  );
}

function outcomeBadge(outcome: string | null): JSX.Element {
  if (!outcome) return <span className="text-[#6b7280] text-xs">pending</span>;
  const isCorrect = outcome === 'correct';
  return (
    <span
      style={{
        background: isCorrect ? '#14532d' : '#450a0a',
        color: isCorrect ? '#4ade80' : '#f87171',
      }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
    >
      {outcome}
    </span>
  );
}

function fmt(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── SVG Bar Chart Component ────────────────────────────────────────────────────

function HorizontalBarChart({
  data,
  maxValue,
}: {
  data: { label: string; value: number; color: string }[];
  maxValue: number;
}) {
  const barHeight = 24;
  const labelWidth = 160;
  const chartWidth = 260;
  const gap = 8;
  const totalHeight = data.length * (barHeight + gap);

  return (
    <svg width={labelWidth + chartWidth + 60} height={totalHeight} style={{ overflow: 'visible' }}>
      {data.map((item, i) => {
        const y = i * (barHeight + gap);
        const barW = maxValue > 0 ? (item.value / maxValue) * chartWidth : 0;
        return (
          <g key={item.label}>
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              fill="#9ca3af"
              fontSize={11}
            >
              {truncate(item.label, 22)}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barW, 2)}
              height={barHeight}
              rx={4}
              fill={item.color}
              opacity={0.85}
            />
            <text
              x={labelWidth + Math.max(barW, 2) + 6}
              y={y + barHeight / 2 + 4}
              fill="#e5e7eb"
              fontSize={11}
              fontWeight="600"
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AIGovernancePage() {
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [shadows, setShadows] = useState<ShadowDeployment[]>([]);
  const [patterns, setPatterns] = useState<Record<string, OverridePattern[]>>({});
  const [signals, setSignals] = useState<LearningSignal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [versionsData, alertsData, shadowsData, statsData] = await Promise.all([
        apiFetch<ModelVersion[]>('/versions'),
        apiFetch<DriftAlert[]>('/drift/alerts/recent'),
        apiFetch<ShadowDeployment[]>('/shadow'),
        apiFetch<Stats>('/stats'),
      ]);
      setVersions(versionsData);
      setAlerts(alertsData);
      setShadows(shadowsData);
      setStats(statsData);
      setError(null);

      // Load override patterns for active versions
      const activeVersions = versionsData.filter((v) => v.status === 'active');
      const patternResults: Record<string, OverridePattern[]> = {};
      const signalResults: LearningSignal[] = [];

      await Promise.all(
        activeVersions.map(async (v) => {
          try {
            const p = await apiFetch<OverridePattern[]>(`/overrides/${v.id}/patterns`);
            patternResults[v.id] = p;
          } catch {
            patternResults[v.id] = [];
          }
        }),
      );

      // Load signals from first active version
      if (activeVersions.length > 0) {
        try {
          const s = await apiFetch<LearningSignal[]>(
            `/overrides/${activeVersions[0].id}/signals`,
          );
          signalResults.push(...s.slice(0, 20));
        } catch {
          // no signals yet
        }
      }

      setPatterns(patternResults);
      setSignals(signalResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 15_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleAction(
    path: string,
    body?: unknown,
    successMsg?: string,
  ) {
    try {
      await apiPost(path, body);
      setActionMsg(successMsg ?? 'Done');
      setTimeout(() => setActionMsg(null), 3000);
      void loadData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed');
      setTimeout(() => setActionMsg(null), 4000);
    }
  }

  // Aggregate patterns across active versions for chart
  const allPatterns: OverridePattern[] = Object.values(patterns)
    .flat()
    .reduce<OverridePattern[]>((acc, p) => {
      const existing = acc.find((a) => a.reason === p.reason);
      if (existing) {
        existing.count += p.count;
      } else {
        acc.push({ ...p });
      }
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxPatternCount = allPatterns[0]?.count ?? 1;

  const cardStyle: React.CSSProperties = {
    background: '#111',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '20px 24px',
  };

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', padding: '28px 32px', color: '#e5e7eb' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Governance</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Model registry, drift detection, shadow deployments &amp; override intelligence
          </p>
        </div>
        {actionMsg && (
          <div
            style={{
              background: actionMsg.includes('failed') || actionMsg.includes('Error') ? '#450a0a' : '#14532d',
              color: actionMsg.includes('failed') || actionMsg.includes('Error') ? '#f87171' : '#4ade80',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {actionMsg}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { label: 'Total Versions', value: stats.totalVersions, color: '#60a5fa' },
            { label: 'Active Models', value: stats.activeVersions, color: '#4ade80' },
            { label: 'Drift Alerts (24h)', value: stats.driftAlerts, color: stats.driftAlerts > 0 ? '#f87171' : '#4ade80' },
            { label: 'Shadows Running', value: stats.shadowVersions, color: '#a78bfa' },
            { label: 'Override Patterns', value: allPatterns.length, color: '#fbbf24' },
          ].map((s) => (
            <div key={s.label} style={cardStyle}>
              <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-1">{s.label}</p>
              <p style={{ color: s.color, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-[#6b7280]">Loading AI Governance data…</div>
      )}

      {error && (
        <div
          style={{ background: '#450a0a', color: '#f87171', padding: '12px 20px', borderRadius: 8, marginBottom: 20 }}
        >
          {error}
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── Model Registry ── */}
          <section style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">Model Registry</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937' }}>
                    {['Model ID', 'Name', 'Purpose', 'Provider', 'Model Ref', 'Status', 'Created', 'Actions'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {versions.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px 12px', textAlign: 'center', color: '#6b7280' }}>
                        No model versions found
                      </td>
                    </tr>
                  )}
                  {versions.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '10px 12px', color: '#d1d5db', fontFamily: 'monospace', fontSize: 12 }}>
                        {v.modelId}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#f3f4f6', fontWeight: 500 }}>
                        {v.name}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#9ca3af' }}>
                        <span
                          style={{
                            background: '#1e293b',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {v.purpose}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{v.provider}</td>
                      <td style={{ padding: '10px 12px', color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>
                        {v.modelRef}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge(v.status)}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmt(v.createdAt)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                          {v.status !== 'active' && v.status !== 'retired' && v.status !== 'rolled_back' && (
                            <button
                              onClick={() =>
                                void handleAction(`/versions/${v.id}/promote`, {}, 'Promoted')
                              }
                              style={{
                                background: '#14532d',
                                color: '#4ade80',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Promote
                            </button>
                          )}
                          {v.status === 'active' && (
                            <button
                              onClick={() =>
                                void handleAction(`/versions/${v.id}/retire`, {}, 'Retired')
                              }
                              style={{
                                background: '#1f2937',
                                color: '#9ca3af',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Retire
                            </button>
                          )}
                          {v.status === 'active' && (
                            <button
                              onClick={() =>
                                void handleAction(
                                  `/versions/${v.id}/rollback`,
                                  { reason: 'Manual rollback from admin UI' },
                                  'Rolled back',
                                )
                              }
                              style={{
                                background: '#450a0a',
                                color: '#f87171',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Rollback
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Drift Alerts ── */}
          <section style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">
              Drift Alerts
              {alerts.length > 0 && (
                <span
                  style={{
                    marginLeft: 10,
                    background: '#450a0a',
                    color: '#f87171',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {alerts.length}
                </span>
              )}
            </h2>
            {alerts.length === 0 ? (
              <p className="text-[#6b7280] text-sm py-4">No high/critical drift alerts</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Metric', 'Drift %', 'Severity', 'Version ID', 'Samples', 'Timestamp'].map((h) => (
                        <th
                          key={h}
                          style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr
                        key={a.id}
                        style={{
                          borderBottom: '1px solid #1a1a1a',
                          background: a.severity === 'critical' ? 'rgba(239,68,68,0.04)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: '#f3f4f6', fontWeight: 500 }}>{a.metric}</td>
                        <td
                          style={{
                            padding: '10px 12px',
                            color: Math.abs(a.driftPct) > 20 ? '#f87171' : '#fbbf24',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        >
                          {a.driftPct > 0 ? '+' : ''}
                          {a.driftPct.toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px 12px' }}>{severityBadge(a.severity)}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                          {a.modelVersionId.slice(0, 8)}…
                        </td>
                        <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{a.sampleCount}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmt(a.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Shadow Deployments ── */}
          <section style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">Shadow Deployments</h2>
            {shadows.length === 0 ? (
              <p className="text-[#6b7280] text-sm py-4">No active shadow deployments</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Purpose', 'Active Version', 'Shadow Version', 'Requests', 'Agreement', 'Latency Delta', 'Status', 'Actions'].map(
                        (h) => (
                          <th
                            key={h}
                            style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shadows.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#1e293b', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#9ca3af' }}>
                            {s.purpose}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                          {s.activeVersionId.slice(0, 8)}…
                        </td>
                        <td style={{ padding: '10px 12px', color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>
                          {s.shadowVersionId.slice(0, 8)}…
                        </td>
                        <td style={{ padding: '10px 12px', color: '#d1d5db', fontWeight: 600 }}>
                          {s.totalRequests.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {s.agreementRate !== null ? (
                            <span
                              style={{
                                color: s.agreementRate >= 90 ? '#4ade80' : s.agreementRate >= 70 ? '#fbbf24' : '#f87171',
                                fontWeight: 700,
                              }}
                            >
                              {s.agreementRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[#6b7280]">—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {s.avgLatencyDelta !== null ? (
                            <span
                              style={{
                                color: s.avgLatencyDelta <= 0 ? '#4ade80' : s.avgLatencyDelta < 50 ? '#fbbf24' : '#f87171',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                              }}
                            >
                              {s.avgLatencyDelta > 0 ? '+' : ''}
                              {s.avgLatencyDelta.toFixed(0)}ms
                            </span>
                          ) : (
                            <span className="text-[#6b7280]">—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{statusBadge(s.status)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {s.status === 'running' && (
                              <>
                                <button
                                  onClick={() =>
                                    void handleAction(`/shadow/${s.id}/complete`, {}, 'Completed')
                                  }
                                  style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() =>
                                    void handleAction(
                                      `/shadow/${s.id}/promote`,
                                      { notes: 'Promoted from admin UI' },
                                      'Promoted',
                                    )
                                  }
                                  style={{ background: '#14532d', color: '#4ade80', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                >
                                  Promote
                                </button>
                                <button
                                  onClick={() =>
                                    void handleAction(
                                      `/shadow/${s.id}/reject`,
                                      { reason: 'Rejected from admin UI' },
                                      'Rejected',
                                    )
                                  }
                                  style={{ background: '#450a0a', color: '#f87171', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Override Intelligence ── */}
          <section style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">Override Intelligence</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Top Disagreement Patterns Bar Chart */}
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-4">
                  Top Disagreement Patterns (all active models)
                </p>
                {allPatterns.length === 0 ? (
                  <p className="text-[#6b7280] text-sm">No override patterns recorded yet</p>
                ) : (
                  <HorizontalBarChart
                    data={allPatterns.map((p, i) => ({
                      label: p.reason,
                      value: p.count,
                      color: ['#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'][i % 5],
                    }))}
                    maxValue={maxPatternCount}
                  />
                )}
              </div>

              {/* Per-version override rates */}
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-4">
                  Override Rate by Active Model
                </p>
                {versions.filter((v) => v.status === 'active').length === 0 ? (
                  <p className="text-[#6b7280] text-sm">No active models</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {versions
                      .filter((v) => v.status === 'active')
                      .map((v) => {
                        const ps = patterns[v.id] ?? [];
                        const totalOverrides = ps.reduce((a, b) => a + b.count, 0);
                        return (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500, marginBottom: 4 }}>
                                {v.name}
                              </p>
                              <div style={{ background: '#1f2937', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${Math.min(totalOverrides * 5, 100)}%`,
                                    height: '100%',
                                    background: totalOverrides > 10 ? '#f87171' : totalOverrides > 3 ? '#fbbf24' : '#4ade80',
                                    borderRadius: 4,
                                    transition: 'width 0.5s ease',
                                  }}
                                />
                              </div>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', minWidth: 32, textAlign: 'right' }}>
                              {totalOverrides}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Learning Signals Feed ── */}
          <section style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">Learning Signals Feed</h2>
            {signals.length === 0 ? (
              <p className="text-[#6b7280] text-sm py-4">
                No resolved overrides yet. Learning signals will appear here once outcomes are recorded.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2937' }}>
                      {['AI Recommendation', 'Human Decision', 'Reason', 'Outcome', 'Financial Impact', 'Resolved'].map(
                        (h) => (
                          <th
                            key={h}
                            style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '10px 12px', color: '#9ca3af', maxWidth: 160 }}>
                          <span title={s.aiRecommendation}>{truncate(s.aiRecommendation, 35)}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#d1d5db', maxWidth: 160 }}>
                          <span title={s.humanDecision}>{truncate(s.humanDecision, 35)}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 140 }}>
                          <span title={s.overrideReason ?? ''}>{truncate(s.overrideReason ?? '—', 30)}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{outcomeBadge(s.outcome)}</td>
                        <td style={{ padding: '10px 12px', color: s.financialImpact && s.financialImpact < 0 ? '#f87171' : '#4ade80', fontFamily: 'monospace', fontSize: 12 }}>
                          {s.financialImpact !== null
                            ? `${s.financialImpact >= 0 ? '+' : ''}€${Math.abs(s.financialImpact).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}`
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmt(s.resolvedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
