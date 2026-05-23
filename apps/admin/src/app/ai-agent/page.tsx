'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : ''}`,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuggestedProduct {
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  supplierId: string;
  supplierName: string;
  estimatedProductionDays: number;
}

interface RiskFactor {
  factor: string;
  impact: string;
  mitigation: string;
}

interface ProcurementPlan {
  id: string;
  briefId: string;
  recommendedSupplier: string;
  fallbackSupplier: string | null;
  routingConfidence: string | number;
  routingReason: string;
  suggestedProducts: unknown;
  unitCost: string | number | null;
  quantity: number | null;
  totalProductCost: string | number | null;
  estimatedShipping: string | number | null;
  printCost: string | number | null;
  platformFee: string | number | null;
  totalCost: string | number | null;
  salePriceRecommended: string | number | null;
  expectedMarginPct: string | number | null;
  productionDays: number | null;
  shippingDays: number | null;
  totalDays: number | null;
  deliveryDateEstimate: string | null;
  meetsDeadline: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: unknown;
  confidenceScore: string | number;
  aiReasoning: string | null;
  aiRecommendations: string[];
  aiWarnings: string[];
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface ProcurementBrief {
  id: string;
  tenantId: string;
  description: string;
  parsedQuantity: number | null;
  parsedBudgetEur: string | number | null;
  parsedDestination: string | null;
  parsedTimelineDays: number | null;
  parsedUrgency: string;
  parsedCategory: string | null;
  parsedKeywords: string[];
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  plan: ProcurementPlan | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(val: string | number | null | undefined, decimals = 2): string {
  if (val == null) return '—';
  return Number(val).toFixed(decimals);
}

function fmtEur(val: string | number | null | undefined): string {
  if (val == null) return '—';
  return `€${Number(val).toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; pulse?: boolean }> = {
    processing: { color: 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40', label: 'Processing', pulse: true },
    planned: { color: 'bg-[#4da3ff]/20 text-[#4da3ff] border border-[#4da3ff]/40', label: 'Planned' },
    approved: { color: 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40', label: 'Approved' },
    executing: { color: 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40', label: 'Executing' },
    failed: { color: 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40', label: 'Failed' },
  };
  const c = config[status] ?? { color: 'bg-[#1a2f48] text-[#4d6a87]', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.color}`}>
      {c.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#f59e0b]" />
        </span>
      )}
      {c.label}
    </span>
  );
}

// ─── Confidence Gauge ────────────────────────────────────────────────────────

function ConfidenceGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = 42;
  const cx = 60;
  const cy = 56;
  const circumference = Math.PI * radius;
  const fillLength = (clamped / 100) * circumference;
  const gapLength = circumference - fillLength;

  const describeArc = (r: number) =>
    `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70" fill="none">
        <path d={describeArc(radius)} stroke="#1a2f48" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path
          d={describeArc(radius)}
          stroke="#a855f7"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${gapLength + 1}`}
          fill="none"
        />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="20" fontWeight="700">
          {Math.round(clamped)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#4d6a87" fontSize="9" fontWeight="500">
          CONFIDENCE
        </text>
      </svg>
    </div>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40',
    medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
    high: 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[level] ?? map['low']}`}>
      {level} risk
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-[#1a2f48] rounded-xl w-1/2" />
      <div className="h-24 bg-[#1a2f48] rounded-xl" />
      <div className="h-32 bg-[#1a2f48] rounded-xl" />
      <div className="h-20 bg-[#1a2f48] rounded-xl" />
      <div className="h-16 bg-[#1a2f48] rounded-xl" />
    </div>
  );
}

// ─── Plan View ───────────────────────────────────────────────────────────────

function PlanView({
  brief,
  onApprove,
  approving,
}: {
  brief: ProcurementBrief;
  onApprove: (planId: string) => void;
  approving: boolean;
}) {
  const plan = brief.plan;
  if (!plan) return null;

  const products = Array.isArray(plan.suggestedProducts)
    ? (plan.suggestedProducts as SuggestedProduct[])
    : (plan.suggestedProducts as unknown as SuggestedProduct[]) ?? [];

  const riskFactors = Array.isArray(plan.riskFactors)
    ? (plan.riskFactors as RiskFactor[])
    : [];

  const confidence = Number(plan.confidenceScore);
  const margin = Number(plan.expectedMarginPct);
  const routingConf = Number(plan.routingConfidence);

  const marginColor = margin > 20 ? '#22c55e' : margin > 15 ? '#f59e0b' : '#ef4444';

  const deliveryStr = plan.deliveryDateEstimate
    ? new Date(plan.deliveryDateEstimate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#f0f6ff]">Procurement Plan</h2>
          <p className="text-[12px] text-[#4d6a87] mt-0.5 font-mono">{plan.id.slice(0, 16)}…</p>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge level={plan.riskLevel} />
          <StatusBadge status={brief.status} />
        </div>
      </div>

      {/* Confidence + Routing */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 flex items-center gap-6">
        <ConfidenceGauge score={confidence} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-semibold text-[#f0f6ff]">{plan.recommendedSupplier}</span>
            <span className="text-[11px] text-[#4d6a87]">Primary Supplier</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#a855f7] transition-all"
                style={{ width: `${routingConf}%` }}
              />
            </div>
            <span className="text-[12px] text-[#a855f7] font-semibold">{Math.round(routingConf)}%</span>
          </div>
          <p className="text-[12px] text-[#4d6a87] italic leading-relaxed">{plan.routingReason}</p>
          {plan.fallbackSupplier && (
            <p className="text-[11px] text-[#4d6a87] mt-1">
              Fallback: <span className="text-[#8ba3be]">{plan.fallbackSupplier}</span>
            </p>
          )}
        </div>
      </div>

      {/* Financials */}
      <div className="bg-[#102131] border border-[#1a2f48] rounded-xl p-4">
        <h3 className="text-[12px] font-semibold text-[#4d6a87] uppercase tracking-wider mb-3">Financial Summary</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Product Cost', val: fmtEur(plan.totalProductCost) },
            { label: 'Print Cost', val: fmtEur(plan.printCost) },
            { label: 'Shipping', val: fmtEur(plan.estimatedShipping) },
            { label: 'Platform Fee (8%)', val: fmtEur(plan.platformFee) },
            { label: 'Total Cost', val: fmtEur(plan.totalCost), bold: true },
            { label: 'Recommended Price', val: fmtEur(plan.salePriceRecommended), accent: true },
          ].map(({ label, val, bold, accent }) => (
            <div key={label} className="bg-[#0b1526] rounded-lg p-3">
              <p className="text-[10px] text-[#4d6a87] mb-1">{label}</p>
              <p
                className={`text-[14px] font-bold ${
                  accent ? 'text-[#4da3ff]' : bold ? 'text-[#f0f6ff]' : 'text-[#8ba3be]'
                }`}
              >
                {val}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-3 border-t border-[#1a2f48]">
          <span className="text-[12px] text-[#4d6a87]">Expected Margin</span>
          <span className="text-[22px] font-bold" style={{ color: marginColor }}>
            {fmt(plan.expectedMarginPct, 1)}%
          </span>
          <span className="text-[11px] text-[#4d6a87]">
            {margin > 20 ? 'Healthy' : margin > 15 ? 'Acceptable' : 'Below target'}
          </span>
        </div>
      </div>

      {/* Suggested Products */}
      {products.length > 0 && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
          <h3 className="text-[12px] font-semibold text-[#4d6a87] uppercase tracking-wider mb-3">Suggested Products</h3>
          <div className="space-y-2">
            {products.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-[#102131] rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#f0f6ff] truncate">{p.name}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-[#a855f7]/20 text-[#a855f7] text-[10px] font-semibold rounded-full border border-[#a855f7]/30 capitalize">
                    {p.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold text-[#4da3ff]">€{p.unitPrice.toFixed(2)}</p>
                  <p className="text-[11px] text-[#4d6a87]">× {p.quantity} units</p>
                  <p className="text-[11px] text-[#22c55e] font-semibold">
                    = €{(p.unitPrice * p.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
        <h3 className="text-[12px] font-semibold text-[#4d6a87] uppercase tracking-wider mb-4">Delivery Timeline</h3>
        <div className="flex items-center gap-0">
          {[
            { icon: '🏭', label: 'Production', days: plan.productionDays, color: '#4da3ff' },
            { icon: '🚚', label: 'Shipping', days: plan.shippingDays, color: '#a855f7' },
          ].map((step, i) => (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className="flex-1 bg-[#102131] rounded-xl px-3 py-3 text-center">
                <span className="text-[18px]">{step.icon}</span>
                <p className="text-[11px] text-[#4d6a87] mt-1">{step.label}</p>
                <p className="text-[15px] font-bold" style={{ color: step.color }}>
                  {step.days ?? '—'}d
                </p>
              </div>
              <div className="w-6 h-0.5 bg-[#1a2f48] shrink-0" />
            </div>
          ))}
          <div className="flex-1 bg-[#102131] rounded-xl px-3 py-3 text-center">
            <span className="text-[18px]">📦</span>
            <p className="text-[11px] text-[#4d6a87] mt-1">Delivery</p>
            <p className="text-[13px] font-bold text-[#f0f6ff]">{deliveryStr}</p>
          </div>
          <div className="ml-3 shrink-0">
            {plan.meetsDeadline ? (
              <div className="flex items-center gap-1.5 text-[#22c55e] text-[12px] font-semibold">
                <span className="text-[16px]">✓</span> On time
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[#ef4444] text-[12px] font-semibold">
                <span className="text-[16px]">✗</span> Late
              </div>
            )}
            <p className="text-[11px] text-[#4d6a87]">{plan.totalDays ?? '—'} days total</p>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
        <h3 className="text-[12px] font-semibold text-[#4d6a87] uppercase tracking-wider mb-3">Risk Assessment</h3>
        {riskFactors.length === 0 ? (
          <div className="flex items-center gap-2 text-[#22c55e] text-[13px]">
            <span>✓</span> No significant risks detected
          </div>
        ) : (
          <div className="space-y-2">
            {riskFactors.map((rf, i) => (
              <div key={i} className="bg-[#102131] rounded-lg p-3">
                <p className="text-[13px] font-bold text-[#f0f6ff] mb-1">{rf.factor}</p>
                <p className="text-[12px] text-[#f59e0b] mb-1">⚠ {rf.impact}</p>
                <p className="text-[12px] text-[#22c55e]">→ {rf.mitigation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="bg-[#0b1526] border border-[#a855f7]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[16px]">✦</span>
          <span className="text-[13px] font-semibold text-[#a855f7]">AI Analysis</span>
        </div>
        {plan.aiReasoning && (
          <p className="text-[13px] text-[#8ba3be] leading-relaxed mb-3">{plan.aiReasoning}</p>
        )}
        {plan.aiRecommendations.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-[#4d6a87] font-semibold uppercase tracking-wider mb-2">Recommendations</p>
            <ul className="space-y-1">
              {plan.aiRecommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-[#8ba3be]">
                  <span className="text-[#22c55e] mt-0.5 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.aiWarnings.length > 0 && (
          <div>
            <p className="text-[11px] text-[#4d6a87] font-semibold uppercase tracking-wider mb-2">Warnings</p>
            <ul className="space-y-1">
              {plan.aiWarnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-[#8ba3be]">
                  <span className="text-[#f59e0b] mt-0.5 shrink-0">▲</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        {!plan.isApproved && brief.status !== 'failed' && (
          <button
            onClick={() => onApprove(plan.id)}
            disabled={approving}
            className="px-5 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {approving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Approving…
              </>
            ) : (
              '✓ Approve Plan'
            )}
          </button>
        )}
        {plan.isApproved && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl text-[#22c55e] text-[13px] font-semibold">
            <span>✓</span> Approved {plan.approvedBy ? `by ${plan.approvedBy}` : ''}
          </div>
        )}
        <Link
          href="/quotes"
          className="px-4 py-2.5 bg-[#102131] hover:bg-[#1a2f48] border border-[#1a2f48] hover:border-[#4da3ff]/40 text-[#4da3ff] text-[13px] font-semibold rounded-xl transition-colors"
        >
          Generate Quote
        </Link>
        <Link
          href="/workflows"
          className="px-4 py-2.5 bg-[#102131] hover:bg-[#1a2f48] border border-[#1a2f48] hover:border-[#a855f7]/40 text-[#a855f7] text-[13px] font-semibold rounded-xl transition-colors"
        >
          Create Workflow
        </Link>
        {brief.status === 'failed' && (
          <button
            onClick={() => {/* retry via parent */}}
            className="px-4 py-2.5 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 border border-[#ef4444]/40 text-[#ef4444] text-[13px] font-semibold rounded-xl transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Brief Card ───────────────────────────────────────────────────────────────

function BriefCard({
  brief,
  selected,
  onClick,
}: {
  brief: ProcurementBrief;
  selected: boolean;
  onClick: () => void;
}) {
  const truncated =
    brief.description.length > 60
      ? brief.description.slice(0, 60) + '…'
      : brief.description;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? 'border-[#a855f7] bg-[#a855f7]/10'
          : 'border-[#1a2f48] bg-[#0b1526] hover:border-[#1f3855]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[12px] text-[#f0f6ff] font-medium leading-snug">{truncated}</p>
        <StatusBadge status={brief.status} />
      </div>
      <div className="flex items-center gap-2">
        {brief.parsedCategory && (
          <span className="text-[10px] px-1.5 py-0.5 bg-[#102131] text-[#4d6a87] rounded border border-[#1a2f48] capitalize">
            {brief.parsedCategory.replace('_', ' ')}
          </span>
        )}
        {brief.parsedQuantity && (
          <span className="text-[10px] text-[#4d6a87]">×{brief.parsedQuantity}</span>
        )}
        <span className="text-[10px] text-[#4d6a87] ml-auto">{timeAgo(brief.createdAt)}</span>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiAgentPage() {
  const [briefs, setBriefs] = useState<ProcurementBrief[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [approving, setApproving] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const selectedBrief = briefs.find((b) => b.id === selectedBriefId) ?? null;

  // ── Fetch brief list ──────────────────────────────────────────────────────

  const fetchBriefs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/procurement-agent/briefs?limit=30`, {
        headers: AUTH_HEADERS,
      });
      if (!res.ok) return;
      const data = (await res.json()) as ProcurementBrief[];
      setBriefs(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    void fetchBriefs();
    refreshRef.current = setInterval(() => void fetchBriefs(), 30_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [fetchBriefs]);

  // ── Poll single brief until plan ready ────────────────────────────────────

  const startPolling = useCallback(
    (briefId: string) => {
      pollCountRef.current = 0;
      setLoadingPlan(true);

      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        try {
          const res = await fetch(
            `${API_BASE}/api/v1/procurement-agent/briefs/${briefId}`,
            { headers: AUTH_HEADERS },
          );
          if (!res.ok) return;
          const data = (await res.json()) as ProcurementBrief;

          // Update in list
          setBriefs((prev) =>
            prev.map((b) => (b.id === briefId ? data : b)),
          );

          if (data.status !== 'processing') {
            setLoadingPlan(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {
          // ignore
        }

        // Stop after 30s (15 × 2s)
        if (pollCountRef.current >= 15) {
          setLoadingPlan(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 2_000);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Submit brief ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!inputText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/procurement-agent/briefs`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ description: inputText.trim() }),
      });
      if (!res.ok) throw new Error('Failed to submit brief');
      const brief = (await res.json()) as ProcurementBrief;
      setBriefs((prev) => [{ ...brief, plan: null }, ...prev]);
      setSelectedBriefId(brief.id);
      setInputText('');
      startPolling(brief.id);
    } catch {
      // silently ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit();
    }
  };

  // ── Select brief ──────────────────────────────────────────────────────────

  const handleSelectBrief = (brief: ProcurementBrief) => {
    setSelectedBriefId(brief.id);
    if (brief.status === 'processing') {
      startPolling(brief.id);
    } else {
      setLoadingPlan(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  };

  // ── Approve plan ──────────────────────────────────────────────────────────

  const handleApprove = async (planId: string) => {
    setApproving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/procurement-agent/plans/${planId}/approve`,
        {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({ approvedBy: 'admin' }),
        },
      );
      if (res.ok) {
        await fetchBriefs();
        if (selectedBriefId) {
          const r = await fetch(
            `${API_BASE}/api/v1/procurement-agent/briefs/${selectedBriefId}`,
            { headers: AUTH_HEADERS },
          );
          if (r.ok) {
            const data = (await r.json()) as ProcurementBrief;
            setBriefs((prev) => prev.map((b) => (b.id === data.id ? data : b)));
          }
        }
      }
    } catch {
      // silently ignore
    } finally {
      setApproving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Page header */}
      <div className="mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#a855f7]/20 border border-[#a855f7]/40 flex items-center justify-center text-[16px]">
            ✦
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#f0f6ff]">AI Procurement Agent</h1>
            <p className="text-[13px] text-[#4d6a87]">Powered by Procurement Intelligence</p>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* LEFT: Conversation + History */}
        <div className="w-2/5 flex flex-col min-h-0">
          {/* Brief history */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
            {briefs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#4d6a87] py-12">
                <span className="text-[32px] mb-3">✦</span>
                <p className="text-[14px] font-medium text-[#8ba3be]">No briefs yet</p>
                <p className="text-[12px] mt-1">Submit your first procurement brief below</p>
              </div>
            )}
            {briefs.map((brief) => (
              <BriefCard
                key={brief.id}
                brief={brief}
                selected={brief.id === selectedBriefId}
                onClick={() => handleSelectBrief(brief)}
              />
            ))}
          </div>

          {/* Input area */}
          <div className="shrink-0 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-3">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Describe your procurement need...\n\nExample: "Prepare onboarding kits for 120 employees in Dubai. Luxury perception. Budget €14k. Deliver within 9 days."`}
              className="w-full bg-[#102131] border border-[#1a2f48] rounded-xl px-4 py-3 text-[14px] text-[#f0f6ff] placeholder:text-[#4d6a87] resize-none min-h-[100px] focus:border-[#4da3ff] focus:outline-none transition-colors"
              disabled={submitting}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-[#4d6a87]">⌘+Enter to submit</p>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || !inputText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-lg transition-colors"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    Send
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7h12M8 2l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Plan View */}
        <div className="w-3/5 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 overflow-y-auto">
          {!selectedBriefId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-[28px] mb-4">
                ✦
              </div>
              <h3 className="text-[16px] font-semibold text-[#8ba3be] mb-2">
                Submit a procurement brief
              </h3>
              <p className="text-[13px] text-[#4d6a87] max-w-xs leading-relaxed">
                Describe your need in natural language and the AI will generate a complete procurement plan instantly.
              </p>
            </div>
          )}

          {selectedBriefId && loadingPlan && !selectedBrief?.plan && <PlanSkeleton />}

          {selectedBriefId && selectedBrief?.status === 'processing' && !selectedBrief.plan && !loadingPlan && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="inline-block w-8 h-8 border-2 border-[#a855f7]/30 border-t-[#a855f7] rounded-full animate-spin mb-4" />
              <p className="text-[14px] text-[#8ba3be] font-medium">Generating plan…</p>
              <p className="text-[12px] text-[#4d6a87] mt-1">This usually takes under 5 seconds</p>
            </div>
          )}

          {selectedBriefId && selectedBrief?.status === 'failed' && !selectedBrief.plan && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-[32px] mb-3">✗</span>
              <p className="text-[14px] text-[#ef4444] font-medium mb-1">Plan generation failed</p>
              {selectedBrief.errorMessage && (
                <p className="text-[12px] text-[#4d6a87] max-w-xs">{selectedBrief.errorMessage}</p>
              )}
              <button
                onClick={() => {
                  if (selectedBriefId) startPolling(selectedBriefId);
                }}
                className="mt-4 px-4 py-2 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 border border-[#ef4444]/40 text-[#ef4444] text-[13px] font-semibold rounded-xl transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {selectedBrief && selectedBrief.plan && (
            <PlanView
              brief={selectedBrief}
              onApprove={(planId) => void handleApprove(planId)}
              approving={approving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
