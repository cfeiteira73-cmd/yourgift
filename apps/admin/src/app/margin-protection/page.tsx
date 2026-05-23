'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthSummary {
  totalAlerts: number;
  criticalAlerts: number;
  avgMarginPct: number;
  riskOrders: number;
  bySupplier: Array<{ supplier: string; alertCount: number; avgMarginPct: number }>;
}

interface MarginAlert {
  id: string;
  referenceId: string;
  referenceType: string;
  supplierName: string | null;
  category: string | null;
  salePrice: number;
  totalCost: number;
  actualMarginPct: number;
  expectedMarginPct: number;
  marginGapPct: number;
  severity: 'info' | 'warning' | 'critical';
  actionTaken: string;
  createdAt: string;
}

interface CostSnapshot {
  id: string;
  supplierName: string;
  category: string;
  productRef: string | null;
  unitCost: number;
  changePctVsPrior: number | null;
  source: string;
  snapshotDate: string;
}

interface DriftResult {
  category: string;
  currentCost: number;
  previousCost: number;
  changePct: number;
  driftSeverity: 'stable' | 'drift' | 'spike';
}

// ─── Local P&L math (mirrors the service exactly) ────────────────────────────

interface SimInputs {
  salePrice: number;
  productCost: number;
  shippingCost: number;
  printCost: number;
  platformFeePct: number;
  fulfillmentPct: number;
  quantity: number;
}

interface SimResult {
  grossRevenue: number;
  productCost: number;
  shippingCost: number;
  printCost: number;
  platformFee: number;
  fulfillmentFee: number;
  totalCost: number;
  grossMargin: number;
  grossMarginPct: number;
  netMargin: number;
  netMarginPct: number;
  isViable: boolean;
  riskLevel: 'safe' | 'warning' | 'critical';
}

function computePL(inputs: SimInputs): SimResult {
  const {
    salePrice,
    productCost,
    shippingCost,
    printCost,
    platformFeePct,
    fulfillmentPct,
    quantity,
  } = inputs;

  const grossRevenue = salePrice * quantity;
  const platformFee = (grossRevenue * platformFeePct) / 100;
  const fulfillmentFee = (grossRevenue * fulfillmentPct) / 100;
  const variableCostPerUnit = productCost + shippingCost + printCost;
  const totalCost = variableCostPerUnit * quantity + platformFee + fulfillmentFee;
  const grossMargin = grossRevenue - variableCostPerUnit * quantity;
  const grossMarginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
  const netMargin = grossRevenue - totalCost;
  const netMarginPct = grossRevenue > 0 ? (netMargin / grossRevenue) * 100 : 0;
  const riskLevel: 'safe' | 'warning' | 'critical' =
    netMarginPct < 10 ? 'critical' : netMarginPct < 18 ? 'warning' : 'safe';

  return {
    grossRevenue,
    productCost,
    shippingCost,
    printCost,
    platformFee,
    fulfillmentFee,
    totalCost,
    grossMargin,
    grossMarginPct,
    netMargin,
    netMarginPct,
    isViable: netMarginPct >= 8,
    riskLevel,
  };
}

const API = '/api/v1/margin-protection';

function fmt(n: number) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg[severity] ?? cfg['info']}`}>
      {severity}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const cfg: Record<string, string> = {
    blocked: 'bg-red-500/20 text-red-400',
    flagged: 'bg-amber-500/20 text-amber-400',
    warned: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cfg[action] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {action}
    </span>
  );
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

function DashboardTab() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [h, a] = await Promise.all([
      fetch(`${API}/health`).then((r) => r.json()),
      fetch(`${API}/alerts`).then((r) => r.json()),
    ]);
    setHealth(h);
    setAlerts(Array.isArray(a) ? a : []);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    await fetch(`${API}/alerts/${id}/resolve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setResolving(null);
    void load();
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts', value: health?.totalAlerts ?? 0, color: 'text-blue-400' },
          { label: 'Critical Alerts', value: health?.criticalAlerts ?? 0, color: 'text-red-400' },
          { label: 'Avg Margin %', value: health ? `${health.avgMarginPct.toFixed(1)}%` : '--', color: 'text-emerald-400' },
          { label: 'Risk Orders', value: health?.riskOrders ?? 0, color: 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-4">
            <p className="text-xs text-[#8ba8c7] mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Active Alerts Table */}
      <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a2f48]">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Active Margin Alerts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Reference', 'Supplier', 'Sale Price', 'Cost', 'Actual Margin', 'Gap', 'Severity', 'Action', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[#8ba8c7] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#4d6a87]">No active alerts</td>
                </tr>
              )}
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className={`border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors ${
                    alert.severity === 'critical' ? 'row-critical' : alert.severity === 'warning' ? 'row-warning' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-[#f0f6ff]">{alert.referenceId.slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-[#8ba8c7]">{alert.supplierName ?? '—'}</td>
                  <td className="px-3 py-2 text-[#f0f6ff]">€{fmt(Number(alert.salePrice))}</td>
                  <td className="px-3 py-2 text-[#8ba8c7]">€{fmt(Number(alert.totalCost))}</td>
                  <td className={`px-3 py-2 font-medium ${Number(alert.actualMarginPct) < 10 ? 'margin-critical' : Number(alert.actualMarginPct) < 18 ? 'margin-warning' : 'margin-safe'}`}>
                    {Number(alert.actualMarginPct).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-red-400">-{Number(alert.marginGapPct).toFixed(1)}%</td>
                  <td className="px-3 py-2"><SeverityBadge severity={alert.severity} /></td>
                  <td className="px-3 py-2"><ActionBadge action={alert.actionTaken} /></td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => { void handleResolve(alert.id); }}
                      disabled={resolving === alert.id}
                      className="px-2 py-1 bg-[#102131] hover:bg-[#1a2f48] border border-[#1a2f48] rounded text-[#8ba8c7] hover:text-[#f0f6ff] transition-colors disabled:opacity-50"
                    >
                      {resolving === alert.id ? '…' : 'Resolve'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Supplier */}
      {health && health.bySupplier.length > 0 && (
        <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2f48]">
            <h3 className="text-sm font-semibold text-[#f0f6ff]">By Supplier</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                {['Supplier', 'Alert Count', 'Avg Margin %'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[#8ba8c7] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {health.bySupplier.map((row) => (
                <tr key={row.supplier} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50">
                  <td className="px-3 py-2 text-[#f0f6ff]">{row.supplier}</td>
                  <td className="px-3 py-2 text-[#8ba8c7]">{row.alertCount}</td>
                  <td className={`px-3 py-2 font-medium ${row.avgMarginPct < 10 ? 'margin-critical' : row.avgMarginPct < 18 ? 'margin-warning' : 'margin-safe'}`}>
                    {row.avgMarginPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Waterfall Chart ──────────────────────────────────────────────────────────

function WaterfallChart({ result, inputs }: { result: SimResult; inputs: SimInputs }) {
  const rev = result.grossRevenue;
  if (rev <= 0) return null;

  const segments = [
    { label: 'Product', value: inputs.productCost * inputs.quantity, color: '#ef4444' },
    { label: 'Shipping', value: inputs.shippingCost * inputs.quantity, color: '#f59e0b' },
    { label: 'Print', value: inputs.printCost * inputs.quantity, color: '#a855f7' },
    { label: 'Fees', value: result.platformFee + result.fulfillmentFee, color: '#4da3ff' },
    { label: 'Net Margin', value: Math.max(0, result.netMargin), color: '#22c55e' },
  ];

  let offset = 0;

  return (
    <div className="mt-4">
      <p className="text-xs text-[#8ba8c7] mb-2">Revenue breakdown</p>
      <svg width="100%" height="44" viewBox="0 0 100 44" preserveAspectRatio="none" className="rounded overflow-hidden">
        {segments.map((seg) => {
          const pct = Math.max(0, (seg.value / rev) * 100);
          const x = offset;
          offset += pct;
          return (
            <g key={seg.label}>
              <rect x={`${x}%`} y={0} width={`${pct}%`} height={28} fill={seg.color} opacity={0.85} />
              {pct > 5 && (
                <text
                  x={`${x + pct / 2}%`}
                  y={18}
                  textAnchor="middle"
                  fill="white"
                  fontSize={5}
                  fontFamily="Inter, system-ui"
                >
                  {pct.toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: seg.color }} />
            <span className="text-xs text-[#8ba8c7]">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: Simulator ─────────────────────────────────────────────────────────

function SimulatorTab() {
  const [inputs, setInputs] = useState<SimInputs>({
    salePrice: 100,
    productCost: 40,
    shippingCost: 8,
    printCost: 5,
    platformFeePct: 8,
    fulfillmentPct: 12,
    quantity: 1,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const result = useMemo(() => computePL(inputs), [inputs]);

  const set = (key: keyof SimInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }));
  };

  const netColor =
    result.netMarginPct > 18
      ? 'text-emerald-400'
      : result.netMarginPct >= 10
        ? 'text-amber-400'
        : 'text-red-400';

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${API}/simulate/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inputs, ...result }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputClass =
    'w-full bg-[#102131] border border-[#1a2f48] rounded px-2 py-1.5 text-sm text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]';

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f0f6ff]">Inputs</h3>
        {([
          ['salePrice', 'Sale Price (€)'],
          ['productCost', 'Product Cost (€)'],
          ['shippingCost', 'Shipping Cost (€)'],
          ['printCost', 'Print / Customization Cost (€)'],
          ['platformFeePct', 'Platform Fee (%)'],
          ['fulfillmentPct', 'Fulfillment (%)'],
          ['quantity', 'Quantity'],
        ] as [keyof SimInputs, string][]).map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs text-[#8ba8c7] mb-1">{label}</label>
            <input
              type="number"
              min={0}
              step={key === 'quantity' ? 1 : 0.01}
              value={inputs[key]}
              onChange={set(key)}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {/* Results */}
      <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f0f6ff]">P&L Breakdown</h3>

        <div className="space-y-0.5">
          {([
            ['Revenue', result.grossRevenue, 'text-[#f0f6ff]'],
            ['Product Cost', -inputs.productCost * inputs.quantity, 'text-[#8ba8c7]'],
            ['Shipping', -inputs.shippingCost * inputs.quantity, 'text-[#8ba8c7]'],
            ['Print Cost', -inputs.printCost * inputs.quantity, 'text-[#8ba8c7]'],
            ['Platform Fee', -result.platformFee, 'text-[#8ba8c7]'],
            ['Fulfillment', -result.fulfillmentFee, 'text-[#8ba8c7]'],
          ] as [string, number, string][]).map(([label, val, cls]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-[#1a2f48]/50">
              <span className="text-xs text-[#8ba8c7]">{label}</span>
              <span className={`text-xs font-medium ${cls}`}>
                {val < 0 ? '(' : ''}€{fmt(Math.abs(val))}{val < 0 ? ')' : ''}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div className="h-px bg-[#1a2f48] my-1" />

          {/* Net Margin */}
          <div className="flex justify-between py-2 rounded px-1 bg-[#102131]">
            <span className="text-xs font-semibold text-[#f0f6ff]">Net Margin</span>
            <span className={`text-sm font-bold ${netColor}`}>
              €{fmt(result.netMargin)}{' '}
              <span className="text-xs">({result.netMarginPct.toFixed(1)}%)</span>
            </span>
          </div>
        </div>

        {/* Risk badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8ba8c7]">Risk:</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            result.riskLevel === 'safe'
              ? 'bg-emerald-500/20 text-emerald-400'
              : result.riskLevel === 'warning'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
          }`}>
            {result.riskLevel}
          </span>
          <span className="text-xs text-[#8ba8c7]">
            {result.isViable ? '— Viable' : '— NOT viable (< 8% net)'}
          </span>
        </div>

        <WaterfallChart result={result} inputs={inputs} />

        <button
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="w-full py-2 rounded bg-[#4da3ff]/20 hover:bg-[#4da3ff]/30 border border-[#4da3ff]/30 text-[#4da3ff] text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Simulation'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab 3: Cost Drift ────────────────────────────────────────────────────────

const KNOWN_SUPPLIERS = ['midocean', 'pf_concept', 'stricker'];

function DriftTab() {
  const [supplier, setSupplier] = useState('midocean');
  const [loading, setLoading] = useState(false);
  const [drift, setDrift] = useState<DriftResult[]>([]);
  const [history, setHistory] = useState<CostSnapshot[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const [d, h] = await Promise.all([
      fetch(`${API}/drift/${encodeURIComponent(supplier)}`).then((r) => r.json()),
      fetch(`${API}/cost-history?supplier=${encodeURIComponent(supplier)}&limit=20`).then((r) => r.json()),
    ]);
    setDrift(Array.isArray(d) ? d : []);
    setHistory(Array.isArray(h) ? h : []);
    setLoading(false);
    setAnalyzed(true);
  };

  const driftBadge = (sev: DriftResult['driftSeverity']) => {
    const cfg = {
      stable: 'bg-emerald-500/20 text-emerald-400',
      drift: 'bg-amber-500/20 text-amber-400',
      spike: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg[sev]}`}>{sev}</span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-4 flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs text-[#8ba8c7] mb-1">Supplier</label>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full bg-[#102131] border border-[#1a2f48] rounded px-2 py-1.5 text-sm text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
          >
            {KNOWN_SUPPLIERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { void analyze(); }}
          disabled={loading}
          className="px-4 py-2 bg-[#4da3ff] hover:bg-[#4da3ff]/90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {analyzed && (
        <>
          {/* Drift Results */}
          <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2f48]">
              <h3 className="text-sm font-semibold text-[#f0f6ff]">Cost Drift — {supplier}</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['Category', 'Current Cost', 'Previous Cost', 'Change %', 'Severity'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[#8ba8c7] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drift.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-[#4d6a87]">No drift data (need at least 2 snapshots per category)</td></tr>
                ) : (
                  drift.map((row, i) => (
                    <tr key={i} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50">
                      <td className="px-3 py-2 text-[#f0f6ff]">{row.category}</td>
                      <td className="px-3 py-2 text-[#f0f6ff]">€{fmt(row.currentCost)}</td>
                      <td className="px-3 py-2 text-[#8ba8c7]">€{fmt(row.previousCost)}</td>
                      <td className={`px-3 py-2 font-medium ${row.changePct > 0 ? 'text-red-400' : row.changePct < 0 ? 'text-emerald-400' : 'text-[#8ba8c7]'}`}>
                        {row.changePct > 0 ? '↑' : row.changePct < 0 ? '↓' : '→'} {Math.abs(row.changePct).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2">{driftBadge(row.driftSeverity)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Snapshots */}
          <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2f48]">
              <h3 className="text-sm font-semibold text-[#f0f6ff]">Recent Snapshots</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['Date', 'Category', 'Unit Cost', 'Change vs Prior', 'Source'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[#8ba8c7] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-[#4d6a87]">No snapshots</td></tr>
                ) : (
                  history.map((snap) => (
                    <tr key={snap.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50">
                      <td className="px-3 py-2 text-[#8ba8c7]">{new Date(snap.snapshotDate).toLocaleDateString('pt-PT')}</td>
                      <td className="px-3 py-2 text-[#f0f6ff]">{snap.category}</td>
                      <td className="px-3 py-2 text-[#f0f6ff]">€{fmt(Number(snap.unitCost))}</td>
                      <td className={`px-3 py-2 ${snap.changePctVsPrior !== null && Number(snap.changePctVsPrior) > 0 ? 'text-red-400' : snap.changePctVsPrior !== null && Number(snap.changePctVsPrior) < 0 ? 'text-emerald-400' : 'text-[#8ba8c7]'}`}>
                        {snap.changePctVsPrior !== null ? `${Number(snap.changePctVsPrior) > 0 ? '+' : ''}${Number(snap.changePctVsPrior).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-[#8ba8c7]">{snap.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Margin Dashboard', 'Profitability Simulator', 'Cost Drift Analysis'] as const;
type Tab = (typeof TABS)[number];

export default function MarginProtectionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Margin Dashboard');

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#f0f6ff]">Margin Protection Engine</h1>
        <p className="text-sm text-[#8ba8c7] mt-0.5">
          Dynamic floor rules · Cost drift detection · Real-time P&L simulator
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1a2f48]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#4da3ff] text-[#4da3ff]'
                : 'border-transparent text-[#8ba8c7] hover:text-[#f0f6ff]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Margin Dashboard' && <DashboardTab />}
      {activeTab === 'Profitability Simulator' && <SimulatorTab />}
      {activeTab === 'Cost Drift Analysis' && <DriftTab />}
    </div>
  );
}
