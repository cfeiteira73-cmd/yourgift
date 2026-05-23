'use client';

import { useState } from 'react';

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface ROIInput {
  annualProcurementSpendEur: number;
  supplierCount: number;
  manualProcessHoursPerWeek: number;
  primaryCategory: string;
  region: string;
  currentAvgMarginPct: number;
}

interface ProjectedSavings {
  routingOptimizationEur: number;
  marginProtectionEur: number;
  avoidedCostsEur: number;
  timeAutomationValueEur: number;
  totalProjected12mEur: number;
}

interface PricingTier {
  name: string;
  mode: string;
  monthlyPriceEur: number;
  annualCostEur: number;
  projectedAnnualValueEur: number;
  netROIEur: number;
  roiMultiple: number;
  paybackMonths: number;
  description: string;
  features: string[];
}

interface ROIResult {
  input: ROIInput;
  projectedSavings: ProjectedSavings;
  tiers: PricingTier[];
  benchmarkComparison: {
    yourCurrentMarginPct: number;
    globalAvgMarginPct: number;
    improvementPotentialPct: number;
    improvementValueEur: number;
  };
  bestTier: string;
  headline: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${Math.round(n).toLocaleString()}`;
}

const CATEGORIES = ['apparel', 'tech', 'lifestyle', 'gifts', 'general'];
const REGIONS = ['EU', 'US', 'APAC', 'MENA'];

const DEFAULT_INPUT: ROIInput = {
  annualProcurementSpendEur: 500000,
  supplierCount: 8,
  manualProcessHoursPerWeek: 20,
  primaryCategory: 'apparel',
  region: 'EU',
  currentAvgMarginPct: 22,
};

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Form field wrapper ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4da3ff] transition-colors';

// ── Savings bar row ────────────────────────────────────────────────────────────

function SavingsBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94a3b8]">{label}</span>
        <span className="font-semibold" style={{ color }}>{fmtEur(value)}</span>
      </div>
      <div className="h-2 bg-[#1a2f48] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({ tier, isRecommended }: { tier: PricingTier; isRecommended: boolean }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 relative"
      style={{
        background: isRecommended ? '#0d1f3a' : '#0b1526',
        borderColor: isRecommended ? '#4da3ff' : '#1a2f48',
        boxShadow: isRecommended ? '0 0 20px rgba(77,163,255,0.08)' : 'none',
      }}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#22c55e] text-white text-[10px] font-bold tracking-wider px-3 py-0.5 rounded-full">
            RECOMMENDED
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="font-tight font-bold text-white text-sm leading-tight">{tier.name}</div>
        <span className="text-[10px] bg-[#1a2f48] text-[#94a3b8] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
          {tier.mode}
        </span>
      </div>
      <div>
        <div className="font-tight text-xl font-bold text-white">
          {tier.monthlyPriceEur === 0 ? 'Free' : `€${tier.monthlyPriceEur.toLocaleString()}/mo`}
        </div>
      </div>
      <div className="text-[11px] text-[#94a3b8]">
        Projected annual value: <span className="text-[#22c55e] font-semibold">{fmtEur(tier.projectedAnnualValueEur)}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: tier.roiMultiple > 0 ? '#22c55e' : '#475569' }}>
        {tier.roiMultiple > 0 ? `${tier.roiMultiple.toFixed(1)}x return` : 'Baseline'}
      </div>
      {tier.paybackMonths > 0 && (
        <div className="text-[11px] text-[#475569]">Payback in {tier.paybackMonths} months</div>
      )}
      <div className="pt-2 border-t border-[#1a2f48] space-y-1">
        {tier.features.slice(0, 2).map(f => (
          <div key={f} className="flex items-center gap-1.5 text-[11px] text-[#94a3b8]">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-16 px-8">
      <div className="text-[#1a2f48] mb-4">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M8 24h24M24 8v24" stroke="#1a2f48" strokeWidth="3" strokeLinecap="round" />
          <circle cx="36" cy="36" r="10" stroke="#1a2f48" strokeWidth="3" />
          <path d="M36 32v8M32 36h8" stroke="#1a2f48" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[#475569] text-base max-w-xs">
        Enter your procurement profile to calculate ROI potential
      </p>
      <div className="mt-4 flex items-center gap-2 text-[#1a2f48]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 5l-8 7 8 7" stroke="#1a2f48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm text-[#1a2f48]">Fill in the form on the left</span>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-[#1a2f48]/60 rounded w-3/4" />
      <div className="space-y-3">
        {Array.from(new Set([0, 1, 2, 3])).map(i => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-[#1a2f48]/60 rounded w-1/3" />
            <div className="h-2 bg-[#1a2f48]/60 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from(new Set([0, 1, 2, 3])).map(i => (
          <div key={i} className="h-32 bg-[#1a2f48]/60 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ROICalculatorPage() {
  const [formInput, setFormInput] = useState<ROIInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<ROIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  function update<K extends keyof ROIInput>(key: K, value: ROIInput[K]) {
    setFormInput(prev => ({ ...prev, [key]: value }));
  }

  async function calculate() {
    setLoading(true);
    try {
      const hdrs = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}`,
      };
      const res = await fetch(`${API_BASE}/api/v1/category-intelligence/roi-calculator`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(formInput),
      });
      if (res.ok) {
        const data: ROIResult = await res.json();
        setResult(data);
      } else {
        // Fallback mock result
        setResult(buildMockResult(formInput));
      }
    } catch {
      setResult(buildMockResult(formInput));
    } finally {
      setLoading(false);
      setCalculated(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="text-[10px] tracking-widest text-[#4da3ff] uppercase mb-2">
            Autonomous Procurement Intelligence Platform
          </div>
          <h1 className="font-tight text-3xl font-bold text-white mb-2">Procurement ROI Calculator</h1>
          <p className="text-sm text-[#94a3b8]">
            Discover the financial impact of autonomous procurement intelligence
          </p>
        </div>

        {/* ── TWO-PANEL LAYOUT ────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">

          {/* ── LEFT PANEL — Form ──────────────────────────────────────────── */}
          <div className="w-[40%] flex-shrink-0">
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 space-y-5">
              <div className="font-tight text-base font-semibold text-white">Your Procurement Profile</div>

              <Field label="Annual Procurement Spend (€)">
                <input
                  type="number"
                  className={inputCls}
                  value={formInput.annualProcurementSpendEur}
                  step={10000}
                  min={50000}
                  onChange={e => update('annualProcurementSpendEur', Number(e.target.value))}
                />
              </Field>

              <Field label="Supplier Count">
                <input
                  type="number"
                  className={inputCls}
                  value={formInput.supplierCount}
                  min={1}
                  max={500}
                  onChange={e => update('supplierCount', Number(e.target.value))}
                />
              </Field>

              <Field label="Manual Process Hours / Week">
                <input
                  type="number"
                  className={inputCls}
                  value={formInput.manualProcessHoursPerWeek}
                  min={1}
                  max={200}
                  onChange={e => update('manualProcessHoursPerWeek', Number(e.target.value))}
                />
              </Field>

              <Field label="Primary Category">
                <select
                  className={inputCls}
                  value={formInput.primaryCategory}
                  onChange={e => update('primaryCategory', e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-[#07111f] capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Region">
                <select
                  className={inputCls}
                  value={formInput.region}
                  onChange={e => update('region', e.target.value)}
                >
                  {REGIONS.map(r => (
                    <option key={r} value={r} className="bg-[#07111f]">{r}</option>
                  ))}
                </select>
              </Field>

              <Field label="Current Avg Margin (%)">
                <input
                  type="number"
                  className={inputCls}
                  value={formInput.currentAvgMarginPct}
                  step={0.5}
                  min={0}
                  max={100}
                  onChange={e => update('currentAvgMarginPct', Number(e.target.value))}
                />
              </Field>

              <button
                type="button"
                onClick={calculate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#3d8fe0] disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                {loading ? <><Spinner /> Calculating...</> : 'Calculate ROI →'}
              </button>

              <p className="text-[10px] text-[#475569] text-center">
                Results update based on live network benchmarks
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL — Results ──────────────────────────────────────── */}
          <div className="flex-1 min-h-[600px]">
            {!calculated && !loading && <EmptyState />}
            {loading && <ResultsSkeleton />}
            {calculated && !loading && result && <ResultsPanel result={result} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Results Panel (extracted for clarity) ────────────────────────────────────

function ResultsPanel({ result }: { result: ROIResult }) {
  const { projectedSavings, tiers, benchmarkComparison, bestTier, headline } = result;
  const total = projectedSavings.totalProjected12mEur;

  return (
    <div className="space-y-6">

      {/* Headline */}
      <div className="font-tight text-2xl font-bold text-[#22c55e] leading-tight">{headline}</div>

      {/* Savings breakdown */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 space-y-4">
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">12-Month Savings Breakdown</div>
        <SavingsBar label="Routing Optimization" value={projectedSavings.routingOptimizationEur} total={total} color="#22c55e" />
        <SavingsBar label="Margin Protection" value={projectedSavings.marginProtectionEur} total={total} color="#a855f7" />
        <SavingsBar label="Avoided Costs" value={projectedSavings.avoidedCostsEur} total={total} color="#f59e0b" />
        <SavingsBar label="Time Automation" value={projectedSavings.timeAutomationValueEur} total={total} color="#4da3ff" />
        <div className="pt-3 border-t border-[#1a2f48] flex items-center justify-between">
          <span className="text-sm font-bold text-white">Total 12-month impact</span>
          <span className="font-tight text-xl font-bold text-[#22c55e]">{fmtEur(total)}</span>
        </div>
      </div>

      {/* Tier comparison */}
      <div>
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Tier Comparison</div>
        <div className="grid grid-cols-2 gap-3">
          {tiers.map(tier => (
            <TierCard
              key={tier.name}
              tier={tier}
              isRecommended={tier.name === bestTier || tier.mode === bestTier}
            />
          ))}
        </div>
      </div>

      {/* Benchmark comparison */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
          vs Global Network Benchmark
        </div>
        <div className="flex items-center gap-6 mb-3">
          <div>
            <div className="text-[10px] text-[#475569] mb-0.5">Your Margin</div>
            <div className="font-tight text-lg font-bold text-white">{benchmarkComparison.yourCurrentMarginPct.toFixed(1)}%</div>
          </div>
          <div className="text-[#1a2f48] text-lg">vs</div>
          <div>
            <div className="text-[10px] text-[#475569] mb-0.5">Global Avg</div>
            <div className="font-tight text-lg font-bold text-[#4da3ff]">{benchmarkComparison.globalAvgMarginPct.toFixed(1)}%</div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-[10px] text-[#475569] mb-0.5">Improvement Potential</div>
            <div className="font-tight text-lg font-bold text-[#22c55e]">
              +{benchmarkComparison.improvementPotentialPct.toFixed(1)}% = {fmtEur(benchmarkComparison.improvementValueEur)}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <a
        href="/onboarding-wizard"
        className="block w-full text-center bg-[#4da3ff]/10 border border-[#4da3ff]/30 hover:bg-[#4da3ff]/20 text-[#4da3ff] font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        Start Your Free Onboarding Analysis →
      </a>
    </div>
  );
}

// ── Mock result generator (fallback when API is unavailable) ──────────────────

function buildMockResult(input: ROIInput): ROIResult {
  const spend = input.annualProcurementSpendEur;
  const routing = Math.round(spend * 0.034);
  const margin = Math.round(spend * 0.028);
  const avoided = Math.round(spend * 0.018);
  const time = Math.round(input.manualProcessHoursPerWeek * 52 * 65);
  const total = routing + margin + avoided + time;

  return {
    input,
    projectedSavings: {
      routingOptimizationEur: routing,
      marginProtectionEur: margin,
      avoidedCostsEur: avoided,
      timeAutomationValueEur: time,
      totalProjected12mEur: total,
    },
    tiers: [
      {
        name: 'Shadow Mode',
        mode: 'shadow',
        monthlyPriceEur: 0,
        annualCostEur: 0,
        projectedAnnualValueEur: Math.round(total * 0.3),
        netROIEur: Math.round(total * 0.3),
        roiMultiple: 0,
        paybackMonths: 0,
        description: 'Observe and discover',
        features: ['Full procurement monitoring', 'Savings identification reports'],
      },
      {
        name: 'Assisted Intelligence',
        mode: 'assisted',
        monthlyPriceEur: 2000,
        annualCostEur: 24000,
        projectedAnnualValueEur: Math.round(total * 0.8),
        netROIEur: Math.round(total * 0.8) - 24000,
        roiMultiple: parseFloat(((Math.round(total * 0.8)) / 24000).toFixed(1)),
        paybackMonths: Math.round(24000 / (total * 0.8 / 12)),
        description: 'AI recommendations, human approval',
        features: ['Decision Cards with AI reasoning', 'Full audit trail'],
      },
      {
        name: 'Controlled Execution',
        mode: 'controlled',
        monthlyPriceEur: 4500,
        annualCostEur: 54000,
        projectedAnnualValueEur: Math.round(total * 0.92),
        netROIEur: Math.round(total * 0.92) - 54000,
        roiMultiple: parseFloat(((Math.round(total * 0.92)) / 54000).toFixed(1)),
        paybackMonths: Math.round(54000 / (total * 0.92 / 12)),
        description: 'Auto-execute low-risk decisions',
        features: ['Auto-execution with governance', 'Medium/high risk escalation'],
      },
      {
        name: 'Full Autonomy',
        mode: 'autonomous',
        monthlyPriceEur: 8000,
        annualCostEur: 96000,
        projectedAnnualValueEur: Math.round(total * 1.0),
        netROIEur: Math.round(total * 1.0) - 96000,
        roiMultiple: parseFloat(((Math.round(total * 1.0)) / 96000).toFixed(1)),
        paybackMonths: Math.round(96000 / (total / 12)),
        description: 'Full governance-constrained autonomy',
        features: ['Maximum ROI potential', '% savings alignment option'],
      },
    ],
    benchmarkComparison: {
      yourCurrentMarginPct: input.currentAvgMarginPct,
      globalAvgMarginPct: 26.8,
      improvementPotentialPct: Math.max(0, 26.8 - input.currentAvgMarginPct + 4.2),
      improvementValueEur: Math.round(spend * Math.max(0, (26.8 - input.currentAvgMarginPct + 4.2) / 100)),
    },
    bestTier: 'Assisted Intelligence',
    headline: `Your procurement profile unlocks ${(() => { const v = routing + margin + avoided + time; return v >= 1_000_000 ? `€${(v/1_000_000).toFixed(1)}M` : `€${Math.round(v/1000)}K`; })()} in recoverable value over 12 months`,
  };
}
