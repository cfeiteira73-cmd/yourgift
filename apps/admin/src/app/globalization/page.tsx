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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

interface RateEntry {
  currency: string;
  rate: number;
  symbol: string;
}

interface ConvertResult {
  amount: number;
  from: string;
  to: string;
  result: number;
  formatted: string;
}

interface VatRule {
  id: string;
  countryCode: string;
  countryName: string;
  standardRate: string | number;
  reducedRate: string | number | null;
  isEuMember: boolean;
  vatNumberPrefix: string | null;
  categoryOverrides: Record<string, number>;
}

interface VatComputation {
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  countryCode: string;
  countryName: string;
  isReduced: boolean;
}

interface RoutingRule {
  id: string;
  region: string;
  countryCodes: string[];
  preferredSuppliers: string[];
  excludedSuppliers: string[];
  maxLeadTimeDays: number;
  currency: string;
  notes: string | null;
}

interface RoutingLookupResult {
  countryCode: string;
  region: RoutingRule | null;
  preferredSuppliers: string[];
  maxLeadTimeDays: number;
  currency: string;
}

// Country code → flag emoji helper
function countryFlag(code: string): string {
  const base = 127397;
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + base))
    .join('');
}

// ── Tab 1: Currencies & Exchange Rates ───────────────────────────────────────

const MATRIX_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN'];

function CurrenciesTab() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [base, setBase] = useState('EUR');
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [convertFrom, setConvertFrom] = useState('EUR');
  const [convertTo, setConvertTo] = useState('USD');
  const [convertAmount, setConvertAmount] = useState('100');
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, r, m] = await Promise.all([
        apiFetch<Currency[]>('/api/v1/globalization/currencies'),
        apiFetch<RateEntry[]>(`/api/v1/globalization/currencies/rates?base=${base}`),
        apiFetch<Record<string, Record<string, number>>>('/api/v1/globalization/currencies/matrix'),
      ]);
      setCurrencies(c);
      setRates(r);
      setMatrix(m);
    } catch { /* ignore */ }
    setLoading(false);
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function handleConvert() {
    const amount = parseFloat(convertAmount);
    if (isNaN(amount)) return;
    setConverting(true);
    try {
      const res = await apiFetch<ConvertResult>('/api/v1/globalization/currencies/convert', 'POST', {
        amount,
        from: convertFrom,
        to: convertTo,
      });
      setConvertResult(res);
    } catch { /* ignore */ }
    setConverting(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const currencyCodes = currencies.map((c) => c.code);

  return (
    <div className="space-y-6">
      {/* Base selector + rates table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-white font-semibold text-sm flex-1">Exchange Rates</h3>
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-1.5 text-sm"
          >
            {['EUR', 'USD', 'GBP'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Code', 'Symbol', 'Rate', 'Example'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2f48]/50">
              {rates.map((r) => {
                const cur = currencies.find((c) => c.code === r.currency);
                const sym = cur?.symbol ?? r.symbol;
                const dec = cur?.decimalPlaces ?? 2;
                return (
                  <tr key={r.currency} className="hover:bg-[#0d1f3a]/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#4da3ff] font-semibold">{r.currency}</td>
                    <td className="px-3 py-2.5 text-white">{sym}</td>
                    <td className="px-3 py-2.5 text-white font-semibold">{r.rate.toFixed(6)}</td>
                    <td className="px-3 py-2.5 text-[#8ba8c7] text-xs">
                      {base === r.currency ? '—' : `${currencies.find(c=>c.code===base)?.symbol ?? base}1 = ${sym}${r.rate.toFixed(dec)}`}
                    </td>
                  </tr>
                );
              })}
              {rates.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-[#4d6a87] text-sm">No rates found for {base}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversion widget */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Currency Converter</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">Amount</label>
            <input
              type="number"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">From</label>
            <select
              value={convertFrom}
              onChange={(e) => setConvertFrom(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm"
            >
              {currencyCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <span className="text-[#4d6a87] text-lg mb-2">→</span>
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">To</label>
            <select
              value={convertTo}
              onChange={(e) => setConvertTo(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm"
            >
              {currencyCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => { void handleConvert(); }}
            disabled={converting}
            className="px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
          >
            {converting ? 'Converting...' : 'Convert'}
          </button>
        </div>
        {convertResult && (
          <div className="mt-4 p-4 rounded-lg bg-[#07111f] border border-[#1a2f48]">
            <p className="text-[#8ba8c7] text-xs mb-1">{convertResult.amount} {convertResult.from} =</p>
            <p className="text-[#22c55e] text-2xl font-bold">{convertResult.formatted}</p>
            <p className="text-[#4d6a87] text-xs mt-1">Rate: {(convertResult.result / convertResult.amount).toFixed(6)}</p>
          </div>
        )}
      </div>

      {/* Mini 5x5 conversion matrix */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Cross-Rate Matrix (EUR/USD/GBP/CHF/PLN)</h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2 text-[#4d6a87] w-14"></th>
                {MATRIX_CURRENCIES.map((c) => (
                  <th key={c} className="px-3 py-2 text-[#4da3ff] font-semibold text-center">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_CURRENCIES.map((from) => (
                <tr key={from} className="border-t border-[#1a2f48]/50">
                  <td className="px-3 py-2 text-[#4da3ff] font-semibold">{from}</td>
                  {MATRIX_CURRENCIES.map((to) => {
                    const val = matrix[from]?.[to] ?? null;
                    const isSame = from === to;
                    return (
                      <td
                        key={to}
                        className={`px-3 py-2 text-center font-mono ${isSame ? 'text-[#4d6a87]' : 'text-white'}`}
                        style={{ background: isSame ? '#07111f' : undefined }}
                      >
                        {val === null ? '—' : isSame ? '1.000' : val.toFixed(4)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: VAT Rules ──────────────────────────────────────────────────────────

function VatTab() {
  const [rules, setRules] = useState<VatRule[]>([]);
  const [showEuOnly, setShowEuOnly] = useState(false);
  const [vatCountry, setVatCountry] = useState('PT');
  const [vatAmount, setVatAmount] = useState('1000');
  const [vatCategory, setVatCategory] = useState('');
  const [vatResult, setVatResult] = useState<VatComputation | null>(null);
  const [computing, setComputing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<VatRule[]>('/api/v1/globalization/vat');
      setRules(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCompute() {
    const net = parseFloat(vatAmount);
    if (isNaN(net)) return;
    setComputing(true);
    try {
      const res = await apiFetch<VatComputation>('/api/v1/globalization/vat/compute', 'POST', {
        netAmount: net,
        countryCode: vatCountry,
        category: vatCategory || undefined,
      });
      setVatResult(res);
    } catch { /* ignore */ }
    setComputing(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  const displayed = showEuOnly ? rules.filter((r) => r.isEuMember) : rules;
  const countryCodes = Array.from(new Set(rules.map((r) => r.countryCode))).sort();

  return (
    <div className="space-y-6">
      {/* Toggle + table */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1a2f48]">
          <h3 className="text-white font-semibold text-sm flex-1">VAT Rules</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[#8ba8c7] text-xs">EU Only</span>
            <div
              onClick={() => setShowEuOnly(!showEuOnly)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${showEuOnly ? 'bg-[#4da3ff]' : 'bg-[#1a2f48]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showEuOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#07111f]">
              {['Flag', 'Country', 'Standard Rate', 'Reduced Rate', 'VAT Prefix', 'EU'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2f48]/50">
            {displayed.map((rule) => (
              <tr key={rule.id} className="hover:bg-[#0d1f3a]/40 transition-colors">
                <td className="px-4 py-3 text-xl">{countryFlag(rule.countryCode)}</td>
                <td className="px-4 py-3 text-white font-medium">{rule.countryName}</td>
                <td className="px-4 py-3 text-[#f59e0b] font-semibold">{Number(rule.standardRate).toFixed(2)}%</td>
                <td className="px-4 py-3 text-[#8ba8c7] text-xs">
                  {rule.reducedRate !== null ? `${Number(rule.reducedRate).toFixed(2)}%` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#8ba8c7]">{rule.vatNumberPrefix ?? '—'}</td>
                <td className="px-4 py-3">
                  {rule.isEuMember ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#4da3ff]/10 text-[#4da3ff]">EU</span>
                  ) : (
                    <span className="text-[#4d6a87] text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* VAT calculator */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
        <h3 className="text-white font-semibold text-sm mb-4">VAT Calculator</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">Country</label>
            <select
              value={vatCountry}
              onChange={(e) => setVatCountry(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm"
            >
              {countryCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">Net Amount (€)</label>
            <input
              type="number"
              value={vatAmount}
              onChange={(e) => setVatAmount(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">Category (optional)</label>
            <input
              type="text"
              value={vatCategory}
              onChange={(e) => setVatCategory(e.target.value)}
              placeholder="e.g. food"
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm w-32 placeholder-[#4d6a87]"
            />
          </div>
          <button
            type="button"
            onClick={() => { void handleCompute(); }}
            disabled={computing}
            className="px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
          >
            {computing ? 'Computing...' : 'Compute VAT'}
          </button>
        </div>

        {vatResult && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Net Amount', value: `€${vatResult.netAmount.toFixed(2)}`, color: '#8ba8c7' },
              { label: `VAT (${vatResult.vatRate}%${vatResult.isReduced ? ' reduced' : ''})`, value: `€${vatResult.vatAmount.toFixed(2)}`, color: '#f59e0b' },
              { label: 'Gross Total', value: `€${vatResult.grossAmount.toFixed(2)}`, color: '#22c55e' },
              { label: 'Country', value: vatResult.countryName, color: '#4da3ff' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
                <p className="text-[#8ba8c7] text-xs mb-1">{label}</p>
                <p style={{ color }} className="font-bold text-sm">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Regional Routing ───────────────────────────────────────────────────

const REGION_COLORS: Record<string, { text: string; bg: string }> = {
  EU: { text: '#4da3ff', bg: '#4da3ff1a' },
  UK: { text: '#a855f7', bg: '#a855f71a' },
  CH: { text: '#4da3ff', bg: '#4da3ff1a' },
  MENA: { text: '#f59e0b', bg: '#f59e0b1a' },
  NA: { text: '#22c55e', bg: '#22c55e1a' },
};

function RegionBadge({ region }: { region: string }) {
  const colors = REGION_COLORS[region] ?? { text: '#8ba8c7', bg: '#8ba8c71a' };
  return (
    <span
      style={{ color: colors.text, background: colors.bg }}
      className="px-2 py-0.5 rounded-full text-xs font-bold"
    >
      {region}
    </span>
  );
}

function SupplierPill({ name }: { name: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#1a2f48] text-[#8ba8c7] border border-[#1a2f48]">
      {name}
    </span>
  );
}

function RoutingTab() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [lookupCode, setLookupCode] = useState('PT');
  const [lookupResult, setLookupResult] = useState<RoutingLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<RoutingRule[]>('/api/v1/globalization/routing');
      setRules(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleLookup() {
    setLooking(true);
    try {
      const res = await apiFetch<RoutingLookupResult>('/api/v1/globalization/routing/lookup', 'POST', {
        countryCode: lookupCode.toUpperCase(),
      });
      setLookupResult(res);
    } catch { /* ignore */ }
    setLooking(false);
  }

  if (loading) return <p className="text-[#8ba8c7] text-sm p-6">Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Routing rules table */}
      <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#07111f] border-b border-[#1a2f48]">
              {['Region', 'Countries', 'Preferred Suppliers', 'Max Lead Time', 'Currency'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[#4d6a87] text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2f48]/50">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-[#0d1f3a]/40 transition-colors">
                <td className="px-4 py-3"><RegionBadge region={rule.region} /></td>
                <td className="px-4 py-3 text-[#8ba8c7] text-xs max-w-xs">
                  {rule.countryCodes.slice(0, 8).join(', ')}
                  {rule.countryCodes.length > 8 && ` +${rule.countryCodes.length - 8}`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {rule.preferredSuppliers.map((s) => <SupplierPill key={s} name={s} />)}
                  </div>
                </td>
                <td className="px-4 py-3 text-white font-semibold">{rule.maxLeadTimeDays}d</td>
                <td className="px-4 py-3 font-mono text-[#4da3ff] font-semibold">{rule.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lookup widget */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Country Routing Lookup</h3>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-[#8ba8c7] text-xs block mb-1">Country Code (ISO 2)</label>
            <input
              type="text"
              maxLength={2}
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
              placeholder="PT"
              className="bg-[#07111f] border border-[#1a2f48] text-white rounded-lg px-3 py-2 text-sm w-20 uppercase placeholder-[#4d6a87]"
            />
          </div>
          <button
            type="button"
            onClick={() => { void handleLookup(); }}
            disabled={looking || lookupCode.length < 2}
            className="px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
          >
            {looking ? 'Looking up...' : 'Lookup'}
          </button>
        </div>

        {lookupResult && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
              <p className="text-[#8ba8c7] text-xs mb-1">Region</p>
              {lookupResult.region ? (
                <RegionBadge region={lookupResult.region.region} />
              ) : (
                <p className="text-[#4d6a87] text-xs">No region found</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
              <p className="text-[#8ba8c7] text-xs mb-1">Preferred Suppliers</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {lookupResult.preferredSuppliers.map((s) => <SupplierPill key={s} name={s} />)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
              <p className="text-[#8ba8c7] text-xs mb-1">Max Lead Time</p>
              <p className="text-white font-bold">{lookupResult.maxLeadTimeDays} days</p>
            </div>
            <div className="p-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
              <p className="text-[#8ba8c7] text-xs mb-1">Preferred Currency</p>
              <p className="text-[#4da3ff] font-bold font-mono">{lookupResult.currency}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'currencies', label: 'Currencies & Rates' },
  { id: 'vat', label: 'VAT Rules' },
  { id: 'routing', label: 'Regional Routing' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function GlobalizationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('currencies');

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => {
      setActiveTab((t) => t);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Globalization Engine</h1>
        <p className="text-[#8ba8c7] text-sm mt-1">
          Multi-currency · VAT rules · Regional supplier routing
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-[#4da3ff] text-[#07111f]'
                : 'text-[#8ba8c7] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab}>
        {activeTab === 'currencies' && <CurrenciesTab />}
        {activeTab === 'vat' && <VatTab />}
        {activeTab === 'routing' && <RoutingTab />}
      </div>
    </div>
  );
}
