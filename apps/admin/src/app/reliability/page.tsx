'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DimensionScore {
  name: string;
  score: number;
  key: string;
}

interface ReliabilitySnapshot {
  id: string;
  overallScore: number;
  apiReliability: number;
  queueReliability: number;
  procurementCorrectness: number;
  supplierStability: number;
  workflowHealth: number;
  financialIntegrity: number;
  authReliability: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  openIncidents: number;
  openReconciliationIssues: number;
  circuitBreakersOpen: number;
  snapshotAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

function scoreColor(score: number): string {
  if (score >= 95) return '#63e6be';
  if (score >= 80) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 95) return 'Excellent';
  if (score >= 80) return 'Degraded';
  return 'Critical';
}

function snapshotToDimensions(snap: ReliabilitySnapshot): DimensionScore[] {
  return [
    { key: 'apiReliability',         name: 'API Reliability',           score: snap.apiReliability },
    { key: 'queueReliability',        name: 'Queue Reliability',         score: snap.queueReliability },
    { key: 'procurementCorrectness',  name: 'Procurement Correctness',   score: snap.procurementCorrectness },
    { key: 'supplierStability',       name: 'Supplier Stability',        score: snap.supplierStability },
    { key: 'workflowHealth',          name: 'Workflow Health',           score: snap.workflowHealth },
    { key: 'financialIntegrity',      name: 'Financial Integrity',       score: snap.financialIntegrity },
    { key: 'authReliability',         name: 'Auth Reliability',          score: snap.authReliability },
  ];
}

// ── Circular Gauge SVG ────────────────────────────────────────────────────────

function CircularGauge({ score }: { score: number }) {
  const r = 72;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2f48" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
        {/* Score text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="28" fontWeight="800" fontFamily="monospace">
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#4d6a87" fontSize="10" fontFamily="monospace">
          / 100
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">
          {scoreLabel(score).toUpperCase()}
        </text>
      </svg>
      <div className="text-[10px] text-[#4d6a87] uppercase tracking-widest font-semibold mt-1">SYSTEM TRUST SCORE</div>
    </div>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: DimensionScore }) {
  const color = scoreColor(dim.score);
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[#8ba8c7]">{dim.name}</span>
        <span className="font-mono font-semibold" style={{ color }}>{dim.score}</span>
      </div>
      <div className="h-2 rounded-full bg-[#1a2f48] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${dim.score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Trend Line Chart ──────────────────────────────────────────────────────────

function TrendChart({ history }: { history: ReliabilitySnapshot[] }) {
  if (history.length < 2) {
    return <div className="text-center py-4 text-[#4d6a87] text-[12px]">Need more history data</div>;
  }
  const width = 480;
  const height = 72;
  const scores = history.map((h) => h.overallScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores, min + 1);
  const pts = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height * 0.8 - 8;
    return `${x},${y}`;
  });
  const last = scores[scores.length - 1];
  const color = scoreColor(last);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill="url(#trendGrad)" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function HeatmapGrid({ snapshots }: { snapshots: ReliabilitySnapshot[] }) {
  const dims = ['apiReliability', 'queueReliability', 'procurementCorrectness', 'supplierStability', 'workflowHealth', 'financialIntegrity', 'authReliability'] as const;
  const dimLabels: Record<typeof dims[number], string> = {
    apiReliability: 'API', queueReliability: 'Queue', procurementCorrectness: 'Procurement',
    supplierStability: 'Supplier', workflowHealth: 'Workflow', financialIntegrity: 'Financial', authReliability: 'Auth',
  };
  const last4 = snapshots.slice(-4);
  if (last4.length === 0) return <div className="text-center py-4 text-[#4d6a87] text-[12px]">No heatmap data</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="text-left text-[#4d6a87] pb-2 pr-3 font-normal">Dimension</th>
            {last4.map((s) => (
              <th key={s.id} className="text-center text-[#4d6a87] pb-2 px-1 font-normal whitespace-nowrap">
                {new Date(s.snapshotAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dims.map((dim) => (
            <tr key={dim}>
              <td className="text-[#8ba8c7] py-1 pr-3 whitespace-nowrap">{dimLabels[dim]}</td>
              {last4.map((s) => {
                const v = s[dim];
                const color = scoreColor(v);
                const opacity = 0.15 + (v / 100) * 0.7;
                return (
                  <td key={s.id} className="py-1 px-1 text-center">
                    <div
                      className="inline-flex items-center justify-center w-12 h-6 rounded text-[10px] font-mono font-semibold"
                      style={{ backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`, color }}
                    >
                      {v}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReliabilityPage() {
  const [latest, setLatest] = useState<ReliabilitySnapshot | null>(null);
  const [history, setHistory] = useState<ReliabilitySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const [latRes, hisRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/reliability/latest`, { headers: h }),
      fetch(`${API_BASE}/api/v1/reliability/history?limit=48`, { headers: h }),
    ]);
    if (latRes.status === 'fulfilled' && latRes.value.ok) {
      setLatest(await latRes.value.json() as ReliabilitySnapshot);
    }
    if (hisRes.status === 'fulfilled' && hisRes.value.ok) {
      const data = await hisRes.value.json() as { snapshots: ReliabilitySnapshot[] };
      setHistory(data.snapshots ?? []);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const compute = async () => {
    setComputing(true);
    try {
      await fetch(`${API_BASE}/api/v1/reliability/compute`, { method: 'POST', headers: authHeaders() });
      await fetchData();
    } catch { /* ignore */ }
    setComputing(false);
  };

  const dims = latest ? snapshotToDimensions(latest) : [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[#63e6be]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="9" cy="9" r="7.5" />
              <circle cx="9" cy="9" r="4" />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Reliability Command Center</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              System trust score · 7 dimensions · auto-refresh 30s
              {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('pt-PT')}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={compute}
          disabled={computing}
          className="flex items-center gap-2 px-4 py-2 bg-[#63e6be]/10 border border-[#63e6be]/30 text-[#63e6be] rounded-lg text-[12px] font-medium hover:bg-[#63e6be]/20 disabled:opacity-50 transition-colors"
        >
          {computing ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : '⚡'}
          Compute Now
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#4d6a87] text-[13px]">
          <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
          Loading reliability data…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr] gap-5">
            {/* Trust score gauge */}
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 flex items-center justify-center">
              <CircularGauge score={latest?.overallScore ?? 0} />
            </div>

            {/* Dimension bars + health chips */}
            <div className="space-y-3">
              {/* Health indicators */}
              {latest && (
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: 'Open Incidents', value: latest.openIncidents, color: latest.openIncidents > 0 ? '#ef4444' : '#63e6be' },
                    { label: 'Reconciliation Issues', value: latest.openReconciliationIssues, color: latest.openReconciliationIssues > 0 ? '#f59e0b' : '#63e6be' },
                    { label: 'Circuit Breakers Open', value: latest.circuitBreakersOpen, color: latest.circuitBreakersOpen > 0 ? '#ef4444' : '#63e6be' },
                  ].map((h) => (
                    <div
                      key={h.label}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ borderColor: h.color, backgroundColor: `${h.color}10` }}
                    >
                      <span className="text-[20px] font-bold tabular-nums" style={{ color: h.color }}>{h.value}</span>
                      <span className="text-[11px] text-[#4d6a87]">{h.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Performance strip */}
              {latest && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'p50', value: latest.p50Ms, target: 100 },
                    { label: 'p95', value: latest.p95Ms, target: 300 },
                    { label: 'p99', value: latest.p99Ms, target: 1000 },
                  ].map((p) => {
                    const color = p.value <= p.target ? '#63e6be' : p.value <= p.target * 1.5 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={p.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-3 text-center">
                        <div className="text-[18px] font-bold font-mono tabular-nums" style={{ color }}>{p.value}ms</div>
                        <div className="text-[10px] text-[#4d6a87] mt-0.5 uppercase">{p.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dimension bars */}
              <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 space-y-3">
                {dims.map((dim) => <DimensionBar key={dim.key} dim={dim} />)}
              </div>
            </div>
          </div>

          {/* Trend chart */}
          {history.length > 0 && (
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
              <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-3">
                Overall Score — Last {history.length} Snapshots
              </div>
              <TrendChart history={history} />
            </div>
          )}

          {/* Heatmap */}
          {history.length > 0 && (
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
              <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-3">Dimension Heatmap — Last 4 Snapshots</div>
              <HeatmapGrid snapshots={history} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
