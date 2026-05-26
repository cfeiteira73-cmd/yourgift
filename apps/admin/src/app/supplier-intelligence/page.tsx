'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupplierEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  category: string;
  reliabilityScore: string | number;
  priceScore: string | number;
  leadTimeDays: number;
  minOrderValue: string | number;
  maxOrderValue: string | number | null;
  supportedRegions: string[];
  isActive: boolean;
  lastUpdated: string;
  recentOutcomes: LearningOutcomeEntry[];
  totalLearnings: number;
  avgScoreDelta: number;
}

interface LearningOutcomeEntry {
  id: string;
  supplierId: string | null;
  metricName: string;
  actualValue: string | number;
  expectedValue: string | number | null;
  delta: string | number | null;
  outcomeType: string;
  createdAt: string;
}

interface RoutingRule {
  id: string;
  region: string;
  countries: string[];
  preferredSuppliers: string[];
  maxLeadTimeDays: number;
  preferredCurrency: string;
  isActive: boolean;
}

// ─── SVG Gauge ──────────────────────────────────────────────────────────────

function ReliabilityGauge({ score }: { score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const radius = 42;
  const cx = 60;
  const cy = 56;
  const circumference = Math.PI * radius; // half circle arc length

  // Semicircle: start at left (180°), go to right (0°) clockwise
  const describeArc = (r: number) =>
    `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const fillLength = (clampedScore / 100) * circumference;
  const gapLength = circumference - fillLength;

  const color =
    clampedScore > 80 ? '#22c55e' : clampedScore > 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center my-3">
      <svg width="120" height="68" viewBox="0 0 120 68" fill="none">
        {/* Background arc */}
        <path
          d={describeArc(radius)}
          stroke="#1a2f48"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        {/* Foreground arc */}
        <path
          d={describeArc(radius)}
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${gapLength + 1}`}
          fill="none"
        />
        {/* Score label */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="white"
          fontSize="18"
          fontWeight="700"
        >
          {Math.round(clampedScore)}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#4d6a87"
          fontSize="9"
          fontWeight="500"
        >
          RELIABILITY
        </text>
      </svg>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 space-y-4">
      <div className="skeleton rounded h-4 w-2/3" />
      <div className="skeleton rounded h-16 w-full" />
      <div className="skeleton rounded h-3 w-full" />
      <div className="skeleton rounded h-3 w-4/5" />
    </div>
  );
}

// ─── Supplier Card ──────────────────────────────────────────────────────────

function SupplierCard({ supplier }: { supplier: SupplierEntry }) {
  const reliability = Number(supplier.reliabilityScore);
  const price = Number(supplier.priceScore);
  const delta = supplier.avgScoreDelta;
  const deltaPositive = delta >= 0;

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 hover:border-[#1f3855] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{supplier.supplierName}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
            {supplier.category}
          </span>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 ${supplier.isActive ? 'text-[#22c55e]' : 'text-[#4d6a87]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${supplier.isActive ? 'bg-[#22c55e]' : 'bg-[#4d6a87]'}`} />
          {supplier.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* SVG Gauge */}
      <ReliabilityGauge score={reliability} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-[#07111f] rounded-lg p-2">
          <p className="text-[10px] text-[#4d6a87] font-medium mb-0.5">Lead Time</p>
          <p className="text-white text-xs font-bold">{supplier.leadTimeDays}d</p>
        </div>
        <div className="bg-[#07111f] rounded-lg p-2">
          <p className="text-[10px] text-[#4d6a87] font-medium mb-0.5">Min Order</p>
          <p className="text-white text-xs font-bold">€{Number(supplier.minOrderValue).toFixed(0)}</p>
        </div>
        <div className="bg-[#07111f] rounded-lg p-2">
          <p className="text-[10px] text-[#4d6a87] font-medium mb-0.5">Price Score</p>
          <p className="text-white text-xs font-bold">{Math.round(price)}</p>
        </div>
      </div>

      {/* Score trend */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-[#4d6a87]">30d trend</span>
        <span className={`text-xs font-bold ${deltaPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {deltaPositive ? '▲' : '▼'} {deltaPositive ? '+' : ''}{delta.toFixed(1)} pts
        </span>
      </div>

      {/* Supported regions */}
      {supplier.supportedRegions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {supplier.supportedRegions.slice(0, 6).map((region) => (
            <span
              key={region}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#102131] text-[#8ba8c7] border border-[#1a2f48]"
            >
              {region}
            </span>
          ))}
          {supplier.supportedRegions.length > 6 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] text-[#4d6a87]">
              +{supplier.supportedRegions.length - 6}
            </span>
          )}
        </div>
      )}

      {/* Learnings count */}
      {supplier.totalLearnings > 0 && (
        <p className="mt-2 text-[10px] text-[#4d6a87]">
          {supplier.totalLearnings} learning outcome{supplier.totalLearnings !== 1 ? 's' : ''} this month
        </p>
      )}
    </div>
  );
}

// ─── Routing Decision Card ───────────────────────────────────────────────────

function RoutingDecisionCard({ suppliers }: { suppliers: SupplierEntry[] }) {
  if (suppliers.length === 0) {
    return (
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 text-center text-[#4d6a87] text-sm">
        No active suppliers in routing matrix.
      </div>
    );
  }

  // Pick best supplier (highest reliability)
  const best = suppliers.reduce((a, b) =>
    Number(a.reliabilityScore) > Number(b.reliabilityScore) ? a : b,
  );

  const reliability = Number(best.reliabilityScore);
  const price = Number(best.priceScore);
  const leadTimeScore = Math.max(0, 100 - best.leadTimeDays * 5);

  const bars = [
    { label: 'Reliability', value: reliability, weight: '40%', color: '#22c55e' },
    { label: 'Price Score', value: price, weight: '35%', color: '#4da3ff' },
    { label: 'Lead Time', value: leadTimeScore, weight: '25%', color: '#a855f7' },
  ];

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 7h10M9 4l3 3-3 3" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] text-[#4d6a87] font-semibold uppercase tracking-wide">Optimal Supplier Selected</p>
          <p className="text-white font-bold text-base">{best.supplierName}</p>
        </div>
      </div>

      <p className="text-[#8ba8c7] text-xs italic mb-4">
        Best composite score for category <span className="text-[#4da3ff] not-italic font-semibold">{best.category}</span>
        — reliability {Math.round(reliability)}%, price score {Math.round(price)}, lead time {best.leadTimeDays}d.
      </p>

      <div className="mb-4">
        <p className="text-[10px] text-[#4d6a87] font-semibold uppercase tracking-wide mb-3">Why this supplier?</p>
        <div className="space-y-2.5">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#8ba8c7]">{bar.label}</span>
                <span className="text-[#4d6a87]">weight {bar.weight}</span>
              </div>
              <div className="h-2 rounded-full bg-[#07111f] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, bar.value)}%`, backgroundColor: bar.color }}
                />
              </div>
              <div className="text-right text-[10px] mt-0.5" style={{ color: bar.color }}>
                {Math.round(bar.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {best.supportedRegions.slice(0, 4).map((r) => (
          <span key={r} className="px-2 py-0.5 rounded-full text-[10px] bg-[#07111f] text-[#8ba8c7] border border-[#1a2f48]">
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Learning Timeline ───────────────────────────────────────────────────────

function LearningTimeline({ suppliers }: { suppliers: SupplierEntry[] }) {
  // Flatten and sort all outcomes across suppliers
  type OutcomeWithName = LearningOutcomeEntry & { supplierName: string };
  const allOutcomes: OutcomeWithName[] = suppliers
    .flatMap((s) =>
      s.recentOutcomes.map((o) => ({ ...o, supplierName: s.supplierName })),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  if (allOutcomes.length === 0) {
    return (
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 text-center text-[#4d6a87] text-sm">
        No learning outcomes recorded in the past 30 days.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allOutcomes.map((outcome) => {
        const delta = Number(outcome.delta ?? 0);
        const positive = delta >= 0;
        const date = new Date(outcome.createdAt);
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

        return (
          <div
            key={outcome.id}
            className="flex items-start gap-3 bg-[#0b1526] border border-[#1a2f48] rounded-lg p-3 hover:border-[#1f3855] transition-colors"
          >
            {/* Date pill */}
            <span className="flex-shrink-0 mt-0.5 px-2 py-1 rounded bg-[#07111f] text-[#4d6a87] text-[10px] font-mono">
              {dateStr}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white text-xs font-semibold truncate">{outcome.supplierName}</p>
                <span className={`flex-shrink-0 text-xs font-bold ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {positive ? '▲ +' : '▼ '}{delta.toFixed(1)} pts
                </span>
              </div>
              <p className="text-[#4d6a87] text-[11px] mt-0.5">
                {outcome.metricName} · actual {Number(outcome.actualValue).toFixed(2)}
                {outcome.expectedValue != null && ` / expected ${Number(outcome.expectedValue).toFixed(2)}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Regional Map ────────────────────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  EU: '#4da3ff',
  UK: '#a855f7',
  CH: '#06b6d4',
  MENA: '#f59e0b',
  NA: '#22c55e',
  APAC: '#f97316',
  LATAM: '#ec4899',
};

function RegionalCard({ rule }: { rule: RoutingRule }) {
  const color = REGION_COLORS[rule.region] ?? '#8ba8c7';

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 hover:border-[#1f3855] transition-colors">
      {/* Region header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-2xl font-black" style={{ color }}>
          {rule.region}
        </h3>
        <div className="flex gap-1.5">
          {rule.preferredCurrency && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold border"
              style={{ color, borderColor: `${color}30`, backgroundColor: `${color}10` }}
            >
              {rule.preferredCurrency}
            </span>
          )}
          {rule.maxLeadTimeDays && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#07111f] text-[#8ba8c7] border border-[#1a2f48]">
              ≤{rule.maxLeadTimeDays}d
            </span>
          )}
        </div>
      </div>

      {/* Countries */}
      {rule.countries && rule.countries.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1.5">Countries</p>
          <div className="flex flex-wrap gap-1">
            {rule.countries.slice(0, 8).map((c) => (
              <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-[#07111f] text-[#8ba8c7] border border-[#1a2f48]">
                {c}
              </span>
            ))}
            {rule.countries.length > 8 && (
              <span className="text-[10px] text-[#4d6a87] self-center">+{rule.countries.length - 8}</span>
            )}
          </div>
        </div>
      )}

      {/* Preferred suppliers */}
      {rule.preferredSuppliers && rule.preferredSuppliers.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1.5">Preferred Suppliers</p>
          <div className="space-y-1">
            {rule.preferredSuppliers.slice(0, 4).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] text-[#8ba8c7] truncate">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SupplierIntelligencePage() {
  const [suppliers, setSuppliers] = useState<SupplierEntry[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    const token =
      typeof window !== 'undefined' ? (localStorage.getItem('adminToken') ?? '') : '';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [suppliersRes, routingRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/automation/supplier-intelligence`, { headers }),
        fetch(`${API_BASE}/api/v1/globalization/routing`, { headers }),
      ]);

      if (suppliersRes.ok) {
        const data = (await suppliersRes.json()) as SupplierEntry[];
        setSuppliers(data);
      }
      if (routingRes.ok) {
        const data = (await routingRes.json()) as RoutingRule[];
        setRoutingRules(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail — network issue
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Supplier Intelligence Network</h1>
          <p className="text-[#4d6a87] text-sm mt-1">
            Real-time supplier performance, routing decisions, and learning outcomes
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] text-[#4d6a87]">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0b1526] border border-[#1a2f48] text-[#8ba8c7] hover:border-[#4da3ff] hover:text-[#4da3ff] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Section 1: Supplier Scorecards ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-white">Supplier Scorecards</h2>
          {!loading && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20 font-semibold">
              {suppliers.length} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center text-[#4d6a87] text-sm">
            No supplier routing entries found. Configure suppliers in the Automation module.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Routing Decision Explainer ── */}
      <section>
        <h2 className="text-base font-bold text-white mb-4">Routing Intelligence</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <RoutingDecisionCard suppliers={suppliers.filter((s) => s.isActive)} />
              <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6">
                <p className="text-[10px] text-[#4d6a87] font-semibold uppercase tracking-wide mb-3">
                  Scoring Weights (Default)
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'Reliability Score', weight: 40, color: '#22c55e', desc: 'Historical delivery accuracy & quality' },
                    { label: 'Price Score', weight: 35, color: '#4da3ff', desc: 'Competitive pricing vs market' },
                    { label: 'Lead Time Score', weight: 25, color: '#a855f7', desc: 'Speed of delivery (shorter = higher score)' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8ba8c7] font-medium">{item.label}</span>
                        <span className="font-bold" style={{ color: item.color }}>{item.weight}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#07111f] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.weight}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <p className="text-[10px] text-[#4d6a87] mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[#1a2f48]">
                  <p className="text-[11px] text-[#4d6a87]">
                    Weights shift when <span className="text-[#8ba8c7]">preferLowLeadTime</span> is active:
                    Reliability 35% · Price 30% · Lead Time 35%
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Section 3: Learning Loop Timeline ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-white">Autonomous Learning</h2>
          <p className="text-[#4d6a87] text-xs mt-0.5">
            Bayesian score updates from real delivery outcomes
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton rounded h-12" />
            ))}
          </div>
        ) : (
          <LearningTimeline suppliers={suppliers} />
        )}
      </section>

      {/* ── Section 4: Regional Performance Map ── */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-bold text-white">Regional Routing Rules</h2>
          <Link
            href="/globalization"
            className="text-xs text-[#4da3ff] hover:underline"
          >
            Manage rules →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : routingRules.length === 0 ? (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-8 text-center text-[#4d6a87] text-sm">
            No regional routing rules configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {routingRules.map((rule) => (
              <RegionalCard key={rule.id ?? rule.region} rule={rule} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
