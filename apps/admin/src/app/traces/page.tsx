'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  service: string;
  operationName: string;
  durationMs: number;
  statusCode: number; // 0=unset, 1=ok, 2=error
  errorMessage?: string;
  startTime: string;
}

interface TraceStats {
  totalSpans: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  serviceLatency: { service: string; points: number[] }[];
}

type TimeRange = '1h' | '6h' | '24h';
type StatusFilter = 'all' | 'ok' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}` };
}

function statusLabel(code: number): 'OK' | 'ERROR' | 'UNSET' {
  if (code === 1) return 'OK';
  if (code === 2) return 'ERROR';
  return 'UNSET';
}

const SERVICE_COLORS: Record<string, string> = {
  api: '#4da3ff',
  web: '#63e6be',
  admin: '#a78bfa',
  stripe: '#fbbf24',
  supabase: '#34d399',
  resend: '#f97316',
  midocean: '#ec4899',
  s3: '#fb923c',
  bullmq: '#818cf8',
};

function serviceColor(service: string): string {
  return SERVICE_COLORS[service.toLowerCase()] ?? '#4d6a87';
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({ series, color, height = 48, width = 200 }: {
  series: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const min = Math.min(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Waterfall bar ─────────────────────────────────────────────────────────────

function WaterfallBar({ span, maxDuration }: { span: Span; maxDuration: number }) {
  const pct = Math.max(2, (span.durationMs / Math.max(maxDuration, 1)) * 100);
  const color = span.statusCode === 2 ? '#ef4444' : serviceColor(span.service);
  return (
    <div className="flex items-center gap-3 py-1.5 hover:bg-[#07111f]/40 px-2 rounded">
      <div className="w-32 shrink-0 text-[11px] text-[#4d6a87] font-mono truncate" title={span.operationName}>
        {span.operationName}
      </div>
      <div className="flex-1 h-5 bg-[#1a2f48] rounded overflow-hidden">
        <div
          className="h-full rounded transition-all"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
      <div className="w-16 shrink-0 text-right text-[11px] font-mono" style={{ color }}>
        {span.durationMs}ms
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TracesPage() {
  const [spans, setSpans] = useState<Span[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const params = new URLSearchParams({ limit: '100' });
    if (serviceFilter) params.set('service', serviceFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('range', timeRange);

    const [spansRes, statsRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/tracing/spans?${params.toString()}`, { headers: h }),
      fetch(`${API_BASE}/api/v1/tracing/stats?range=${timeRange}`, { headers: h }),
    ]);

    if (spansRes.status === 'fulfilled' && spansRes.value.ok) {
      const data = await spansRes.value.json() as { spans: Span[] };
      setSpans(data.spans ?? []);
    }
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      setStats(await statsRes.value.json() as TraceStats);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [serviceFilter, statusFilter, timeRange]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Group spans by traceId
  const traceGroups = spans.reduce<Record<string, Span[]>>((acc, s) => {
    if (!acc[s.traceId]) acc[s.traceId] = [];
    acc[s.traceId].push(s);
    return acc;
  }, {});

  const allServices = Array.from(new Set(spans.map((s) => s.service)));
  const failedSpans = spans.filter((s) => s.statusCode === 2);

  const kpis = [
    { label: 'Total Spans', value: stats?.totalSpans ?? spans.length, color: '#4da3ff' },
    { label: 'p50 ms', value: stats?.p50Ms ?? '—', color: '#63e6be' },
    { label: 'p95 ms', value: stats?.p95Ms ?? '—', color: '#fbbf24' },
    { label: 'p99 ms', value: stats?.p99Ms ?? '—', color: '#f97316' },
    { label: 'Error Rate', value: stats?.errorRate !== undefined ? `${stats.errorRate.toFixed(1)}%` : '—', color: failedSpans.length > 0 ? '#ef4444' : '#63e6be' },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[#4da3ff]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 9h4M12 9h4M9 2v4M9 12v4" />
              <circle cx="9" cy="9" r="3" />
              <path d="M4.5 4.5l2 2M13.5 4.5l-2 2M4.5 13.5l2-2M13.5 13.5l-2-2" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Trace Explorer</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              Distributed tracing · OpenTelemetry · auto-refresh 10s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#63e6be] animate-pulse" />
          {lastRefresh && (
            <span className="text-[10px] text-[#4d6a87]">Updated {lastRefresh.toLocaleTimeString('pt-PT')}</span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[22px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-[#0b1526] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]/60"
        >
          <option value="">All Services</option>
          {allServices.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1">
          {(['all', 'ok', 'error'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors ${statusFilter === f ? 'bg-[#1a2f48] text-[#f0f6ff]' : 'text-[#4d6a87] hover:text-[#8ba8c7]'}`}
            >{f}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1">
          {(['1h', '6h', '24h'] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${timeRange === r ? 'bg-[#1a2f48] text-[#f0f6ff]' : 'text-[#4d6a87] hover:text-[#8ba8c7]'}`}
            >{r}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void fetchData(); }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Trace waterfall list */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#1a2f48] bg-[#07111f]/50 text-[10px] text-[#4d6a87] uppercase tracking-wider">
            <div className="w-28 shrink-0">Trace ID</div>
            <div className="w-24 shrink-0">Service</div>
            <div className="flex-1">Operation</div>
            <div className="w-20 text-right shrink-0">Duration</div>
            <div className="w-16 text-center shrink-0">Status</div>
            <div className="w-28 text-right shrink-0">Time</div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#4d6a87] text-[13px]">
              <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
              Loading traces…
            </div>
          ) : Object.entries(traceGroups).length === 0 ? (
            <div className="text-center py-16 text-[#4d6a87] text-[13px]">No trace data for current filters.</div>
          ) : (
            Object.entries(traceGroups).map(([traceId, traceSpans]) => {
              const rootSpan = traceSpans[0];
              const hasError = traceSpans.some((s) => s.statusCode === 2);
              const totalDuration = traceSpans.reduce((sum, s) => sum + s.durationMs, 0);
              const maxDuration = Math.max(...traceSpans.map((s) => s.durationMs));
              const isExpanded = expandedTrace === traceId;
              return (
                <div key={traceId}>
                  <button
                    type="button"
                    onClick={() => setExpandedTrace(isExpanded ? null : traceId)}
                    className="w-full flex items-center gap-4 px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors text-left"
                  >
                    <div className="w-28 shrink-0 font-mono text-[12px] text-[#4da3ff]">{traceId.slice(0, 8)}…</div>
                    <div className="w-24 shrink-0">
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ backgroundColor: `${serviceColor(rootSpan.service)}15`, color: serviceColor(rootSpan.service) }}>
                        {rootSpan.service}
                      </span>
                    </div>
                    <div className="flex-1 text-[12px] text-[#cfe4ff] truncate">{rootSpan.operationName}</div>
                    <div className="w-20 text-right text-[12px] font-mono text-[#8ba8c7] shrink-0">{totalDuration}ms</div>
                    <div className="w-16 text-center shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${hasError ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'bg-[#63e6be]/10 text-[#63e6be]'}`}>
                        {hasError ? 'ERROR' : 'OK'}
                      </span>
                    </div>
                    <div className="w-28 text-right text-[11px] text-[#4d6a87] shrink-0">
                      {new Date(rootSpan.startTime).toLocaleTimeString('pt-PT')}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="bg-[#07111f]/60 border-b border-[#1a2f48]/50 px-4 py-3">
                      <div className="text-[10px] text-[#4d6a87] uppercase tracking-wider mb-2">Waterfall — {traceSpans.length} spans</div>
                      {traceSpans.map((span) => (
                        <WaterfallBar key={span.spanId} span={span} maxDuration={maxDuration} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Service latency chart */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-3">p95 Latency Trend</div>
            {(stats?.serviceLatency ?? []).length === 0 ? (
              <div className="text-center py-6 text-[#4d6a87] text-[12px]">No latency data</div>
            ) : (
              <div className="space-y-3">
                {(stats?.serviceLatency ?? []).slice(0, 5).map((sl) => (
                  <div key={sl.service}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span style={{ color: serviceColor(sl.service) }}>{sl.service}</span>
                      <span className="text-[#4d6a87]">{sl.points[sl.points.length - 1]}ms</span>
                    </div>
                    <LineChart series={sl.points} color={serviceColor(sl.service)} height={32} width={280} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failed spans */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a2f48] bg-[#07111f]/50">
              <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#ef4444] uppercase tracking-wider">
                Failed Spans ({failedSpans.length})
              </span>
            </div>
            {failedSpans.length === 0 ? (
              <div className="text-center py-8 text-[#4d6a87] text-[12px]">
                <div className="text-[#63e6be] text-lg mb-1">✓</div>
                No errors
              </div>
            ) : (
              failedSpans.slice(0, 10).map((span) => (
                <div key={span.spanId} className="px-4 py-2.5 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40">
                  <div className="text-[11px] text-[#cfe4ff] truncate">{span.operationName}</div>
                  <div className="text-[10px] text-[#ef4444] mt-0.5 truncate">{span.errorMessage ?? 'Unknown error'}</div>
                  <div className="text-[10px] text-[#4d6a87] mt-0.5 font-mono">{span.traceId.slice(0, 12)}… · {span.durationMs}ms</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
