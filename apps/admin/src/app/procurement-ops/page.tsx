'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── helpers ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
}

// ─── types ───────────────────────────────────────────────────────────────────

interface WorkflowStats {
  total?: number;
  running?: number;
  completed?: number;
  failed?: number;
}

interface BudgetSummary {
  totalBudget?: number;
  totalSpent?: number;
  utilizationPct?: number;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  totalAmount?: number | string;
}

interface AutomationRule {
  id: string;
  name: string;
  triggerEvent?: string;
  actionType?: string;
  isActive?: boolean;
  executionCount?: number;
  createdAt?: string;
}

interface Anomaly {
  id: string;
  description?: string;
  acknowledged?: boolean;
}

interface ProcurementRequest {
  id: string;
  status: string;
  urgency?: string;
  productName?: string;
  employeeName?: string;
  amount?: number | string;
  createdAt: string;
  reason?: string;
}

interface WorkflowStep {
  id?: string;
  name: string;
  status?: string;
  completedAt?: string;
}

interface WorkflowInstance {
  id: string;
  definitionName?: string;
  workflowDefinition?: { name?: string };
  currentStep?: string;
  status: string;
  startedAt?: string;
  createdAt?: string;
  steps?: WorkflowStep[];
  completedSteps?: number;
  totalSteps?: number;
}

interface Budget {
  id: string;
  department?: string;
  departmentName?: string;
  totalAmount?: number | string;
  spentAmount?: number | string;
  amount?: number | string;
  spent?: number | string;
  name?: string;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SkeletonCard({ h = 'h-24' }: { h?: string }) {
  return (
    <div className={`bg-[#0b1526] border border-[#1a2f48] rounded-xl ${h} animate-pulse`} />
  );
}

function UrgencyBadge({ urgency }: { urgency?: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    normal: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    low: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  };
  const u = (urgency ?? 'normal').toLowerCase();
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${map[u] ?? map['normal']}`}>
      {u}
    </span>
  );
}

function StatusBadge({ status, active }: { status?: string; active?: boolean }) {
  const isActive = active ?? status === 'active';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
      {status ?? (isActive ? 'active' : 'inactive')}
    </span>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

function KpiCard({ label, value, color = 'text-white', sub }: KpiCardProps) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-[11px] text-[#4d6a87] font-medium uppercase tracking-wider truncate">{label}</p>
      <p className={`text-2xl font-bold ${color} leading-tight`}>{value}</p>
      {sub && <p className="text-[11px] text-[#4d6a87]">{sub}</p>}
    </div>
  );
}

// ─── budget bar ──────────────────────────────────────────────────────────────

function BudgetBar({ budget }: { budget: Budget }) {
  const total = Number(budget.totalAmount ?? budget.amount ?? 0);
  const spent = Number(budget.spentAmount ?? budget.spent ?? 0);
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const dept = budget.department ?? budget.departmentName ?? budget.name ?? '—';

  const barColor =
    pct > 90 ? 'bg-[#ef4444]' :
    pct > 75 ? 'bg-[#f59e0b]' :
    pct > 50 ? 'bg-[#4da3ff]' :
    'bg-[#22c55e]';

  const atRisk = pct > 80;

  return (
    <div className="py-2.5 border-b border-[#1a2f48] last:border-0">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {atRisk && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
              <path d="M6 1L11 10H1L6 1z" />
              <path d="M6 4.5v2.5M6 8.5h.01" />
            </svg>
          )}
          <span className="text-xs font-medium text-white truncate">{dept}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#4d6a87]">{fmtCurrency(spent)} / {fmtCurrency(total)}</span>
          <span className={`text-xs font-bold ${pct > 90 ? 'text-[#ef4444]' : pct > 75 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#102131] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── workflow step trail ──────────────────────────────────────────────────────

function StepTrail({ instance }: { instance: WorkflowInstance }) {
  const steps = instance.steps ?? [];
  const totalSteps = instance.totalSteps ?? steps.length;
  const completedSteps = instance.completedSteps ?? steps.filter(s => s.status === 'completed' || s.completedAt).length;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="mt-2 space-y-1.5">
      {steps.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((step, i) => {
            const isDone = step.status === 'completed' || !!step.completedAt;
            const isCurrent = step.name === instance.currentStep;
            return (
              <div key={step.id ?? i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#1a2f48] text-xs">→</span>}
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? 'bg-[#22c55e]' : isCurrent ? 'bg-[#4da3ff] animate-pulse' : 'bg-[#1a2f48]'}`} />
                  <span className={`text-[10px] truncate max-w-[60px] ${isCurrent ? 'text-[#4da3ff] font-semibold' : isDone ? 'text-[#22c55e]' : 'text-[#4d6a87]'}`}>
                    {step.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#102131] rounded-full overflow-hidden">
          <div className="h-full bg-[#4da3ff] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-[#4d6a87] flex-shrink-0">{completedSteps}/{totalSteps} steps</span>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ProcurementOpsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // data state
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats>({});
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary>({});
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<ProcurementRequest[]>([]);
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // action state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [approvingAll, setApprovingAll] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const headers = authHeaders();

      const [
        _requestsRes, workflowsRes, budgetsRes, ordersRes, routingRes, anomaliesRes
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/employee-portal/requests/stats?tenantId=default`, { headers }),
        fetch(`${API_BASE}/api/v1/workflows/stats`, { headers }),
        fetch(`${API_BASE}/api/v1/employee-portal/budgets/summary?tenantId=default`, { headers }),
        fetch(`${API_BASE}/api/v1/orders?limit=20&status=pending`, { headers }),
        fetch(`${API_BASE}/api/v1/automation/rules`, { headers }),
        fetch(`${API_BASE}/api/v1/consolidation/anomalies?unacknowledged=true`, { headers }),
      ]);

      // workflow stats
      if (workflowsRes.status === 'fulfilled' && workflowsRes.value.ok) {
        const d = await workflowsRes.value.json() as { data?: WorkflowStats } & WorkflowStats;
        setWorkflowStats(d.data ?? d);
      }

      // budget summary
      if (budgetsRes.status === 'fulfilled' && budgetsRes.value.ok) {
        const d = await budgetsRes.value.json() as { data?: BudgetSummary } & BudgetSummary;
        setBudgetSummary(d.data ?? d);
      }

      // pending orders
      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const d = await ordersRes.value.json() as { data?: Order[]; orders?: Order[] } & { items?: Order[] };
        const list = d.data ?? (d as unknown as Order[]);
        setPendingOrders(Array.isArray(list) ? list : []);
      }

      // automation rules
      if (routingRes.status === 'fulfilled' && routingRes.value.ok) {
        const d = await routingRes.value.json() as { data?: AutomationRule[]; rules?: AutomationRule[] };
        const list = d.data ?? d.rules ?? (d as unknown as AutomationRule[]);
        setAutomationRules(Array.isArray(list) ? list : []);
      }

      // anomalies
      if (anomaliesRes.status === 'fulfilled' && anomaliesRes.value.ok) {
        const d = await anomaliesRes.value.json() as { data?: Anomaly[]; total?: number; count?: number };
        const list = d.data ?? (d as unknown as Anomaly[]);
        if (typeof d.total === 'number') setAnomalyCount(d.total);
        else if (typeof d.count === 'number') setAnomalyCount(d.count);
        else setAnomalyCount(Array.isArray(list) ? list.length : 0);
      }

      // pending requests
      const pendingR = await fetch(`${API_BASE}/api/v1/employee-portal/requests?tenantId=default`, { headers });
      if (pendingR.ok) {
        const d = await pendingR.json() as { data?: ProcurementRequest[] } | ProcurementRequest[];
        const list = (Array.isArray(d) ? d : ((d as { data?: ProcurementRequest[] }).data ?? []));
        const pending = list.filter(r => r.status === 'pending');
        // sort: critical first, high, normal, low
        const priority: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
        pending.sort((a, b) => {
          const ap = priority[(a.urgency ?? 'normal').toLowerCase()] ?? 2;
          const bp = priority[(b.urgency ?? 'normal').toLowerCase()] ?? 2;
          return ap - bp;
        });
        setPendingRequests(pending);
      }

      // workflow instances
      const instancesR = await fetch(`${API_BASE}/api/v1/workflows/instances?status=running&limit=10`, { headers });
      if (instancesR.ok) {
        const d = await instancesR.json() as { data?: WorkflowInstance[] } | WorkflowInstance[];
        const list = Array.isArray(d) ? d : ((d as { data?: WorkflowInstance[] }).data ?? []);
        setWorkflowInstances(list);
      }

      // budgets list
      const budgetsListR = await fetch(`${API_BASE}/api/v1/employee-portal/budgets?tenantId=default`, { headers });
      if (budgetsListR.ok) {
        const d = await budgetsListR.json() as { data?: Budget[] } | Budget[];
        const list = Array.isArray(d) ? d : ((d as { data?: Budget[] }).data ?? []);
        setBudgets(list);
      }

      setLastRefreshed(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch + 30s auto-refresh
  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => { void fetchAll(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // seconds-ago ticker
  useEffect(() => {
    if (!lastRefreshed) return;
    const ticker = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastRefreshed.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastRefreshed]);

  // approval actions
  const approveRequest = useCallback(async (id: string) => {
    setProcessingIds(prev => new Set(Array.from(prev).concat(id)));
    try {
      await fetch(`${API_BASE}/api/v1/employee-portal/requests/${id}/approve`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'ops-center' }),
      });
      await fetchAll();
    } finally {
      setProcessingIds(prev => {
        const next = Array.from(prev).filter(x => x !== id);
        return new Set(next);
      });
    }
  }, [fetchAll]);

  const rejectRequest = useCallback(async (id: string) => {
    setProcessingIds(prev => new Set(Array.from(prev).concat(id)));
    try {
      await fetch(`${API_BASE}/api/v1/employee-portal/requests/${id}/reject`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected via Ops Center', rejectedBy: 'ops-center' }),
      });
      await fetchAll();
    } finally {
      setProcessingIds(prev => {
        const next = Array.from(prev).filter(x => x !== id);
        return new Set(next);
      });
    }
  }, [fetchAll]);

  const approveAllNormal = useCallback(async () => {
    setApprovingAll(true);
    const normalItems = pendingRequests.filter(r => (r.urgency ?? 'normal').toLowerCase() === 'normal');
    await Promise.allSettled(
      normalItems.map(r =>
        fetch(`${API_BASE}/api/v1/employee-portal/requests/${r.id}/approve`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvedBy: 'ops-center' }),
        })
      )
    );
    await fetchAll();
    setApprovingAll(false);
  }, [pendingRequests, fetchAll]);

  const retryWorkflow = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/v1/workflows/${id}/retry`, {
      method: 'POST',
      headers: authHeaders(),
    });
    await fetchAll();
  }, [fetchAll]);

  // derived KPIs
  const pendingCount = pendingRequests.length;
  const runningWorkflows = workflowStats.running ?? 0;
  const utilPct = budgetSummary.utilizationPct != null
    ? Math.round(Number(budgetSummary.utilizationPct))
    : budgetSummary.totalBudget
      ? Math.round((Number(budgetSummary.totalSpent ?? 0) / Number(budgetSummary.totalBudget)) * 100)
      : 0;
  const activeRules = automationRules.filter(r => r.isActive !== false).length;
  const pendingOrdersCount = pendingOrders.length;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-[#0b1526] border border-[#1a2f48] rounded-xl w-80 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} h="h-20" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard h="h-96" />
          <SkeletonCard h="h-96" />
          <SkeletonCard h="h-96" />
        </div>
        <SkeletonCard h="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-[#0b1526] border border-[#ef4444]/50 rounded-xl p-6 flex flex-col items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-[#ef4444] font-semibold">Failed to load data</p>
          <p className="text-[#4d6a87] text-sm">{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); void fetchAll(); }}
            className="px-4 py-2 bg-[#4da3ff]/10 hover:bg-[#4da3ff]/20 text-[#4da3ff] border border-[#4da3ff]/30 rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 min-h-screen bg-[#07111f]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Procurement Operations Center</h1>
          <p className="text-sm text-[#4d6a87] mt-0.5">Live procurement pipeline · approvals · budgets · supplier routing</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[#4d6a87]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            {lastRefreshed ? `Updated ${secondsAgo}s ago` : 'Loading…'}
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); void fetchAll(); }}
            className="px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4da3ff] text-xs font-medium hover:bg-[#102131] transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10.5 6A4.5 4.5 0 1 1 8.25 2.08" />
              <path d="M10.5 1.5v3h-3" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Pending Approvals"
          value={pendingCount}
          color={pendingCount > 0 ? 'text-[#f59e0b]' : 'text-white'}
          sub={pendingCount > 0 ? 'awaiting action' : 'queue clear'}
        />
        <KpiCard
          label="Running Workflows"
          value={runningWorkflows}
          color="text-[#4da3ff]"
          sub="active instances"
        />
        <KpiCard
          label="Budget Utilization"
          value={`${utilPct}%`}
          color={utilPct > 90 ? 'text-[#ef4444]' : utilPct > 75 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}
          sub={utilPct > 90 ? 'critical' : utilPct > 75 ? 'watch' : 'healthy'}
        />
        <KpiCard
          label="Active Rules"
          value={activeRules}
          color="text-[#4da3ff]"
          sub="automation rules"
        />
        <KpiCard
          label="Open Anomalies"
          value={anomalyCount}
          color={anomalyCount > 0 ? 'text-[#ef4444]' : 'text-white'}
          sub={anomalyCount > 0 ? 'needs review' : 'all clear'}
        />
        <KpiCard
          label="Orders Awaiting"
          value={pendingOrdersCount}
          color={pendingOrdersCount > 5 ? 'text-[#f59e0b]' : 'text-white'}
          sub="pending orders"
        />
      </div>

      {/* Simulation Access Strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            title: 'Run Simulation',
            desc: 'Pre-compute cost, margin & risk',
            href: '/brain',
            icon: '◎',
            color: '#a855f7',
          },
          {
            title: 'Margin Check',
            desc: 'Validate margin before approval',
            href: '/margin-protection',
            icon: '◈',
            color: '#22c55e',
          },
          {
            title: 'Shipping Quote',
            desc: 'Compare carrier costs live',
            href: '/logistics',
            icon: '◷',
            color: '#4da3ff',
          },
          {
            title: 'AI Agent',
            desc: 'Generate procurement plan',
            href: '/ai-agent',
            icon: '✦',
            color: '#f59e0b',
          },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 hover:border-[#1f3855] transition-colors card-hover"
          >
            <div className="text-[20px] mb-2" style={{ color: card.color }}>{card.icon}</div>
            <div className="text-[13px] font-semibold text-[#f0f6ff]">{card.title}</div>
            <div className="text-[11px] text-[#4d6a87] mt-0.5">{card.desc}</div>
          </Link>
        ))}
      </div>

      {/* Middle: 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 2A: Approval Queue */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a2f48]">
            <h2 className="font-semibold text-white text-sm">Procurement Approval Queue</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30">
                {pendingCount}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1a2f48]">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="14" cy="14" r="11" />
                  <path d="M9 14.5l3 3 7-7" />
                </svg>
                <p className="text-[#22c55e] text-sm font-medium">Queue empty</p>
                <p className="text-[#4d6a87] text-xs">No pending requests</p>
              </div>
            ) : (
              pendingRequests.map(req => {
                const isProcessing = processingIds.has(req.id);
                const name = (req.productName ?? 'Untitled').slice(0, 30);
                const amt = Number(req.amount ?? 0);

                return (
                  <div key={req.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <UrgencyBadge urgency={req.urgency} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#4d6a87]">{req.employeeName ?? 'Employee'}</span>
                          <span className="text-[10px] text-[#22c55e] font-semibold">{fmtCurrency(amt)}</span>
                          <span className="text-[10px] text-[#4d6a87]">{timeAgo(req.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void approveRequest(req.id)}
                        className="flex-1 py-1 rounded-lg bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void rejectRequest(req.id)}
                        className="flex-1 py-1 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? '…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {pendingRequests.some(r => (r.urgency ?? 'normal').toLowerCase() === 'normal') && (
            <div className="px-4 py-3 border-t border-[#1a2f48]">
              <button
                type="button"
                disabled={approvingAll}
                onClick={() => void approveAllNormal()}
                className="w-full py-2 rounded-lg bg-[#4da3ff]/10 hover:bg-[#4da3ff]/20 text-[#4da3ff] border border-[#4da3ff]/30 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approvingAll ? 'Approving…' : 'Approve All Normal'}
              </button>
            </div>
          )}
        </div>

        {/* 2B: Active Workflows */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a2f48]">
            <h2 className="font-semibold text-white text-sm">Active Workflow Instances</h2>
            {workflowInstances.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30">
                {workflowInstances.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1a2f48]">
            {workflowInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="14" cy="14" r="11" />
                  <path d="M14 9v5l3 3" />
                </svg>
                <p className="text-[#4d6a87] text-sm">No running workflows</p>
              </div>
            ) : (
              workflowInstances.map(inst => {
                const defName = inst.definitionName ?? inst.workflowDefinition?.name ?? 'Workflow';
                const startedAt = inst.startedAt ?? inst.createdAt ?? new Date().toISOString();
                const isFailed = inst.status === 'failed';

                return (
                  <div key={inst.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{defName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {inst.currentStep && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 font-medium truncate max-w-[120px]">
                              {inst.currentStep}
                            </span>
                          )}
                          <span className="text-[10px] text-[#4d6a87]">{timeAgo(startedAt)}</span>
                        </div>
                      </div>
                      {isFailed && (
                        <button
                          type="button"
                          onClick={() => void retryWorkflow(inst.id)}
                          className="flex-shrink-0 px-2 py-1 rounded-lg bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 text-[10px] font-semibold transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    <StepTrail instance={inst} />
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-[#1a2f48]">
            <Link
              href="/workflows"
              className="flex items-center justify-center gap-1 text-xs text-[#4da3ff] hover:text-white transition-colors"
            >
              View all workflows
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8l6-6M8 8V2H2" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 2C: Budget Pulse */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a2f48]">
            <h2 className="font-semibold text-white text-sm">Department Budget Utilization</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {budgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="14" cy="14" r="11" />
                  <path d="M14 9v7M11 12h6" />
                </svg>
                <p className="text-[#4d6a87] text-sm">No budget data</p>
              </div>
            ) : (
              budgets.map(b => <BudgetBar key={b.id} budget={b} />)
            )}
          </div>

          {(budgetSummary.totalBudget ?? 0) > 0 && (
            <div className="px-4 py-3 border-t border-[#1a2f48] flex items-center justify-between">
              <span className="text-[11px] text-[#4d6a87]">Total utilized</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white font-semibold">
                  {fmtCurrency(Number(budgetSummary.totalSpent ?? 0))}
                </span>
                <span className="text-[10px] text-[#4d6a87]">
                  of {fmtCurrency(Number(budgetSummary.totalBudget ?? 0))}
                </span>
                <span className={`text-xs font-bold ${utilPct > 90 ? 'text-[#ef4444]' : utilPct > 75 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                  {utilPct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Automation Rules */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a2f48]">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white text-sm">Active Automation Rules</h2>
            {automationRules.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
                {activeRules} active
              </span>
            )}
          </div>
          <Link
            href="/automation"
            className="flex items-center gap-1 text-xs text-[#4da3ff] hover:text-white transition-colors"
          >
            View all
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-6M8 8V2H2" />
            </svg>
          </Link>
        </div>

        {automationRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-[#4d6a87] text-sm">No automation rules configured</p>
            <Link href="/automation" className="text-xs text-[#4da3ff] hover:underline">Set up rules →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  <th className="text-left px-4 py-2.5 text-[#4d6a87] font-semibold uppercase tracking-wider text-[10px]">Rule Name</th>
                  <th className="text-left px-4 py-2.5 text-[#4d6a87] font-semibold uppercase tracking-wider text-[10px]">Trigger Event</th>
                  <th className="text-left px-4 py-2.5 text-[#4d6a87] font-semibold uppercase tracking-wider text-[10px]">Action Type</th>
                  <th className="text-left px-4 py-2.5 text-[#4d6a87] font-semibold uppercase tracking-wider text-[10px]">Executions</th>
                  <th className="text-left px-4 py-2.5 text-[#4d6a87] font-semibold uppercase tracking-wider text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {automationRules.slice(0, 10).map((rule, idx) => (
                  <tr key={rule.id} className={idx % 2 === 1 ? 'bg-[#102131]' : ''}>
                    <td className="px-4 py-2.5 text-white font-medium">{rule.name}</td>
                    <td className="px-4 py-2.5 text-[#8ba8c7]">{rule.triggerEvent ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#8ba8c7]">{rule.actionType ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#8ba8c7]">
                      {rule.executionCount != null ? rule.executionCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge active={rule.isActive !== false} status={rule.isActive !== false ? 'active' : 'inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
