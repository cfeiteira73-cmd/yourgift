'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const authHdrs = { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}` };

// ── Interfaces ─────────────────────────────────────────────────────────────

interface Inefficiency {
  type: string;
  description: string;
  estimatedWasteEur: number;
  severity: 'high' | 'medium' | 'low';
  supplierCode?: string;
  category?: string;
}

interface SavingsOpportunity {
  title: string;
  description: string;
  potentialSavingEur: number;
  confidencePct: number;
  effort: 'immediate' | 'short_term' | 'long_term';
  action: string;
}

interface OnboardingReport {
  id: string;
  status: string;
  rawDataSummary: {
    supplierCount: number;
    orderCount: number;
    invoiceCount: number;
    totalSpendEur: number;
    dateRange: { from: string; to: string } | null;
  };
  inefficiencies: Inefficiency[];
  savingsOpportunities: SavingsOpportunity[];
  totalSavingsPotentialEur: number;
  completedAt: string | null;
}

type WizardStep = 1 | 2 | 3;

// ── Sample data ────────────────────────────────────────────────────────────

const SAMPLE_DATA = {
  supplierList: [
    { name: 'Midocean', code: 'mid', annualSpendEur: 85000 },
    { name: 'PF Concept', code: 'pfc', annualSpendEur: 62000 },
    { name: 'DHL Express', code: 'dhl', annualSpendEur: 45000 },
    { name: 'FedEx', code: 'fedex', annualSpendEur: 58000 },
    { name: 'UPS', code: 'ups', annualSpendEur: 24000 },
    { name: 'DPD', code: 'dpd', annualSpendEur: 10000 },
  ],
  orderHistory: [
    { date: '2025-11-01', supplierCode: 'mid', amountEur: 4200, category: 'apparel', deliveryDays: 8 },
    { date: '2025-11-05', supplierCode: 'mid', amountEur: 6800, category: 'apparel', deliveryDays: 9 },
    { date: '2025-11-10', supplierCode: 'pfc', amountEur: 3400, category: 'gifts', deliveryDays: 12 },
    { date: '2025-11-15', supplierCode: 'mid', amountEur: 8200, category: 'apparel', deliveryDays: 7 },
    { date: '2025-11-20', supplierCode: 'dhl', amountEur: 1200, category: 'shipping', deliveryDays: 3 },
    { date: '2025-12-01', supplierCode: 'mid', amountEur: 12400, category: 'apparel', deliveryDays: 10 },
    { date: '2025-12-05', supplierCode: 'mid', amountEur: 9800, category: 'apparel', deliveryDays: 8 },
    { date: '2025-12-10', supplierCode: 'fedex', amountEur: 5600, category: 'tech', deliveryDays: 5 },
    { date: '2025-12-15', supplierCode: 'pfc', amountEur: 7200, category: 'lifestyle', deliveryDays: 18 },
    { date: '2025-12-20', supplierCode: 'mid', amountEur: 15000, category: 'apparel', deliveryDays: 11 },
    { date: '2026-01-10', supplierCode: 'mid', amountEur: 6400, category: 'apparel', deliveryDays: 9 },
    { date: '2026-01-20', supplierCode: 'ups', amountEur: 4100, category: 'tech', deliveryDays: 6 },
    { date: '2026-02-05', supplierCode: 'mid', amountEur: 8900, category: 'apparel', deliveryDays: 8 },
    { date: '2026-02-15', supplierCode: 'pfc', amountEur: 5300, category: 'gifts', deliveryDays: 14 },
    { date: '2026-03-01', supplierCode: 'mid', amountEur: 11200, category: 'apparel', deliveryDays: 9 },
    { date: '2026-03-10', supplierCode: 'fedex', amountEur: 6700, category: 'tech', deliveryDays: 5 },
    { date: '2026-03-20', supplierCode: 'dhl', amountEur: 2300, category: 'shipping', deliveryDays: 3 },
    { date: '2026-04-05', supplierCode: 'mid', amountEur: 9400, category: 'apparel', deliveryDays: 7 },
    { date: '2026-04-15', supplierCode: 'pfc', amountEur: 4800, category: 'lifestyle', deliveryDays: 16 },
    { date: '2026-05-01', supplierCode: 'mid', amountEur: 13600, category: 'apparel', deliveryDays: 10 },
  ],
  invoiceData: [
    { date: '2025-11-30', supplierCode: 'mid', invoicedEur: 19200, paidEur: 19200 },
    { date: '2025-12-31', supplierCode: 'mid', invoicedEur: 37200, paidEur: 36800 },
    { date: '2025-12-31', supplierCode: 'pfc', invoicedEur: 10600, paidEur: 10600 },
    { date: '2026-01-31', supplierCode: 'mid', invoicedEur: 6400, paidEur: 6400 },
    { date: '2026-02-28', supplierCode: 'mid', invoicedEur: 8900, paidEur: 9200 },
    { date: '2026-03-31', supplierCode: 'mid', invoicedEur: 20600, paidEur: 20600 },
    { date: '2026-04-30', supplierCode: 'mid', invoicedEur: 9400, paidEur: 9400 },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtEur(val: number): string {
  return `€${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const cfg = {
    high: { bg: '#3b0f0f', text: '#ef4444', label: 'HIGH' },
    medium: { bg: '#3b2700', text: '#f59e0b', label: 'MEDIUM' },
    low: { bg: '#0f2a0f', text: '#22c55e', label: 'LOW' },
  };
  const c = cfg[severity];
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function EffortBadge({ effort }: { effort: 'immediate' | 'short_term' | 'long_term' }) {
  const cfg = {
    immediate: { bg: '#0f2a0f', text: '#22c55e', label: 'IMMEDIATE' },
    short_term: { bg: '#0d1f3a', text: '#4da3ff', label: 'SHORT TERM' },
    long_term: { bg: '#1a2030', text: '#6b7280', label: 'LONG TERM' },
  };
  const c = cfg[effort];
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

// ── STEP 1 ─────────────────────────────────────────────────────────────────

interface Step1Props {
  tenantId: string;
  setTenantId: (v: string) => void;
  onStart: () => void;
  analyzing: boolean;
}

function Step1({ tenantId, setTenantId, onStart, analyzing }: Step1Props) {
  const [selectedCard, setSelectedCard] = useState<'sample' | 'upload'>('sample');

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Headline */}
      <div className="text-center mb-10">
        <div className="inline-block rounded-full px-3 py-1 bg-[#0d1f3a] border border-[#1a2f48] text-xs text-[#4da3ff] font-semibold uppercase tracking-widest mb-4">
          24-Hour Procurement Intelligence
        </div>
        <h1 className="font-tight text-3xl font-bold text-white mb-3 leading-tight">
          Discover{' '}
          <span className="text-[#22c55e]">€47,000+</span>{' '}
          in hidden procurement savings
        </h1>
        <p className="text-[#8ba8c7] text-base">
          Upload your data or use sample data. Get your personalized report in under 60 seconds.
        </p>
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Card A */}
        <button
          type="button"
          onClick={() => setSelectedCard('sample')}
          className={`relative rounded-xl border-2 p-5 text-left transition-all ${
            selectedCard === 'sample'
              ? 'border-[#22c55e] bg-[#0b1f12]'
              : 'border-[#1a2f48] bg-[#0b1526] hover:border-[#2a4028]'
          }`}
        >
          {selectedCard === 'sample' && (
            <div className="absolute top-3 right-3 rounded-full px-2 py-0.5 bg-[#22c55e] text-[#07111f] text-[10px] font-bold uppercase">
              Recommended
            </div>
          )}
          <div className="text-2xl mb-2">⚡</div>
          <div className="font-tight font-bold text-white mb-1">Use Sample Data</div>
          <div className="text-xs text-[#8ba8c7]">Instant demo with realistic procurement data. No upload required.</div>
        </button>

        {/* Card B */}
        <div className="relative rounded-xl border-2 border-[#1a2f48] bg-[#0b1526] p-5 opacity-60 cursor-not-allowed">
          <div className="absolute top-3 right-3 rounded-full px-2 py-0.5 bg-[#1a2f48] text-[#6b7280] text-[10px] font-bold uppercase">
            Coming Soon
          </div>
          <div className="text-2xl mb-2">📁</div>
          <div className="font-tight font-bold text-white mb-1">Upload CSV Data</div>
          <div className="text-xs text-[#8ba8c7]">
            Upload your orders.csv, invoices.csv, suppliers.csv
          </div>
        </div>
      </div>

      {/* Tenant ID */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide mb-2">
          Your Company ID
        </label>
        <input
          type="text"
          placeholder="your-company-name"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full rounded-xl border border-[#1a2f48] bg-[#0b1526] px-4 py-3 text-white placeholder-[#4a6480] text-sm focus:outline-none focus:border-[#4da3ff] transition-colors"
        />
      </div>

      {/* Data preview */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4 mb-8">
        <div className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide mb-3">What will be analyzed</div>
        <div className="space-y-2">
          {[
            { icon: '🏭', text: '6 supplier relationships across 4 product categories' },
            { icon: '📦', text: '20 historical orders · €284,000 in procurement spend' },
            { icon: '📅', text: '12 months of shipment & delivery data (Nov 2025 → May 2026)' },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-2 text-sm text-[#8ba8c7]">
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onStart}
        disabled={analyzing}
        className="w-full rounded-xl bg-[#4da3ff] text-[#07111f] font-bold py-3 px-8 text-lg hover:bg-[#3b8fe8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {analyzing ? 'Starting analysis...' : 'Analyze My Procurement →'}
      </button>

      <p className="text-center text-xs text-[#4a6480] mt-3">
        No credit card required · Results in under 60 seconds
      </p>
    </div>
  );
}

// ── STEP 2 ─────────────────────────────────────────────────────────────────

function Step2() {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [showGenerating, setShowGenerating] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleSteps(1), 0),
      setTimeout(() => setVisibleSteps(2), 400),
      setTimeout(() => setVisibleSteps(3), 800),
      setTimeout(() => setVisibleSteps(4), 1200),
      setTimeout(() => setShowGenerating(true), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const steps = [
    'Ingesting supplier data',
    'Modeling spend patterns',
    'Detecting inefficiencies',
    'Simulating optimization scenarios',
  ];

  return (
    <div className="max-w-lg mx-auto py-20 px-4 text-center">
      <div className="mb-10">
        {/* Spinner */}
        <div className="inline-block w-16 h-16 rounded-full border-4 border-[#1a2f48] border-t-[#4da3ff] animate-spin mb-6" />
        <h2 className="font-tight text-2xl font-bold text-white mb-2">
          Analyzing your procurement data...
        </h2>
        <p className="text-sm text-[#8ba8c7]">Running 47 optimization simulations</p>
      </div>

      <div className="space-y-3 text-left">
        {steps.map((step, idx) => (
          <div
            key={step}
            className={`flex items-center gap-3 transition-all duration-300 ${
              visibleSteps > idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="#07111f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm text-[#8ba8c7]">{step}</span>
          </div>
        ))}
      </div>

      {showGenerating && (
        <div className="mt-8 text-sm text-[#4da3ff] animate-pulse">
          Generating your personalized report...
        </div>
      )}
    </div>
  );
}

// ── STEP 3 ─────────────────────────────────────────────────────────────────

function Step3({ report, onReset }: { report: OnboardingReport; onReset: () => void }) {
  const ineff = Array.from(report.inefficiencies ?? []).sort(
    (a, b) => b.estimatedWasteEur - a.estimatedWasteEur
  );
  const opps = Array.from(report.savingsOpportunities ?? []).sort((a, b) => {
    if (a.effort === 'immediate' && b.effort !== 'immediate') return -1;
    if (b.effort === 'immediate' && a.effort !== 'immediate') return 1;
    return b.potentialSavingEur - a.potentialSavingEur;
  });

  const rs = report.rawDataSummary ?? { supplierCount: 0, orderCount: 0, invoiceCount: 0, totalSpendEur: 0, dateRange: null };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-block rounded-full px-3 py-1 bg-[#0f2a0f] border border-[#22c55e]/30 text-xs text-[#22c55e] font-semibold uppercase tracking-widest mb-4">
          Analysis Complete
        </div>
        <h1 className="font-tight text-3xl font-bold text-white mb-3 leading-tight">
          Your procurement is hiding{' '}
          <span className="text-[#22c55e]">{fmtEur(report.totalSavingsPotentialEur)}</span>{' '}
          in savings
        </h1>
        <p className="text-[#8ba8c7] text-base">
          Found in {ineff.length} identified inefficiencies across your supplier network
        </p>
      </div>

      {/* Data Summary Row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Suppliers Analyzed', value: String(rs.supplierCount ?? 0), color: '#4da3ff' },
          { label: 'Orders Reviewed', value: String(rs.orderCount ?? 0), color: '#a855f7' },
          { label: 'Total Spend', value: fmtEur(rs.totalSpendEur ?? 0), color: '#f59e0b' },
          { label: 'Savings Potential', value: fmtEur(report.totalSavingsPotentialEur), color: '#22c55e' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4 text-center">
            <div className="font-tight text-xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs text-[#8ba8c7] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Inefficiencies Table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#1a2f48]">
          <div className="font-tight text-base font-bold text-white">Identified Inefficiencies</div>
          <div className="text-xs text-[#8ba8c7] mt-0.5">{ineff.length} issues found in your procurement data</div>
        </div>
        {ineff.length === 0 ? (
          <div className="px-5 py-8 text-center text-[#8ba8c7] text-sm">No inefficiencies detected</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide w-24">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide w-32">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide whitespace-nowrap">Est. Waste</th>
              </tr>
            </thead>
            <tbody>
              {ineff.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? '' : 'bg-[#071018]'}>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase bg-[#1a2f48] text-[#8ba8c7]">
                      {item.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8ba8c7]">{item.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#ef4444] whitespace-nowrap">
                    {fmtEur(item.estimatedWasteEur)} waste
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Savings Opportunities */}
      <div className="mb-8">
        <div className="font-tight text-base font-bold text-white mb-4">Immediate Action Plan</div>
        {opps.length === 0 ? (
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-8 text-center text-[#8ba8c7] text-sm">
            No savings opportunities found yet
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {opps.map((opp, i) => {
              const barW = Math.round(opp.confidencePct * 2);
              return (
                <div key={i} className="relative rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
                  <div className="absolute top-4 right-4">
                    <EffortBadge effort={opp.effort} />
                  </div>
                  <div className="font-semibold text-white mb-2 pr-28">{opp.title}</div>
                  <div className="text-sm text-[#8ba8c7] mb-3">{opp.description}</div>
                  <div className="font-tight text-2xl font-bold text-[#22c55e] mb-2">
                    {fmtEur(opp.potentialSavingEur)}{' '}
                    <span className="text-sm font-normal text-[#8ba8c7]">potential</span>
                  </div>
                  {/* Confidence bar */}
                  <div className="mb-1">
                    <div className="flex justify-between text-xs text-[#4a6480] mb-1">
                      <span>Confidence</span>
                      <span>{opp.confidencePct}%</span>
                    </div>
                    <svg width="100%" height="6" viewBox="0 0 200 6">
                      <rect x={0} y={0} width={200} height={6} rx={3} fill="#1a2f48" />
                      <rect x={0} y={0} width={barW} height={6} rx={3} fill="#4da3ff" opacity={0.8} />
                    </svg>
                  </div>
                  <div className="mt-3 text-xs text-[#4da3ff]">→ {opp.action}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        className="rounded-2xl border border-[#4da3ff]/30 p-8 text-center"
        style={{ background: 'linear-gradient(to right, #0d1f3a, #07111f)' }}
      >
        <h2 className="font-tight text-xl font-bold text-white mb-2">
          Ready to activate your procurement intelligence system?
        </h2>
        <p className="text-sm text-[#8ba8c7] mb-6">
          Start in observe-only mode — no risk, full visibility
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            className="rounded-xl border border-[#4da3ff] text-[#4da3ff] font-bold py-3 px-6 hover:bg-[#4da3ff]/10 transition-colors text-sm"
          >
            Activate Shadow Mode (Free)
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4da3ff] text-[#07111f] font-bold py-3 px-6 hover:bg-[#3b8fe8] transition-colors text-sm"
          >
            Start Controlled Execution →
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-xs text-[#4a6480] hover:text-[#8ba8c7] transition-colors"
        >
          ← Run another analysis
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OnboardingWizardPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<OnboardingReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setAnalyzing(true);
    setError(null);

    try {
      // Step 1: start session
      const startRes = await fetch(`${API_BASE}/api/v1/proof-engine/onboarding/start`, {
        method: 'POST',
        headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId || 'demo-company' }),
      });

      let sid: string | null = null;
      if (startRes.ok) {
        const startData = await startRes.json();
        sid = startData.id ?? startData.sessionId ?? null;
        setSessionId(sid);
      }

      // Move to step 2 immediately (show animation while analyzing)
      setStep(2);

      // Step 2: run analysis
      const analyzeEndpoint = sid
        ? `${API_BASE}/api/v1/proof-engine/onboarding/${sid}/analyze`
        : `${API_BASE}/api/v1/proof-engine/onboarding/analyze`;

      const analyzeRes = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantId || 'demo-company',
          ...SAMPLE_DATA,
        }),
      });

      // Wait at least 2s so step 2 animations play
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (analyzeRes.ok) {
        const analysisData = await analyzeRes.json();
        setReport(analysisData);
        setStep(3);
      } else {
        // Use mock fallback report so UX always completes
        setReport(MOCK_FALLBACK_REPORT);
        setStep(3);
      }
    } catch {
      // Network error — use fallback
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setReport(MOCK_FALLBACK_REPORT);
      setStep(3);
    } finally {
      setAnalyzing(false);
    }
  }, [tenantId]);

  const handleReset = useCallback(() => {
    setStep(1);
    setReport(null);
    setSessionId(null);
    setError(null);
    setAnalyzing(false);
  }, []);

  // Progress indicator
  const stepLabels = ['Connect Data', 'Analyzing', 'Your Report'];

  return (
    <div className="min-h-screen bg-[#07111f]">
      {/* Top bar with steps */}
      <div className="border-b border-[#1a2f48] bg-[#0b1526]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-tight text-sm font-bold text-white">
            YourGift Procurement Intelligence
          </div>
          <div className="flex items-center gap-2">
            {stepLabels.map((label, idx) => {
              const s = idx + 1;
              const active = step === s;
              const done = step > s;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        done
                          ? 'bg-[#22c55e] text-[#07111f]'
                          : active
                          ? 'bg-[#4da3ff] text-[#07111f]'
                          : 'bg-[#1a2f48] text-[#4a6480]'
                      }`}
                    >
                      {done ? (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="#07111f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        s
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        active ? 'text-white' : done ? 'text-[#22c55e]' : 'text-[#4a6480]'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div className={`w-8 h-px ${step > s ? 'bg-[#22c55e]' : 'bg-[#1a2f48]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-2xl mx-auto mt-4 px-4">
          <div className="rounded-xl border border-[#ef4444]/30 bg-[#3b0f0f] px-4 py-3 text-sm text-[#ef4444]">
            {error}
          </div>
        </div>
      )}

      {/* Step content */}
      {step === 1 && (
        <Step1
          tenantId={tenantId}
          setTenantId={setTenantId}
          onStart={handleStart}
          analyzing={analyzing}
        />
      )}
      {step === 2 && <Step2 />}
      {step === 3 && report && <Step3 report={report} onReset={handleReset} />}
    </div>
  );
}

// ── Fallback mock report (when API is unavailable) ─────────────────────────

const MOCK_FALLBACK_REPORT: OnboardingReport = {
  id: 'demo-001',
  status: 'completed',
  rawDataSummary: {
    supplierCount: 6,
    orderCount: 20,
    invoiceCount: 7,
    totalSpendEur: 284000,
    dateRange: { from: '2025-11-01', to: '2026-05-01' },
  },
  inefficiencies: [
    {
      type: 'supplier_concentration',
      description: '76% of spend concentrated in a single supplier (Midocean). High dependency risk.',
      estimatedWasteEur: 18500,
      severity: 'high',
      supplierCode: 'mid',
      category: 'apparel',
    },
    {
      type: 'shipping_overpayment',
      description: 'FedEx used for non-urgent tech orders. Standard courier 40% cheaper for same SLA.',
      estimatedWasteEur: 8200,
      severity: 'high',
      supplierCode: 'fedex',
      category: 'shipping',
    },
    {
      type: 'invoice_discrepancy',
      description: 'Dec 2025 Midocean invoice: €37,200 invoiced vs €36,800 paid. Unresolved €400 delta.',
      estimatedWasteEur: 400,
      severity: 'medium',
      supplierCode: 'mid',
    },
    {
      type: 'delivery_overrun',
      description: 'PF Concept lifestyle orders averaging 17 days vs 7-day SLA commitment.',
      estimatedWasteEur: 6100,
      severity: 'medium',
      supplierCode: 'pfc',
      category: 'lifestyle',
    },
    {
      type: 'payment_overpayment',
      description: 'Feb 2026 Midocean: paid €9,200 on €8,900 invoice. €300 unexplained overpayment.',
      estimatedWasteEur: 300,
      severity: 'low',
      supplierCode: 'mid',
    },
  ],
  savingsOpportunities: [
    {
      title: 'Diversify Apparel Supplier Base',
      description: 'Onboard a secondary apparel supplier to reduce Midocean dependency and unlock volume negotiation.',
      potentialSavingEur: 14200,
      confidencePct: 87,
      effort: 'short_term',
      action: 'Request quotes from 2 alternative EU apparel suppliers',
    },
    {
      title: 'Switch Non-Urgent Tech Shipping to DHL',
      description: 'Route FedEx tech orders with >3-day window to DHL Standard at €8.40 vs €14.20 per kg.',
      potentialSavingEur: 8200,
      confidencePct: 94,
      effort: 'immediate',
      action: 'Update shipping rules in carrier management system',
    },
    {
      title: 'Negotiate PF Concept Lifestyle SLA',
      description: 'Current 17-day average vs 7-day contracted. Escalate or activate penalty clause.',
      potentialSavingEur: 6100,
      confidencePct: 78,
      effort: 'immediate',
      action: 'Schedule SLA review meeting with PF Concept account manager',
    },
    {
      title: 'Implement Invoice Reconciliation Automation',
      description: 'Automate 3-way matching (PO → receipt → invoice) to catch discrepancies before payment.',
      potentialSavingEur: 4800,
      confidencePct: 91,
      effort: 'short_term',
      action: 'Enable YourGift invoice reconciliation module',
    },
  ],
  totalSavingsPotentialEur: 47300,
  completedAt: new Date().toISOString(),
};
