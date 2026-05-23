'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string | null | undefined): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '€—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
}

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function riskColor(level: string): string {
  const l = level?.toLowerCase();
  if (l === 'low') return '#22c55e';
  if (l === 'medium') return '#f59e0b';
  return '#ef4444';
}

function riskBg(level: string): string {
  const l = level?.toLowerCase();
  if (l === 'low') return 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30';
  if (l === 'medium') return 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30';
  return 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30';
}

function statusDotColor(status: string): string {
  const s = status?.toLowerCase();
  if (s === 'completed' || s === 'delivered') return '#22c55e';
  if (s === 'in_production' || s === 'in_transit' || s === 'processing') return '#4da3ff';
  if (s === 'pending' || s === 'created') return '#f59e0b';
  if (s === 'cancelled' || s === 'failed') return '#ef4444';
  return '#4d6a87';
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SystemState {
  overallSystemScore: number;
  totalOpenOrders: number;
  ordersInProduction: number;
  slaBreaches: number;
  pendingDecisions: number;
  activeAlerts: number;
  supplierHealthScore: number;
}

interface StateHistoryEntry {
  overallSystemScore: number;
  createdAt: string;
}

interface Decision {
  id: string;
  triggerType: string;
  triggerDescription?: string;
  action: string;
  riskLevel: string;
  riskScore: number;
  confidenceScore: number;
  marginImpact?: number;
  deliveryImpact?: number;
  failureProbability?: number;
  reasoning?: string;
  status: string;
  createdAt: string;
  alternatives?: DecisionAlternative[];
}

interface DecisionAlternative {
  action: string;
  marginImpact?: number;
  deliveryDaysImpact?: number;
  riskScore?: number;
  confidenceScore?: number;
}

interface ResolvedDecision {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface OrderFeed {
  id: string;
  ref?: string;
  status: string;
  totalAmount?: number | string;
  createdAt: string;
  client?: { name?: string; email?: string };
}

interface SupplierSignal {
  supplierName: string;
  reliabilityScore: number;
  avgScoreDelta?: number;
  status?: string;
}

interface DecisionStats {
  totalDecisions: number;
  autoExecutionRate: number;
  avgRiskScore: number;
  pendingDecisions: number;
}

interface SimResult {
  finalCost?: number;
  netMargin?: number;
  netMarginPct?: number;
  shippingCost?: number;
  shippingProvider?: string;
  estimatedDeliveryDays?: number;
  riskScore?: number;
  recommendedAction?: string;
}

interface SimInput {
  productCost: number;
  salePrice: number;
  quantity: number;
  originCountry: string;
  destinationCountry: string;
  weightKg: number;
  supplierName: string;
}

// ─── icons ────────────────────────────────────────────────────────────────────

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 1L9.5 6H14.5L10.5 9.5L12 14.5L8 11L4 14.5L5.5 9.5L1.5 6H6.5L8 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircuitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="1" r="1" fill="currentColor" />
      <circle cx="8" cy="15" r="1" fill="currentColor" />
      <circle cx="1" cy="8" r="1" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

// ─── sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.length === 0 ? Array.from({ length: 12 }, () => 75) : data;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 300;
  const H = 40;
  const step = W / (pts.length - 1);
  const points = pts
    .map((v, i) => `${i * step},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${H} ${points} ${W},${H}`} fill={color} fillOpacity="0.07" strokeWidth="0" />
    </svg>
  );
}

// ─── gauge arc ────────────────────────────────────────────────────────────────

function GaugeArc({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(value / max, 1);
  const r = 18;
  const cx = 22;
  const cy = 22;
  const circ = Math.PI * r; // half circle
  const offset = circ * (1 - pct);
  return (
    <svg width="44" height="28" viewBox="0 0 44 30">
      <path
        d={`M4,26 A${r},${r} 0 0,1 40,26`}
        fill="none"
        stroke="#1a2f48"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={`M4,26 A${r},${r} 0 0,1 40,26`}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(0deg)' }}
      />
      <text x="22" y="27" textAnchor="middle" fill={color} fontSize="8" fontWeight="600">
        {value}
      </text>
    </svg>
  );
}

// ─── mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1 bg-[#1a2f48] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-[13px] font-medium animate-fade-in shadow-lg ${
        type === 'success'
          ? 'bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#22c55e]'
          : 'bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444]'
      }`}
    >
      {message}
    </div>
  );
}

// ─── section title ────────────────────────────────────────────────────────────

function SectionTitle({ icon, label, muted }: { icon: ReactNode; label: string; muted?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[#4da3ff]">{icon}</span>
      <span className="font-tight text-[13px] font-semibold text-[#f0f6ff]">{label}</span>
      {muted && <span className="text-[11px] text-[#4d6a87] ml-auto">{muted}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════════════════════

function TopBar({
  systemScore,
  pendingCount,
  lastUpdated,
  onSnapshot,
  snapshotLoading,
}: {
  systemScore: number | null;
  pendingCount: number;
  lastUpdated: Date | null;
  onSnapshot: () => void;
  snapshotLoading: boolean;
}) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsAgo(lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : 0);
    }, 1000);
    return () => clearInterval(iv);
  }, [lastUpdated]);

  const color = systemScore != null ? scoreColor(systemScore) : '#4d6a87';

  return (
    <div className="sticky top-0 z-30 bg-[#070B14] border-b border-[#1a2f48] px-6 py-3 flex items-center justify-between gap-4">
      {/* Left */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full bg-[#22c55e] pulse-live flex-shrink-0"
          aria-label="Live indicator"
        />
        <span className="font-tight text-[15px] font-semibold text-[#f0f6ff]">
          Procurement Command Brain
        </span>
      </div>

      {/* Center: System Score */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[#4d6a87] uppercase tracking-wide">System Score</span>
        {systemScore != null ? (
          <>
            <span className="font-tight text-[22px] font-semibold" style={{ color }}>
              {systemScore}
            </span>
            <div className="w-24 h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${systemScore}%`, backgroundColor: color }}
              />
            </div>
          </>
        ) : (
          <span className="w-16 h-5 skeleton rounded" />
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-[12px] font-medium">
            ⊙ {pendingCount} Pending
          </span>
        )}
        <button
          type="button"
          onClick={onSnapshot}
          disabled={snapshotLoading}
          className="px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#8ba8c7] hover:border-[#1f3855] hover:text-[#f0f6ff] text-[12px] font-medium transition-colors disabled:opacity-50"
        >
          {snapshotLoading ? 'Saving…' : 'Take Snapshot'}
        </button>
        <div className="flex items-center gap-1.5 text-[12px] text-[#4d6a87]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span>Updated {secondsAgo}s ago</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function LeftPanel({
  state,
  history,
  orders,
  suppliers,
  loading,
}: {
  state: SystemState | null;
  history: StateHistoryEntry[];
  orders: OrderFeed[];
  suppliers: SupplierSignal[];
  loading: boolean;
}) {
  const historyScores = history.map((h) => h.overallSystemScore);
  const latestScore = state?.overallSystemScore ?? 75;
  const sparkColor = scoreColor(latestScore);

  const metrics: { label: string; value: string | number; color?: string; isBar?: boolean }[] = state
    ? [
        { label: 'Open Orders', value: state.totalOpenOrders },
        { label: 'In Production', value: state.ordersInProduction, color: '#4da3ff' },
        { label: 'SLA Breaches', value: state.slaBreaches, color: state.slaBreaches > 0 ? '#ef4444' : '#22c55e' },
        { label: 'Pending Decisions', value: state.pendingDecisions, color: state.pendingDecisions > 0 ? '#f59e0b' : '#22c55e' },
        { label: 'Active Alerts', value: state.activeAlerts, color: state.activeAlerts > 0 ? '#ef4444' : '#22c55e' },
        { label: 'Supplier Health', value: `${state.supplierHealthScore}%`, color: scoreColor(state.supplierHealthScore), isBar: true },
      ]
    : [];

  if (loading && !state) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* State title */}
      <SectionTitle icon={<SparkleIcon />} label="Live State" muted="15s refresh" />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[#102131] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] text-[#4d6a87] uppercase tracking-wide leading-none">{m.label}</span>
            <span className="font-tight text-[22px] font-semibold leading-tight" style={{ color: m.color ?? '#f0f6ff' }}>
              {m.value}
            </span>
            {m.isBar && state && (
              <MiniBar value={state.supplierHealthScore} color={scoreColor(state.supplierHealthScore)} />
            )}
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div className="bg-[#0b1526] rounded-xl p-3 border border-[#1a2f48]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#4d6a87] uppercase tracking-wide">Score History</span>
          <span className="text-[11px] font-medium" style={{ color: sparkColor }}>{latestScore}</span>
        </div>
        <Sparkline data={historyScores} color={sparkColor} />
      </div>

      {/* Orders stream */}
      <div>
        <SectionTitle icon={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        } label="Order Stream" />
        <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-[#4d6a87]">No recent orders</div>
          ) : (
            orders.slice(0, 6).map((order) => (
              <div key={order.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a2f48] last:border-0 hover:bg-[#102131]/50 transition-colors">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusDotColor(order.status) }}
                />
                <span className="font-tight text-[12px] font-semibold text-[#f0f6ff] w-20 truncate">
                  {(order.ref ?? order.id).slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[11px] text-[#4d6a87] flex-1 truncate max-w-[120px]">
                  {order.client?.name ?? order.client?.email ?? 'Unknown'}
                </span>
                <span className="text-[11px] text-[#8ba8c7] ml-auto flex-shrink-0">
                  {fmtCurrency(Number(order.totalAmount ?? 0))}
                </span>
                <span className="text-[10px] text-[#4d6a87] flex-shrink-0">{timeAgo(order.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Supplier signals */}
      <div>
        <SectionTitle icon={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 12L8 4l6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="4" r="1.5" fill="currentColor" />
          </svg>
        } label="Supplier Signals" />
        <div className="space-y-2">
          {suppliers.slice(0, 3).map((s, i) => {
            const c = scoreColor(s.reliabilityScore);
            const delta = s.avgScoreDelta ?? 0;
            return (
              <div key={`${s.supplierName}-${i}`} className="bg-[#102131] rounded-xl p-3 border border-[#1a2f48]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium text-[#f0f6ff] truncate">{s.supplierName}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                      {delta >= 0 ? '▲' : '▼'}
                    </span>
                    <span className="text-[12px] font-semibold" style={{ color: c }}>{s.reliabilityScore}%</span>
                  </div>
                </div>
                <MiniBar value={s.reliabilityScore} color={c} />
              </div>
            );
          })}
          {suppliers.length === 0 && (
            <div className="text-center text-[12px] text-[#4d6a87] py-3">No supplier data</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface BenchmarkData {
  label: string;
  vsBenchmarkPct: number;
}

function CenterPanel({
  decisions,
  resolved,
  currentIdx,
  setCurrentIdx,
  onDecisionAction,
  stats,
  benchmark,
}: {
  decisions: Decision[];
  resolved: ResolvedDecision[];
  currentIdx: number;
  setCurrentIdx: (i: number) => void;
  onDecisionAction: (id: string, action: 'approve' | 'reject', reasoning?: string) => Promise<void>;
  stats: DecisionStats | null;
  benchmark: BenchmarkData | null;
}) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [modifyMode, setModifyMode] = useState(false);
  const [modifyText, setModifyText] = useState('');

  const decision = decisions[currentIdx] ?? null;

  async function handleAction(type: 'approve' | 'reject') {
    if (!decision) return;
    setActionLoading(type);
    await onDecisionAction(decision.id, type, type === 'approve' && modifyMode ? modifyText : undefined);
    setActionLoading(null);
    setModifyMode(false);
    setModifyText('');
  }

  // Empty state
  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6"
        style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.08)' }}>
        <div className="text-center space-y-3">
          <div className="text-[28px] text-[#22c55e] mb-2">✦</div>
          <div className="font-tight text-[18px] font-semibold text-[#f0f6ff]">All decisions processed</div>
          <div className="text-[13px] text-[#4d6a87]">The system is operating autonomously.</div>
          <div className="text-[13px] text-[#4d6a87]">Zero decisions require human input.</div>
        </div>
        {stats && (
          <div className="flex gap-6 mt-2">
            <div className="text-center">
              <div className="text-[20px] font-tight font-semibold text-[#22c55e]">
                {stats.autoExecutionRate?.toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#4d6a87]">auto-execute rate</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-tight font-semibold text-[#4da3ff]">
                {stats.totalDecisions}
              </div>
              <div className="text-[11px] text-[#4d6a87]">total decisions today</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!decision) return null;

  const marginImpact = decision.marginImpact ?? 0;
  const deliveryImpact = decision.deliveryImpact ?? 0;
  const failureProb = decision.failureProbability ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle icon={<SparkleIcon />} label="Decision Focus" />
        <span className="text-[11px] text-[#4d6a87]">
          {currentIdx + 1} of {decisions.length} pending
        </span>
      </div>

      {/* Main decision card */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-6 flex flex-col gap-5">
        {/* Card header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-0.5 rounded-md bg-[#102131] border border-[#1a2f48] text-[10px] text-[#4da3ff] uppercase tracking-wide font-medium w-fit">
              {decision.triggerType?.replace(/_/g, ' ')}
            </span>
            {decision.triggerDescription && (
              <span className="text-[12px] text-[#4d6a87]">{decision.triggerDescription}</span>
            )}
          </div>
          <span className="text-[11px] text-[#4d6a87] flex-shrink-0">{timeAgo(decision.createdAt)}</span>
        </div>

        {/* Action — most prominent */}
        <div className="font-tight text-[18px] font-semibold text-[#f0f6ff] leading-snug">
          {decision.action}
        </div>

        {/* Risk & Confidence row */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${riskBg(decision.riskLevel)}`}>
            {decision.riskLevel?.toUpperCase() ?? 'UNKNOWN'} RISK
          </span>
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#4d6a87]">Confidence</span>
              <span className="text-[#4da3ff] font-medium">{Math.round((decision.confidenceScore ?? 0) * 100)}%</span>
            </div>
            <MiniBar value={(decision.confidenceScore ?? 0) * 100} color="#4da3ff" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <GaugeArc value={decision.riskScore ?? 0} color={riskColor(decision.riskLevel)} />
            <span className="text-[10px] text-[#4d6a87]">Risk</span>
          </div>
        </div>

        {/* Impact grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Margin Impact',
              value: marginImpact >= 0 ? `+€${marginImpact.toFixed(2)}` : `-€${Math.abs(marginImpact).toFixed(2)}`,
              color: marginImpact >= 0 ? '#22c55e' : '#ef4444',
            },
            {
              label: 'Delivery Impact',
              value: deliveryImpact === 0 ? '±0 days' : deliveryImpact > 0 ? `+${deliveryImpact}d` : `${deliveryImpact}d`,
              color: deliveryImpact <= 0 ? '#22c55e' : '#f59e0b',
            },
            {
              label: 'Failure Prob.',
              value: `${Math.round(failureProb * 100)}%`,
              color: failureProb < 0.1 ? '#22c55e' : failureProb < 0.3 ? '#f59e0b' : '#ef4444',
            },
          ].map((cell) => (
            <div key={cell.label} className="bg-[#102131] rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#4d6a87] uppercase tracking-wide mb-1">{cell.label}</div>
              <div className="font-tight text-[16px] font-semibold" style={{ color: cell.color }}>
                {cell.value}
              </div>
            </div>
          ))}
        </div>

        {/* Global Benchmark */}
        {benchmark && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(77,163,255,0.08)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: 8, marginTop: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#4da3ff" strokeWidth="1.2" />
              <path d="M4 7h6M7 4v6" stroke="#4da3ff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, color: '#8ba8c7' }}>vs global avg:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: benchmark.vsBenchmarkPct >= 0 ? '#22c55e' : '#ef4444' }}>
              {benchmark.vsBenchmarkPct >= 0 ? '↑' : '↓'}{Math.abs(benchmark.vsBenchmarkPct).toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: '#4d6a87', marginLeft: 'auto' }}>{benchmark.label}</span>
          </div>
        )}

        {/* AI Reasoning */}
        {decision.reasoning && (
          <div className="bg-[#102131] rounded-xl p-4 border border-[#a855f7]/20 ai-glow">
            <div className="flex items-center gap-2 mb-2">
              <SparkleIcon className="text-[#a855f7]" />
              <span className="text-[11px] font-semibold text-[#a855f7] uppercase tracking-wide">AI Reasoning</span>
            </div>
            <p className="text-[13px] text-[#8ba8c7] leading-relaxed">{decision.reasoning}</p>
          </div>
        )}

        {/* Modify mode */}
        {modifyMode && (
          <div className="animate-fade-in">
            <textarea
              value={modifyText}
              onChange={(e) => setModifyText(e.target.value)}
              placeholder="Enter modified reasoning or action…"
              className="w-full bg-[#102131] border border-[#1f3855] rounded-xl p-3 text-[13px] text-[#f0f6ff] placeholder:text-[#4d6a87] resize-none h-24 focus:outline-none focus:border-[#4da3ff]"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleAction('approve')}
            disabled={actionLoading !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-6 py-2.5 rounded-xl font-medium text-[14px] transition-colors disabled:opacity-50"
          >
            {actionLoading === 'approve' ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : '✓'}
            Approve
          </button>
          <button
            type="button"
            onClick={() => setModifyMode((v) => !v)}
            disabled={actionLoading !== null}
            className="flex-1 bg-[#1a2f48] hover:bg-[#1f3855] text-[#f0f6ff] px-6 py-2.5 rounded-xl font-medium text-[14px] transition-colors disabled:opacity-50"
          >
            {modifyMode ? 'Cancel' : 'Modify'}
          </button>
          <button
            type="button"
            onClick={() => handleAction('reject')}
            disabled={actionLoading !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/30 px-6 py-2.5 rounded-xl font-medium text-[14px] transition-colors disabled:opacity-50"
          >
            {actionLoading === 'reject' ? (
              <span className="w-4 h-4 border-2 border-[#ef4444]/30 border-t-[#ef4444] rounded-full animate-spin" />
            ) : '✕'}
            Reject
          </button>
        </div>

        {/* Navigation */}
        {decisions.length > 1 && (
          <div className="flex items-center justify-between pt-1 border-t border-[#1a2f48]">
            <button
              type="button"
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="text-[12px] text-[#4da3ff] hover:text-[#f0f6ff] disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-[11px] text-[#4d6a87]">{currentIdx + 1} / {decisions.length} pending</span>
            <button
              type="button"
              onClick={() => setCurrentIdx(Math.min(decisions.length - 1, currentIdx + 1))}
              disabled={currentIdx === decisions.length - 1}
              className="text-[12px] text-[#4da3ff] hover:text-[#f0f6ff] disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Decision history strip */}
      {resolved.length > 0 && (
        <div>
          <div className="text-[10px] text-[#4d6a87] uppercase tracking-wide mb-2">Recent Decisions</div>
          <div className="space-y-1.5">
            {resolved.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-[#0b1526] rounded-lg border border-[#1a2f48]">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    r.status === 'approved'
                      ? 'bg-[#22c55e]/10 text-[#22c55e]'
                      : 'bg-[#ef4444]/10 text-[#ef4444]'
                  }`}
                >
                  {r.status?.toUpperCase()}
                </span>
                <span className="text-[12px] text-[#8ba8c7] flex-1 truncate">
                  {r.action.slice(0, 40)}{r.action.length > 40 ? '…' : ''}
                </span>
                <span className="text-[11px] text-[#4d6a87] flex-shrink-0">{timeAgo(r.updatedAt ?? r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function RightPanel({
  activeDecision,
  stats,
  onAlternativeSelect,
}: {
  activeDecision: Decision | null;
  stats: DecisionStats | null;
  onAlternativeSelect: (alt: DecisionAlternative) => void;
}) {
  const [simInput, setSimInput] = useState<SimInput>({
    productCost: 15,
    salePrice: 45,
    quantity: 100,
    originCountry: 'NL',
    destinationCountry: 'PT',
    weightKg: 2.5,
    supplierName: '',
  });
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  async function runSimulation() {
    setSimLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/decision-engine/simulate`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...simInput, targetPrice: simInput.salePrice }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch {
      // silent
    } finally {
      setSimLoading(false);
    }
  }

  const marginColor = simResult
    ? (simResult.netMargin ?? 0) >= 0 ? '#22c55e' : '#ef4444'
    : '#f0f6ff';

  const rScore = simResult?.riskScore ?? 0;

  return (
    <div className="space-y-5">
      {/* Simulation Engine title */}
      <SectionTitle icon={<CircuitIcon />} label="Simulation Engine" />

      {/* Quick simulator form */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
        <div className="text-[11px] text-[#4d6a87] mb-3 uppercase tracking-wide">Quick Simulation</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Product Cost */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Product Cost (€)</label>
            <input
              type="number"
              value={simInput.productCost}
              onChange={(e) => setSimInput((p) => ({ ...p, productCost: Number(e.target.value) }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            />
          </div>
          {/* Sale Price */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Sale Price (€)</label>
            <input
              type="number"
              value={simInput.salePrice}
              onChange={(e) => setSimInput((p) => ({ ...p, salePrice: Number(e.target.value) }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            />
          </div>
          {/* Quantity */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Quantity</label>
            <input
              type="number"
              value={simInput.quantity}
              onChange={(e) => setSimInput((p) => ({ ...p, quantity: Number(e.target.value) }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            />
          </div>
          {/* Weight */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={simInput.weightKg}
              onChange={(e) => setSimInput((p) => ({ ...p, weightKg: Number(e.target.value) }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            />
          </div>
          {/* Origin */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Origin</label>
            <select
              value={simInput.originCountry}
              onChange={(e) => setSimInput((p) => ({ ...p, originCountry: e.target.value }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            >
              {['NL', 'PL', 'DE', 'CN', 'PT'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Destination */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#4d6a87]">Destination</label>
            <select
              value={simInput.destinationCountry}
              onChange={(e) => setSimInput((p) => ({ ...p, destinationCountry: e.target.value }))}
              className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]"
            >
              {['PT', 'ES', 'DE', 'FR', 'GB', 'US', 'AE'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {/* Supplier */}
        <div className="flex flex-col gap-1 mb-3">
          <label className="text-[10px] text-[#4d6a87]">Supplier</label>
          <input
            type="text"
            value={simInput.supplierName}
            onChange={(e) => setSimInput((p) => ({ ...p, supplierName: e.target.value }))}
            placeholder="Supplier name…"
            className="bg-[#102131] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] placeholder:text-[#4d6a87] focus:outline-none focus:border-[#4da3ff]"
          />
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={simLoading}
          className="w-full bg-[#a855f7] hover:bg-[#7c3aed] text-white py-2 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {simLoading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          {simLoading ? 'Simulating…' : 'Simulate ▶'}
        </button>
      </div>

      {/* Simulation result */}
      {simResult && (
        <div className="bg-[#102131] border border-[#1a2f48] rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wide mb-1">Simulation Result</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-[#4d6a87] mb-0.5">Final Cost</div>
              <div className="font-tight text-[16px] font-semibold text-[#f0f6ff]">
                {fmtCurrency(simResult.finalCost ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#4d6a87] mb-0.5">Net Margin</div>
              <div className="font-tight text-[16px] font-semibold" style={{ color: marginColor }}>
                {fmtCurrency(simResult.netMargin ?? 0)}
                {simResult.netMarginPct != null && (
                  <span className="text-[12px] ml-1">({simResult.netMarginPct.toFixed(1)}%)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#4d6a87] mb-0.5">Shipping</div>
              <div className="text-[13px] text-[#8ba8c7]">
                {fmtCurrency(simResult.shippingCost ?? 0)}
                {simResult.shippingProvider && <span className="text-[#4d6a87]"> · {simResult.shippingProvider}</span>}
                {simResult.estimatedDeliveryDays != null && (
                  <span className="text-[#4d6a87]"> — {simResult.estimatedDeliveryDays}d</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#4d6a87] mb-1">Risk Score</div>
              <MiniBar value={rScore} color={scoreColor(100 - rScore)} />
              <div className="text-[11px] mt-1" style={{ color: scoreColor(100 - rScore) }}>{rScore}/100</div>
            </div>
          </div>
          {simResult.recommendedAction && (
            <div className="pt-2 border-t border-[#1a2f48]">
              <div className="text-[10px] text-[#4d6a87] mb-1">Recommended Action</div>
              <p className="text-[12px] text-[#8ba8c7] italic">{simResult.recommendedAction}</p>
            </div>
          )}
        </div>
      )}

      {/* Alternatives panel */}
      {activeDecision?.alternatives && activeDecision.alternatives.length > 0 && (
        <div>
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wide mb-2">Decision Alternatives</div>
          <div className="space-y-2">
            {activeDecision.alternatives.map((alt, i) => {
              const altMargin = alt.marginImpact ?? 0;
              const altConf = (alt.confidenceScore ?? 0) * 100;
              const altRisk = alt.riskScore ?? 0;
              return (
                <div
                  key={i}
                  className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-3 cursor-pointer hover:border-[#1f3855] transition-colors"
                >
                  <div className="font-medium text-[13px] text-[#f0f6ff] mb-2 leading-snug">{alt.action}</div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center">
                      <div className="text-[10px] text-[#4d6a87]">Margin</div>
                      <div className="text-[12px] font-semibold" style={{ color: altMargin >= 0 ? '#22c55e' : '#ef4444' }}>
                        {altMargin >= 0 ? '+' : ''}{altMargin.toFixed(1)}€
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[#4d6a87]">Delivery</div>
                      <div className="text-[12px] font-semibold text-[#4da3ff]">
                        {alt.deliveryDaysImpact != null ? `${alt.deliveryDaysImpact > 0 ? '+' : ''}${alt.deliveryDaysImpact}d` : '—'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[#4d6a87]">Risk</div>
                      <div className="text-[12px] font-semibold" style={{ color: scoreColor(100 - altRisk) }}>
                        {altRisk}/100
                      </div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#4d6a87]">Confidence</span>
                      <span className="text-[#4da3ff]">{Math.round(altConf)}%</span>
                    </div>
                    <MiniBar value={altConf} color="#4da3ff" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onAlternativeSelect(alt)}
                    className="w-full py-1.5 rounded-lg bg-[#4da3ff]/10 hover:bg-[#4da3ff]/20 text-[#4da3ff] text-[11px] font-medium transition-colors border border-[#4da3ff]/20"
                  >
                    Select This
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats strip */}
      {stats && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wide mb-3">Engine Stats</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Decisions', value: String(stats.totalDecisions), color: '#f0f6ff' },
              { label: 'Auto-Exec Rate', value: `${stats.autoExecutionRate?.toFixed(1)}%`, color: '#22c55e' },
              { label: 'Avg Risk Score', value: String(Math.round(stats.avgRiskScore ?? 0)), color: scoreColor(100 - (stats.avgRiskScore ?? 0)) },
              { label: 'Pending', value: String(stats.pendingDecisions), color: stats.pendingDecisions > 0 ? '#f59e0b' : '#22c55e' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-tight text-[18px] font-semibold" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[10px] text-[#4d6a87] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BrainPage() {
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [stateHistory, setStateHistory] = useState<StateHistoryEntry[]>([]);
  const [pendingDecisions, setPendingDecisions] = useState<Decision[]>([]);
  const [resolvedDecisions, setResolvedDecisions] = useState<ResolvedDecision[]>([]);
  const [decisionStats, setDecisionStats] = useState<DecisionStats | null>(null);
  const [orders, setOrders] = useState<OrderFeed[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSignal[]>([]);
  const [currentDecisionIdx, setCurrentDecisionIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const loadData = useCallback(async () => {
    const headers = getHeaders();
    const [stateRes, pendingRes, historyRes, statsRes, ordersRes, suppliersRes, resolvedRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/decision-engine/state`, { headers }),
      fetch(`${API_BASE}/api/v1/decision-engine/decisions/pending`, { headers }),
      fetch(`${API_BASE}/api/v1/decision-engine/state/history?limit=12`, { headers }),
      fetch(`${API_BASE}/api/v1/decision-engine/stats`, { headers }),
      fetch(`${API_BASE}/api/v1/orders?limit=6`, { headers }),
      fetch(`${API_BASE}/api/v1/automation/supplier-intelligence`, { headers }),
      fetch(`${API_BASE}/api/v1/decision-engine/decisions?limit=5&status=approved`, { headers }),
    ]);

    if (stateRes.status === 'fulfilled' && stateRes.value.ok) {
      try { setSystemState(await stateRes.value.json()); } catch { /* ignore */ }
    }
    if (pendingRes.status === 'fulfilled' && pendingRes.value.ok) {
      try {
        const d = await pendingRes.value.json();
        const items: Decision[] = Array.isArray(d) ? d : (d.decisions ?? d.data ?? []);
        setPendingDecisions(items);
        setCurrentDecisionIdx((prev) => Math.min(prev, Math.max(0, items.length - 1)));
      } catch { /* ignore */ }
    }
    if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
      try {
        const d = await historyRes.value.json();
        const items: StateHistoryEntry[] = Array.isArray(d) ? d : (d.history ?? d.data ?? []);
        setStateHistory(items);
      } catch { /* ignore */ }
    }
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      try { setDecisionStats(await statsRes.value.json()); } catch { /* ignore */ }
    }
    if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
      try {
        const d = await ordersRes.value.json();
        const items: OrderFeed[] = Array.isArray(d) ? d : (d.orders ?? d.data ?? []);
        setOrders(items);
      } catch { /* ignore */ }
    }
    if (suppliersRes.status === 'fulfilled' && suppliersRes.value.ok) {
      try {
        const d = await suppliersRes.value.json();
        const items: SupplierSignal[] = Array.isArray(d) ? d : (d.suppliers ?? d.data ?? []);
        setSuppliers(items);
      } catch { /* ignore */ }
    }
    if (resolvedRes.status === 'fulfilled' && resolvedRes.value.ok) {
      try {
        const d = await resolvedRes.value.json();
        const items: ResolvedDecision[] = Array.isArray(d) ? d : (d.decisions ?? d.data ?? []);
        setResolvedDecisions(items);
      } catch { /* ignore */ }
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  // Initial load + 15s interval
  useEffect(() => {
    void loadData();
    const iv = setInterval(() => { void loadData(); }, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  // Benchmark fetch — fires when active decision changes
  const activeDecision = pendingDecisions[currentDecisionIdx] ?? null;
  useEffect(() => {
    if (!activeDecision) {
      setBenchmark(null);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : '';
    const authHdrs: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const marginValue = (activeDecision as Decision & { finalMarginPct?: number }).finalMarginPct ?? 27;
    fetch(
      `${API_BASE}/api/v1/network-intelligence/benchmark-compare?type=decision_margin&value=${marginValue}`,
      { headers: authHdrs },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBenchmark(data as BenchmarkData);
      })
      .catch(() => { /* silent */ });
  }, [activeDecision?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSnapshot() {
    setSnapshotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/decision-engine/state/snapshot`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Snapshot saved ✓', 'success');
        void loadData();
      } else {
        showToast('Snapshot failed', 'error');
      }
    } catch {
      showToast('Snapshot failed', 'error');
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function handleDecisionAction(id: string, actionType: 'approve' | 'reject', reasoning?: string) {
    const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
    const body =
      actionType === 'approve'
        ? JSON.stringify({ approvedBy: 'brain-ui', ...(reasoning ? { reasoning } : {}) })
        : JSON.stringify({ rejectedBy: 'brain-ui' });

    try {
      const res = await fetch(`${API_BASE}/api/v1/decision-engine/decisions/${id}/${actionType}`, {
        method: 'PATCH',
        headers,
        body,
      });
      if (res.ok) {
        showToast(actionType === 'approve' ? 'Approved ✓' : 'Rejected', 'success');
        // Remove from pending, advance index
        setPendingDecisions((prev) => {
          const next = prev.filter((d) => d.id !== id);
          setCurrentDecisionIdx((idx) => Math.min(idx, Math.max(0, next.length - 1)));
          return next;
        });
        void loadData();
      } else {
        showToast(`Action failed (${res.status})`, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  function handleAlternativeSelect(alt: DecisionAlternative) {
    // Inject alternative as new pending decision at current idx
    const synthetic: Decision = {
      id: `alt-${Date.now()}`,
      triggerType: 'ALTERNATIVE_SELECTED',
      triggerDescription: 'User selected an alternative action',
      action: alt.action,
      riskLevel: (alt.riskScore ?? 0) < 30 ? 'low' : (alt.riskScore ?? 0) < 60 ? 'medium' : 'high',
      riskScore: alt.riskScore ?? 0,
      confidenceScore: alt.confidenceScore ?? 0.5,
      marginImpact: alt.marginImpact,
      deliveryImpact: alt.deliveryDaysImpact,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setPendingDecisions((prev) => {
      const next = [...prev];
      next.splice(currentDecisionIdx + 1, 0, synthetic);
      return next;
    });
    setCurrentDecisionIdx((i) => i + 1);
    showToast('Alternative added as next decision', 'success');
  }

  return (
    // Break out of ShellLayout's px-8 py-8 max-w container
    <div className="-mx-8 -my-8">
      <TopBar
        systemScore={systemState?.overallSystemScore ?? null}
        pendingCount={pendingDecisions.length}
        lastUpdated={lastUpdated}
        onSnapshot={handleSnapshot}
        snapshotLoading={snapshotLoading}
      />

      {/* Three-panel layout */}
      <div className="flex gap-4 p-4 min-h-[calc(100vh-120px)]">
        {/* LEFT: 28% */}
        <aside className="w-[28%] flex-shrink-0 overflow-y-auto scrollbar-thin pb-6">
          <LeftPanel
            state={systemState}
            history={stateHistory}
            orders={orders}
            suppliers={suppliers}
            loading={loading}
          />
        </aside>

        {/* CENTER: flex-1 */}
        <main className="flex-1 overflow-y-auto scrollbar-thin pb-6">
          {loading && pendingDecisions.length === 0 && !systemState ? (
            <div className="space-y-4">
              <div className="h-8 skeleton rounded-lg w-48" />
              <div className="h-64 skeleton rounded-2xl" />
              <div className="h-32 skeleton rounded-xl" />
            </div>
          ) : (
            <CenterPanel
              decisions={pendingDecisions}
              resolved={resolvedDecisions}
              currentIdx={currentDecisionIdx}
              setCurrentIdx={setCurrentDecisionIdx}
              onDecisionAction={handleDecisionAction}
              stats={decisionStats}
              benchmark={benchmark}
            />
          )}
        </main>

        {/* RIGHT: 28% */}
        <aside className="w-[28%] flex-shrink-0 overflow-y-auto scrollbar-thin pb-6">
          <RightPanel
            activeDecision={activeDecision}
            stats={decisionStats}
            onAlternativeSelect={handleAlternativeSelect}
          />
        </aside>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
