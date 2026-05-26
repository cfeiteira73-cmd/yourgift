'use client';

import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('adminToken') ?? '';
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShippingOption {
  provider: string;
  providerCode: string;
  zoneLevel: number;
  baseCost: number;
  fuelSurcharge: number;
  totalCost: number;
  transitDaysMin: number;
  transitDaysMax: number;
  requiresCustoms: boolean;
  currency: string;
}

interface EstimateResult {
  options: ShippingOption[];
  cheapest: ShippingOption;
  fastest: ShippingOption;
  effectiveWeightKg: number;
  volumetricWeightKg: number | null;
}

interface ShippingQuote {
  id: string;
  referenceId: string | null;
  referenceType: string | null;
  originCountry: string;
  destinationCountry: string;
  weightKg: string | number;
  effectiveWeightKg: string | number;
  options: ShippingOption[];
  selectedProvider: string | null;
  selectedCost: string | number | null;
  selectionReason: string | null;
  currency: string;
  createdAt: string;
}

interface RateCard {
  id: string;
  providerCode: string;
  zoneLevel: number;
  weightFromKg: string | number;
  weightToKg: string | number;
  basePrice: string | number;
  pricePerKg: string | number;
  fuelSurchargePct: string | number;
}

interface CarrierStat {
  provider: string;
  code: string;
  avgCostEur: number;
  avgTransitDays: number;
  quoteCount: number;
}

interface Provider {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  strengths: string[];
  apiAvailable: boolean;
}

// ── Zone label map ─────────────────────────────────────────────────────────────

const ZONE_LABELS: Record<number, string> = {
  1: 'Domestic / Adjacent',
  2: 'EU Core',
  3: 'EU Extended / UK',
  4: 'International',
  5: 'Long Haul',
};

const ORIGIN_OPTIONS = ['NL', 'PL', 'PT', 'ES', 'DE', 'FR', 'BE', 'IT'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'blue' | 'amber' | 'gray' }) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400 border border-green-500/30',
    blue: 'bg-blue-500/20 text-[#4da3ff] border border-blue-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    gray: 'bg-white/5 text-white/50 border border-white/10',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1526', border: '1px solid #1a2f48' }} className="rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// ── Tab 1: Shipping Calculator ─────────────────────────────────────────────────

function ShippingCalculatorTab() {
  const [origin, setOrigin] = useState('NL');
  const [destination, setDestination] = useState('PT');
  const [weight, setWeight] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculate = async () => {
    if (!weight || isNaN(Number(weight))) { setError('Enter a valid weight'); return; }
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        originCountry: origin,
        destinationCountry: destination,
        weightKg: Number(weight),
      };
      if (lengthCm && widthCm && heightCm) {
        body.lengthCm = Number(lengthCm);
        body.widthCm = Number(widthCm);
        body.heightCm = Number(heightCm);
      }
      const data = await apiFetch<EstimateResult>('/api/v1/logistics/estimate', 'POST', body);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section title="Route & Package">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Origin Country</label>
            <select
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            >
              {ORIGIN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Destination Country (ISO)</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. PT"
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Weight (kg) *</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="5.0"
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Length (cm)</label>
            <input
              type="number"
              min="0"
              value={lengthCm}
              onChange={e => setLengthCm(e.target.value)}
              placeholder="40"
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Width (cm)</label>
            <input
              type="number"
              min="0"
              value={widthCm}
              onChange={e => setWidthCm(e.target.value)}
              placeholder="30"
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Height (cm)</label>
            <input
              type="number"
              min="0"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
              placeholder="20"
              className="w-full text-sm rounded-lg px-3 py-2 text-white"
              style={{ background: '#102131', border: '1px solid #1a2f48' }}
            />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <button
          onClick={calculate}
          disabled={loading}
          className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#4da3ff' }}
        >
          {loading ? 'Calculating…' : 'Calculate Shipping'}
        </button>
      </Section>

      {result && (
        <Section title="Shipping Options">
          <div className="flex gap-4 mb-4 text-sm text-white/60">
            <span>Actual weight: <strong className="text-white">{Number(weight)} kg</strong></span>
            {result.volumetricWeightKg != null && (
              <span>Volumetric: <strong className="text-white">{result.volumetricWeightKg} kg</strong></span>
            )}
            <span>Effective weight: <strong className="text-[#4da3ff]">{result.effectiveWeightKg} kg</strong></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                  {['Carrier', 'Zone', 'Transit', 'Base Cost', 'Fuel', 'Total', 'Customs', 'Tags'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.options.map((opt, i) => {
                  const isCheapest = opt.providerCode === result.cheapest?.providerCode && opt.totalCost === result.cheapest?.totalCost;
                  const isFastest = opt.providerCode === result.fastest?.providerCode && opt.transitDaysMin === result.fastest?.transitDaysMin && !isCheapest;
                  const rowBg = isCheapest
                    ? 'rgba(34,197,94,0.07)'
                    : isFastest
                    ? 'rgba(77,163,255,0.07)'
                    : 'transparent';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1a2f4820', background: rowBg }}>
                      <td className="py-3 pr-4 font-medium text-white">{opt.provider}</td>
                      <td className="py-3 pr-4 text-white/60">{ZONE_LABELS[opt.zoneLevel] ?? `Zone ${opt.zoneLevel}`}</td>
                      <td className="py-3 pr-4 text-white/80">{opt.transitDaysMin}–{opt.transitDaysMax}d</td>
                      <td className="py-3 pr-4 text-white/80">€{opt.baseCost.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-white/60">€{opt.fuelSurcharge.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-bold text-white">€{opt.totalCost.toFixed(2)}</td>
                      <td className="py-3 pr-4">
                        {opt.requiresCustoms
                          ? <Badge color="amber">Required</Badge>
                          : <Badge color="gray">No</Badge>}
                      </td>
                      <td className="py-3 pr-4 flex gap-1">
                        {isCheapest && <Badge color="green">Cheapest</Badge>}
                        {isFastest && <Badge color="blue">Fastest</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {result.options.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-white/30 py-8">No routes found for this origin → destination</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Tab 2: Rate Matrix ─────────────────────────────────────────────────────────

function RateMatrixTab() {
  const [matrix, setMatrix] = useState<Record<string, RateCard[]>>({});
  const [activeProvider, setActiveProvider] = useState('dhl');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, RateCard[]>>('/api/v1/logistics/rate-matrix')
      .then(data => { setMatrix(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const providers = Object.keys(matrix);
  const cards = matrix[activeProvider] ?? [];

  const grouped: Record<number, RateCard[]> = {};
  for (const card of cards) {
    if (!grouped[card.zoneLevel]) grouped[card.zoneLevel] = [];
    grouped[card.zoneLevel].push(card);
  }

  return (
    <div className="space-y-5">
      {/* Provider tabs */}
      <div className="flex gap-2">
        {loading
          ? <div className="text-white/40 text-sm">Loading…</div>
          : providers.map(p => (
            <button
              key={p}
              onClick={() => setActiveProvider(p)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold uppercase"
              style={{
                background: activeProvider === p ? '#4da3ff' : '#102131',
                color: activeProvider === p ? '#fff' : 'rgba(255,255,255,0.5)',
                border: '1px solid #1a2f48',
              }}
            >
              {p}
            </button>
          ))
        }
      </div>

      {Object.entries(grouped).map(([zone, rateCards]) => (
        <Section key={zone} title={`Zone ${zone} — ${ZONE_LABELS[Number(zone)] ?? ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                {['Weight Band', 'Base Price', '+ Per kg Over Band', 'Fuel Surcharge %', 'With Fuel (1kg example)'].map(h => (
                  <th key={h} className="text-left text-white/40 text-xs py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rateCards.map((rc, i) => {
                const base = Number(rc.basePrice);
                const fuel = Number(rc.fuelSurchargePct);
                const withFuel = Math.round(base * (1 + fuel / 100) * 100) / 100;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1a2f4820' }}>
                    <td className="py-2.5 pr-4 text-white/80">{Number(rc.weightFromKg)}–{Number(rc.weightToKg)} kg</td>
                    <td className="py-2.5 pr-4 text-white font-medium">€{base.toFixed(2)}</td>
                    <td className="py-2.5 pr-4 text-white/60">€{Number(rc.pricePerKg).toFixed(4)}</td>
                    <td className="py-2.5 pr-4 text-amber-400">{fuel}%</td>
                    <td className="py-2.5 pr-4 text-[#4da3ff]">€{withFuel.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      ))}

      {!loading && providers.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">No rate cards found. Run migrations and seed data.</p>
      )}
    </div>
  );
}

// ── Tab 3: Carrier Performance ─────────────────────────────────────────────────

function CarrierPerformanceTab({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<CarrierStat[]>([]);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, q] = await Promise.all([
        apiFetch<CarrierStat[]>('/api/v1/logistics/carrier-stats'),
        apiFetch<ShippingQuote[]>('/api/v1/logistics/quotes?limit=50'),
      ]);
      setStats(s);
      setQuotes(q);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <div className="space-y-5">
      <Section title="Carrier Performance Summary">
        {loading ? (
          <p className="text-white/30 text-sm">Loading…</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.code} style={{ background: '#102131', border: '1px solid #1a2f48' }} className="rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{s.provider}</span>
                  <Badge color="gray">{s.code.toUpperCase()}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Avg Cost</span>
                    <span className="text-[#22c55e] font-semibold">€{s.avgCostEur.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Avg Transit</span>
                    <span className="text-[#4da3ff]">{s.avgTransitDays}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Quotes</span>
                    <span className="text-white/80">{s.quoteCount}</span>
                  </div>
                </div>
              </div>
            ))}
            {stats.length === 0 && (
              <p className="col-span-3 text-white/30 text-sm text-center py-4">No quotes computed yet. Use the Shipping Calculator to generate data.</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Recent Shipping Quotes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2f48' }}>
                {['Reference', 'Route', 'Weight', 'Selected Carrier', 'Cost', 'Reason', 'Date'].map(h => (
                  <th key={h} className="text-left text-white/40 text-xs py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => {
                const isCheapest = q.selectionReason === 'cheapest';
                const isFastest = q.selectionReason === 'fastest';
                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid #1a2f4820' }}>
                    <td className="py-2.5 pr-4 text-white/60 text-xs font-mono">
                      {q.referenceId ? `${q.referenceType}/${q.referenceId.slice(0, 8)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-white font-medium">
                      {q.originCountry} → {q.destinationCountry}
                    </td>
                    <td className="py-2.5 pr-4 text-white/70">{Number(q.effectiveWeightKg).toFixed(2)} kg</td>
                    <td className="py-2.5 pr-4 text-white/80">{q.selectedProvider?.toUpperCase() ?? '—'}</td>
                    <td className={`py-2.5 pr-4 font-semibold ${isCheapest ? 'text-[#22c55e]' : isFastest ? 'text-[#4da3ff]' : 'text-white/80'}`}>
                      {q.selectedCost != null ? `€${Number(q.selectedCost).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      {q.selectionReason === 'cheapest' && <Badge color="green">Cheapest</Badge>}
                      {q.selectionReason === 'fastest' && <Badge color="blue">Fastest</Badge>}
                      {!q.selectionReason && <span className="text-white/30">—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-white/40 text-xs">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {quotes.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center text-white/30 py-8">No quotes yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LogisticsPage() {
  const [tab, setTab] = useState<'calculator' | 'matrix' | 'performance'>('calculator');
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => setRefreshKey(k => k + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'calculator', label: 'Shipping Calculator' },
    { key: 'matrix', label: 'Rate Matrix' },
    { key: 'performance', label: 'Carrier Performance' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ color: 'white', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Logistics Cost Engine</h1>
          <p className="text-sm text-white/40 mt-0.5">Real-time shipping estimates, carrier comparison, margin-safe routing</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-white"
          style={{ background: '#102131', border: '1px solid #1a2f48' }}
        >
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#0b1526', border: '1px solid #1a2f48' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: tab === t.key ? '#4da3ff' : 'transparent',
              color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.45)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'calculator' && <ShippingCalculatorTab />}
      {tab === 'matrix' && <RateMatrixTab />}
      {tab === 'performance' && <CarrierPerformanceTab refreshKey={refreshKey} />}
    </div>
  );
}
