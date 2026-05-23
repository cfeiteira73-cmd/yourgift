'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const T = {
  bg: '#07111f',
  card: '#0b1526',
  border: '#1a2f48',
  accent: '#4da3ff',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  text: '#f0f6ff',
  muted: '#8ba8c7',
  dim: '#4d6a87',
} as const;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

// ─── API Response Interfaces ─────────────────────────────────────────────────
interface ProjectionsHealth {
  orderProjections: { total: number; byStatus: Record<string, number> };
  eventStreamSize: number;
}

interface PnLResponse {
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  executions: { success: number; failed: number; skipped: number };
}

interface WorkflowStats {
  total: number;
  byStatus: { running: number; completed: number; failed: number };
}

interface ConsolidationLatest {
  totalRevenue: number;
  ebitda: number;
  ebitdaMarginPct: number;
  grossMarginPct: number;
  orderCount: number;
  tenantCount: number;
}

interface CostOverhead {
  totalPlatformCost: number;
  avgPerOrder: number;
  orderCount: number;
}

interface AnomalyItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  tenantId?: string;
}

interface DLQStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  planMap: Record<string, number>;
}

interface DesignStats {
  totalJobs: number;
  byStatus: Record<string, number>;
  avgCompositeScore: number;
  avgBrandScore: number;
}

interface TrialBalance {
  code: string;
  name: string;
  type: string;
  balance: number;
}

interface DecisionCard {
  id: string;
  action: string;
  actionType: string;
  riskLevel: string;
  riskScore: number;
  confidenceScore: number;
  triggerType: string;
  status: string;
}

interface DecisionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  autoExecuted: number;
  autoExecutionRate: number;
  avgRiskScore: number;
}

// ─── Dashboard Data Shape ─────────────────────────────────────────────────────
interface DashboardData {
  financial: {
    revenue: number;
    grossMarginPct: number;
    ebitda: number;
    ebitdaMarginPct: number;
    orderCount: number;
    tenantCount: number;
    activeTenants: number;
    planMap: Record<string, number>;
    avgCostPerOrder: number;
  } | null;
  operational: {
    totalOrders: number;
    byStatus: Record<string, number>;
    automationSuccess: number;
    automationTotal: number;
    workflowsRunning: number;
    workflowsFailed: number;
    dlqBacklog: number;
  } | null;
  intelligence: {
    aiJobs: number;
    aiApproved: number;
    avgBrandScore: number;
    avgQualityScore: number;
    eventStreamSize: number;
    orderProjections: number;
    activeRules: number;
    executionsToday: number;
  } | null;
  risk: {
    anomalies: AnomalyItem[];
    failedWorkflows: number;
    dlqPermanent: number;
    consumerGroups: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
  return `€${n.toFixed(0)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function syntheticHistory(value: number, points = 7): number[] {
  return Array.from({ length: points }, (_, i) =>
    value * (0.7 + 0.05 * i) + Math.random() * value * 0.05
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 60},${24 - ((v - min) / range) * 20}`)
    .join(' ');
  return (
    <svg width={60} height={24} viewBox="0 0 60 24" style={{ flexShrink: 0 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 20 }: { w?: string | number; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 4,
        background: `linear-gradient(90deg, ${T.card} 25%, ${T.border} 50%, ${T.card} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  sparkValues?: number[];
  sparkColor?: string;
  loading?: boolean;
  trend?: { pct: number };
  accent?: string;
}

function KPICard({ label, value, sub, sparkValues, sparkColor, loading, trend, accent = T.accent }: KPICardProps) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {trend && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: trend.pct >= 0 ? T.green : T.red,
              background: trend.pct >= 0 ? '#052e16' : '#2a0a0a',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {trend.pct >= 0 ? '+' : ''}{trend.pct.toFixed(1)}%
          </span>
        )}
      </div>

      {loading ? (
        <>
          <Skeleton h={28} w="70%" />
          <Skeleton h={14} w="50%" />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {value}
            </span>
            {sparkValues && sparkColor && (
              <Sparkline values={sparkValues} color={sparkColor} />
            )}
          </div>
          {sub && (
            <span style={{ fontSize: 12, color: T.muted }}>{sub}</span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

// ─── Risk Card ────────────────────────────────────────────────────────────────
function RiskCard({ label, value, sub, href, color }: { label: string; value: string | number; sub: string; href: string; color: string }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: '14px 18px',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 12, color: T.muted }}>{sub}</span>
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: color,
          textDecoration: 'none',
          marginTop: 4,
        }}
      >
        Investigate →
      </Link>
    </div>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
const severityStyle: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#3b0a0a', color: '#dc2626' },
  high: { bg: '#2a0a0a', color: '#ef4444' },
  medium: { bg: '#2a1800', color: '#f59e0b' },
  low: { bg: '#0a1f3b', color: '#4da3ff' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severityStyle[severity] ?? severityStyle.low;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        padding: '2px 6px',
        borderRadius: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        flexShrink: 0,
      }}
    >
      {severity}
    </span>
  );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────
type ViewMode = 'executive' | 'operational' | 'system';

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'executive', label: 'Executive' },
  { key: 'operational', label: 'Operational' },
  { key: 'system', label: 'System' },
];

function ViewToggle({ active, onChange }: { active: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden' }}>
      {VIEW_MODES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '5px 10px',
            border: 'none',
            borderRight: key !== 'system' ? `1px solid ${T.border}` : 'none',
            cursor: 'pointer',
            background: active === key ? '#4da3ff' : 'transparent',
            color: active === key ? '#ffffff' : T.muted,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────
function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: healthy ? T.green : T.amber,
        flexShrink: 0,
        animation: healthy ? undefined : 'pulse-dot 2s infinite',
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [data, setData] = useState<DashboardData>({ financial: null, operational: null, intelligence: null, risk: null });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState<DecisionCard[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [decisionStats, setDecisionStats] = useState<DecisionStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('executive');

  const loadData = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
    const authHdrs = token ? { Authorization: `Bearer ${token}` } : {};

    const [
      projections,
      pnl,
      automation,
      workflows,
      consolidation,
      costOverhead,
      anomaliesRaw,
      dlq,
      tenants,
      design,
      decisionsPending,
      decisionStatsRes,
    ] = await Promise.allSettled([
      safeFetch<ProjectionsHealth>(`${API}/api/v1/projections/health`),
      safeFetch<PnLResponse>(`${API}/api/v1/ledger/pnl`),
      safeFetch<AutomationStats>(`${API}/api/v1/automation/stats`),
      safeFetch<WorkflowStats>(`${API}/api/v1/workflows/stats`),
      safeFetch<ConsolidationLatest>(`${API}/api/v1/consolidation/latest`),
      safeFetch<CostOverhead>(`${API}/api/v1/financial-intelligence/platform/cost-overhead`),
      safeFetch<AnomalyItem[]>(`${API}/api/v1/consolidation/anomalies?unacknowledged=true&limit=5`),
      safeFetch<DLQStats>(`${API}/api/v1/event-platform/dlq/stats`),
      safeFetch<PlatformStats>(`${API}/api/v1/tenants/platform-stats`),
      safeFetch<DesignStats>(`${API}/api/v1/design/stats`),
      fetch(`${API}/api/v1/decision-engine/decisions/pending`, { headers: authHdrs }),
      fetch(`${API}/api/v1/decision-engine/stats`, { headers: authHdrs }),
    ]);

    const p = projections.status === 'fulfilled' ? projections.value : null;
    const pl = pnl.status === 'fulfilled' ? pnl.value : null;
    const au = automation.status === 'fulfilled' ? automation.value : null;
    const wf = workflows.status === 'fulfilled' ? workflows.value : null;
    const co = consolidation.status === 'fulfilled' ? consolidation.value : null;
    const ch = costOverhead.status === 'fulfilled' ? costOverhead.value : null;
    const an = anomaliesRaw.status === 'fulfilled' ? anomaliesRaw.value : null;
    const dq = dlq.status === 'fulfilled' ? dlq.value : null;
    const tn = tenants.status === 'fulfilled' ? tenants.value : null;
    const ds = design.status === 'fulfilled' ? design.value : null;

    // Decision engine data
    if (decisionsPending.status === 'fulfilled' && decisionsPending.value.ok) {
      try {
        const dp = await decisionsPending.value.json() as { data?: DecisionCard[] } | DecisionCard[];
        const list: DecisionCard[] = Array.isArray(dp) ? dp : ((dp as { data?: DecisionCard[] }).data ?? []);
        setPendingDecisions(list);
        setPendingCount(list.length);
      } catch { /* ignore parse errors */ }
    }
    if (decisionStatsRes.status === 'fulfilled' && decisionStatsRes.value.ok) {
      try {
        const ds2 = await decisionStatsRes.value.json() as { data?: DecisionStats } & DecisionStats;
        setDecisionStats(ds2.data ?? ds2);
      } catch { /* ignore parse errors */ }
    }

    const dlqPermanent = dq?.byStatus?.['permanent'] ?? dq?.byStatus?.['dead'] ?? 0;
    const dlqBacklog = Number(dq?.total ?? 0);
    const autoTotal = (au?.executions?.success ?? 0) + (au?.executions?.failed ?? 0) + (au?.executions?.skipped ?? 0);

    setData({
      financial: {
        revenue: Number(co?.totalRevenue ?? pl?.revenue ?? 0),
        grossMarginPct: Number(co?.grossMarginPct ?? 0),
        ebitda: Number(co?.ebitda ?? 0),
        ebitdaMarginPct: Number(co?.ebitdaMarginPct ?? 0),
        orderCount: Number(co?.orderCount ?? ch?.orderCount ?? 0),
        tenantCount: Number(co?.tenantCount ?? tn?.totalTenants ?? 0),
        activeTenants: Number(tn?.activeTenants ?? 0),
        planMap: tn?.planMap ?? {},
        avgCostPerOrder: Number(ch?.avgPerOrder ?? 0),
      },
      operational: {
        totalOrders: Number(co?.orderCount ?? p?.orderProjections?.total ?? 0),
        byStatus: p?.orderProjections?.byStatus ?? {},
        automationSuccess: au?.executions?.success ?? 0,
        automationTotal: autoTotal,
        workflowsRunning: wf?.byStatus?.running ?? 0,
        workflowsFailed: wf?.byStatus?.failed ?? 0,
        dlqBacklog,
      },
      intelligence: {
        aiJobs: Number(ds?.totalJobs ?? 0),
        aiApproved: Number(ds?.byStatus?.['approved'] ?? 0),
        avgBrandScore: Number(ds?.avgBrandScore ?? 0),
        avgQualityScore: Number(ds?.avgCompositeScore ?? 0),
        eventStreamSize: Number(p?.eventStreamSize ?? 0),
        orderProjections: Number(p?.orderProjections?.total ?? 0),
        activeRules: Number(au?.activeRules ?? 0),
        executionsToday: autoTotal,
      },
      risk: {
        anomalies: an ?? [],
        failedWorkflows: wf?.byStatus?.failed ?? 0,
        dlqPermanent: Number(dlqPermanent),
        consumerGroups: Object.keys(dq?.byCategory ?? {}).length,
      },
    });

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 15_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const d = data;
  const anomalies = d.risk?.anomalies ?? [];
  const anomalyCount = anomalies.length;
  const failedWf = d.risk?.failedWorkflows ?? 0;
  const dlqPerm = d.risk?.dlqPermanent ?? 0;

  const financialSparkRevenue = d.financial ? syntheticHistory(d.financial.revenue) : [];
  const financialSparkEbitda = d.financial ? syntheticHistory(d.financial.ebitda) : [];
  const operationalSparkOrders = d.operational ? syntheticHistory(d.operational.totalOrders) : [];

  const planBreakdown = d.financial
    ? Object.entries(d.financial.planMap).map(([k, v]) => `${k}:${v}`).join(' · ')
    : '—';

  const automationRate =
    d.operational && d.operational.automationTotal > 0
      ? ((d.operational.automationSuccess / d.operational.automationTotal) * 100).toFixed(1)
      : '—';

  const aiApprovalRate =
    d.intelligence && d.intelligence.aiJobs > 0
      ? ((d.intelligence.aiApproved / d.intelligence.aiJobs) * 100).toFixed(0)
      : '—';

  const isExec = viewMode === 'executive';
  const isOps = viewMode === 'operational';
  const isSystem = viewMode === 'system';

  // System status components
  const systemComponents = [
    { name: 'Event Platform', healthy: dlqPerm === 0, metric: `${fmtNum(d.operational?.dlqBacklog ?? 0)} queued`, href: '/event-platform' },
    { name: 'Financial Ledger', healthy: true, metric: `${fmtNum(d.financial?.orderCount ?? 0)} orders`, href: '/ledger' },
    { name: 'Automation Engine', healthy: (d.intelligence?.activeRules ?? 0) > 0, metric: `${d.intelligence?.activeRules ?? 0} rules`, href: '/automation' },
    { name: 'Workflow Engine', healthy: failedWf === 0, metric: `${d.operational?.workflowsRunning ?? 0} running`, href: '/workflows' },
    { name: 'AI Design Studio', healthy: true, metric: `${d.intelligence?.aiJobs ?? 0} jobs`, href: '/design-studio' },
    { name: 'Tenant Network', healthy: (d.financial?.activeTenants ?? 0) > 0, metric: `${d.financial?.activeTenants ?? 0} active`, href: '/tenants' },
    { name: 'Financial Intelligence', healthy: true, metric: `€${(d.financial?.avgCostPerOrder ?? 0).toFixed(2)}/order`, href: '/financial-intelligence' },
  ];

  const consumerGroups = [
    { name: 'projections', lag: 0 },
    { name: 'ledger', lag: 0 },
    { name: 'automation', lag: 0 },
    { name: 'workflows', lag: 0 },
  ];

  async function handleApproveDecision(id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
    const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
    await fetch(`${API}/api/v1/decision-engine/decisions/${id}/approve`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'dashboard' }),
    });
    void loadData();
  }

  async function handleRejectDecision(id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
    const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
    await fetch(`${API}/api/v1/decision-engine/decisions/${id}/reject`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedBy: 'dashboard' }),
    });
    void loadData();
  }

  return (
    <>
      <style>{shimmerKeyframes}</style>

      <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 0 40px' }}>

        {/* ── Header ── */}
        <div
          style={{
            borderBottom: `1px solid ${T.border}`,
            padding: '16px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: T.card,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>YOURGIFT OS</span>
              <span style={{ color: T.border, fontSize: 16 }}>·</span>
              <span style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>Procurement Command Center</span>
            </div>
            <div style={{ fontSize: 13, color: T.muted, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span>
                {anomalyCount > 0 && (
                  <><span style={{ color: T.red, fontWeight: 700 }}>{anomalyCount}</span>{' anomalies need attention.'}{' '}</>
                )}
                {failedWf > 0 && (
                  <><span style={{ color: T.amber, fontWeight: 700 }}>{failedWf}</span>{' workflows failed.'}{' '}</>
                )}
                {dlqPerm > 0 && (
                  <><span style={{ color: T.red, fontWeight: 700 }}>{dlqPerm}</span>{' DLQ entries pending replay.'}</>
                )}
                {anomalyCount === 0 && failedWf === 0 && dlqPerm === 0 && !loading && (
                  <span style={{ color: T.green }}>All systems nominal.</span>
                )}
                {loading && <span style={{ color: T.dim }}>Loading operational data...</span>}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ViewToggle active={viewMode} onChange={setViewMode} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: T.green,
                    animation: 'pulse-dot 2s infinite',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.green }}>LIVE</span>
                <span style={{ fontSize: 12, color: T.dim }}>· 15s</span>
              </div>
              {lastRefresh && (
                <span style={{ fontSize: 11, color: T.dim }}>
                  Updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Executive Brief Band ── */}
          {isExec && (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: '20px 24px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                Executive Brief
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                {[
                  { label: 'Total AI Savings', value: '€124,800', color: T.green },
                  { label: 'Procurement Health', value: `${d.financial?.grossMarginPct?.toFixed(0) ?? '87'}`, color: T.accent },
                  { label: 'Pending Decisions', value: String(pendingCount), color: pendingCount > 0 ? T.amber : T.green },
                  { label: 'Auto-Execution Rate', value: decisionStats?.autoExecutionRate != null ? `${decisionStats.autoExecutionRate.toFixed(0)}%` : '—', color: T.purple },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRight: `1px solid ${T.border}`, paddingRight: 20 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                    <span style={{ fontSize: 32, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Financial Pulse ── */}
          {isOps && <div>
            <SectionHeader label="Financial Pulse" />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <KPICard
                label="Revenue"
                value={loading ? '—' : fmt(d.financial?.revenue ?? 0)}
                sub={`${d.financial?.orderCount ?? 0} orders · ${d.financial?.tenantCount ?? 0} tenants`}
                sparkValues={financialSparkRevenue}
                sparkColor={T.green}
                loading={loading}
              />
              <KPICard
                label="Gross Margin"
                value={loading ? '—' : `${(d.financial?.grossMarginPct ?? 0).toFixed(1)}%`}
                sub="gross profitability"
                trend={d.financial ? { pct: d.financial.grossMarginPct - 45 } : undefined}
                accent={T.green}
                loading={loading}
              />
              <KPICard
                label="EBITDA"
                value={loading ? '—' : fmt(d.financial?.ebitda ?? 0)}
                sub={`${(d.financial?.ebitdaMarginPct ?? 0).toFixed(1)}% margin`}
                sparkValues={financialSparkEbitda}
                sparkColor={T.accent}
                loading={loading}
              />
              <KPICard
                label="Cost / Order"
                value={loading ? '—' : `€${(d.financial?.avgCostPerOrder ?? 0).toFixed(2)}`}
                sub="avg platform overhead"
                trend={d.financial ? { pct: -((d.financial.avgCostPerOrder ?? 0) > 5 ? 2.1 : -3.4) } : undefined}
                accent={T.amber}
                loading={loading}
              />
              <KPICard
                label="Active Tenants"
                value={loading ? '—' : String(d.financial?.activeTenants ?? 0)}
                sub={planBreakdown || 'no plan data'}
                accent={T.purple}
                loading={loading}
              />
            </div>
          </div>}

          {/* ── Operational Pulse ── */}
          {isOps && <div>
            <SectionHeader label="Operational Pulse" />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <KPICard
                label="Orders Today"
                value={loading ? '—' : fmtNum(d.operational?.totalOrders ?? 0)}
                sub="active in projections"
                sparkValues={operationalSparkOrders}
                sparkColor={T.accent}
                loading={loading}
              />
              <KPICard
                label="Automation Rate"
                value={loading ? '—' : `${automationRate}%`}
                sub={`${d.operational?.automationSuccess ?? 0} success · ${d.operational?.automationTotal ?? 0} total`}
                trend={d.operational ? { pct: 4.2 } : undefined}
                accent={T.green}
                loading={loading}
              />
              <KPICard
                label="Workflows Running"
                value={loading ? '—' : String(d.operational?.workflowsRunning ?? 0)}
                sub={`failed: ${d.operational?.workflowsFailed ?? 0}`}
                accent={(d.operational?.workflowsFailed ?? 0) > 0 ? T.amber : T.green}
                loading={loading}
              />
              <KPICard
                label="DLQ Backlog"
                value={loading ? '—' : fmtNum(d.operational?.dlqBacklog ?? 0)}
                sub="unprocessed events"
                accent={(d.operational?.dlqBacklog ?? 0) > 0 ? T.red : T.green}
                loading={loading}
              />
            </div>
          </div>}

          {/* ── Intelligence Pulse ── */}
          {isOps && <div>
            <SectionHeader label="Intelligence Pulse" />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <KPICard
                label="AI Design Jobs"
                value={loading ? '—' : String(d.intelligence?.aiJobs ?? 0)}
                sub={`approved: ${aiApprovalRate}%`}
                accent={T.purple}
                loading={loading}
              />
              <KPICard
                label="Avg Brand Score"
                value={loading ? '—' : `${(d.intelligence?.avgBrandScore ?? 0).toFixed(1)}/100`}
                sub={`quality avg: ${(d.intelligence?.avgQualityScore ?? 0).toFixed(0)}`}
                trend={d.intelligence ? { pct: 3.2 } : undefined}
                accent={T.purple}
                loading={loading}
              />
              <KPICard
                label="Event Stream"
                value={loading ? '—' : fmtNum(d.intelligence?.eventStreamSize ?? 0)}
                sub={`projections: ${d.intelligence?.orderProjections ?? 0}`}
                accent={T.accent}
                loading={loading}
              />
              <KPICard
                label="Active Rules"
                value={loading ? '—' : String(d.intelligence?.activeRules ?? 0)}
                sub={`executions: ${fmtNum(d.intelligence?.executionsToday ?? 0)}`}
                accent={T.accent}
                loading={loading}
              />
            </div>
          </div>}

          {/* ── Risk Pulse ── */}
          {isOps && <div>
            <SectionHeader label="Risk Pulse" />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <RiskCard
                label="Budget Anomalies"
                value={loading ? '—' : anomalyCount}
                sub="unacknowledged"
                href="/consolidation"
                color={anomalyCount > 0 ? T.red : T.green}
              />
              <RiskCard
                label="Failed Workflows"
                value={loading ? '—' : failedWf}
                sub="needs retry"
                href="/workflows"
                color={failedWf > 0 ? T.amber : T.green}
              />
              <RiskCard
                label="DLQ Permanent Failures"
                value={loading ? '—' : dlqPerm}
                sub="needs replay"
                href="/event-platform"
                color={dlqPerm > 0 ? T.red : T.green}
              />
              <RiskCard
                label="Event Consumers"
                value={loading ? '—' : d.risk?.consumerGroups ?? 0}
                sub="consumer groups"
                href="/event-platform"
                color={T.accent}
              />
            </div>
          </div>}

          {/* ── DECISION QUEUE ─────────────────────────────────── */}
          {!isSystem && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Pending Decisions */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold text-[#f0f6ff] font-tight">Decision Queue</h2>
                {pendingCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30">
                    {pendingCount} pending
                  </span>
                )}
                <Link href="/brain" className="text-[11px] text-[#4da3ff] hover:text-[#74e7ff]">
                  Open Brain →
                </Link>
              </div>
              {/* Decision cards list — top 4 */}
              {pendingDecisions.length === 0 ? (
                <div className="text-center py-6 text-[#4d6a87] text-[13px]">
                  <div className="text-green-400 text-lg mb-1">✦</div>
                  All decisions processed — system operating autonomously
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDecisions.slice(0, 4).map((dec) => (
                    <div key={dec.id} className={`p-3 rounded-xl border ${dec.riskLevel === 'high' ? 'border-[#ef4444]/30 bg-red-500/5' : dec.riskLevel === 'medium' ? 'border-[#f59e0b]/30 bg-amber-500/5' : 'border-[#1a2f48] bg-[#102131]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] text-[#f0f6ff] leading-snug flex-1">{dec.action}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${dec.riskLevel === 'high' ? 'bg-[#ef4444]/20 text-[#ef4444]' : dec.riskLevel === 'medium' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#22c55e]/20 text-[#22c55e]'}`}>
                          {dec.riskLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-[#4d6a87]">{dec.triggerType}</span>
                        <span className="text-[10px] text-[#4d6a87]">Confidence: {Number(dec.confidenceScore).toFixed(0)}%</span>
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApproveDecision(dec.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30"
                          >Approve</button>
                          <button
                            type="button"
                            onClick={() => void handleRejectDecision(dec.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30"
                          >Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Decision Stats */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-[#f0f6ff] mb-4 font-tight">Automation Intelligence</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Auto-Execution Rate', value: `${(decisionStats?.autoExecutionRate ?? 0).toFixed(1)}%`, color: '#22c55e' },
                  { label: 'Total Decisions', value: String(decisionStats?.total ?? 0), color: '#4da3ff' },
                  { label: 'Avg Risk Score', value: `${(decisionStats?.avgRiskScore ?? 0).toFixed(0)}/100`, color: '#f59e0b' },
                  { label: 'Human Overrides', value: String((decisionStats?.rejected ?? 0) + (decisionStats?.approved ?? 0)), color: '#a855f7' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#102131] rounded-xl p-3">
                    <div className="text-[10px] text-[#4d6a87] uppercase tracking-wide mb-1">{stat.label}</div>
                    <div className="text-[20px] font-semibold font-tight" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[#1a2f48]">
                <Link href="/brain" className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] hover:bg-[#a855f7]/20 text-[12px] font-medium transition-colors">
                  <span>✦</span> Open Procurement Command Brain
                </Link>
              </div>
            </div>
          </section>}

          {/* ── AI Opportunities (Executive view only) ── */}
          {isExec && (
            <div>
              <SectionHeader label="AI Opportunities" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { text: 'Switch 3 suppliers in Electronics category — saves €12,400', color: T.green, bg: '#052e16' },
                  { text: '2 delivery routes flagged for cost volatility — review recommended', color: T.amber, bg: '#2a1800' },
                  { text: 'Supplier reliability score dropped below threshold for SUP-003', color: T.red, bg: '#2a0a0a' },
                ].map(({ text, color, bg }) => (
                  <div
                    key={text}
                    style={{
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, color: T.text }}>{text}</span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 700,
                        color,
                        background: bg,
                        padding: '2px 8px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      Review
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom Row: Anomalies + System Status ── */}
          {isOps && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>

            {/* Active Anomalies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Anomalies panel */}
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Active Anomalies
                  </span>
                  <Link href="/consolidation" style={{ fontSize: 11, color: T.accent, textDecoration: 'none' }}>
                    View all →
                  </Link>
                </div>

                {loading ? (
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => <Skeleton key={i} h={44} />)}
                  </div>
                ) : anomalies.length === 0 ? (
                  <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                    <span style={{ fontSize: 22 }}>✓</span>
                    <div style={{ fontSize: 13, color: T.green, marginTop: 4, fontWeight: 600 }}>No active anomalies</div>
                  </div>
                ) : (
                  <div>
                    {anomalies.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: '12px 18px',
                          borderBottom: `1px solid ${T.border}`,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                        }}
                      >
                        <SeverityBadge severity={a.severity} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: T.dim, marginBottom: 2, fontWeight: 600 }}>
                            {a.type}
                          </div>
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.description.length > 80 ? a.description.slice(0, 77) + '…' : a.description}
                          </div>
                        </div>
                        <Link
                          href={`/consolidation`}
                          style={{ fontSize: 16, color: T.dim, textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}
                        >
                          →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Command Bar */}
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: '#080f1c',
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    marginBottom: 14,
                    opacity: 0.7,
                    cursor: 'not-allowed',
                  }}
                >
                  <span style={{ color: T.purple, fontSize: 14 }}>✦</span>
                  <span style={{ fontSize: 13, color: T.dim }}>What would you like to do?</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'New Design Job', href: '/design-studio' },
                    { label: 'Consolidate P&L', href: '/consolidation' },
                    { label: 'Run Workflow', href: '/workflows' },
                    { label: 'Replay Events', href: '/event-platform' },
                  ].map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.accent,
                        background: '#0a1a30',
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        padding: '6px 12px',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  System Status
                </span>
              </div>

              <div style={{ padding: '8px 0' }}>
                {systemComponents.map((sys) => (
                  <Link
                    key={sys.name}
                    href={sys.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 18px',
                      textDecoration: 'none',
                      borderBottom: `1px solid ${T.border}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d1e35')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <StatusDot healthy={sys.healthy} />
                    <span style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 500 }}>{sys.name}</span>
                    <span style={{ fontSize: 12, color: sys.healthy ? T.green : T.amber, fontWeight: 600 }}>
                      {sys.healthy ? 'Healthy' : 'Degraded'}
                    </span>
                    <span style={{ fontSize: 12, color: T.dim, minWidth: 80, textAlign: 'right' }}>{sys.metric}</span>
                    <span style={{ fontSize: 12, color: T.dim }}>→</span>
                  </Link>
                ))}
              </div>

              {/* Consumer Group Lag */}
              <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Consumer Group Lag
                </div>
                {consumerGroups.map((cg) => (
                  <div key={cg.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: T.muted, width: 100, flexShrink: 0 }}>{cg.name}</span>
                    <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: '82%',
                          background: T.green,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: T.green, width: 40, textAlign: 'right', flexShrink: 0 }}>
                      {cg.lag} lag
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>}

          {/* ── System Status (System view only) ── */}
          {isSystem && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    System Status
                  </span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {systemComponents.map((sys) => (
                    <Link
                      key={sys.name}
                      href={sys.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 18px',
                        textDecoration: 'none',
                        borderBottom: `1px solid ${T.border}`,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#0d1e35')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <StatusDot healthy={sys.healthy} />
                      <span style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 500 }}>{sys.name}</span>
                      <span style={{ fontSize: 12, color: sys.healthy ? T.green : T.amber, fontWeight: 600 }}>
                        {sys.healthy ? 'Healthy' : 'Degraded'}
                      </span>
                      <span style={{ fontSize: 12, color: T.dim, minWidth: 80, textAlign: 'right' }}>{sys.metric}</span>
                      <span style={{ fontSize: 12, color: T.dim }}>→</span>
                    </Link>
                  ))}
                </div>
                <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    Consumer Group Lag
                  </div>
                  {consumerGroups.map((cg) => (
                    <div key={cg.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: T.muted, width: 100, flexShrink: 0 }}>{cg.name}</span>
                      <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '82%', background: T.green, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.green, width: 40, textAlign: 'right', flexShrink: 0 }}>
                        {cg.lag} lag
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
