'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken, timeAgo } from '@/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface GovernancePolicy {
  id: string;
  tenantId: string | null;
  policyType: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  updatedAt: string;
}

interface PolicyViolation {
  id: string;
  policyId: string;
  decisionCardId: string | null;
  triggerContext: Record<string, unknown>;
  violationType: string;
  blockedAction: string;
  resolvedAction: string;
  createdAt: string;
}

interface GovernanceStats {
  totalPolicies: number;
  activePolicies: number;
  totalViolations: number;
  violationsLast24h: number;
  blockedDecisions: number;
  escalatedDecisions: number;
}

interface TraceStats {
  total: number;
  allowed: number;
  blocked: number;
  escalated: number;
  requiresApproval: number;
  outcomeRecorded: number;
  avgTrustScore: number;
}

type ActiveTab = 'policies' | 'violations' | 'traces';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function policyTypeBadge(type: string): string {
  const map: Record<string, string> = {
    learning:  'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20',
    execution: 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
    financial: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
    supplier:  'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    audit:     'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
  };
  return map[type] ?? 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20';
}

function violationTypeBadge(type: string): string {
  if (type === 'risk_score_blocked') return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20';
  if (type === 'margin_below_floor') return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20';
  return 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20';
}

function resolvedActionBadge(action: string): string {
  if (action === 'blocked')          return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20';
  if (action === 'escalated')        return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20';
  if (action === 'requires_approval') return 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20';
  return 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20';
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── SVG Pie ──────────────────────────────────────────────────────────────────

interface PieSlice { label: string; value: number; color: string }

function ManualPie({ slices, size = 120 }: { slices: PieSlice[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <div className="text-[#4d6a87] text-sm">No data</div>;

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 6;

  let cumAngle = -Math.PI / 2;
  const paths = slices.map((slice) => {
    if (slice.value === 0) return null;
    const angle   = (slice.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return (
      <path
        key={slice.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={slice.color}
        opacity={0.85}
      />
    );
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
      </svg>
      <div className="flex flex-col gap-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[#8ba8c7]">{s.label}</span>
            <span className="text-white font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const [policies,       setPolicies]       = useState<GovernancePolicy[]>([]);
  const [violations,     setViolations]     = useState<PolicyViolation[]>([]);
  const [stats,          setStats]          = useState<GovernanceStats | null>(null);
  const [traceStats,     setTraceStats]     = useState<TraceStats | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('policies');
  const [editingPolicy,  setEditingPolicy]  = useState<GovernancePolicy | null>(null);
  const [editConfig,     setEditConfig]     = useState<string>('');
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);

  const authHdrs = {
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}`,
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [rPolicies, rViolations, rStats, rTrace] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/governance/policies`,            { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/governance/violations?limit=30`, { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/governance/stats`,               { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/governance/traces/stats`,        { headers: authHdrs }),
    ]);

    if (rPolicies.status   === 'fulfilled' && rPolicies.value.ok)   setPolicies(await rPolicies.value.json());
    if (rViolations.status === 'fulfilled' && rViolations.value.ok) {
      const d = await rViolations.value.json();
      setViolations(Array.isArray(d) ? d : d.data ?? []);
    }
    if (rStats.status      === 'fulfilled' && rStats.value.ok)      setStats(await rStats.value.json());
    if (rTrace.status      === 'fulfilled' && rTrace.value.ok)      setTraceStats(await rTrace.value.json());

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openEditor = (policy: GovernancePolicy) => {
    setEditingPolicy(policy);
    setEditConfig(JSON.stringify(policy.config, null, 2));
    setSaveError(null);
  };

  const cancelEdit = () => { setEditingPolicy(null); setSaveError(null); };

  const saveConfig = async () => {
    if (!editingPolicy) return;
    setSaving(true);
    setSaveError(null);
    try {
      const parsed = JSON.parse(editConfig);
      const res = await fetch(`${API_BASE}/api/v1/governance/policies/${editingPolicy.id}/config`, {
        method:  'PATCH',
        headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config: parsed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingPolicy(null);
      await fetchAll();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isFullyGoverned = stats ? stats.activePolicies === stats.totalPolicies : false;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07111f] text-white p-6">

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-tight text-2xl font-bold tracking-tight">Governance Center</h1>
          <p className="text-[#4d6a87] text-sm mt-0.5">
            Policy-constrained autonomous execution · audit-grade traceability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              isFullyGoverned
                ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
                : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
            }`}
          >
            {isFullyGoverned ? '● GOVERNED' : '◐ PARTIAL'}
          </span>
          {stats && stats.violationsLast24h > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30">
              {stats.violationsLast24h} violations (24h)
            </span>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Active Policies',    value: stats?.activePolicies    ?? '—', color: '#4da3ff' },
          { label: 'Total Violations',   value: stats?.totalViolations   ?? '—', color: '#8ba8c7' },
          {
            label: 'Violations (24h)',
            value: stats?.violationsLast24h ?? '—',
            color: (stats?.violationsLast24h ?? 0) > 0 ? '#ef4444' : '#22c55e',
          },
          { label: 'Blocked Decisions',  value: stats?.blockedDecisions  ?? '—', color: '#ef4444' },
          { label: 'Escalated',          value: stats?.escalatedDecisions ?? '—', color: '#f59e0b' },
          {
            label: 'Avg Trust Score',
            value: traceStats ? traceStats.avgTrustScore.toFixed(1) : '—',
            color: traceStats && traceStats.avgTrustScore >= 80 ? '#22c55e' : traceStats && traceStats.avgTrustScore >= 60 ? '#f59e0b' : '#ef4444',
          },
        ].map((s) => (
          <div key={s.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="font-tight text-xl font-bold" style={{ color: s.color }}>{String(s.value)}</div>
            <div className="text-xs text-[#4d6a87] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* FOUR-LAYER ARCHITECTURE BANNER */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">System Architecture</span>
        </div>
        <div className="flex items-center justify-between">
          {[
            { label: 'REALITY',       color: '#4d6a87', active: false },
            { label: 'INTELLIGENCE',  color: '#4da3ff', active: false },
            { label: 'AUTONOMY',      color: '#a855f7', active: false },
            { label: 'GOVERNANCE',    color: '#4da3ff', active: true  },
          ].map((layer, i, arr) => (
            <div key={layer.label} className="flex items-center gap-3 flex-1">
              <div
                className="flex-1 rounded-lg px-4 py-3 text-center"
                style={{
                  background:  layer.active ? 'rgba(77,163,255,0.08)' : 'rgba(27,47,72,0.4)',
                  border:      `1px solid ${layer.active ? '#4da3ff' : '#1a2f48'}`,
                  boxShadow:   layer.active ? '0 0 16px rgba(77,163,255,0.2)' : 'none',
                }}
              >
                <div className="text-xs font-bold tracking-widest" style={{ color: layer.color }}>
                  {layer.label}
                </div>
              </div>
              {i < arr.length - 1 && (
                <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                  <path d="M0 8h16M10 2l8 6-8 6" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-[#4d6a87] mt-3 font-medium">
          GOVERNANCE IS THE FINAL GATE — nothing executes without policy clearance
        </p>
      </div>

      {/* TAB BAR */}
      <div className="flex gap-1 mb-6 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
        {(['policies', 'violations', 'traces'] as ActiveTab[]).map((tab) => {
          const labels: Record<ActiveTab, string> = {
            policies:   'Policy Rules',
            violations: 'Violations Log',
            traces:     'Trace Stats',
          };
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20'
                  : 'text-[#4d6a87] hover:text-white'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="text-[#4d6a87] text-sm animate-pulse">Loading governance data…</div>
      )}

      {/* ── TAB 1: POLICY RULES ─────────────────────────────────────────────── */}
      {!loading && activeTab === 'policies' && (
        <div className="grid grid-cols-1 gap-3">
          {policies.length === 0 && (
            <div className="text-[#4d6a87] text-sm">No policies found.</div>
          )}
          {policies.map((policy) => (
            <div key={policy.id} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
              {/* Header row */}
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${policyTypeBadge(policy.policyType)}`}>
                  {policy.policyType}
                </span>
                <span className="font-semibold text-white flex-1">{policy.name}</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: policy.isActive ? '#22c55e' : '#4d6a87' }}
                    />
                    <span className={policy.isActive ? 'text-[#22c55e]' : 'text-[#4d6a87]'}>
                      {policy.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditor(policy)}
                    className="px-3 py-1 rounded-lg text-xs bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 hover:bg-[#4da3ff]/20 transition-colors"
                  >
                    Edit Config
                  </button>
                </div>
              </div>

              {/* Description */}
              {policy.description && (
                <p className="text-[#8ba8c7] text-sm mb-3">{policy.description}</p>
              )}

              {/* Config chips */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(policy.config).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2.5 py-1 rounded-lg text-xs bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7]"
                  >
                    <span className="text-[#4d6a87]">{k}:</span>{' '}
                    <span className="text-white">{String(v)}</span>
                  </span>
                ))}
              </div>

              {/* Edit Panel */}
              {editingPolicy?.id === policy.id && (
                <div className="mt-4 bg-[#07111f] border border-[#1a2f48] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">Edit Policy Config</span>
                    <span className="text-xs text-[#f59e0b] flex items-center gap-1">
                      ⚠ Changes affect all autonomous decisions globally
                    </span>
                  </div>
                  <textarea
                    className="w-full h-32 bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 font-mono text-xs text-[#8ba8c7] resize-none focus:outline-none focus:border-[#4da3ff]/50"
                    value={editConfig}
                    onChange={(e) => setEditConfig(e.target.value)}
                    spellCheck={false}
                  />
                  {saveError && (
                    <p className="text-xs text-[#ef4444] mt-1">{saveError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={saveConfig}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30 hover:bg-[#4da3ff]/20 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a2f48]/40 text-[#4d6a87] border border-[#1a2f48] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 2: VIOLATIONS LOG ────────────────────────────────────────────── */}
      {!loading && activeTab === 'violations' && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          {violations.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-[#22c55e] text-3xl mb-3">✓</div>
              <p className="text-[#22c55e] font-semibold text-sm mb-1">No violations recorded</p>
              <p className="text-[#4d6a87] text-xs">System is operating within all policy constraints</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['Type', 'Blocked Action', 'Resolution', 'Policy', 'Decision Card', 'Time'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#4d6a87] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {violations.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`border-b border-[#1a2f48]/50 hover:bg-[#4da3ff]/5 transition-colors ${
                      i === violations.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${violationTypeBadge(v.violationType)}`}>
                        {v.violationType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8ba8c7] text-xs font-mono">{trunc(v.blockedAction, 40)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${resolvedActionBadge(v.resolvedAction)}`}>
                        {v.resolvedAction.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#4d6a87] text-xs font-mono">{v.policyId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-[#4d6a87] text-xs font-mono">
                      {v.decisionCardId ? v.decisionCardId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#4d6a87] text-xs">{timeAgo(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB 3: TRACE STATS ───────────────────────────────────────────────── */}
      {!loading && activeTab === 'traces' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Decision Trace Funnel */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
            <h3 className="font-tight font-semibold text-sm mb-4 text-white">Decision Trace Funnel</h3>
            {traceStats ? (
              <div className="space-y-3">
                {[
                  { label: 'INPUT',           value: traceStats.total,           color: '#4d6a87' },
                  { label: 'GOVERNANCE CHECK',value: traceStats.allowed + traceStats.blocked + traceStats.escalated, color: '#4da3ff' },
                  { label: 'EXECUTION',       value: traceStats.allowed,         color: '#22c55e' },
                  { label: 'OUTCOME',         value: traceStats.outcomeRecorded, color: '#a855f7' },
                ].map((row) => {
                  const pct = traceStats.total > 0 ? (row.value / traceStats.total) * 100 : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-[#4d6a87] font-medium">{row.label}</span>
                        <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                      </div>
                      <div className="h-2 bg-[#1a2f48] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: row.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[#4d6a87] text-xs">No trace data available</div>
            )}
          </div>

          {/* Card 2: Governance Distribution */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
            <h3 className="font-tight font-semibold text-sm mb-4 text-white">Governance Distribution</h3>
            {traceStats ? (
              <ManualPie
                slices={[
                  { label: 'Allowed',           value: traceStats.allowed,          color: '#22c55e' },
                  { label: 'Blocked',           value: traceStats.blocked,          color: '#ef4444' },
                  { label: 'Escalated',         value: traceStats.escalated,        color: '#f59e0b' },
                  { label: 'Requires Approval', value: traceStats.requiresApproval, color: '#4da3ff' },
                ]}
                size={140}
              />
            ) : (
              <div className="text-[#4d6a87] text-xs">No trace data available</div>
            )}
          </div>

          {/* Card 3: Avg Trust Score */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 flex flex-col items-center justify-center">
            <div className="text-xs text-[#4d6a87] uppercase tracking-wider mb-2">Avg Trust Score</div>
            <div
              className="font-tight text-5xl font-bold mb-2"
              style={{
                color: traceStats
                  ? traceStats.avgTrustScore >= 80 ? '#22c55e'
                    : traceStats.avgTrustScore >= 60 ? '#f59e0b'
                    : '#ef4444'
                  : '#4d6a87',
              }}
            >
              {traceStats ? traceStats.avgTrustScore.toFixed(1) : '—'}
            </div>
            <div className="text-xs text-[#4d6a87]">
              {traceStats && traceStats.avgTrustScore >= 80 ? 'High confidence' : traceStats && traceStats.avgTrustScore >= 60 ? 'Moderate confidence' : 'Low confidence'}
            </div>
          </div>

          {/* Card 4: Outcome Recording Rate */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 flex flex-col items-center justify-center">
            <div className="text-xs text-[#4d6a87] uppercase tracking-wider mb-2">Outcome Recording Rate</div>
            {traceStats && traceStats.total > 0 ? (
              <>
                <div className="font-tight text-5xl font-bold text-[#a855f7] mb-2">
                  {((traceStats.outcomeRecorded / traceStats.total) * 100).toFixed(1)}%
                </div>
                <div className="w-full mt-2">
                  <div className="h-2 bg-[#1a2f48] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(traceStats.outcomeRecorded / traceStats.total) * 100}%`,
                        backgroundColor: '#a855f7',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#4d6a87] mt-1">
                    <span>{traceStats.outcomeRecorded} recorded</span>
                    <span>{traceStats.total} total</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="font-tight text-5xl font-bold text-[#4d6a87]">—</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
