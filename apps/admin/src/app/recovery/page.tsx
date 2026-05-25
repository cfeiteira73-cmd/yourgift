'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  service: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: string;
  lastStateChange: string;
}

interface RetryStats {
  service: string;
  operation: string;
  totalRetries: number;
  successRate: number;
  avgBackoffMs: number;
}

interface DegradedService {
  service: string;
  state: CircuitState;
  reason: string;
  since: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

const STATE_CONFIG: Record<CircuitState, { color: string; bg: string; border: string; label: string; pulse: boolean }> = {
  CLOSED:    { color: '#63e6be', bg: 'rgba(99,230,190,0.1)',   border: '#63e6be', label: 'CLOSED',    pulse: false },
  OPEN:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', label: 'OPEN',      pulse: true  },
  HALF_OPEN: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: '#f59e0b', label: 'HALF-OPEN', pulse: false },
};

const SERVICE_ICONS: Record<string, string> = {
  stripe: '💳', midocean: '🌊', resend: '📧', supabase: '🗄️',
  s3: '🪣', bullmq: '⚡', redis: '🔴', cloudfront: '☁️',
};

// ── Circuit Breaker Card ──────────────────────────────────────────────────────

function CircuitBreakerCard({
  cb,
  onReset,
}: {
  cb: CircuitBreaker;
  onReset: (service: string) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const cfg = STATE_CONFIG[cb.state];

  const handleReset = async () => {
    setResetting(true);
    await onReset(cb.service);
    setResetting(false);
  };

  return (
    <div
      className="bg-[#0b1526] rounded-xl p-4 border-2 transition-all"
      style={{
        borderColor: cfg.border,
        boxShadow: cb.state === 'OPEN' ? `0 0 16px rgba(239,68,68,0.15)` : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{SERVICE_ICONS[cb.service.toLowerCase()] ?? '🔧'}</span>
          <span className="text-[13px] font-semibold text-[#f0f6ff] capitalize">{cb.service}</span>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          {cfg.label}
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#4d6a87]">Failures</span>
          <span style={{ color: cb.failureCount > 0 ? '#ef4444' : '#63e6be' }} className="font-mono font-semibold">
            {cb.failureCount}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-[#4d6a87]">Successes</span>
          <span className="text-[#63e6be] font-mono font-semibold">{cb.successCount}</span>
        </div>
        {cb.lastFailureTime && (
          <div className="flex justify-between text-[11px]">
            <span className="text-[#4d6a87]">Last failure</span>
            <span className="text-[#8ba8c7] text-[10px]">
              {new Date(cb.lastFailureTime).toLocaleTimeString('pt-PT')}
            </span>
          </div>
        )}
      </div>

      {cb.state === 'OPEN' && (
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="w-full py-1.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg text-[11px] font-medium hover:bg-[#ef4444]/20 disabled:opacity-50 transition-colors"
        >
          {resetting ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Resetting…
            </span>
          ) : '⟳ Reset Circuit'}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecoveryPage() {
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [retryStats, setRetryStats] = useState<RetryStats[]>([]);
  const [degraded, setDegraded] = useState<DegradedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const [cbRes, rsRes, dgRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/recovery/circuit-breakers`, { headers: h }),
      fetch(`${API_BASE}/api/v1/recovery/retry-stats`, { headers: h }),
      fetch(`${API_BASE}/api/v1/recovery/degraded`, { headers: h }),
    ]);
    if (cbRes.status === 'fulfilled' && cbRes.value.ok) {
      const data = await cbRes.value.json() as { breakers: CircuitBreaker[] };
      setBreakers(data.breakers ?? []);
    }
    if (rsRes.status === 'fulfilled' && rsRes.value.ok) {
      const data = await rsRes.value.json() as { stats: RetryStats[] };
      setRetryStats(data.stats ?? []);
    }
    if (dgRes.status === 'fulfilled' && dgRes.value.ok) {
      const data = await dgRes.value.json() as { services: DegradedService[] };
      setDegraded(data.services ?? []);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 20_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const resetBreaker = async (service: string) => {
    await fetch(`${API_BASE}/api/v1/recovery/circuit-breakers/${service}/reset`, {
      method: 'POST',
      headers: authHeaders(),
    });
    await fetchData();
  };

  const openCount = breakers.filter((b) => b.state === 'OPEN').length;
  const halfOpenCount = breakers.filter((b) => b.state === 'HALF_OPEN').length;
  const closedCount = breakers.filter((b) => b.state === 'CLOSED').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[#4da3ff]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 1.5L1.5 5v4c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V5L9 1.5z" />
              <path d="M5.5 9.5l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Self-Healing Control Plane</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              Circuit breakers · retry policies · auto-refresh 20s
              {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('pt-PT')}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void fetchData(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'CLOSED (healthy)', value: closedCount, color: '#63e6be' },
          { label: 'OPEN (tripped)',   value: openCount,   color: openCount > 0 ? '#ef4444' : '#4d6a87' },
          { label: 'HALF-OPEN',       value: halfOpenCount, color: halfOpenCount > 0 ? '#f59e0b' : '#4d6a87' },
        ].map((k) => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[28px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Degraded services alert */}
      {degraded.length > 0 && (
        <div className="bg-[#ef4444]/05 border border-[#ef4444]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-[12px] font-semibold text-[#ef4444]">{degraded.length} Degraded Service{degraded.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {degraded.map((svc) => {
              const cfg = STATE_CONFIG[svc.state];
              return (
                <div key={svc.service} className="flex items-center gap-3 text-[12px]">
                  <span className="font-semibold text-[#cfe4ff] capitalize">{svc.service}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <span className="text-[#4d6a87] flex-1">{svc.reason}</span>
                  <span className="text-[10px] text-[#4d6a87]">since {new Date(svc.since).toLocaleTimeString('pt-PT')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Circuit breaker grid */}
      <div>
        <div className="text-[11px] font-semibold text-[#4d6a87] uppercase tracking-wider mb-3">Circuit Breaker Grid</div>
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-[#0b1526] border border-[#1a2f48] rounded-xl text-[#4d6a87] text-[13px]">
            <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
            Loading circuit breakers…
          </div>
        ) : breakers.length === 0 ? (
          <div className="text-center py-12 bg-[#0b1526] border border-[#1a2f48] rounded-xl text-[#4d6a87] text-[13px]">
            No circuit breaker data available.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {breakers.map((cb) => (
              <CircuitBreakerCard key={cb.service} cb={cb} onReset={resetBreaker} />
            ))}
          </div>
        )}
      </div>

      {/* Retry statistics */}
      {retryStats.length > 0 && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#1a2f48] bg-[#07111f]/50 text-[11px] font-semibold text-[#4d6a87] uppercase tracking-wider">
            Retry Statistics
          </div>
          <div className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-3 px-4 py-2 border-b border-[#1a2f48]/50 text-[10px] text-[#4d6a87] uppercase tracking-wider">
            <span>Service</span>
            <span>Operation</span>
            <span className="text-right">Total Retries</span>
            <span className="text-right">Success Rate</span>
            <span className="text-right">Avg Backoff</span>
          </div>
          {retryStats.map((rs, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-3 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors"
            >
              <div className="text-[12px] text-[#cfe4ff] capitalize">{rs.service}</div>
              <div className="text-[12px] text-[#8ba8c7] font-mono">{rs.operation}</div>
              <div className="text-[12px] font-mono text-right text-[#4da3ff]">{rs.totalRetries}</div>
              <div
                className="text-[12px] font-mono text-right font-semibold"
                style={{ color: rs.successRate > 90 ? '#63e6be' : rs.successRate > 70 ? '#f59e0b' : '#ef4444' }}
              >
                {rs.successRate.toFixed(1)}%
              </div>
              <div className="text-[12px] font-mono text-right text-[#4d6a87]">{rs.avgBackoffMs}ms</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
