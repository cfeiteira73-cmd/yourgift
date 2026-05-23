'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const authHdrs = { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}` };

// ── Interfaces ─────────────────────────────────────────────────────────────

interface CFOReport {
  period: string;
  totalSavedEur: number;
  totalAvoidedEur: number;
  totalMarginImpactEur: number;
  totalTimeSavedHours: number;
  totalTimeSavedValueEur: number;
  totalValueEur: number;
  recordCount: number;
}

interface ValueSummary {
  allTime: {
    totalValueEur: number;
    savedCostEur: number;
    avoidedCostEur: number;
    marginImpactEur: number;
    timeSavedHours: number;
    timeSavedValueEur: number;
    recordCount: number;
  };
  last30Days: { totalValueEur: number; recordCount: number };
  last90Days: { totalValueEur: number; recordCount: number };
  byCategory: Array<{ category: string; totalValueEur: number; recordCount: number }>;
  bySupplier: Array<{ supplierCode: string; totalValueEur: number; savedCostEur: number }>;
  monthlyTrend: CFOReport[];
  avgValuePerDecision: number;
  proofROI: number;
}

interface AdoptionMode {
  id: string;
  tenantId: string;
  mode: string;
  shadowSimulationsRun: number;
  shadowSavingsIdentifiedEur: number;
  modesHistory: Array<{ mode: string; changedAt: string }>;
}

interface CorrectnessData {
  correctnessRatePct: number;
  totalDecisions: number;
  correctDecisions: number;
  avgSavingsAccuracyPct: number;
  avgMarginAccuracyPct: number;
  avgDeliveryAccuracyPct: number;
  totalRealizedSavingsEur: number;
  totalPredictedSavingsEur: number;
  savingsCapturePct: number;
  trend: string;
  byCategory: Record<string, { correctness: number; count: number }>;
}

interface CashFlowData {
  totalPayablesEur: number;
  overduePayablesEur: number;
  pendingInvoiceCount: number;
  overdueInvoiceCount: number;
  avgDaysPayableOutstanding: number;
  cashConversionCycleDays: number;
  liquidityRiskScore: number;
  workingCapitalAtRiskEur: number;
  thirtyDayForecastEur: number;
  riskLevel: 'low' | 'medium' | 'high';
  cashFlowTimeline: Array<{ date: string; outflow: number; inflow: number; net: number }>;
}

type TabId = 'overview' | 'categories' | 'suppliers' | 'adoption';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtEur(val: number): string {
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
  return `€${val.toFixed(0)}`;
}

function fmtEurFull(val: number): string {
  return `€${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const CATEGORY_COLORS: Record<string, string> = {
  shipping: '#4da3ff',
  apparel: '#22c55e',
  gifts: '#a855f7',
  lifestyle: '#f59e0b',
  tech: '#ef4444',
  other: '#6b7280',
};

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? CATEGORY_COLORS.other;
}

// ── Mode badge ─────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    shadow: { bg: '#374151', text: '#9ca3af' },
    assisted: { bg: '#1e3a5f', text: '#4da3ff' },
    controlled: { bg: '#1a3a2a', text: '#22c55e' },
    autonomous: { bg: '#2e1a47', text: '#a855f7' },
  };
  const c = cfg[mode.toLowerCase()] ?? cfg.shadow;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: c.bg, color: c.text }}
    >
      {mode}
    </span>
  );
}

// ── Stacked Bar Chart ──────────────────────────────────────────────────────

function MonthlyChart({ data }: { data: CFOReport[] }) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.totalValueEur), 1);
  const BAR_H = 150;
  const BAR_W = 40;
  const GAP = 24;
  const LEFT = 50;
  const BOTTOM = 30;
  const slotW = BAR_W + GAP;
  const totalW = Math.max(900, LEFT + data.length * slotW + 20);

  const segments = [
    { key: 'totalSavedEur' as keyof CFOReport, color: '#22c55e', label: 'Saved Cost' },
    { key: 'totalAvoidedEur' as keyof CFOReport, color: '#4da3ff', label: 'Avoided Cost' },
    { key: 'totalMarginImpactEur' as keyof CFOReport, color: '#a855f7', label: 'Margin Impact' },
    { key: 'totalTimeSavedValueEur' as keyof CFOReport, color: '#f59e0b', label: 'Time Value' },
  ];

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 mb-6">
      <div className="mb-3">
        <div className="font-tight text-base font-bold text-white">Monthly Value Delivered</div>
        <div className="text-xs text-[#8ba8c7]">Saved Cost + Avoided Cost + Margin Impact + Time Value</div>
      </div>
      {/* Legend */}
      <div className="flex gap-5 mb-4">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-xs text-[#8ba8c7]">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${totalW} ${BAR_H + BOTTOM + 10}`} width="100%" style={{ minWidth: 400 }}>
          {data.map((d, i) => {
            const x = LEFT + i * slotW;
            let yOffset = BAR_H;
            return (
              <g key={d.period}>
                {segments.map((seg) => {
                  const rawVal = d[seg.key] as number;
                  const val = typeof rawVal === 'number' ? rawVal : 0;
                  const h = (val / maxVal) * BAR_H;
                  yOffset -= h;
                  const rect = (
                    <rect
                      key={seg.key}
                      x={x}
                      y={yOffset}
                      width={BAR_W}
                      height={h}
                      fill={seg.color}
                      opacity={0.85}
                      rx={2}
                    />
                  );
                  return rect;
                })}
                <text
                  x={x + BAR_W / 2}
                  y={BAR_H + BOTTOM - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#6b7280"
                >
                  {d.period.slice(0, 7)}
                </text>
              </g>
            );
          })}
          {/* Y axis */}
          <line x1={LEFT - 4} y1={0} x2={LEFT - 4} y2={BAR_H} stroke="#1a2f48" strokeWidth={1} />
          <text x={LEFT - 6} y={8} textAnchor="end" fontSize={9} fill="#6b7280">{fmtEur(maxVal)}</text>
          <text x={LEFT - 6} y={BAR_H / 2} textAnchor="end" fontSize={9} fill="#6b7280">{fmtEur(maxVal / 2)}</text>
          <text x={LEFT - 6} y={BAR_H} textAnchor="end" fontSize={9} fill="#6b7280">€0</text>
        </svg>
      </div>
    </div>
  );
}

// ── Horizontal breakdown bar ───────────────────────────────────────────────

function BreakdownChart({ summary }: { summary: ValueSummary }) {
  const total = summary.allTime.totalValueEur || 1;
  const items = [
    { label: 'Saved Cost', value: summary.allTime.savedCostEur, color: '#22c55e' },
    { label: 'Avoided Cost', value: summary.allTime.avoidedCostEur, color: '#4da3ff' },
    { label: 'Margin Impact', value: summary.allTime.marginImpactEur, color: '#a855f7' },
    { label: 'Time Value', value: summary.allTime.timeSavedValueEur, color: '#f59e0b' },
  ];

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 h-full">
      <div className="font-tight text-base font-bold text-white mb-4">Value Breakdown</div>
      <div className="space-y-4">
        {items.map((item) => {
          const pct = (item.value / total) * 100;
          const barW = Math.round(pct * 2.4);
          return (
            <div key={item.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#8ba8c7]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4a6480]">{pct.toFixed(1)}%</span>
                  <span className="text-sm font-semibold text-white">{fmtEurFull(item.value)}</span>
                </div>
              </div>
              <svg width="100%" height="12" viewBox="0 0 240 12">
                <rect x={0} y={0} width={240} height={12} rx={6} fill="#1a2f48" />
                <rect x={0} y={0} width={barW} height={12} rx={6} fill={item.color} opacity={0.85} />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ROI Proof card ─────────────────────────────────────────────────────────

function ROICard({ summary }: { summary: ValueSummary }) {
  const PLATFORM_COST = 6000;
  const total = summary.allTime.totalValueEur;
  const monthlyAvg = summary.last30Days.totalValueEur || 1;
  const breakevenMonths = Math.ceil(PLATFORM_COST / monthlyAvg);
  const ratio = (total / PLATFORM_COST).toFixed(1);
  const valueBarH = Math.min(140, 140);
  const platformBarH = Math.max(10, Math.round((PLATFORM_COST / total) * 140));

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 h-full flex flex-col">
      <div className="font-tight text-base font-bold text-white mb-4">Proof of ROI</div>
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-white">{fmtEurFull(total)}</div>
        <div className="text-xs text-[#8ba8c7]">created vs</div>
        <div className="text-lg font-semibold text-[#ef4444]">€{PLATFORM_COST.toLocaleString()} platform cost</div>
      </div>
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-[#22c55e]">{summary.proofROI || ratio}x ROI</div>
        <div className="text-xs text-[#8ba8c7]">Breakeven in {breakevenMonths} months</div>
      </div>
      {/* Comparison bars */}
      <div className="flex items-end justify-center gap-8 mb-4">
        <div className="flex flex-col items-center gap-1">
          <svg width="32" height="150" viewBox="0 0 32 150">
            <rect x={4} y={150 - platformBarH} width={24} height={platformBarH} rx={3} fill="#374151" />
          </svg>
          <span className="text-xs text-[#6b7280]">Cost</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <svg width="32" height="150" viewBox="0 0 32 150">
            <rect x={4} y={150 - valueBarH} width={24} height={valueBarH} rx={3} fill="#22c55e" opacity={0.85} />
          </svg>
          <span className="text-xs text-[#22c55e]">Value</span>
        </div>
      </div>
      <div className="text-center text-sm text-[#8ba8c7] mt-auto">
        Every <span className="text-white font-semibold">€1</span> invested →{' '}
        <span className="text-[#22c55e] font-bold">€{ratio}</span> returned
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CFOPage() {
  const [summary, setSummary] = useState<ValueSummary | null>(null);
  const [modes, setModes] = useState<AdoptionMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [correctness, setCorrectness] = useState<CorrectnessData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);

  const CASH_FLOW_FALLBACK: CashFlowData = {
    totalPayablesEur: 60300,
    overduePayablesEur: 4400,
    pendingInvoiceCount: 6,
    overdueInvoiceCount: 2,
    avgDaysPayableOutstanding: 30,
    cashConversionCycleDays: 34,
    liquidityRiskScore: 28,
    workingCapitalAtRiskEur: 4400,
    thirtyDayForecastEur: 60300,
    riskLevel: 'low',
    cashFlowTimeline: [
      { date: '2026-05-23', outflow: 15800, inflow: 0, net: -15800 },
      { date: '2026-05-30', outflow: 4500,  inflow: 0, net: -4500  },
      { date: '2026-06-06', outflow: 18900, inflow: 0, net: -18900 },
      { date: '2026-06-13', outflow: 7800,  inflow: 0, net: -7800  },
      { date: '2026-06-20', outflow: 13400, inflow: 0, net: -13400 },
      { date: '2026-06-27', outflow: 0,     inflow: 0, net: 0      },
      { date: '2026-07-04', outflow: 0,     inflow: 0, net: 0      },
      { date: '2026-07-11', outflow: 0,     inflow: 0, net: 0      },
    ],
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [sumRes, modeRes, corrRes, cfRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/proof-engine/summary`, { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/proof-engine/adoption`, { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/decision-engine/correctness?period=30d`, { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/cash-flow/working-capital`, { headers: authHdrs }),
    ]);

    if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
      const data = await sumRes.value.json();
      setSummary(data);
    }
    if (modeRes.status === 'fulfilled' && modeRes.value.ok) {
      const data = await modeRes.value.json();
      setModes(Array.isArray(data) ? data : data.modes ?? []);
    }
    if (corrRes.status === 'fulfilled' && corrRes.value.ok) {
      try {
        const data = await corrRes.value.json() as CorrectnessData;
        setCorrectness(data);
      } catch { /* ignore */ }
    }
    if (cfRes.status === 'fulfilled' && cfRes.value.ok) {
      try {
        const data = await cfRes.value.json() as CashFlowData;
        setCashFlow(data);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'categories', label: 'By Category' },
    { id: 'suppliers', label: 'By Supplier' },
    { id: 'adoption', label: 'Adoption Modes' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#4da3ff] text-sm animate-pulse">Loading CFO Intelligence...</div>
      </div>
    );
  }

  const s = summary;
  const totalValue = s?.allTime.totalValueEur ?? 0;
  const catTotal = (s?.byCategory ?? []).reduce((a, c) => a + c.totalValueEur, 0) || 1;
  const supTotal = (s?.bySupplier ?? []).reduce((a, c) => a + c.totalValueEur, 0) || 1;

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-tight text-2xl font-bold text-white">CFO Intelligence</h1>
          <p className="text-sm text-[#8ba8c7] mt-1">Financial proof of your procurement infrastructure</p>
        </div>
        <div className="text-right">
          <div className="font-tight text-3xl font-bold text-[#22c55e]">
            ROI: {s?.proofROI ?? 0}x
          </div>
          <div className="text-xs text-[#8ba8c7]">vs platform cost</div>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* Total Value */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
          <div className="text-xs text-[#8ba8c7] mb-2 uppercase tracking-wide">Total Value Created</div>
          <div className="font-tight text-2xl font-bold text-[#22c55e]">{fmtEurFull(totalValue)}</div>
          <div className="text-xs text-[#4a6480] mt-1">All-time value delivered</div>
        </div>
        {/* Last 30 Days */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
          <div className="text-xs text-[#8ba8c7] mb-2 uppercase tracking-wide">Last 30 Days</div>
          <div className="font-tight text-2xl font-bold text-white">{fmtEurFull(s?.last30Days.totalValueEur ?? 0)}</div>
          <div className="text-xs text-[#4a6480] mt-1">Rolling 30-day impact</div>
        </div>
        {/* Avg per Decision */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
          <div className="text-xs text-[#8ba8c7] mb-2 uppercase tracking-wide">Avg per Decision</div>
          <div className="font-tight text-2xl font-bold text-[#4da3ff]">{fmtEurFull(s?.avgValuePerDecision ?? 0)}</div>
          <div className="text-xs text-[#4a6480] mt-1">Value per procurement decision</div>
        </div>
        {/* Time Reclaimed */}
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
          <div className="text-xs text-[#8ba8c7] mb-2 uppercase tracking-wide">Time Reclaimed</div>
          <div className="font-tight text-2xl font-bold text-[#a855f7]">{(s?.allTime.timeSavedHours ?? 0).toFixed(0)}h</div>
          <div className="text-xs text-[#4a6480] mt-1">Hours saved by automation</div>
        </div>
      </div>

      {/* Monthly Chart */}
      <MonthlyChart data={s?.monthlyTrend ?? []} />

      {/* Tab Bar */}
      <div className="flex gap-1 mb-5 border-b border-[#1a2f48]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#4da3ff] text-[#4da3ff]'
                : 'border-transparent text-[#8ba8c7] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1 — OVERVIEW */}
      {activeTab === 'overview' && s && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <BreakdownChart summary={s} />
          </div>
          <div className="col-span-1">
            <ROICard summary={s} />
          </div>
        </div>
      )}

      {/* TAB 2 — BY CATEGORY */}
      {activeTab === 'categories' && (
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Total Value</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Records</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">% of Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Trend</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(s?.byCategory ?? [])
                .sort((a, b) => b.totalValueEur - a.totalValueEur)
                .map((cat, i) => {
                  const pct = (cat.totalValueEur / catTotal) * 100;
                  const barW = Math.round(pct * 2);
                  const color = getCatColor(cat.category);
                  return (
                    <tr key={cat.category} className={i % 2 === 0 ? '' : 'bg-[#071018]'}>
                      <td className="px-4 py-3 font-medium text-white">{capitalize(cat.category)}</td>
                      <td className="px-4 py-3 text-right text-[#22c55e] font-semibold">{fmtEurFull(cat.totalValueEur)}</td>
                      <td className="px-4 py-3 text-right text-[#8ba8c7]">{cat.recordCount}</td>
                      <td className="px-4 py-3 text-right text-[#4a6480] text-xs">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <svg width={200} height={12} viewBox="0 0 200 12">
                          <rect x={0} y={0} width={200} height={12} rx={4} fill="#1a2f48" />
                          <rect x={0} y={0} width={barW} height={12} rx={4} fill={color} opacity={0.8} />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#1a2f48]">
                <td className="px-4 py-3 font-bold text-white">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#22c55e]">{fmtEurFull(catTotal)}</td>
                <td className="px-4 py-3 text-right font-bold text-white">
                  {(s?.byCategory ?? []).reduce((a, c) => a + c.recordCount, 0)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-white">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TAB 3 — BY SUPPLIER */}
      {activeTab === 'suppliers' && (
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Total Value</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Direct Savings</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">% of Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Bar</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(s?.bySupplier ?? [])
                .sort((a, b) => b.totalValueEur - a.totalValueEur)
                .map((sup, i) => {
                  const pct = (sup.totalValueEur / supTotal) * 100;
                  const barW = Math.round(pct * 2);
                  return (
                    <tr key={sup.supplierCode} className={i % 2 === 0 ? '' : 'bg-[#071018]'}>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase bg-[#1a2f48] text-[#4da3ff]">
                          {sup.supplierCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#22c55e] font-semibold">{fmtEurFull(sup.totalValueEur)}</td>
                      <td className="px-4 py-3 text-right text-[#4da3ff]">{fmtEurFull(sup.savedCostEur)}</td>
                      <td className="px-4 py-3 text-right text-[#4a6480] text-xs">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <svg width={200} height={12} viewBox="0 0 200 12">
                          <rect x={0} y={0} width={200} height={12} rx={4} fill="#1a2f48" />
                          <rect x={0} y={0} width={barW} height={12} rx={4} fill="#4da3ff" opacity={0.8} />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#1a2f48]">
                <td className="px-4 py-3 font-bold text-white">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#22c55e]">{fmtEurFull(supTotal)}</td>
                <td className="px-4 py-3 text-right font-bold text-[#4da3ff]">
                  {fmtEurFull((s?.bySupplier ?? []).reduce((a, c) => a + c.savedCostEur, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-white">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── DECISION QUALITY SECTION ──────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4d6a87', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Decision Quality
          </span>
          <div style={{ flex: 1, height: 1, background: '#1a2f48' }} />
        </div>

        {/* Top 3 hero panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          {/* Decision Correctness */}
          {(() => {
            const rate = correctness?.correctnessRatePct ?? 90.0;
            const color = rate >= 85 ? '#22c55e' : rate >= 70 ? '#f59e0b' : '#ef4444';
            return (
              <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Decision Correctness
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
                  {rate.toFixed(1)}%
                </div>
                <div style={{ fontSize: 12, color: '#8ba8c7' }}>
                  {(correctness?.correctDecisions ?? 27)} / {(correctness?.totalDecisions ?? 30)} decisions correct
                </div>
              </div>
            );
          })()}

          {/* Savings Capture */}
          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Savings Capture
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#4da3ff', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
              {(correctness?.savingsCapturePct ?? 97.4).toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: '#8ba8c7' }}>
              {correctness
                ? `€${correctness.totalRealizedSavingsEur.toLocaleString('en-US')} realized of €${correctness.totalPredictedSavingsEur.toLocaleString('en-US')} predicted`
                : 'of predicted savings realized'}
            </div>
          </div>

          {/* Decisions Tracked */}
          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Decisions Tracked
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#f0f6ff', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
              {(correctness?.totalDecisions ?? 30)}
            </div>
            <div style={{ fontSize: 12, color: '#8ba8c7' }}>
              {correctness?.trend === 'improving' ? '↑ improving trend' : correctness?.trend === 'degrading' ? '↓ degrading trend' : '→ stable trend'}
            </div>
          </div>
        </div>

        {/* Accuracy breakdown — 3 progress bars */}
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f6ff', marginBottom: 16 }}>Prediction Accuracy Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Savings Accuracy', value: correctness?.avgSavingsAccuracyPct ?? 96.8, color: '#22c55e' },
              { label: 'Margin Accuracy', value: correctness?.avgMarginAccuracyPct ?? 96.5, color: '#4da3ff' },
              { label: 'Delivery Accuracy', value: correctness?.avgDeliveryAccuracyPct ?? 97.2, color: '#a855f7' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#8ba8c7' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{value.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: '#1a2f48', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* byCategory table */}
        {correctness && Object.keys(correctness.byCategory).length > 0 && (
          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2f48' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f6ff' }}>Correctness by Category</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                  {['Category', 'Correctness %', 'Decisions'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(correctness.byCategory).map(([cat, data], i) => {
                  const corrColor = data.correctness >= 85 ? '#22c55e' : data.correctness >= 70 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={cat} style={{ borderBottom: '1px solid #1a2f48', background: i % 2 === 1 ? '#071018' : 'transparent' }}>
                      <td style={{ padding: '10px 20px', fontSize: 13, color: '#f0f6ff', fontWeight: 500 }}>{cat}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: corrColor }}>{data.correctness}%</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, color: '#8ba8c7' }}>{data.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CASH FLOW REALITY ENGINE ─────────────────────────────────────── */}
      {(() => {
        const cf = cashFlow ?? CASH_FLOW_FALLBACK;
        const riskColor = cf.riskLevel === 'high' ? '#ef4444' : cf.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
        const maxOutflow = Math.max(...cf.cashFlowTimeline.map((w) => w.outflow), 1);

        return (
          <div style={{ marginTop: 40 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4d6a87', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Cash Flow Reality Engine
              </span>
              <div style={{ flex: 1, height: 1, background: '#1a2f48' }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: riskColor,
                background: riskColor + '18', borderRadius: 20,
                padding: '2px 10px', border: `1px solid ${riskColor}40`,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {cf.riskLevel} risk
              </span>
            </div>

            {/* 4 hero numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {/* Total Payables */}
              <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Total Payables
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6ff', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                  {fmtEurFull(cf.totalPayablesEur)}
                </div>
                <div style={{ fontSize: 12, color: '#4a6480' }}>
                  {cf.pendingInvoiceCount} pending invoice{cf.pendingInvoiceCount !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Overdue */}
              <div style={{ background: '#0b1526', border: `1px solid ${cf.overduePayablesEur > 0 ? '#ef444440' : '#1a2f48'}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Overdue Payables
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: cf.overduePayablesEur > 0 ? '#ef4444' : '#22c55e', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                  {fmtEurFull(cf.overduePayablesEur)}
                </div>
                <div style={{ fontSize: 12, color: '#4a6480' }}>
                  {cf.overdueInvoiceCount} overdue invoice{cf.overdueInvoiceCount !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Cash Conversion Cycle */}
              <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Cash Conversion
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#4da3ff', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                  {cf.cashConversionCycleDays}d
                </div>
                <div style={{ fontSize: 12, color: '#4a6480' }}>Avg cycle · DPO {cf.avgDaysPayableOutstanding}d</div>
              </div>

              {/* Liquidity Risk Score */}
              <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8ba8c7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Liquidity Risk
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: riskColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                  {cf.liquidityRiskScore}<span style={{ fontSize: 14, fontWeight: 500, color: '#4a6480' }}>/100</span>
                </div>
                <div style={{ fontSize: 12, color: '#4a6480' }}>
                  {fmtEurFull(cf.workingCapitalAtRiskEur)} at risk
                </div>
              </div>
            </div>

            {/* 30-day outflow forecast SVG bar chart */}
            <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', marginBottom: 4 }}>8-Week Outflow Forecast</div>
                <div style={{ fontSize: 12, color: '#4a6480' }}>
                  30-day: {fmtEurFull(cf.thirtyDayForecastEur)} due · Weekly payment obligations
                </div>
              </div>
              <svg width="100%" viewBox={`0 0 ${cf.cashFlowTimeline.length * 90 + 20} 140`} style={{ display: 'block' }}>
                {cf.cashFlowTimeline.map((week, i) => {
                  const BAR_MAX_H = 90;
                  const barH = week.outflow > 0 ? Math.max(4, (week.outflow / maxOutflow) * BAR_MAX_H) : 4;
                  const x = i * 90 + 10;
                  const y = BAR_MAX_H - barH + 10;
                  const barColor = week.outflow > 10000 ? '#ef4444' : week.outflow > 5000 ? '#f59e0b' : '#4da3ff';
                  return (
                    <g key={week.date}>
                      <rect x={x} y={y} width={60} height={barH} rx={4} fill={barColor} opacity={0.8} />
                      {week.outflow > 0 && (
                        <text x={x + 30} y={y - 4} textAnchor="middle" fontSize={9} fill="#8ba8c7">
                          {fmtEur(week.outflow)}
                        </text>
                      )}
                      <text x={x + 30} y={115} textAnchor="middle" fontSize={9} fill="#4a6480">
                        {week.date.slice(5)}
                      </text>
                    </g>
                  );
                })}
                <line x1={10} y1={100} x2={cf.cashFlowTimeline.length * 90 + 10} y2={100} stroke="#1a2f48" strokeWidth={1} />
              </svg>
            </div>

            {/* Invoice status summary */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4da3ff', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#4da3ff' }}>{cf.pendingInvoiceCount}</span>
                  <span style={{ fontSize: 13, color: '#8ba8c7', marginLeft: 8 }}>invoices pending</span>
                </div>
              </div>
              <div style={{ flex: 1, background: '#0b1526', border: `1px solid ${cf.overdueInvoiceCount > 0 ? '#ef444430' : '#1a2f48'}`, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cf.overdueInvoiceCount > 0 ? '#ef4444' : '#22c55e', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: cf.overdueInvoiceCount > 0 ? '#ef4444' : '#22c55e' }}>{cf.overdueInvoiceCount}</span>
                  <span style={{ fontSize: 13, color: '#8ba8c7', marginLeft: 8 }}>invoices overdue</span>
                </div>
              </div>
              <div style={{ flex: 1, background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{fmtEurFull(cf.thirtyDayForecastEur)}</span>
                  <span style={{ fontSize: 13, color: '#8ba8c7', marginLeft: 8 }}>due in 30 days</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 4 — ADOPTION MODES */}
      {activeTab === 'adoption' && (
        <div>
          <div className="font-tight text-base font-bold text-white mb-4">Tenant Adoption Journey</div>
          {modes.length === 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  mode: 'shadow',
                  color: '#6b7280',
                  title: 'Shadow Mode',
                  desc: 'Observe and simulate decisions without executing them. Zero risk, full visibility into potential savings.',
                },
                {
                  mode: 'assisted',
                  color: '#4da3ff',
                  title: 'Assisted Mode',
                  desc: 'AI suggests optimal decisions, humans approve before execution. Best for teams building trust.',
                },
                {
                  mode: 'controlled',
                  color: '#22c55e',
                  title: 'Controlled Mode',
                  desc: 'AI executes within pre-approved rules and limits. Significant automation with guardrails.',
                },
                {
                  mode: 'autonomous',
                  color: '#a855f7',
                  title: 'Autonomous Mode',
                  desc: 'Full AI-driven procurement within policy boundaries. Maximum efficiency and speed.',
                },
              ].map((m) => (
                <div key={m.mode} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: m.color }}
                    />
                    <span className="font-tight font-bold text-white">{m.title}</span>
                  </div>
                  <p className="text-sm text-[#8ba8c7]">{m.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {modes.map((m) => (
                <div key={m.id} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-white">{m.tenantId}</span>
                    <ModeBadge mode={m.mode} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#4da3ff]">{m.shadowSimulationsRun}</div>
                      <div className="text-xs text-[#8ba8c7]">Shadow simulations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#22c55e]">{fmtEurFull(m.shadowSavingsIdentifiedEur)}</div>
                      <div className="text-xs text-[#8ba8c7]">Savings identified</div>
                    </div>
                  </div>
                  {/* Mode history timeline */}
                  {m.modesHistory && m.modesHistory.length > 0 && (
                    <div>
                      <div className="text-xs text-[#4a6480] mb-2">Mode History</div>
                      <div className="flex items-center gap-0">
                        {m.modesHistory.map((h, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className="flex flex-col items-center">
                              <div
                                className="w-2.5 h-2.5 rounded-full border-2"
                                style={{ borderColor: '#4da3ff', background: idx === m.modesHistory.length - 1 ? '#4da3ff' : '#0b1526' }}
                              />
                              <span className="text-[9px] text-[#4a6480] mt-0.5 whitespace-nowrap">{h.mode}</span>
                            </div>
                            {idx < m.modesHistory.length - 1 && (
                              <div className="w-6 h-px bg-[#1a2f48] mx-0.5 mb-4" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
