'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TierConfig {
  badge: string;
  badgeColor: string;
  name: string;
  price: string;
  priceNote: string;
  description: string;
  valueProp: string;
  cta: string;
  ctaStyle: 'outline' | 'solid' | 'dark';
  isPopular?: boolean;
  features: string[];
}

type FeatureKey =
  | 'Decision Cards'
  | 'AI Reasoning'
  | 'Auto-execution'
  | 'Governance Policies'
  | 'Trust Engine'
  | 'Decision Traces'
  | 'CFO Reporting'
  | 'Global Benchmarks'
  | 'Network Learning'
  | '% Savings Alignment';

// ── Static data ───────────────────────────────────────────────────────────────

const TIERS: TierConfig[] = [
  {
    badge: 'OBSERVE',
    badgeColor: '#4da3ff',
    name: 'Shadow Mode',
    price: 'Free',
    priceNote: 'No commitment. No card.',
    description: 'Full system visibility. Observe every procurement event. Discover savings before committing.',
    valueProp: 'Reveals average €40,000 in hidden inefficiencies',
    cta: 'Start Free',
    ctaStyle: 'outline',
    features: [
      'Full procurement monitoring',
      'Shadow simulation of all decisions',
      'Savings identification reports',
      'Supplier intelligence access',
      'Global benchmark comparisons',
      'Onboarding analysis included',
    ],
  },
  {
    badge: 'MOST POPULAR',
    badgeColor: '#22c55e',
    name: 'Assisted Intelligence',
    price: '€2,000 / month',
    priceNote: 'Billed annually or month-to-month',
    description: 'AI generates Decision Cards. Your team approves. Full reasoning, complete audit trail.',
    valueProp: 'Average 3.1x ROI — €6.2 returned per €1 invested',
    cta: 'Start Assisted Mode',
    ctaStyle: 'solid',
    isPopular: true,
    features: [
      'Everything in Shadow Mode',
      'AI-generated Decision Cards',
      'Full reasoning transparency',
      'Human approval workflow',
      'Complete audit trail',
      'CFO-ready reporting',
    ],
  },
  {
    badge: 'AUTOMATE',
    badgeColor: '#a855f7',
    name: 'Controlled Execution',
    price: '€4,500 / month',
    priceNote: '+ governance included',
    description: 'Auto-execute low-risk decisions. Medium/high risk escalated. Maximum efficiency with full governance.',
    valueProp: 'Average 2.3x ROI at €500k annual spend',
    cta: 'Start Controlled Mode',
    ctaStyle: 'dark',
    features: [
      'Everything in Assisted Mode',
      'Auto-execution of low-risk decisions',
      'Governance policy engine',
      'Escalation workflows',
      'Trust score dashboard',
      'Real-time decision traces',
    ],
  },
  {
    badge: 'ENTERPRISE',
    badgeColor: '#f59e0b',
    name: 'Full Autonomy',
    price: '€8,000 / month',
    priceNote: '+ optional % of savings alignment',
    description: 'Full governance-constrained autonomy. Maximum ROI. Requires trust score ≥ 85.',
    valueProp: 'Aligns our success to yours: we earn more when you save more',
    cta: 'Contact for Enterprise',
    ctaStyle: 'dark',
    features: [
      'Everything in Controlled Mode',
      'Full autonomous execution',
      '% savings alignment option',
      'Dedicated success manager',
      'Custom governance policies',
      'Priority network learning',
    ],
  },
];

const FEATURE_MATRIX: Record<FeatureKey, [boolean, boolean, boolean, boolean]> = {
  'Decision Cards':       [true,  true,  true,  true],
  'AI Reasoning':         [false, true,  true,  true],
  'Auto-execution':       [false, false, true,  true],
  'Governance Policies':  [false, false, true,  true],
  'Trust Engine':         [true,  true,  true,  true],
  'Decision Traces':      [false, true,  true,  true],
  'CFO Reporting':        [false, true,  true,  true],
  'Global Benchmarks':    [true,  true,  true,  true],
  'Network Learning':     [true,  true,  true,  true],
  '% Savings Alignment':  [false, false, false, true],
};

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(34,197,94,0.15)" />
      <path d="M5 8l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 8h6" stroke="#1a2f48" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FeatureCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3 3 6-6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── CTA button ────────────────────────────────────────────────────────────────

function CTAButton({ label, style, isPopular }: { label: string; style: 'outline' | 'solid' | 'dark'; isPopular?: boolean }) {
  const base = 'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors text-center block';
  if (style === 'solid' || isPopular) {
    return (
      <button type="button" className={`${base} bg-[#4da3ff] hover:bg-[#3d8fe0] text-white`}>
        {label}
      </button>
    );
  }
  if (style === 'outline') {
    return (
      <button type="button" className={`${base} border border-[#4da3ff] text-[#4da3ff] hover:bg-[#4da3ff]/10`}>
        {label}
      </button>
    );
  }
  return (
    <button type="button" className={`${base} bg-[#1a2f48] hover:bg-[#243d5c] text-[#94a3b8]`}>
      {label}
    </button>
  );
}

// ── Principle card ────────────────────────────────────────────────────────────

function PrincipleCard({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="font-tight text-sm font-semibold text-white mb-2">"{title}"</div>
      <p className="text-sm text-[#94a3b8] leading-relaxed">{body}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PricingPage() {
  const features = Object.keys(FEATURE_MATRIX) as FeatureKey[];

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-14">
          <div className="inline-block text-[10px] tracking-widest text-[#4da3ff] uppercase border border-[#4da3ff]/30 bg-[#4da3ff]/5 px-4 py-1.5 rounded-full mb-4">
            Autonomous Procurement Intelligence Platform
          </div>
          <h1 className="font-tight text-4xl font-bold text-white mb-3">
            Pricing aligned to value, not seats
          </h1>
          <p className="text-[#94a3b8] text-lg max-w-xl mx-auto">
            We earn when you save. Your ROI is our business model.
          </p>
        </div>

        {/* ── 4-TIER CARDS ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-14">
          {TIERS.map(tier => (
            <div
              key={tier.name}
              className="relative rounded-2xl border flex flex-col p-6"
              style={{
                background: tier.isPopular ? '#0d1f3a' : '#0b1526',
                borderColor: tier.isPopular ? '#4da3ff' : '#1a2f48',
                boxShadow: tier.isPopular ? '0 0 32px rgba(77,163,255,0.08), 0 0 64px rgba(77,163,255,0.04)' : 'none',
              }}
            >
              {/* Tier badge */}
              <div className="mb-4">
                <span
                  className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full"
                  style={{ background: `${tier.badgeColor}20`, color: tier.badgeColor }}
                >
                  {tier.badge}
                </span>
              </div>

              {/* Name */}
              <div className="font-tight text-xl font-bold text-white mb-1">{tier.name}</div>

              {/* Price */}
              <div className="mb-1">
                <span
                  className="font-tight text-2xl font-bold"
                  style={{ color: tier.price === 'Free' ? '#22c55e' : 'white' }}
                >
                  {tier.price}
                </span>
              </div>
              <div className="text-[11px] text-[#475569] mb-4">{tier.priceNote}</div>

              {/* Description */}
              <p className="text-sm text-[#94a3b8] leading-relaxed mb-4 flex-none">{tier.description}</p>

              {/* Value prop */}
              <div
                className="text-xs font-semibold px-3 py-2 rounded-lg mb-5"
                style={{ background: `${tier.badgeColor}10`, color: tier.badgeColor }}
              >
                {tier.valueProp}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#94a3b8]">
                    <FeatureCheck />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <CTAButton label={tier.cta} style={tier.ctaStyle} isPopular={tier.isPopular} />
            </div>
          ))}
        </div>

        {/* ── VALUE PRINCIPLE SECTION ─────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-8 mb-14"
          style={{ background: '#0d1f3a', borderColor: 'rgba(77,163,255,0.2)' }}
        >
          <h2 className="font-tight text-2xl font-bold text-white mb-8 text-center">Why value-based pricing?</h2>
          <div className="grid grid-cols-3 gap-8">
            <PrincipleCard
              title="Stripe didn't charge per payment"
              body="They charged a percentage of volume processed. Same principle here: we charge a share of value created, not a flat SaaS fee that ignores outcomes."
            />
            <PrincipleCard
              title="Your savings are our proof"
              body="Every euro saved by your procurement is a proof record in our system. We publish our ROI publicly. If our system doesn't create value, you shouldn't pay for it."
            />
            <PrincipleCard
              title="Autonomy is earned, not sold"
              body="Shadow Mode is free. You graduate to higher tiers as your trust score grows. We build confidence with you before we execute on your behalf."
            />
          </div>
        </div>

        {/* ── COMPARISON TABLE ────────────────────────────────────────────── */}
        <div className="mb-14">
          <h2 className="font-tight text-xl font-bold text-white mb-6">What&apos;s included at each tier</h2>
          <div className="bg-[#0b1526] rounded-2xl border border-[#1a2f48] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  <th className="text-left text-xs font-semibold text-[#475569] px-6 py-4 w-56">Feature</th>
                  {TIERS.map(t => (
                    <th key={t.name} className="text-center px-4 py-4">
                      <div className="text-xs font-bold text-white">{t.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr
                    key={feature}
                    className={`border-b border-[#1a2f48]/50 hover:bg-[#0d1f3a]/30 transition-colors ${i === features.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-6 py-3 text-sm text-[#94a3b8]">{feature}</td>
                    {FEATURE_MATRIX[feature].map((has, j) => (
                      <td key={j} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          {has ? <CheckIcon /> : <DashIcon />}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROI CALCULATOR CALLOUT ──────────────────────────────────────── */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-10 text-center">
          <div className="text-[10px] tracking-widest text-[#4da3ff] uppercase mb-3">Personalized Analysis</div>
          <h2 className="font-tight text-2xl font-bold text-white mb-3">Calculate your exact ROI</h2>
          <p className="text-[#94a3b8] text-sm max-w-md mx-auto mb-6">
            Input your procurement profile — get your personalized savings projection in 30 seconds
          </p>
          <a
            href="/roi-calculator"
            className="inline-flex items-center gap-2 bg-[#4da3ff] hover:bg-[#3d8fe0] text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
          >
            Open ROI Calculator →
          </a>
        </div>

      </div>
    </div>
  );
}
