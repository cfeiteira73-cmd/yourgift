'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegionHealth {
  id: string;
  region: string;
  role: string;
  status: string;
  db_latency_ms: number | null;
  redis_latency_ms: number | null;
  api_latency_p95_ms: number | null;
  lag_seconds: number | null;
  checked_at: string;
}

interface ResilientStatus {
  primaryRegion: string;
  secondaryRegion: string;
  replicationLagSeconds: number;
  estimatedRtoMinutes: number;
  estimatedRpoMinutes: number;
  readinessScore: number;
  readinessLevel: 'red' | 'yellow' | 'green';
}

interface ChaosDrill {
  id: string;
  drillType: string;
  targetService: string;
  status: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  mttrMinutes: number | null;
  rtoMet: boolean | null;
  rpoMet: boolean | null;
  findings: string | null;
  triggeredBy: string;
}

interface DrillStats {
  totalDrills: number;
  completedDrills: number;
  abortedDrills: number;
  avgMttrMinutes: number;
  rtoMetRate: number;
  rpoMetRate: number;
  drillsByType: { drillType: string; count: number }[];
}

interface FailoverEvent {
  id: string;
  fromRegion: string;
  toRegion: string;
  trigger: string;
  status: string;
  rtoMinutes: number | null;
  rpoMinutes: number | null;
  rtoTargetMet: boolean | null;
  rpoTargetMet: boolean | null;
  initiatedBy: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface SimResult {
  estimatedImpact: string;
  affectedServices: string[];
  estimatedMttrMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DRILL_TYPES = [
  'redis_outage',
  'db_failover',
  'stripe_timeout',
  'queue_corruption',
  'dependency_degradation',
  'network_partition',
  'memory_pressure',
  'latency_injection',
] as const;

const REGION_OPTIONS = ['eu-west-1', 'eu-west-2', 'eu-central-1'];

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  healthy:     { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  degraded:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  failover:    { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  offline:     { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  scheduled:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  running:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  completed:   { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  aborted:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  failed:      { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  initiated:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  in_progress: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  rolled_back: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const RISK_COLORS: Record<string, string> = {
  low:    '#4ade80',
  medium: '#f59e0b',
  high:   '#f87171',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    Authorization: `Bearer ${getAdminToken()}`,
    'Content-Type': 'application/json',
  };
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] ?? { color: '#8ba8c7', bg: 'rgba(139,168,199,0.1)' };
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function MetBadge({ met, label }: { met: boolean | null; label: string }) {
  if (met === null) return <span className="text-[#4d6a87] text-xs">—</span>;
  return (
    <span
      style={{
        color: met ? '#4ade80' : '#f87171',
        background: met ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
        border: `1px solid ${met ? '#4ade8030' : '#f8717130'}`,
      }}
      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
    >
      {met ? `${label} ✓` : `${label} ✗`}
    </span>
  );
}

function formatDt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Region SVG Map ────────────────────────────────────────────────────────────

function RegionMap({ regions }: { regions: RegionHealth[] }) {
  const byRegion = new Map(regions.map((r) => [r.region, r]));

  const nodes = [
    { id: 'eu-west-1',    label: 'EU West 1',    sublabel: 'Primary',    cx: 140, cy: 100 },
    { id: 'eu-west-2',    label: 'EU West 2',    sublabel: 'Secondary',  cx: 340, cy: 100 },
    { id: 'eu-central-1', label: 'EU Central 1', sublabel: 'DR',         cx: 240, cy: 220 },
  ];

  const lines = [
    { x1: 140, y1: 100, x2: 340, y2: 100 },
    { x1: 140, y1: 100, x2: 240, y2: 220 },
    { x1: 340, y1: 100, x2: 240, y2: 220 },
  ];

  return (
    <svg viewBox="0 0 480 320" className="w-full" style={{ maxHeight: 260 }}>
      {/* Connection lines */}
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="#1a3a5c" strokeWidth="1.5" strokeDasharray="4 3"
        />
      ))}

      {/* Nodes */}
      {nodes.map((n) => {
        const r = byRegion.get(n.id);
        const status = r?.status ?? 'unknown';
        const cfg = STATUS_COLORS[status] ?? { color: '#8ba8c7', bg: 'rgba(139,168,199,0.1)' };

        return (
          <g key={n.id}>
            {/* Glow */}
            <circle cx={n.cx} cy={n.cy} r={38} fill={cfg.color} opacity={0.06} />
            {/* Node circle */}
            <circle cx={n.cx} cy={n.cy} r={28} fill="#0d1f3a" stroke={cfg.color} strokeWidth={2} />
            {/* Status dot */}
            <circle cx={n.cx + 20} cy={n.cy - 20} r={6} fill={cfg.color} />

            {/* Label */}
            <text x={n.cx} y={n.cy - 4} textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="700">
              {n.label}
            </text>
            <text x={n.cx} y={n.cy + 9} textAnchor="middle" fill={cfg.color} fontSize={8}>
              {n.sublabel}
            </text>

            {/* DB latency */}
            {r?.db_latency_ms != null && (
              <text x={n.cx} y={n.cy + 60} textAnchor="middle" fill="#4d6a87" fontSize={7.5}>
                DB {r.db_latency_ms}ms
              </text>
            )}
            {/* Redis latency */}
            {r?.redis_latency_ms != null && (
              <text x={n.cx} y={n.cy + 72} textAnchor="middle" fill="#4d6a87" fontSize={7.5}>
                Redis {r.redis_latency_ms}ms
              </text>
            )}
            {/* API p95 */}
            {r?.api_latency_p95_ms != null && (
              <text x={n.cx} y={n.cy + 84} textAnchor="middle" fill="#4d6a87" fontSize={7.5}>
                p95 {r.api_latency_p95_ms}ms
              </text>
            )}
            {/* Lag */}
            {r?.lag_seconds != null && (
              <text x={n.cx} y={n.cy + 96} textAnchor="middle" fill="#f59e0b" fontSize={7.5}>
                lag {r.lag_seconds}s
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Resilience Gauge ──────────────────────────────────────────────────────────

function ResilienceGauge({ score, level }: { score: number; level: 'red' | 'yellow' | 'green' }) {
  const colors = { red: '#f87171', yellow: '#f59e0b', green: '#4ade80' };
  const color = colors[level];
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <svg viewBox="0 0 120 120" width={120} height={120}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="#1a2f48" strokeWidth={10} />
      <circle
        cx={60} cy={60} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={60} y={55} textAnchor="middle" fill={color} fontSize={22} fontWeight="800">{score}</text>
      <text x={60} y={72} textAnchor="middle" fill="#8ba8c7" fontSize={9}>/ 100</text>
    </svg>
  );
}

// ── Drills Bar Chart ──────────────────────────────────────────────────────────

function DrillsBarChart({ data }: { data: { drillType: string; count: number }[] }) {
  if (!data.length) return <p className="text-[#4d6a87] text-xs">No drill data yet.</p>;

  const max = Math.max(...data.map((d) => d.count), 1);
  const barW = Math.floor(260 / data.length) - 4;

  return (
    <svg viewBox={`0 0 280 100`} className="w-full" style={{ maxHeight: 100 }}>
      {data.map((d, i) => {
        const barH = Math.max(4, (d.count / max) * 68);
        const x = i * (barW + 4) + 10;
        const y = 78 - barH;

        return (
          <g key={d.drillType}>
            <rect x={x} y={y} width={barW} height={barH} rx={2} fill="#4da3ff" opacity={0.7} />
            <text x={x + barW / 2} y={75} textAnchor="middle" fill="#4d6a87" fontSize={6} transform={`rotate(-40 ${x + barW / 2} 75)`}>
              {d.drillType.replace('_', ' ')}
            </text>
            <text x={x + barW / 2} y={y - 3} textAnchor="middle" fill="#8ba8c7" fontSize={7}>
              {d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChaosPage() {
  const [regions, setRegions] = useState<RegionHealth[]>([]);
  const [resilience, setResilience] = useState<ResilientStatus | null>(null);
  const [drills, setDrills] = useState<ChaosDrill[]>([]);
  const [drillStats, setDrillStats] = useState<DrillStats | null>(null);
  const [failovers, setFailovers] = useState<FailoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Schedule drill modal
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    drillType: 'redis_outage',
    targetService: 'redis',
    scheduledAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    triggeredBy: 'admin',
  });

  // Simulate
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simDrillType, setSimDrillType] = useState('redis_outage');
  const [simTarget, setSimTarget] = useState('redis');

  // Failover modal
  const [showFailover, setShowFailover] = useState(false);
  const [failoverConfirm, setFailoverConfirm] = useState(false);
  const [failoverForm, setFailoverForm] = useState({
    fromRegion: 'eu-west-1',
    toRegion: 'eu-west-2',
    trigger: 'manual' as 'manual' | 'auto_circuit_breaker' | 'chaos_drill',
    initiatedBy: 'admin',
    notes: '',
  });

  const load = useCallback(async () => {
    const h = authHeaders();
    try {
      const [regRes, resRes, drillsRes, statsRes, foRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/chaos/regions`, { headers: h }),
        fetch(`${API_BASE}/api/v1/chaos/resilience`, { headers: h }),
        fetch(`${API_BASE}/api/v1/chaos/drills`, { headers: h }),
        fetch(`${API_BASE}/api/v1/chaos/drills/stats`, { headers: h }),
        fetch(`${API_BASE}/api/v1/chaos/failover/history`, { headers: h }),
      ]);

      if (regRes.ok) setRegions(await regRes.json() as RegionHealth[]);
      if (resRes.ok) setResilience(await resRes.json() as ResilientStatus);
      if (drillsRes.ok) setDrills(await drillsRes.json() as ChaosDrill[]);
      if (statsRes.ok) setDrillStats(await statsRes.json() as DrillStats);
      if (foRes.ok) setFailovers(await foRes.json() as FailoverEvent[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function triggerHealthCheck() {
    const res = await fetch(`${API_BASE}/api/v1/chaos/regions/check`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) {
      setActionMsg('Health check triggered');
      void load();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function scheduleDrill() {
    const res = await fetch(`${API_BASE}/api/v1/chaos/drills`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...scheduleForm,
        scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
        config: {},
      }),
    });
    if (res.ok) {
      setShowSchedule(false);
      setActionMsg('Drill scheduled');
      void load();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function startDrill(id: string) {
    await fetch(`${API_BASE}/api/v1/chaos/drills/${id}/start`, {
      method: 'POST', headers: authHeaders(),
    });
    void load();
  }

  async function abortDrill(id: string) {
    await fetch(`${API_BASE}/api/v1/chaos/drills/${id}/abort`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason: 'Manually aborted from admin console' }),
    });
    void load();
  }

  async function runSimulate() {
    const res = await fetch(`${API_BASE}/api/v1/chaos/simulate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ drillType: simDrillType, targetService: simTarget }),
    });
    if (res.ok) setSimResult(await res.json() as SimResult);
  }

  async function initiateFailover() {
    const res = await fetch(`${API_BASE}/api/v1/chaos/failover`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(failoverForm),
    });
    if (res.ok) {
      setShowFailover(false);
      setFailoverConfirm(false);
      setActionMsg('Failover initiated');
      void load();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  // KPI from resilience
  const nowMonth = new Date().getMonth();
  const drillsThisMonth = drills.filter(
    (d) => new Date(d.scheduledAt).getMonth() === nowMonth,
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#07111f]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chaos Engineering</h1>
          <p className="text-[#4d6a87] text-sm mt-1">Multi-region resilience · RTO target 15min · RPO target 5min</p>
        </div>
        <div className="flex items-center gap-3">
          {actionMsg && (
            <span className="text-xs text-[#4ade80] bg-[rgba(74,222,128,0.1)] px-3 py-1.5 rounded-lg border border-[#4ade8030]">
              {actionMsg}
            </span>
          )}
          <button
            type="button"
            onClick={() => void triggerHealthCheck()}
            className="px-4 py-2 bg-[#102131] text-[#4da3ff] border border-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#0d1f3a] transition-colors"
          >
            Check Regions
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 bg-[#102131] text-[#8ba8c7] border border-[#1a2f48] rounded-lg text-sm font-medium hover:bg-[#0d1f3a] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Primary Region', value: resilience?.primaryRegion ?? '—' },
          { label: 'Replication Lag', value: resilience ? `${resilience.replicationLagSeconds}s` : '—' },
          { label: 'RTO Capability', value: resilience ? `${resilience.estimatedRtoMinutes}m` : '—' },
          { label: 'RPO Capability', value: resilience ? `${resilience.estimatedRpoMinutes}m` : '—' },
          { label: 'Drills This Month', value: String(drillsThisMonth) },
        ].map((s) => (
          <div key={s.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <p className="text-[#4d6a87] text-xs uppercase tracking-wider">{s.label}</p>
            <p className="text-white font-bold text-lg mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Region Map + Resilience Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Region Map */}
        <div className="md:col-span-2 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Region Map</h2>
          <RegionMap regions={regions} />
          {regions.length === 0 && (
            <p className="text-[#4d6a87] text-xs text-center py-4">No region data — click &quot;Check Regions&quot;</p>
          )}
        </div>

        {/* Resilience Score */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Resilience Score</h2>
          {resilience ? (
            <div className="flex flex-col items-center gap-4">
              <ResilienceGauge score={resilience.readinessScore} level={resilience.readinessLevel} />
              <div className="w-full space-y-2">
                {[
                  { label: 'Readiness', value: resilience.readinessLevel.toUpperCase() },
                  { label: 'Est. RTO', value: `${resilience.estimatedRtoMinutes} min` },
                  { label: 'Est. RPO', value: `${resilience.estimatedRpoMinutes} min` },
                  { label: 'Lag', value: `${resilience.replicationLagSeconds}s` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-[#4d6a87]">{item.label}</span>
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          item.label === 'Readiness'
                            ? { RED: '#f87171', YELLOW: '#f59e0b', GREEN: '#4ade80' }[item.value] ?? '#8ba8c7'
                            : '#8ba8c7',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[#4d6a87] text-xs">No data available</p>
          )}
        </div>
      </div>

      {/* Drill Stats KPIs */}
      {drillStats && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Drill Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Total Drills', value: String(drillStats.totalDrills) },
              { label: 'Completed', value: String(drillStats.completedDrills) },
              { label: 'Aborted', value: String(drillStats.abortedDrills) },
              { label: 'Avg MTTR', value: `${drillStats.avgMttrMinutes}m` },
              { label: 'RTO Met', value: `${drillStats.rtoMetRate}%` },
              { label: 'RPO Met', value: `${drillStats.rpoMetRate}%` },
            ].map((k) => (
              <div key={k.label} className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3">
                <p className="text-[#4d6a87] text-[10px] uppercase tracking-wider">{k.label}</p>
                <p className="text-white font-bold text-base mt-1">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="max-w-xs">
            <p className="text-[#4d6a87] text-[10px] uppercase tracking-wider mb-2">Drills by Type</p>
            <DrillsBarChart data={drillStats.drillsByType} />
          </div>
        </div>
      )}

      {/* Chaos Drill Console */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">Chaos Drill Console</h2>
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            className="px-3 py-1.5 bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30 rounded-lg text-xs font-semibold hover:bg-[#4da3ff]/20 transition-colors"
          >
            + Schedule Drill
          </button>
        </div>

        {drills.length === 0 ? (
          <p className="text-[#4d6a87] text-sm py-4 text-center">No drills scheduled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['Status', 'Type', 'Target', 'Scheduled', 'MTTR', 'RTO', 'RPO', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-[#4d6a87] uppercase tracking-wider text-[10px] pb-2 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drills.map((d) => (
                  <tr key={d.id} className="border-b border-[#1a2f48]/50 hover:bg-[#0d1f3a]/30">
                    <td className="py-2.5 pr-4"><StatusBadge status={d.status} /></td>
                    <td className="py-2.5 pr-4 text-[#8ba8c7]">{d.drillType.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 pr-4 text-[#8ba8c7]">{d.targetService}</td>
                    <td className="py-2.5 pr-4 text-[#4d6a87]">{formatDt(d.scheduledAt)}</td>
                    <td className="py-2.5 pr-4 text-[#8ba8c7]">
                      {d.mttrMinutes != null ? `${d.mttrMinutes}m` : '—'}
                    </td>
                    <td className="py-2.5 pr-4"><MetBadge met={d.rtoMet} label="RTO" /></td>
                    <td className="py-2.5 pr-4"><MetBadge met={d.rpoMet} label="RPO" /></td>
                    <td className="py-2.5 flex gap-2">
                      {d.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => void startDrill(d.id)}
                          className="px-2 py-1 bg-[#a78bfa]/10 text-[#a78bfa] rounded text-[10px] border border-[#a78bfa]/30 hover:bg-[#a78bfa]/20"
                        >
                          Start
                        </button>
                      )}
                      {(d.status === 'running' || d.status === 'scheduled') && (
                        <button
                          type="button"
                          onClick={() => void abortDrill(d.id)}
                          className="px-2 py-1 bg-[#f87171]/10 text-[#f87171] rounded text-[10px] border border-[#f87171]/30 hover:bg-[#f87171]/20"
                        >
                          Abort
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulate Drill */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Dry-Run Simulation</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Drill Type</label>
            <select
              value={simDrillType}
              onChange={(e) => setSimDrillType(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
            >
              {DRILL_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Target Service</label>
            <input
              value={simTarget}
              onChange={(e) => setSimTarget(e.target.value)}
              className="bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff] w-36"
              placeholder="e.g. redis"
            />
          </div>
          <button
            type="button"
            onClick={() => void runSimulate()}
            className="px-4 py-2 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 rounded-lg text-xs font-semibold hover:bg-[#f59e0b]/20 transition-colors"
          >
            Simulate (no impact)
          </button>
        </div>

        {simResult && (
          <div className="mt-4 bg-[#07111f] border border-[#1a2f48] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                style={{ color: RISK_COLORS[simResult.riskLevel], background: `${RISK_COLORS[simResult.riskLevel]}18` }}
              >
                {simResult.riskLevel} risk
              </span>
              <span className="text-[#4d6a87] text-xs">Est. MTTR: <span className="text-[#8ba8c7] font-semibold">{simResult.estimatedMttrMinutes}m</span></span>
            </div>
            <p className="text-[#8ba8c7] text-xs">{simResult.estimatedImpact}</p>
            <div>
              <p className="text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Affected Services</p>
              <div className="flex flex-wrap gap-1.5">
                {simResult.affectedServices.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-[#1a2f48] text-[#8ba8c7] rounded text-[10px]">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Recommendations</p>
              <ul className="space-y-1">
                {simResult.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-[#8ba8c7] flex items-start gap-2">
                    <span className="text-[#4da3ff] mt-0.5">•</span>{rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Failover History */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">Failover History</h2>
          <button
            type="button"
            onClick={() => { setShowFailover(true); setFailoverConfirm(false); }}
            className="px-3 py-1.5 bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/30 rounded-lg text-xs font-semibold hover:bg-[#f87171]/20 transition-colors"
          >
            Initiate Failover
          </button>
        </div>

        {failovers.length === 0 ? (
          <p className="text-[#4d6a87] text-sm py-4 text-center">No failover events recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {['From', 'To', 'Trigger', 'Status', 'RTO', 'RPO', 'Started'].map((h) => (
                    <th key={h} className="text-left text-[#4d6a87] uppercase tracking-wider text-[10px] pb-2 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failovers.map((f) => (
                  <tr key={f.id} className="border-b border-[#1a2f48]/50 hover:bg-[#0d1f3a]/30">
                    <td className="py-2.5 pr-4 text-[#8ba8c7]">{f.fromRegion}</td>
                    <td className="py-2.5 pr-4 text-[#4da3ff]">{f.toRegion}</td>
                    <td className="py-2.5 pr-4 text-[#4d6a87]">{f.trigger.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={f.status} /></td>
                    <td className="py-2.5 pr-4">
                      {f.rtoMinutes != null ? (
                        <span style={{ color: f.rtoTargetMet ? '#4ade80' : '#f87171' }}>
                          {f.rtoMinutes}m {f.rtoTargetMet ? '✓' : '✗'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      {f.rpoMinutes != null ? (
                        <span style={{ color: f.rpoTargetMet ? '#4ade80' : '#f87171' }}>
                          {f.rpoMinutes}m {f.rpoTargetMet ? '✓' : '✗'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-[#4d6a87]">{formatDt(f.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Schedule Drill Modal ── */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Schedule Chaos Drill</h3>
              <button type="button" onClick={() => setShowSchedule(false)} className="text-[#4d6a87] hover:text-white">✕</button>
            </div>

            {(['drillType', 'targetService', 'triggeredBy'] as const).map((field) => (
              <div key={field}>
                <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">
                  {field === 'drillType' ? 'Drill Type' : field === 'targetService' ? 'Target Service' : 'Triggered By'}
                </label>
                {field === 'drillType' ? (
                  <select
                    value={scheduleForm[field]}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, [field]: e.target.value })}
                    className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
                  >
                    {DRILL_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={scheduleForm[field]}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, [field]: e.target.value })}
                    className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
                  />
                )}
              </div>
            ))}

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Scheduled At</label>
              <input
                type="datetime-local"
                value={scheduleForm.scheduledAt}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="flex-1 py-2 bg-[#102131] text-[#8ba8c7] border border-[#1a2f48] rounded-lg text-sm hover:bg-[#0d1f3a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void scheduleDrill()}
                className="flex-1 py-2 bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30 rounded-lg text-sm font-semibold hover:bg-[#4da3ff]/20"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Initiate Failover Modal ── */}
      {showFailover && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Initiate Region Failover</h3>
              <button type="button" onClick={() => setShowFailover(false)} className="text-[#4d6a87] hover:text-white">✕</button>
            </div>

            <div className="bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg p-3 text-xs text-[#f87171]">
              Warning: This will initiate a region failover. This action affects live traffic.
            </div>

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">From Region</label>
              <select
                value={failoverForm.fromRegion}
                onChange={(e) => setFailoverForm({ ...failoverForm, fromRegion: e.target.value })}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
              >
                {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">To Region</label>
              <select
                value={failoverForm.toRegion}
                onChange={(e) => setFailoverForm({ ...failoverForm, toRegion: e.target.value })}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
              >
                {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Trigger</label>
              <select
                value={failoverForm.trigger}
                onChange={(e) => setFailoverForm({ ...failoverForm, trigger: e.target.value as typeof failoverForm.trigger })}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
              >
                <option value="manual">Manual</option>
                <option value="auto_circuit_breaker">Auto Circuit Breaker</option>
                <option value="chaos_drill">Chaos Drill</option>
              </select>
            </div>

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Initiated By</label>
              <input
                value={failoverForm.initiatedBy}
                onChange={(e) => setFailoverForm({ ...failoverForm, initiatedBy: e.target.value })}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff]"
              />
            </div>

            <div>
              <label className="block text-[#4d6a87] text-[10px] uppercase tracking-wider mb-1">Notes</label>
              <textarea
                value={failoverForm.notes}
                onChange={(e) => setFailoverForm({ ...failoverForm, notes: e.target.value })}
                rows={2}
                className="w-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#4da3ff] resize-none"
                placeholder="Optional notes..."
              />
            </div>

            {!failoverConfirm ? (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFailover(false)}
                  className="flex-1 py-2 bg-[#102131] text-[#8ba8c7] border border-[#1a2f48] rounded-lg text-sm hover:bg-[#0d1f3a]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setFailoverConfirm(true)}
                  className="flex-1 py-2 bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/30 rounded-lg text-sm font-semibold hover:bg-[#f87171]/20"
                >
                  Review & Confirm
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg p-3 text-xs text-[#f87171] font-semibold text-center">
                  Are you sure? Failover {failoverForm.fromRegion} → {failoverForm.toRegion}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFailoverConfirm(false)}
                    className="flex-1 py-2 bg-[#102131] text-[#8ba8c7] border border-[#1a2f48] rounded-lg text-sm hover:bg-[#0d1f3a]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void initiateFailover()}
                    className="flex-1 py-2 bg-[#f87171] text-white rounded-lg text-sm font-bold hover:bg-[#ef4444]"
                  >
                    Initiate Failover
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
