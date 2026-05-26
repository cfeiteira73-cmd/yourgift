'use client';

import { useEffect, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  actionType: string;
  priority: number;
  executionCount: number;
  lastExecutedAt: string | null;
  isActive: boolean;
}

interface AutomationExecution {
  id: string;
  triggerEvent: string;
  status: 'success' | 'failed' | 'skipped';
  executedAt: string;
  rule: { name: string; actionType: string };
}

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  executions: Record<string, number>;
}

interface SupplierMatrix {
  id: string;
  supplierId: string;
  supplierName: string;
  category: string;
  baseScore: number;
  reliabilityScore: number;
  priceScore: number;
  leadTimeDays: number;
  minOrderValue: number;
  maxOrderValue: number | null;
  supportedRegions: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  send_notification: { bg: '#1e3a5f', text: '#60a5fa', border: '#2563eb33' },
  create_job:        { bg: '#2d1f4f', text: '#a78bfa', border: '#7c3aed33' },
  update_status:     { bg: '#1a3a2a', text: '#4ade80', border: '#16a34a33' },
  flag_review:       { bg: '#3a2a10', text: '#fbbf24', border: '#d9770633' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: '#1a3a2a', text: '#4ade80' },
  failed:  { bg: '#3a1a1a', text: '#f87171' },
  skipped: { bg: '#1a2535', text: '#8ba8c7' },
};

function compositeScore(s: SupplierMatrix): number {
  const leadTimeScore = Math.max(0, 100 - Number(s.leadTimeDays) * 5);
  return Math.round((Number(s.reliabilityScore) * 0.40 + Number(s.priceScore) * 0.35 + leadTimeScore * 0.25) * 10) / 10;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: '#0b1526',
      border: '1px solid #1a2f48',
      borderRadius: 12,
      padding: '18px 20px',
      flex: 1,
      minWidth: 0,
    }}>
      <p style={{ color: '#8ba8c7', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
      <p style={{ color: '#f0f6ff', fontSize: 28, fontWeight: 700, margin: '6px 0 0', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: '#4d6a87', fontSize: 11, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: checked ? '#4da3ff' : '#1a2f48',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 18 : 3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#f0f6ff',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? '#4ade80' : pct >= 55 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#1a2f48', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color: '#f0f6ff', fontSize: 12, fontWeight: 600, minWidth: 32 }}>{pct}</span>
    </div>
  );
}

// ─── Routing Matrix Modal ─────────────────────────────────────────────────────

function RoutingMatrixModal({ matrix, onClose }: { matrix: SupplierMatrix[]; onClose: () => void }) {
  const sorted = [...matrix].sort((a, b) => compositeScore(b) - compositeScore(a));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,17,31,0.85)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 16,
        width: '100%', maxWidth: 860, maxHeight: '80vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1a2f48', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#f0f6ff', fontSize: 16, fontWeight: 700, margin: 0 }}>Supplier Routing Matrix</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#8ba8c7', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
            &times;
          </button>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#07111f' }}>
                {['Supplier', 'Category', 'Composite Score', 'Reliability', 'Price', 'Lead Time', 'Regions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#8ba8c7', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const score = compositeScore(s);
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid #1a2f48' }}>
                    <td style={{ padding: '12px 16px', color: '#f0f6ff', fontWeight: 600 }}>{s.supplierName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#1a2f48', color: '#8ba8c7', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{s.category}</span>
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 140 }}>
                      <ScoreBar value={score} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{Number(s.reliabilityScore).toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{Number(s.priceScore).toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{s.leadTimeDays}d</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.supportedRegions.map(r => (
                          <span key={r} style={{ background: '#0d1f3a', color: '#4da3ff', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>{r}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [matrix, setMatrix] = useState<SupplierMatrix[]>([]);
  const [showMatrix, setShowMatrix] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
  const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    try {
      const [rulesRes, execRes, statsRes, matrixRes] = await Promise.all([
        fetch(`${API}/api/v1/automation/rules`, { headers }),
        fetch(`${API}/api/v1/automation/executions?limit=30`, { headers }),
        fetch(`${API}/api/v1/automation/stats`, { headers }),
        fetch(`${API}/api/v1/automation/routing/matrix`, { headers }),
      ]);
      const [r, e, s, m] = await Promise.all([
        rulesRes.json() as Promise<AutomationRule[]>,
        execRes.json() as Promise<AutomationExecution[]>,
        statsRes.json() as Promise<AutomationStats>,
        matrixRes.json() as Promise<SupplierMatrix[]>,
      ]);
      setRules(Array.isArray(r) ? r : []);
      setExecutions(Array.isArray(e) ? e : []);
      setStats(s && typeof s === 'object' ? s : null);
      setMatrix(Array.isArray(m) ? m : []);
    } catch {
      // silently handle network errors during polling
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => { void fetchAll(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleToggle(rule: AutomationRule) {
    setTogglingId(rule.id);
    try {
      await fetch(`${API}/api/v1/automation/rules/${rule.id}/toggle`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } finally {
      setTogglingId(null);
    }
  }

  const totalExec = stats
    ? Object.values(stats.executions).reduce((a, b) => a + b, 0)
    : 0;
  const successExec = stats?.executions['success'] ?? 0;
  const failedExec = stats?.executions['failed'] ?? 0;
  const todayExec = successExec + failedExec;
  const successRate = todayExec > 0 ? Math.round((successExec / todayExec) * 100) : 0;

  const matrixSorted = [...matrix].sort((a, b) => compositeScore(b) - compositeScore(a));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: '#4da3ff', fontSize: 14 }}>Loading automation engine…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', background: '#07111f', minHeight: '100vh', color: '#f0f6ff' }}>
      {showMatrix && <RoutingMatrixModal matrix={matrix} onClose={() => setShowMatrix(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Automation Engine</h1>
          <span style={{
            background: '#0d3a6e', color: '#4da3ff', border: '1px solid #1a5a9e',
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          }}>
            {stats?.activeRules ?? 0} Gravity Rules Active
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowMatrix(true)}
          style={{
            background: '#0d1f3a', border: '1px solid #1a2f48', color: '#4da3ff',
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="5" rx="1" />
            <rect x="1" y="10" width="14" height="5" rx="1" />
          </svg>
          Supplier Routing Matrix
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total Rules" value={stats?.totalRules ?? 0} />
        <KpiCard label="Active Rules" value={stats?.activeRules ?? 0} sub={`${(stats?.totalRules ?? 0) - (stats?.activeRules ?? 0)} paused`} />
        <KpiCard label="Executions Today" value={todayExec} sub={`${failedExec} failed`} />
        <KpiCard
          label="Success Rate"
          value={`${successRate}%`}
          sub={`${totalExec} total executions`}
        />
      </div>

      {/* Main two-column area */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>

        {/* Rules table — 60% */}
        <div style={{
          flex: 6, background: '#0b1526', border: '1px solid #1a2f48',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2f48' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f0f6ff' }}>Automation Rules</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#07111f' }}>
                  {['Pri', 'Name', 'Trigger Event', 'Action', 'Runs', 'Last Run', 'Active'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#4d6a87', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => {
                  const ac = ACTION_COLORS[rule.actionType] ?? { bg: '#1a2f48', text: '#8ba8c7', border: '#1a2f4833' };
                  return (
                    <tr key={rule.id} style={{ borderTop: '1px solid #1a2f48' }}>
                      <td style={{ padding: '11px 14px', color: '#4da3ff', fontWeight: 700 }}>{rule.priority}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ color: '#f0f6ff', fontWeight: 600 }}>{rule.name}</div>
                        {rule.description && (
                          <div style={{ color: '#4d6a87', fontSize: 11, marginTop: 2 }}>{rule.description}</div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <code style={{ background: '#07111f', color: '#8ba8c7', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{rule.triggerEvent}</code>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          background: ac.bg, color: ac.text, border: `1px solid ${ac.border}`,
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          {rule.actionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#8ba8c7' }}>{rule.executionCount}</td>
                      <td style={{ padding: '11px 14px', color: '#4d6a87', whiteSpace: 'nowrap' }}>
                        {rule.lastExecutedAt ? timeAgo(rule.lastExecutedAt) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <ToggleSwitch
                          checked={rule.isActive}
                          onChange={() => {
                            if (togglingId !== rule.id) void handleToggle(rule);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#4d6a87' }}>No automation rules found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Executions — 40% */}
        <div style={{
          flex: 4, background: '#0b1526', border: '1px solid #1a2f48',
          borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2f48' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f0f6ff' }}>Recent Executions</h2>
          </div>
          <div style={{ overflow: 'auto', flex: 1, padding: '8px 0' }}>
            {executions.map(exec => {
              const sc = STATUS_COLORS[exec.status] ?? { bg: '#1a2535', text: '#8ba8c7' };
              return (
                <div key={exec.id} style={{
                  padding: '10px 16px', borderBottom: '1px solid #0d1f38',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0f6ff', fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exec.rule.name}
                    </div>
                    <div style={{ color: '#4d6a87', fontSize: 11, marginTop: 1 }}>
                      <code style={{ color: '#8ba8c7' }}>{exec.triggerEvent}</code>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{
                      background: sc.bg, color: sc.text,
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    }}>
                      {exec.status}
                    </span>
                    <span style={{ color: '#4d6a87', fontSize: 10 }}>{timeAgo(exec.executedAt)}</span>
                  </div>
                </div>
              );
            })}
            {executions.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#4d6a87', fontSize: 13 }}>No executions yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Routing Matrix — full width */}
      <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2f48', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f0f6ff' }}>Supplier Routing Matrix</h2>
          <span style={{ color: '#4d6a87', fontSize: 12 }}>sorted by composite score</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#07111f' }}>
                {['Supplier', 'Category', 'Composite Score', 'Reliability', 'Price', 'Lead Time', 'Regions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4d6a87', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixSorted.map(s => {
                const score = compositeScore(s);
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid #1a2f48' }}>
                    <td style={{ padding: '12px 16px', color: '#f0f6ff', fontWeight: 700 }}>{s.supplierName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#1a2f48', color: '#8ba8c7', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{s.category}</span>
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 160 }}>
                      <ScoreBar value={score} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{Number(s.reliabilityScore).toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{Number(s.priceScore).toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', color: '#8ba8c7' }}>{s.leadTimeDays}d</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.supportedRegions.map(r => (
                          <span key={r} style={{ background: '#0d1f3a', color: '#4da3ff', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, border: '1px solid #1a3a5c' }}>{r}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {matrixSorted.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#4d6a87' }}>No supplier matrix data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
