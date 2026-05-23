'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── interfaces ───────────────────────────────────────────────────────────────

interface NetworkStats {
  totalLearningEvents: number;
  uniqueSuppliersCovered: number;
  uniqueRoutesCovered: number;
  categoriesCovered: number;
  avgGlobalReliability: number;
  networkHealthScore: number;
}

interface SupplierScore {
  id: string;
  supplierCode: string;
  supplierName: string;
  globalReliabilityScore: number;
  failureProbabilityPct: number;
  avgLeadTimeDays: number;
  leadTimeVarianceDays: number;
  avgMarginContributionPct: number;
  totalEvents: number;
  activeTenantCount: number;
  lastUpdatedAt: string;
}

interface RouteIntel {
  id: string;
  originCountry: string;
  destinationCountry: string;
  carrierCode: string;
  avgTransitDays: number;
  transitVarianceDays: number;
  customsDelayProbabilityPct: number;
  costVolatilityPct: number;
  onTimeDeliveryRatePct: number;
  totalShipments: number;
}

interface CategoryIntel {
  id: string;
  category: string;
  region: string;
  avgMarginPct: number;
  demandTrend: string;
  riskScore: number;
  seasonalPeaks: number[];
  topSupplierCodes: string[];
  totalOrders: number;
}

interface LearningEvent {
  id: string;
  tenantHash: string;
  eventType: string;
  supplierCode: string | null;
  routeKey: string | null;
  category: string | null;
  outcome: string;
  marginImpactPct: number | null;
  region: string | null;
  createdAt: string;
}

type ActiveTab = 'suppliers' | 'routes' | 'categories' | 'activity';

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function healthColor(score: number): string {
  if (score > 80) return '#22c55e';
  if (score > 60) return '#f59e0b';
  return '#ef4444';
}

function reliabilityColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function otdColor(pct: number): string {
  if (pct >= 92) return '#22c55e';
  if (pct >= 80) return '#f59e0b';
  return '#ef4444';
}

function marginColor(pct: number): string {
  if (pct >= 30) return '#22c55e';
  if (pct >= 20) return '#f59e0b';
  return '#ef4444';
}

function routeBorderColor(volatility: number): string {
  if (volatility < 5) return '#22c55e';
  if (volatility < 15) return '#f59e0b';
  return '#ef4444';
}

function outcomeColor(outcome: string): string {
  const o = outcome?.toLowerCase();
  if (o === 'success') return '#22c55e';
  if (o === 'failure') return '#ef4444';
  return '#f59e0b';
}

function trendBadge(trend: string): ReactNode {
  const t = trend?.toLowerCase();
  if (t === 'rising') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
        ↑ Rising
      </span>
    );
  }
  if (t === 'falling') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30">
        ↓ Falling
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30">
      → Stable
    </span>
  );
}

// ─── inline reliability bar ───────────────────────────────────────────────────

function ReliabilityBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = reliabilityColor(value);
  return (
    <div className="flex items-center gap-2">
      <svg width="80" height="8" viewBox="0 0 80 8">
        <rect x="0" y="2" width="80" height="4" rx="2" fill="#1a2f48" />
        <rect x="0" y="2" width={pct * 0.8} height="4" rx="2" fill={color} />
      </svg>
      <span className="text-[12px] font-semibold" style={{ color }}>{value.toFixed(1)}%</span>
    </div>
  );
}

// ─── inline risk bar ──────────────────────────────────────────────────────────

function RiskBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <svg width="100%" height="8" viewBox="0 0 200 8">
      <rect x="0" y="2" width="200" height="4" rx="2" fill="#1a2f48" />
      <rect x="0" y="2" width={pct * 2} height="4" rx="2" fill="#ef4444" />
    </svg>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from(new Set(Array.from({ length: count }, (_, i) => i))).map((i) => (
        <div key={i} className="h-32 bg-[#1a2f48] animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from(new Set(Array.from({ length: count }, (_, i) => i))).map((i) => (
        <div key={i} className="h-12 bg-[#1a2f48] animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

// ─── network effect loop SVG ──────────────────────────────────────────────────

function NetworkEffectLoop() {
  const nodes = ['More Tenants', 'More Decisions', 'Better Predictions', 'Better Margins', 'More Trust'];
  const W = 600;
  const H = 80;
  const nodeW = 100;
  const nodeH = 36;
  const gap = (W - nodes.length * nodeW) / (nodes.length - 1);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* Arrow lines between nodes */}
      {nodes.map((_, i) => {
        if (i === nodes.length - 1) return null;
        const x1 = i * (nodeW + gap) + nodeW;
        const x2 = (i + 1) * (nodeW + gap);
        const y = H / 2;
        return (
          <g key={`arrow-${i}`}>
            <line x1={x1} y1={y} x2={x2 - 4} y2={y} stroke="#4da3ff" strokeWidth="1.2" strokeOpacity="0.6" />
            <polygon
              points={`${x2 - 4},${y - 3} ${x2},${y} ${x2 - 4},${y + 3}`}
              fill="#4da3ff"
              fillOpacity="0.7"
            />
          </g>
        );
      })}
      {/* Loop-back arc from last to first */}
      <path
        d={`M ${(nodes.length - 1) * (nodeW + gap) + nodeW},${H / 2 - 10} C ${W + 30},${-20} ${-30},${-20} 0,${H / 2 - 10}`}
        fill="none"
        stroke="#4da3ff"
        strokeWidth="1.2"
        strokeOpacity="0.4"
        strokeDasharray="4 3"
      />
      {/* Nodes */}
      {nodes.map((label, i) => {
        const x = i * (nodeW + gap);
        const y = (H - nodeH) / 2;
        return (
          <g key={label}>
            <rect x={x} y={y} width={nodeW} height={nodeH} rx="8" fill="#0d1f3a" stroke="#4da3ff" strokeWidth="1" strokeOpacity="0.6" />
            <text
              x={x + nodeW / 2}
              y={y + nodeH / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#f0f6ff"
              fontSize="9"
              fontWeight="600"
              fontFamily="Inter, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 flex flex-col gap-2">
      {icon && <span className="text-[#4da3ff]">{icon}</span>}
      <span className="font-tight text-[20px] font-bold" style={{ color: color ?? '#f0f6ff' }}>
        {value}
      </span>
      <span className="text-[11px] text-[#4d6a87] uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── brain icon ───────────────────────────────────────────────────────────────

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2C4.9 2 4 2.9 4 4c-1.1 0-2 .9-2 2s.9 2 2 2v4h8V8c1.1 0 2-.9 2-2s-.9-2-2-2c0-1.1-.9-2-2-2H6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 2v12M5 7h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([]);
  const [routes, setRoutes] = useState<RouteIntel[]>([]);
  const [categories, setCategories] = useState<CategoryIntel[]>([]);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('suppliers');

  useEffect(() => {
    async function fetchAll() {
      const authHdrs: Record<string, string> = {
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}`,
      };
      const base = `${API_BASE}/api/v1/network-intelligence`;
      const [statsRes, suppliersRes, routesRes, categoriesRes, eventsRes] = await Promise.allSettled([
        fetch(`${base}/stats`, { headers: authHdrs }),
        fetch(`${base}/suppliers`, { headers: authHdrs }),
        fetch(`${base}/routes`, { headers: authHdrs }),
        fetch(`${base}/categories`, { headers: authHdrs }),
        fetch(`${base}/events?limit=20`, { headers: authHdrs }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        try { setStats(await statsRes.value.json()); } catch { /* ignore */ }
      }
      if (suppliersRes.status === 'fulfilled' && suppliersRes.value.ok) {
        try {
          const d = await suppliersRes.value.json();
          setSuppliers(Array.isArray(d) ? d : (d.suppliers ?? d.data ?? []));
        } catch { /* ignore */ }
      }
      if (routesRes.status === 'fulfilled' && routesRes.value.ok) {
        try {
          const d = await routesRes.value.json();
          setRoutes(Array.isArray(d) ? d : (d.routes ?? d.data ?? []));
        } catch { /* ignore */ }
      }
      if (categoriesRes.status === 'fulfilled' && categoriesRes.value.ok) {
        try {
          const d = await categoriesRes.value.json();
          setCategories(Array.isArray(d) ? d : (d.categories ?? d.data ?? []));
        } catch { /* ignore */ }
      }
      if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
        try {
          const d = await eventsRes.value.json();
          setEvents(Array.isArray(d) ? d : (d.events ?? d.data ?? []));
        } catch { /* ignore */ }
      }

      setLoading(false);
    }

    void fetchAll();
  }, []);

  const healthScore = stats?.networkHealthScore ?? 0;
  const healthCol = healthColor(healthScore);

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'suppliers', label: 'Supplier Scores' },
    { key: 'routes', label: 'Route Intelligence' },
    { key: 'categories', label: 'Category Intelligence' },
    { key: 'activity', label: 'Learning Activity' },
  ];

  return (
    <div className="min-h-screen bg-[#07111f] text-white px-6 py-6">
      {/* Header row */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-tight text-2xl font-bold text-white">Decision Intelligence Network</h1>
          <p className="text-[#8ba8c7] text-sm mt-1">
            Cross-tenant learning graph · anonymized · continuously improving
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-tight text-[36px] font-bold leading-none" style={{ color: healthCol }}>
            {loading ? '—' : healthScore}
          </span>
          <span className="text-xs text-[#4d6a87]">Network Health</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Learning Events"
          value={loading ? '—' : (stats?.totalLearningEvents ?? 0).toLocaleString()}
          icon={<BrainIcon />}
        />
        <StatCard
          label="Suppliers Tracked"
          value={loading ? '—' : String(stats?.uniqueSuppliersCovered ?? 0)}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard
          label="Routes Mapped"
          value={loading ? '—' : String(stats?.uniqueRoutesCovered ?? 0)}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2l4 6-4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          label="Categories"
          value={loading ? '—' : String(stats?.categoriesCovered ?? 0)}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          }
        />
        <StatCard
          label="Avg Reliability"
          value={loading ? '—' : `${(stats?.avgGlobalReliability ?? 0).toFixed(1)}%`}
          color={stats ? reliabilityColor(stats.avgGlobalReliability) : undefined}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 11l-3.7 2.5 1.4-4.3L2 6.5h4.5L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          label="Health Score"
          value={loading ? '—' : `${healthScore}/100`}
          color={healthCol}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 14s-6-4-6-8a4 4 0 0 1 8 0 4 4 0 0 1 4 0c0 4-6 8-6 8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      {/* Network Effect Loop */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-tight text-sm font-semibold text-[#f0f6ff]">Data Network Effect</span>
          <span className="text-[11px] text-[#4d6a87]">Self-reinforcing intelligence moat</span>
        </div>
        <NetworkEffectLoop />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30'
                : 'text-[#8ba8c7] hover:text-[#f0f6ff] border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'suppliers' && (
        loading ? (
          <SkeletonRows count={6} />
        ) : (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['Supplier', 'Global Reliability', 'Failure Risk', 'Avg Lead Time', 'Margin Contribution', 'Events', 'Tenants'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] text-[#4d6a87] uppercase tracking-wide font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#4d6a87] text-[13px]">
                      No supplier data available
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-[#1a2f48] last:border-0 hover:bg-[#102131]/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#f0f6ff] text-[13px]">{s.supplierName}</div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#1a2f48] rounded text-[#4da3ff] font-mono">
                          {s.supplierCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ReliabilityBar value={s.globalReliabilityScore} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            background: s.failureProbabilityPct > 20
                              ? 'rgba(239,68,68,0.1)'
                              : s.failureProbabilityPct > 10
                              ? 'rgba(245,158,11,0.1)'
                              : 'rgba(34,197,94,0.1)',
                            color: s.failureProbabilityPct > 20
                              ? '#ef4444'
                              : s.failureProbabilityPct > 10
                              ? '#f59e0b'
                              : '#22c55e',
                          }}
                        >
                          {s.failureProbabilityPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-[13px]">
                        {s.avgLeadTimeDays}d
                        <span className="text-[11px] text-[#4d6a87] ml-1">±{s.leadTimeVarianceDays}d</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#22c55e]">
                          +{s.avgMarginContributionPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-[13px]">{s.totalEvents.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
                          {s.activeTenantCount}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'routes' && (
        loading ? (
          <SkeletonCards count={6} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {routes.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-[#4d6a87] text-[13px]">No route data available</div>
            ) : (
              routes.map((r) => {
                const borderCol = routeBorderColor(r.costVolatilityPct);
                return (
                  <div
                    key={r.id}
                    className="bg-[#0b1526] rounded-xl p-4"
                    style={{ border: `1px solid ${borderCol}40` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-tight text-[16px] font-bold text-[#f0f6ff]">
                        {r.originCountry} → {r.destinationCountry}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1a2f48] text-[#4da3ff]">
                        {r.carrierCode}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="text-[10px] text-[#4d6a87] mb-0.5">On-Time Delivery</div>
                      <span className="font-tight text-[24px] font-bold" style={{ color: otdColor(r.onTimeDeliveryRatePct) }}>
                        {r.onTimeDeliveryRatePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#4d6a87]">Avg Transit</span>
                        <div className="text-[#f0f6ff] font-medium">{r.avgTransitDays}d ±{r.transitVarianceDays}d</div>
                      </div>
                      <div>
                        <span className="text-[#4d6a87]">Customs Delay</span>
                        <div className="font-medium" style={{ color: r.customsDelayProbabilityPct > 20 ? '#ef4444' : '#8ba8c7' }}>
                          {r.customsDelayProbabilityPct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[#4d6a87]">Cost Volatility</span>
                        <div className="font-medium" style={{ color: borderCol }}>
                          {r.costVolatilityPct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[#4d6a87]">Shipments</span>
                        <div className="text-[#8ba8c7] font-medium">{r.totalShipments.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )
      )}

      {activeTab === 'categories' && (
        loading ? (
          <SkeletonCards count={6} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {categories.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-[#4d6a87] text-[13px]">No category data available</div>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="font-tight text-[14px] font-semibold text-[#f0f6ff] capitalize">{c.category}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#1a2f48] text-[#8ba8c7]">{c.region}</span>
                      {trendBadge(c.demandTrend)}
                    </div>
                  </div>
                  {/* Avg margin */}
                  <div>
                    <div className="text-[10px] text-[#4d6a87] mb-0.5">Avg Margin</div>
                    <span className="font-tight text-[26px] font-bold" style={{ color: marginColor(c.avgMarginPct) }}>
                      {c.avgMarginPct.toFixed(1)}%
                    </span>
                  </div>
                  {/* Risk bar */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#4d6a87]">Risk Score</span>
                      <span style={{ color: c.riskScore > 60 ? '#ef4444' : c.riskScore > 30 ? '#f59e0b' : '#22c55e' }}>
                        {c.riskScore}/100
                      </span>
                    </div>
                    <RiskBar value={c.riskScore} />
                  </div>
                  {/* Top suppliers */}
                  {c.topSupplierCodes && c.topSupplierCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.topSupplierCodes.slice(0, 4).map((code) => (
                        <span key={code} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1a2f48] text-[#4da3ff]">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Total orders */}
                  <div className="text-[11px] text-[#4d6a87]">{c.totalOrders.toLocaleString()} orders</div>
                </div>
              ))
            )}
          </div>
        )
      )}

      {activeTab === 'activity' && (
        loading ? (
          <SkeletonRows count={8} />
        ) : (
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            {events.length === 0 ? (
              <div className="py-12 text-center text-[#4d6a87] text-[13px]">No recent learning events</div>
            ) : (
              events.map((ev) => {
                const dotColor = outcomeColor(ev.outcome);
                const marginImpact = ev.marginImpactPct;
                return (
                  <div key={ev.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a2f48] last:border-0 hover:bg-[#102131]/30 transition-colors">
                    {/* Outcome dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    {/* Event type + tenant */}
                    <div className="flex flex-col gap-0.5 min-w-[160px]">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1a2f48] text-[#8ba8c7] w-fit">
                        {ev.eventType?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#4d6a87] font-mono">
                        {ev.tenantHash ? `${ev.tenantHash.slice(0, 8)}…` : 'anon'}
                      </span>
                    </div>
                    {/* Details */}
                    <div className="flex gap-2 flex-wrap flex-1">
                      {ev.supplierCode && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
                          {ev.supplierCode}
                        </span>
                      )}
                      {ev.routeKey && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
                          {ev.routeKey}
                        </span>
                      )}
                      {ev.category && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 capitalize">
                          {ev.category}
                        </span>
                      )}
                    </div>
                    {/* Margin impact */}
                    {marginImpact != null && (
                      <span
                        className="text-[12px] font-semibold flex-shrink-0"
                        style={{ color: marginImpact >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {marginImpact >= 0 ? '+' : ''}{marginImpact.toFixed(1)}%
                      </span>
                    )}
                    {/* Region */}
                    {ev.region && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a2f48] text-[#4d6a87] flex-shrink-0">
                        {ev.region}
                      </span>
                    )}
                    {/* Time */}
                    <span className="text-[11px] text-[#4d6a87] flex-shrink-0">{timeAgo(ev.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
}
