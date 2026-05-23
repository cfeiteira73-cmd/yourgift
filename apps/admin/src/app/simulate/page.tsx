'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ─── design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#07111f',
  card: '#0b1526',
  border: '#1a2f48',
  accent: '#4da3ff',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  text: '#f0f6ff',
  muted: '#8ba8c7',
  dim: '#4d6a87',
  card2: '#102131',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SimInput {
  productCost: number;
  salePrice: number;
  quantity: number;
  originCountry: string;
  destinationCountry: string;
  weightKg: number;
  supplierName: string;
  category: string;
}

interface ScenarioResult {
  finalMarginEur: number;
  finalMarginPct: number;
  shippingCost: number;
  compositeRiskScore: number;
  shippingDays: number;
}

interface Scenario {
  type: string;
  label: string;
  description?: string;
  result?: ScenarioResult;
  marginDeltaEur: number;
  marginDeltaPct: number;
  costDeltaEur: number;
  deliveryDeltaDays: number;
  riskDelta: number;
  isOptimal: boolean;
  recommendation: string;
}

interface WhatIfResponse {
  base: Scenario;
  scenarios: Scenario[];
  optimal: Scenario;
  summary: string;
  runId: string;
}

// ─── quick templates ──────────────────────────────────────────────────────────

const TEMPLATES: { label: string; values: Partial<SimInput> }[] = [
  {
    label: 'Electronics EU',
    values: { productCost: 12, salePrice: 38, quantity: 200, originCountry: 'NL', destinationCountry: 'PT', weightKg: 1.8 },
  },
  {
    label: 'Premium Gifts',
    values: { productCost: 28, salePrice: 85, quantity: 50, originCountry: 'DE', destinationCountry: 'ES', weightKg: 3.2 },
  },
  {
    label: 'Textiles Bulk',
    values: { productCost: 8, salePrice: 22, quantity: 500, originCountry: 'PL', destinationCountry: 'FR', weightKg: 0.9 },
  },
];

const ORIGINS = ['NL', 'PL', 'DE', 'CN', 'PT', 'ES', 'FR'];
const DESTINATIONS = ['PT', 'ES', 'DE', 'FR', 'GB', 'US', 'AE', 'IT', 'NL'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals);
}

function fmtDelta(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+€${fmt(Math.abs(n))}` : `-€${fmt(Math.abs(n))}`;
}

function deltaColor(n: number): string {
  if (n === 0) return T.dim;
  return n > 0 ? T.green : T.red;
}

// ─── SVG Delta Chart ──────────────────────────────────────────────────────────

function DeltaChart({ base, scenarios }: { base: Scenario; scenarios: Scenario[] }) {
  const all = [base, ...scenarios];
  const deltas = all.map((s) => s.marginDeltaEur);
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);

  const W = 480;
  const H = 120;
  const labelW = 120;
  const barAreaW = W - labelW - 16;
  const centerX = labelW + barAreaW / 2;
  const barHeight = 10;
  const rowH = H / all.length;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      {/* center line */}
      <line x1={centerX} y1={0} x2={centerX} y2={H} stroke={T.border} strokeWidth="1" />

      {all.map((s, i) => {
        const delta = s.marginDeltaEur;
        const barW = (Math.abs(delta) / maxAbs) * (barAreaW / 2 - 4);
        const y = i * rowH + rowH / 2 - barHeight / 2;
        const color = i === 0 ? T.dim : delta >= 0 ? T.green : T.red;
        const x = delta >= 0 ? centerX : centerX - barW;

        return (
          <g key={s.type + i}>
            {/* label */}
            <text
              x={labelW - 6}
              y={i * rowH + rowH / 2 + 4}
              textAnchor="end"
              fill={s.isOptimal ? T.green : T.muted}
              fontSize="9"
              fontWeight={s.isOptimal ? '700' : '400'}
            >
              {s.label.length > 14 ? s.label.slice(0, 14) + '…' : s.label}
            </text>
            {/* bar */}
            {barW > 0 && (
              <rect x={x} y={y} width={barW} height={barHeight} fill={color} rx="2" opacity={i === 0 ? 0.4 : 0.85} />
            )}
            {/* value label */}
            {delta !== 0 && (
              <text
                x={delta >= 0 ? centerX + barW + 4 : centerX - barW - 4}
                y={i * rowH + rowH / 2 + 3}
                textAnchor={delta >= 0 ? 'start' : 'end'}
                fill={color}
                fontSize="8"
                fontWeight="600"
              >
                {delta > 0 ? '+' : ''}{fmt(delta)}€
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: `2px solid rgba(255,255,255,0.25)`,
        borderTop: `2px solid #fff`,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' }}>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    background: T.card2,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    color: T.text,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ base, scenarios }: { base: Scenario; scenarios: Scenario[] }) {
  const allRows: (Scenario & { isBase?: boolean })[] = [
    { ...base, isBase: true },
    ...scenarios,
  ];

  const cols = ['Scenario', 'Margin €', 'Margin %', 'vs Base', 'Cost Δ', 'Delivery Δ', 'Risk Δ', 'Status'];

  const thStyle: React.CSSProperties = {
    padding: '8px 14px',
    fontSize: 11,
    color: T.dim,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    fontWeight: 600,
    textAlign: 'left',
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${T.border}`, background: T.card }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={thStyle}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, i) => {
            const isBase = row.isBase === true;
            const isOpt = row.isOptimal && !isBase;
            const result = row.result;
            const marginEur = isBase
              ? (result?.finalMarginEur ?? 0)
              : (base.result?.finalMarginEur ?? 0) + row.marginDeltaEur;
            const marginPct = isBase
              ? (result?.finalMarginPct ?? 0)
              : (base.result?.finalMarginPct ?? 0) + row.marginDeltaPct;

            const rowStyle: React.CSSProperties = {
              borderBottom: i < allRows.length - 1 ? `1px solid ${T.border}` : 'none',
              background: isOpt ? 'rgba(34,197,94,0.04)' : isBase ? 'rgba(77,163,255,0.03)' : 'transparent',
              borderLeft: isOpt ? `3px solid ${T.green}` : isBase ? `3px solid ${T.accent}` : '3px solid transparent',
            };

            const tdStyle: React.CSSProperties = {
              padding: '12px 14px',
              fontSize: 12,
              color: T.muted,
              whiteSpace: 'nowrap',
              verticalAlign: 'middle',
            };

            return (
              <tr key={row.type + i} style={rowStyle}>
                {/* Scenario name */}
                <td style={{ ...tdStyle, color: isOpt ? T.green : isBase ? T.accent : T.text, fontWeight: isOpt ? 700 : 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {row.label}
                    {isOpt && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: T.green, border: `1px solid rgba(34,197,94,0.3)`, letterSpacing: '0.06em' }}>
                        OPTIMAL
                      </span>
                    )}
                    {isBase && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(77,163,255,0.12)', color: T.accent, border: `1px solid rgba(77,163,255,0.25)`, letterSpacing: '0.06em' }}>
                        BASE
                      </span>
                    )}
                  </div>
                </td>
                {/* Margin € */}
                <td style={{ ...tdStyle, color: T.text, fontWeight: 600 }}>€{fmt(marginEur)}</td>
                {/* Margin % */}
                <td style={{ ...tdStyle, color: T.text }}>{fmt(marginPct, 1)}%</td>
                {/* vs Base */}
                <td style={{ ...tdStyle, color: deltaColor(row.marginDeltaEur), fontWeight: 600 }}>
                  {isBase ? <span style={{ color: T.dim }}>—</span> : fmtDelta(row.marginDeltaEur)}
                </td>
                {/* Cost delta */}
                <td style={{ ...tdStyle, color: row.costDeltaEur < 0 ? T.green : row.costDeltaEur > 0 ? T.red : T.dim }}>
                  {isBase ? '—' : row.costDeltaEur === 0 ? '—' : `${row.costDeltaEur > 0 ? '+' : ''}€${fmt(Math.abs(row.costDeltaEur))}`}
                </td>
                {/* Delivery delta */}
                <td style={{ ...tdStyle, color: row.deliveryDeltaDays < 0 ? T.green : row.deliveryDeltaDays > 0 ? T.amber : T.dim }}>
                  {isBase ? `${result?.shippingDays ?? 0}d` : row.deliveryDeltaDays === 0 ? '±0d' : `${row.deliveryDeltaDays > 0 ? '+' : ''}${row.deliveryDeltaDays}d`}
                </td>
                {/* Risk delta */}
                <td style={{ ...tdStyle, color: row.riskDelta > 0 ? T.red : row.riskDelta < 0 ? T.green : T.dim }}>
                  {isBase ? (result?.compositeRiskScore ?? 0) : row.riskDelta === 0 ? '±0' : `${row.riskDelta > 0 ? '+' : ''}${row.riskDelta}`}
                </td>
                {/* Status */}
                <td style={tdStyle}>
                  {isBase ? (
                    <span style={{ color: T.dim, fontSize: 11 }}>Baseline</span>
                  ) : isOpt ? (
                    <span style={{ color: T.green, fontWeight: 600, fontSize: 11 }}>Recommended</span>
                  ) : row.marginDeltaEur > 0 ? (
                    <span style={{ color: T.muted, fontSize: 11 }}>Viable</span>
                  ) : (
                    <span style={{ color: T.dim, fontSize: 11 }}>Worse</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '60px 40px',
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32, color: T.dim }}>⊙</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.muted }}>Run scenarios to see financial delta comparison</div>
      <div style={{ fontSize: 12, color: T.dim }}>Simulate all 7 alternatives in &lt; 2 seconds</div>
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(239,68,68,0.1)',
        border: `1px solid rgba(239,68,68,0.3)`,
        color: T.red,
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const [input, setInput] = useState<SimInput>({
    productCost: 15,
    salePrice: 45,
    quantity: 100,
    originCountry: 'NL',
    destinationCountry: 'PT',
    weightKg: 2.5,
    supplierName: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const applyTemplate = useCallback((tpl: Partial<SimInput>) => {
    setInput((prev) => ({ ...prev, ...tpl }));
    setResult(null);
    setError(null);
  }, []);

  const runSimulation = useCallback(async () => {
    if (loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/decision-engine/what-if`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          productCost: input.productCost,
          salePrice: input.salePrice,
          quantity: input.quantity,
          originCountry: input.originCountry,
          destinationCountry: input.destinationCountry,
          weightKg: input.weightKg,
          supplierName: input.supplierName || undefined,
          category: input.category || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setError(`Simulation failed — API returned ${res.status}`);
        return;
      }

      const data: WhatIfResponse = await res.json();
      setResult(data);
      setRunCount((c) => c + 1);
      setLastRunAt(new Date());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Simulation failed — API unreachable');
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  function setField<K extends keyof SimInput>(key: K, value: SimInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const iStyle = inputStyle();

  return (
    <>
      {/* inline keyframes for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'system-ui, sans-serif' }}>
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 32px 20px',
            borderBottom: `1px solid ${T.border}`,
            background: T.card,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>What-If Simulation Engine</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
              Simulate all procurement alternatives simultaneously. Find the optimal path.
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: T.dim }}>
            <div style={{ color: T.accent, fontWeight: 600, fontSize: 14 }}>
              Run Count: {runCount} simulation{runCount !== 1 ? 's' : ''} this session
            </div>
            {lastRunAt && (
              <div style={{ marginTop: 2 }}>Last run: {lastRunAt.toLocaleTimeString()}</div>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', gap: 24, padding: 32, alignItems: 'flex-start' }}>

          {/* ── LEFT: Input Form (40%) ── */}
          <div style={{ width: '40%', flexShrink: 0 }}>
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 12, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16, fontWeight: 600 }}>
                Scenario Inputs
              </div>

              {/* 2-col grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {/* Product Cost */}
                <div>
                  <Label>Product Cost (€)</Label>
                  <input
                    type="number"
                    style={iStyle}
                    value={input.productCost}
                    onChange={(e) => setField('productCost', Number(e.target.value))}
                  />
                </div>
                {/* Sale Price */}
                <div>
                  <Label>Sale Price (€)</Label>
                  <input
                    type="number"
                    style={iStyle}
                    value={input.salePrice}
                    onChange={(e) => setField('salePrice', Number(e.target.value))}
                  />
                </div>
                {/* Quantity */}
                <div>
                  <Label>Quantity</Label>
                  <input
                    type="number"
                    style={iStyle}
                    value={input.quantity}
                    onChange={(e) => setField('quantity', Number(e.target.value))}
                  />
                </div>
                {/* Weight */}
                <div>
                  <Label>Weight (kg)</Label>
                  <input
                    type="number"
                    step="0.1"
                    style={iStyle}
                    value={input.weightKg}
                    onChange={(e) => setField('weightKg', Number(e.target.value))}
                  />
                </div>
                {/* Origin */}
                <div>
                  <Label>Origin Country</Label>
                  <select
                    style={iStyle}
                    value={input.originCountry}
                    onChange={(e) => setField('originCountry', e.target.value)}
                  >
                    {ORIGINS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Destination */}
                <div>
                  <Label>Destination</Label>
                  <select
                    style={iStyle}
                    value={input.destinationCountry}
                    onChange={(e) => setField('destinationCountry', e.target.value)}
                  >
                    {DESTINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Full-width inputs */}
              <div style={{ marginBottom: 12 }}>
                <Label>Supplier Name (optional)</Label>
                <input
                  type="text"
                  style={iStyle}
                  value={input.supplierName}
                  placeholder="e.g. Premium Gifts Co"
                  onChange={(e) => setField('supplierName', e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <Label>Category (optional)</Label>
                <input
                  type="text"
                  style={iStyle}
                  value={input.category}
                  placeholder="e.g. Electronics"
                  onChange={(e) => setField('category', e.target.value)}
                />
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={runSimulation}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 12,
                  background: loading ? 'rgba(77,163,255,0.5)' : T.accent,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'background 0.2s',
                }}
              >
                {loading && <Spinner />}
                {loading ? 'Simulating 7 scenarios…' : 'Run All Scenarios →'}
              </button>

              {/* Quick Templates */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 600 }}>
                  Quick Templates
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl.values)}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 8,
                        background: T.card2,
                        border: `1px solid ${T.border}`,
                        color: T.muted,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s, color 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = T.accent;
                        (e.currentTarget as HTMLButtonElement).style.color = T.text;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
                        (e.currentTarget as HTMLButtonElement).style.color = T.muted;
                      }}
                    >
                      <span>{tpl.label}</span>
                      <span style={{ fontSize: 10, color: T.dim }}>
                        €{tpl.values.productCost} → €{tpl.values.salePrice} · ×{tpl.values.quantity} · {tpl.values.originCountry}→{tpl.values.destinationCountry}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results (60%) ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && <ErrorBanner message={error} />}

            {!result ? (
              <EmptyState />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Optimal Banner */}
                <div
                  style={{
                    background: 'rgba(34,197,94,0.06)',
                    border: `1px solid rgba(34,197,94,0.35)`,
                    borderRadius: 14,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      OPTIMAL: {result.optimal.label}
                    </div>
                    <div style={{ fontSize: 13, color: T.muted }}>{result.optimal.recommendation}</div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{result.summary}</div>
                  </div>
                  {result.optimal.marginDeltaEur > 0 && (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 30, fontWeight: 800, color: T.green, lineHeight: 1 }}>
                        €{fmt(result.optimal.marginDeltaEur)}
                      </div>
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>additional margin</div>
                    </div>
                  )}
                </div>

                {/* Comparison Matrix */}
                <div>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 600 }}>
                    Comparison Matrix
                  </div>
                  <ComparisonTable base={result.base} scenarios={result.scenarios} />
                </div>

                {/* Visual Delta Chart */}
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ fontSize: 11, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontWeight: 600 }}>
                    Margin Delta vs Base
                  </div>
                  <DeltaChart base={result.base} scenarios={result.scenarios} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: T.dim }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: T.green, display: 'inline-block' }} />
                      Positive delta
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: T.red, display: 'inline-block' }} />
                      Negative delta
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: T.dim, display: 'inline-block' }} />
                      Base
                    </span>
                  </div>
                </div>

                {/* Run history note */}
                <div style={{ fontSize: 12, color: T.dim, textAlign: 'right' }}>
                  This session: <span style={{ color: T.muted, fontWeight: 600 }}>{runCount} simulation{runCount !== 1 ? 's' : ''}</span> run
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
