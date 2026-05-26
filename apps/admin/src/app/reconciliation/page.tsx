'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
type IssueStatus = 'open' | 'repairing' | 'repaired' | 'ignored';

interface ReconciliationRun {
  id: string;
  type: 'full' | 'delta';
  integrityScore: number;
  totalChecked: number;
  openIssues: number;
  criticalIssues: number;
  ranAt: string;
  durationMs: number;
}

interface ReconciliationIssue {
  id: string;
  issueType: string;
  severity: IssueSeverity;
  description: string;
  amountDiscrepancy?: number;
  reference?: string;
  status: IssueStatus;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

const SEV_CONFIG: Record<IssueSeverity, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'High' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Medium' },
  low:      { color: '#4da3ff', bg: 'rgba(77,163,255,0.08)', label: 'Low' },
};

const STATUS_CFG: Record<IssueStatus, { color: string; bg: string }> = {
  open:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  repairing:{ color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  repaired: { color: '#63e6be', bg: 'rgba(99,230,190,0.1)' },
  ignored:  { color: '#4d6a87', bg: 'rgba(77,106,135,0.1)' },
};

function scoreColor(score: number): string {
  if (score > 95) return '#63e6be';
  if (score > 85) return '#f59e0b';
  return '#ef4444';
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function ScoreChart({ runs }: { runs: ReconciliationRun[] }) {
  if (runs.length < 2) {
    return <div className="text-center py-6 text-[#4d6a87] text-[12px]">Not enough run history</div>;
  }
  const width = 560;
  const height = 80;
  const scores = runs.map((r) => r.integrityScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores, min + 1);
  const pts = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height * 0.8 - 8;
    return `${x},${y}`;
  });
  const last = scores[scores.length - 1];
  const color = scoreColor(last);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts.join(' ')} ${width},${height}`}
        fill="url(#scoreGrad)"
      />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {scores.map((v, i) => {
        const x = (i / (scores.length - 1)) * width;
        const y = height - ((v - min) / (max - min)) * height * 0.8 - 8;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [issues, setIssues] = useState<ReconciliationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<'full' | 'delta' | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const params = new URLSearchParams();
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);

    const [runsRes, issuesRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/reconciliation/runs`, { headers: h }),
      fetch(`${API_BASE}/api/v1/reconciliation/issues?${params.toString()}`, { headers: h }),
    ]);
    if (runsRes.status === 'fulfilled' && runsRes.value.ok) {
      const data = await runsRes.value.json() as { runs: ReconciliationRun[] };
      setRuns(data.runs ?? []);
    }
    if (issuesRes.status === 'fulfilled' && issuesRes.value.ok) {
      const data = await issuesRes.value.json() as { issues: ReconciliationIssue[] };
      setIssues(data.issues ?? []);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [severityFilter, statusFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const triggerRun = async (type: 'full' | 'delta') => {
    setRunning(type);
    try {
      await fetch(`${API_BASE}/api/v1/reconciliation/run`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type }),
      });
      await fetchData();
    } catch { /* ignore */ }
    setRunning(null);
  };

  const repair = async (id: string) => {
    setRepairingId(id);
    try {
      await fetch(`${API_BASE}/api/v1/reconciliation/issues/${id}/repair`, {
        method: 'POST',
        headers: authHeaders(),
      });
      await fetchData();
    } catch { /* ignore */ }
    setRepairingId(null);
  };

  const latestRun = runs[0];
  const integrityScore = latestRun?.integrityScore ?? 0;
  const openIssues = issues.filter((i) => i.status === 'open').length;
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[#63e6be]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 1.5L1.5 5v4c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V5L9 1.5z" />
              <path d="M6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Financial Reconciliation</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              Integrity monitoring · {lastRefresh ? `last run ${lastRefresh.toLocaleTimeString('pt-PT')}` : 'loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void triggerRun('delta')}
            disabled={running !== null}
            className="flex items-center gap-2 px-4 py-2 bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] rounded-lg text-[12px] font-medium hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
          >
            {running === 'delta' ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : '⚡'}
            Run Delta
          </button>
          <button
            type="button"
            onClick={() => void triggerRun('full')}
            disabled={running !== null}
            className="flex items-center gap-2 px-4 py-2 bg-[#63e6be]/10 border border-[#63e6be]/30 text-[#63e6be] rounded-lg text-[12px] font-medium hover:bg-[#63e6be]/20 disabled:opacity-50 transition-colors"
          >
            {running === 'full' ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : '🔄'}
            Run Full
          </button>
        </div>
      </div>

      {/* Score + KPIs */}
      <div className="grid grid-cols-[auto_1fr] gap-4">
        {/* Integrity Score */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 flex flex-col items-center justify-center min-w-[180px]">
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-2">Integrity Score</div>
          <div className="text-[56px] font-black tabular-nums leading-none" style={{ color: scoreColor(integrityScore) }}>
            {integrityScore}
          </div>
          <div className="text-[12px] text-[#4d6a87] mt-1">/ 100</div>
          <div
            className="mt-3 text-[11px] font-semibold px-3 py-1 rounded-full"
            style={{
              color: scoreColor(integrityScore),
              backgroundColor: `${scoreColor(integrityScore)}15`,
            }}
          >
            {integrityScore > 95 ? 'Excellent' : integrityScore > 85 ? 'Warning' : 'Critical'}
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Checked', value: latestRun?.totalChecked ?? '—', color: '#4da3ff' },
            { label: 'Open Issues', value: openIssues, color: openIssues > 0 ? '#f59e0b' : '#63e6be' },
            { label: 'Critical Issues', value: criticalIssues, color: criticalIssues > 0 ? '#ef4444' : '#63e6be' },
            { label: 'Duration', value: latestRun ? `${latestRun.durationMs}ms` : '—', color: '#8ba8c7' },
          ].map((k) => (
            <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
              <div className="text-[22px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Run history chart */}
      {runs.length > 0 && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-3">
            Integrity Score — Last {runs.length} Runs
          </div>
          <ScoreChart runs={[...runs].reverse()} />
        </div>
      )}

      {/* Filters + Issue table */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a2f48] bg-[#07111f]/50 flex-wrap">
          <span className="text-[11px] font-semibold text-[#f0f6ff]">Issues</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-2 py-1 text-[11px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]/60"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-2 py-1 text-[11px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]/60"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="repairing">Repairing</option>
            <option value="repaired">Repaired</option>
            <option value="ignored">Ignored</option>
          </select>
          <span className="ml-auto text-[11px] text-[#4d6a87]">{issues.length} issues</span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[100px_80px_1fr_120px_140px_90px_80px] gap-3 px-4 py-2 border-b border-[#1a2f48] text-[10px] text-[#4d6a87] uppercase tracking-wider">
          <span>Type</span>
          <span>Severity</span>
          <span>Description</span>
          <span>Discrepancy</span>
          <span>Reference</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#4d6a87] text-[13px]">
            <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
            Loading…
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 text-[#4d6a87] text-[13px]">
            <div className="text-[#63e6be] text-2xl mb-2">✓</div>
            No reconciliation issues found.
          </div>
        ) : (
          issues.map((issue) => {
            const sevCfg = SEV_CONFIG[issue.severity];
            const stCfg = STATUS_CFG[issue.status];
            const isRepairing = repairingId === issue.id;
            return (
              <div
                key={issue.id}
                className="grid grid-cols-[100px_80px_1fr_120px_140px_90px_80px] gap-3 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors"
              >
                <div className="text-[11px] text-[#8ba8c7] font-mono truncate">{issue.issueType}</div>
                <div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: sevCfg.bg, color: sevCfg.color }}>
                    {sevCfg.label}
                  </span>
                </div>
                <div className="text-[12px] text-[#cfe4ff] truncate" title={issue.description}>{issue.description}</div>
                <div className="text-[12px] font-mono text-right" style={{ color: issue.amountDiscrepancy ? '#ef4444' : '#4d6a87' }}>
                  {issue.amountDiscrepancy != null ? `€${issue.amountDiscrepancy.toFixed(2)}` : '—'}
                </div>
                <div className="text-[11px] text-[#4d6a87] font-mono truncate">{issue.reference ?? '—'}</div>
                <div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                    {issue.status}
                  </span>
                </div>
                <div>
                  {issue.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => void repair(issue.id)}
                      disabled={isRepairing}
                      className="px-2 py-1 bg-[#63e6be]/10 border border-[#63e6be]/30 text-[#63e6be] rounded text-[10px] font-medium hover:bg-[#63e6be]/20 disabled:opacity-50 transition-colors"
                    >
                      {isRepairing ? '…' : 'Repair'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
