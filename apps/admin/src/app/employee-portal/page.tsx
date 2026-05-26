'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('adminToken') ?? '';
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface WalletStats {
  totalWallets: number;
  totalBalance: number;
  totalGranted: number;
  totalSpent: number;
  byDepartment: Array<{ department: string; balance: number; spent: number }>;
}

interface EmployeeWallet {
  id: string;
  companyId: string;
  tenantId: string;
  employeeEmail: string;
  employeeName: string;
  department: string | null;
  balance: string | number;
  totalGranted: string | number;
  totalSpent: string | number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

interface ProcurementRequest {
  id: string;
  walletId: string;
  companyId: string;
  tenantId: string;
  employeeEmail: string;
  department: string | null;
  productName: string;
  quantity: number;
  unitPrice: string | number | null;
  totalAmount: string | number | null;
  currency: string;
  status: string;
  urgency: string;
  justification: string | null;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface RequestStats {
  pending: number;
  approved: number;
  rejected: number;
  totalValue: number;
  avgApprovalHours: number;
  byUrgency: Record<string, number>;
}

interface OnboardingKit {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  department: string | null;
  totalValue: string | number;
  currency: string;
  isActive: boolean;
  items: unknown[];
  createdAt: string;
}

interface KitDeployment {
  id: string;
  kitId: string;
  walletId: string;
  tenantId: string;
  status: string;
  employeeEmail: string;
  employeeName: string;
  totalCost: string | number;
  deployedAt: string;
  createdAt: string;
}

interface DepartmentBudget {
  id: string;
  tenantId: string;
  companyId: string;
  department: string;
  fiscalYear: number;
  fiscalQuarter: number | null;
  totalBudget: string | number;
  allocated: string | number;
  spent: string | number;
  committed: string | number;
  currency: string;
  alertThreshold: string | number;
  isLocked: boolean;
  createdAt: string;
}

interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  utilizationPct: number;
  atRisk: Array<{ department: string; utilizationPct: number }>;
  byDepartment: DepartmentBudget[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, decimals = 2): string {
  const n = Number(val ?? 0);
  return isNaN(n) ? '0' : n.toFixed(decimals);
}

function fmtEur(val: string | number | null | undefined): string {
  return `€${fmt(val)}`;
}

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1a2f48]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs w-10 text-right" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    normal: '#4da3ff',
    low: '#8ba8c7',
  };
  const color = map[urgency] ?? '#8ba8c7';
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {urgency}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#22c55e',
    rejected: '#ef4444',
    ordered: '#4da3ff',
    delivered: '#22c55e',
    processing: '#a855f7',
    shipped: '#4da3ff',
    cancelled: '#8ba8c7',
  };
  const color = map[status] ?? '#8ba8c7';
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {status}
    </span>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = '#4da3ff',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
      <p className="text-[11px] text-[#4d6a87] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'wallets' | 'requests' | 'kits' | 'budgets';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'wallets', label: 'Wallets' },
  { id: 'requests', label: 'Requests' },
  { id: 'kits', label: 'Onboarding Kits' },
  { id: 'budgets', label: 'Department Budgets' },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeePortalPage() {
  const [tab, setTab] = useState<Tab>('wallets');
  const [tenantId] = useState('default');

  // Wallets
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);

  // Requests
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [reqStats, setReqStats] = useState<RequestStats | null>(null);

  // Kits
  const [kits, setKits] = useState<OnboardingKit[]>([]);
  const [deployments, setDeployments] = useState<KitDeployment[]>([]);

  // Budgets
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ws, rqs, rqStats, ks, deps, bs] = await Promise.all([
        apiFetch<WalletStats>('/api/v1/employee-portal/wallets'),
        apiFetch<ProcurementRequest[]>(
          `/api/v1/employee-portal/requests?tenantId=${tenantId}`,
        ),
        apiFetch<RequestStats>(
          `/api/v1/employee-portal/requests/stats?tenantId=${tenantId}`,
        ),
        apiFetch<OnboardingKit[]>(
          `/api/v1/employee-portal/kits?tenantId=${tenantId}`,
        ),
        apiFetch<KitDeployment[]>(
          `/api/v1/employee-portal/kits/deployments?tenantId=${tenantId}`,
        ),
        apiFetch<BudgetSummary>(
          `/api/v1/employee-portal/budgets/summary?tenantId=${tenantId}`,
        ),
      ]);
      setWalletStats(ws);
      setRequests(rqs);
      setReqStats(rqStats);
      setKits(ks);
      setDeployments(deps);
      setBudgetSummary(bs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load error');
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function handleApprove(id: string) {
    try {
      await apiFetch(`/api/v1/employee-portal/requests/${id}/approve`, 'PATCH', {
        approvedBy: 'admin',
      });
      void load();
    } catch {
      // ignore
    }
  }

  async function handleReject(id: string) {
    try {
      await apiFetch(`/api/v1/employee-portal/requests/${id}/reject`, 'PATCH', {
        reason: 'Rejected by admin',
        rejectedBy: 'admin',
      });
      void load();
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Employee Procurement Portal</h1>
          <p className="text-[#4d6a87] text-sm mt-1">
            Wallets · Requests · Onboarding Kits · Department Budgets
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-[#4da3ff] text-[#07111f]'
                  : 'text-[#8ba8c7] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Wallets ─────────────────────────────────────────────────── */}
        {tab === 'wallets' && walletStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Wallets" value={walletStats.totalWallets} />
              <StatCard
                label="Total Balance"
                value={fmtEur(walletStats.totalBalance)}
                color="#22c55e"
              />
              <StatCard
                label="Total Granted"
                value={fmtEur(walletStats.totalGranted)}
                color="#4da3ff"
              />
              <StatCard
                label="Total Spent"
                value={fmtEur(walletStats.totalSpent)}
                color="#f59e0b"
              />
            </div>

            {/* Department breakdown */}
            {walletStats.byDepartment.length > 0 && (
              <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">By Department</h3>
                <div className="grid grid-cols-3 gap-3">
                  {walletStats.byDepartment.map((d) => (
                    <div key={d.department} className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3">
                      <p className="text-xs text-[#4d6a87] mb-1">{d.department}</p>
                      <p className="text-sm font-bold text-[#22c55e]">{fmtEur(d.balance)}</p>
                      <p className="text-[11px] text-[#8ba8c7]">Spent: {fmtEur(d.spent)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wallets placeholder note */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
              <p className="text-[#4d6a87] text-sm text-center py-6">
                Use the API endpoints to list individual wallets by company.
                Platform stats are shown above.
              </p>
            </div>
          </div>
        )}

        {/* ── Tab: Requests ────────────────────────────────────────────────── */}
        {tab === 'requests' && (
          <div className="space-y-6">
            {reqStats && (
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Pending" value={reqStats.pending} color="#f59e0b" />
                <StatCard label="Approved" value={reqStats.approved} color="#22c55e" />
                <StatCard label="Rejected" value={reqStats.rejected} color="#ef4444" />
                <StatCard
                  label="Total Value"
                  value={fmtEur(reqStats.totalValue)}
                  color="#4da3ff"
                />
              </div>
            )}

            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a2f48] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Procurement Requests</h3>
                <span className="text-[11px] text-[#4d6a87]">{requests.length} total</span>
              </div>
              {requests.length === 0 ? (
                <p className="text-center text-[#4d6a87] text-sm py-8">No requests</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2f48]">
                        {['Employee', 'Product', 'Qty', 'Amount', 'Urgency', 'Status', 'Date', 'Actions'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-[#1a2f48]/50 hover:bg-[#102131] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{r.employeeEmail}</p>
                            {r.department && (
                              <p className="text-[11px] text-[#4d6a87]">{r.department}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#8ba8c7]">{r.productName}</td>
                          <td className="px-4 py-3 text-[#8ba8c7]">{r.quantity}</td>
                          <td className="px-4 py-3 text-white font-medium">
                            {r.totalAmount != null ? fmtEur(r.totalAmount) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <UrgencyBadge urgency={r.urgency} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-[#4d6a87] text-xs">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {r.status === 'pending' && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => { void handleApprove(r.id); }}
                                  className="px-2 py-1 rounded text-[10px] font-bold bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleReject(r.id); }}
                                  className="px-2 py-1 rounded text-[10px] font-bold bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Kits ────────────────────────────────────────────────────── */}
        {tab === 'kits' && (
          <div className="space-y-6">
            {/* Kit cards */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Onboarding Kits ({kits.length})
              </h3>
              {kits.length === 0 ? (
                <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center">
                  <p className="text-[#4d6a87] text-sm">No kits configured</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {kits.map((kit) => {
                    const items = Array.isArray(kit.items) ? kit.items : [];
                    return (
                      <div
                        key={kit.id}
                        className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white font-semibold">{kit.name}</p>
                            <p className="text-[11px] text-[#4d6a87] mt-0.5">
                              {kit.department ?? 'All Departments'}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-[#4da3ff]">
                            {fmtEur(kit.totalValue)}
                          </span>
                        </div>
                        {kit.description && (
                          <p className="text-xs text-[#8ba8c7] mb-3">{kit.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#4d6a87]">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[11px] text-[#22c55e]">{kit.currency}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Deployments */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a2f48]">
                <h3 className="text-sm font-semibold text-white">
                  Deployments ({deployments.length})
                </h3>
              </div>
              {deployments.length === 0 ? (
                <p className="text-center text-[#4d6a87] text-sm py-8">No deployments yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2f48]">
                        {['Employee', 'Kit ID', 'Status', 'Cost', 'Deployed At'].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deployments.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-[#1a2f48]/50 hover:bg-[#102131] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{d.employeeName}</p>
                            <p className="text-[11px] text-[#4d6a87]">{d.employeeEmail}</p>
                          </td>
                          <td className="px-4 py-3 text-[#8ba8c7] font-mono text-xs">
                            {d.kitId.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-4 py-3 text-white font-medium">
                            {fmtEur(d.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-[#4d6a87] text-xs">
                            {new Date(d.deployedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Budgets ─────────────────────────────────────────────────── */}
        {tab === 'budgets' && budgetSummary && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Budget"
                value={fmtEur(budgetSummary.totalBudget)}
                color="#4da3ff"
              />
              <StatCard
                label="Total Spent"
                value={fmtEur(budgetSummary.totalSpent)}
                color="#f59e0b"
              />
              <StatCard
                label="Utilization"
                value={`${budgetSummary.utilizationPct.toFixed(1)}%`}
                color={
                  budgetSummary.utilizationPct >= 90
                    ? '#ef4444'
                    : budgetSummary.utilizationPct >= 80
                    ? '#f59e0b'
                    : '#22c55e'
                }
              />
            </div>

            {/* At Risk */}
            {budgetSummary.atRisk.length > 0 && (
              <div className="bg-[#ef4444]/5 border border-[#ef4444]/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#ef4444] mb-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1L13 12H1L7 1Z" />
                    <path d="M7 5v3M7 10h.01" stroke="#07111f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                  At Risk ({budgetSummary.atRisk.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {budgetSummary.atRisk.map((r) => (
                    <div
                      key={r.department}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20"
                    >
                      <span className="text-sm text-white font-medium">{r.department}</span>
                      <span className="text-[11px] text-[#ef4444] font-bold">
                        {r.utilizationPct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget Table */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a2f48]">
                <h3 className="text-sm font-semibold text-white">
                  Department Budgets ({budgetSummary.byDepartment.length})
                </h3>
              </div>
              {budgetSummary.byDepartment.length === 0 ? (
                <p className="text-center text-[#4d6a87] text-sm py-8">No budgets configured</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2f48]">
                        {[
                          'Department',
                          'Fiscal Year',
                          'Total Budget',
                          'Spent',
                          'Committed',
                          'Utilization',
                          'Currency',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {budgetSummary.byDepartment.map((b) => {
                        const budgetNum = Number(b.totalBudget);
                        const spentNum = Number(b.spent);
                        const utilizationPct =
                          budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
                        return (
                          <tr
                            key={b.id}
                            className="border-b border-[#1a2f48]/50 hover:bg-[#102131] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="text-white font-medium">{b.department}</span>
                              {b.isLocked && (
                                <span className="ml-2 text-[10px] text-[#f59e0b]">LOCKED</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#8ba8c7]">
                              {b.fiscalYear}
                              {b.fiscalQuarter != null ? ` Q${b.fiscalQuarter}` : ''}
                            </td>
                            <td className="px-4 py-3 text-white font-medium">
                              {fmtEur(b.totalBudget)}
                            </td>
                            <td className="px-4 py-3 text-[#f59e0b]">{fmtEur(b.spent)}</td>
                            <td className="px-4 py-3 text-[#a855f7]">{fmtEur(b.committed)}</td>
                            <td className="px-4 py-3 w-40">
                              <UtilBar pct={utilizationPct} />
                            </td>
                            <td className="px-4 py-3 text-[#4d6a87]">{b.currency}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
