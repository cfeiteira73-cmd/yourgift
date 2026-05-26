'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface DlqItem {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedAt: string;
  reason: string;
  originalQueue: string;
  retries: number;
}

type Tab = 'overview' | 'dlq';

// ── Queue metadata (labels + categories) ──────────────────────────────────────

const QUEUE_META: Record<string, { label: string; category: string }> = {
  'email':                  { label: 'Email',               category: 'Communication' },
  'notifications':          { label: 'Notifications',       category: 'Communication' },
  'ai-generation':          { label: 'AI Generation',       category: 'AI' },
  'ai-benchmark':           { label: 'AI Benchmark',        category: 'AI' },
  'ai-brief-parse':         { label: 'Brief Parse',         category: 'AI' },
  'procurement-workflow':   { label: 'Procurement Flow',    category: 'Procurement' },
  'procurement-decision':   { label: 'Decision Engine',     category: 'Procurement' },
  'supplier-sync':          { label: 'Supplier Sync',       category: 'Supplier' },
  'inventory-sync':         { label: 'Inventory Sync',      category: 'Supplier' },
  'shipping-sync':          { label: 'Shipping Sync',       category: 'Supplier' },
  'financial-aggregation':  { label: 'Financial Agg.',      category: 'Financial' },
  'invoice-lifecycle':      { label: 'Invoice Lifecycle',   category: 'Financial' },
  'pdf-generation':         { label: 'PDF Generation',      category: 'Reports' },
  'report-generation':      { label: 'Report Gen.',         category: 'Reports' },
  'benchmark-generation':   { label: 'Benchmark Gen.',      category: 'Reports' },
  'onboarding-analysis':    { label: 'Onboarding AI',       category: 'Onboarding' },
  'dead-letter-queue':      { label: 'Dead Letter Queue',   category: 'DLQ' },
  'dlq-replay':             { label: 'DLQ Replay',          category: 'DLQ' },
};

const CATEGORY_ORDER = ['Communication', 'AI', 'Procurement', 'Supplier', 'Financial', 'Reports', 'Onboarding', 'DLQ'];

const CATEGORY_COLORS: Record<string, string> = {
  Communication: '#4da3ff',
  AI: '#a78bfa',
  Procurement: '#63e6be',
  Supplier: '#fbbf24',
  Financial: '#34d399',
  Reports: '#f97316',
  Onboarding: '#ec4899',
  DLQ: '#ef4444',
};

// ── Health calculation ────────────────────────────────────────────────────────

function queueHealth(q: QueueStats): 'healthy' | 'warn' | 'error' {
  if (q.failed > 0) return 'error';
  if (q.waiting > 100 || q.delayed > 50) return 'warn';
  return 'healthy';
}

const HEALTH_CONFIG = {
  healthy: { label: 'OK',   dot: '#63e6be', bg: 'rgba(99,230,190,0.08)',  text: '#63e6be' },
  warn:    { label: 'SLOW', dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  text: '#fbbf24' },
  error:   { label: 'ERR',  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)',   text: '#ef4444' },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.5 8A6.5 6.5 0 0 1 12.3 3.7L14 5.5" />
      <path d="M14.5 8A6.5 6.5 0 0 1 3.7 12.3L2 10.5" />
      <path d="M14 2v4h-4" />
      <path d="M2 14v-4h4" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.5 8A6.5 6.5 0 0 1 12.3 3.7L14 5.5" />
      <path d="M14 2v4h-4" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="12" height="3" rx="1" />
      <rect x="2" y="6.5" width="9" height="3" rx="1" />
      <rect x="2" y="11" width="6" height="3" rx="1" />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] text-[#4d6a87] mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function QueueRow({ q }: { q: QueueStats }) {
  const meta = QUEUE_META[q.name] ?? { label: q.name, category: 'Other' };
  const health = queueHealth(q);
  const cfg = HEALTH_CONFIG[health];
  const catColor = CATEGORY_COLORS[meta.category] ?? '#4d6a87';
  const total = q.waiting + q.active + q.completed + q.failed + q.delayed;

  // Throughput bar: ratio of completed to total
  const pct = total > 0 ? Math.min(100, Math.round((q.completed / total) * 100)) : 0;

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-[#1a2f48]/50 hover:bg-[#0b1526]/50 transition-colors">
      {/* Health dot */}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />

      {/* Name + category */}
      <div className="w-44 shrink-0">
        <div className="text-[13px] font-medium text-[#cfe4ff]">{meta.label}</div>
        <div className="text-[10px] mt-0.5 font-mono" style={{ color: catColor }}>{meta.category}</div>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-5 gap-2 text-center">
        <StatPill value={q.waiting}   label="waiting"   color="#4da3ff" />
        <StatPill value={q.active}    label="active"    color="#fbbf24" />
        <StatPill value={q.completed} label="done"      color="#63e6be" />
        <StatPill value={q.failed}    label="failed"    color="#ef4444" />
        <StatPill value={q.delayed}   label="delayed"   color="#a78bfa" />
      </div>

      {/* Throughput bar */}
      <div className="w-24 shrink-0">
        <div className="flex justify-between text-[10px] text-[#4d6a87] mb-1">
          <span>throughput</span><span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a2f48]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: health === 'error' ? '#ef4444' : '#63e6be' }}
          />
        </div>
      </div>

      {/* Health badge */}
      <div
        className="w-14 shrink-0 text-center text-[10px] font-mono font-semibold py-0.5 rounded"
        style={{ backgroundColor: cfg.bg, color: cfg.text }}
      >
        {cfg.label}
      </div>
    </div>
  );
}

function DlqRow({ item, onReplay }: { item: DlqItem; onReplay: (id: string) => Promise<void> }) {
  const [replaying, setReplaying] = useState(false);
  const [replayed, setReplayed] = useState(false);

  const handleReplay = async () => {
    setReplaying(true);
    await onReplay(item.id);
    setReplaying(false);
    setReplayed(true);
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center py-3 px-4 border-b border-[#1a2f48]/50 hover:bg-[#0b1526]/50 transition-colors">
      <div>
        <div className="text-[12px] font-mono text-[#4da3ff]">{item.id.slice(0, 16)}…</div>
        <div className="text-[11px] text-[#4d6a87] mt-0.5">{item.name}</div>
      </div>
      <div>
        <div className="text-[11px] text-[#8ba8c7]">{QUEUE_META[item.originalQueue]?.label ?? item.originalQueue}</div>
        <div className="text-[10px] text-[#4d6a87] font-mono mt-0.5">{item.retries} retries</div>
      </div>
      <div className="text-[11px] text-[#ef4444] truncate" title={item.reason}>{item.reason}</div>
      <button
        type="button"
        onClick={handleReplay}
        disabled={replaying || replayed}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
          replayed
            ? 'bg-[#63e6be]/10 text-[#63e6be] cursor-default'
            : 'bg-[#4da3ff]/10 text-[#4da3ff] hover:bg-[#4da3ff]/20'
        }`}
      >
        {replaying ? (
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <ReplayIcon />
        )}
        {replayed ? 'Queued' : 'Replay'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QueuesPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [dlq, setDlq] = useState<DlqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueues = useCallback(async () => {
    const token = getAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    const [qRes, dRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/admin/queues`, { headers }),
      fetch(`${API_BASE}/api/v1/admin/queues/dlq?limit=100`, { headers }),
    ]);
    if (qRes.status === 'fulfilled' && qRes.value.ok) {
      const data = await qRes.value.json() as { queues: QueueStats[] };
      setQueues(data.queues ?? []);
    }
    if (dRes.status === 'fulfilled' && dRes.value.ok) {
      const data = await dRes.value.json() as { items: DlqItem[] };
      setDlq(data.items ?? []);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchQueues();
  }, [fetchQueues]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchQueues, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchQueues]);

  const replayDlqItem = async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/api/v1/admin/queues/dlq/${id}/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });
  };

  // ── Aggregate stats ──────────────────────────────────────────────────────────

  const totalWaiting   = queues.reduce((s, q) => s + q.waiting, 0);
  const totalActive    = queues.reduce((s, q) => s + q.active, 0);
  const totalFailed    = queues.reduce((s, q) => s + q.failed, 0);
  const healthyCount   = queues.filter((q) => queueHealth(q) === 'healthy').length;
  const errorCount     = queues.filter((q) => queueHealth(q) === 'error').length;

  // ── Group queues by category ──────────────────────────────────────────────────

  const groupedQueues = CATEGORY_ORDER.reduce<Record<string, QueueStats[]>>((acc, cat) => {
    const items = queues.filter((q) => (QUEUE_META[q.name]?.category ?? 'Other') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[#4da3ff]"><QueueIcon /></div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Queue Monitor</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              BullMQ · {queues.length} queues · Redis {'{yourgift}'} prefix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
              autoRefresh
                ? 'bg-[#4da3ff]/10 border-[#4da3ff]/30 text-[#4da3ff]'
                : 'bg-[#0b1526] border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-[#63e6be] animate-pulse' : 'bg-[#4d6a87]'}`} />
            {autoRefresh ? 'Auto · 30s' : 'Paused'}
          </button>
          {/* Manual refresh */}
          <button
            type="button"
            onClick={() => { setLoading(true); void fetchQueues(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
          >
            <RefreshIcon />
            Refresh
          </button>
          {lastRefresh && (
            <span className="text-[10px] text-[#4d6a87]">
              Updated {lastRefresh.toLocaleTimeString('pt-PT')}
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Queues',   value: queues.length,  color: '#4da3ff' },
          { label: 'Healthy',  value: healthyCount,   color: '#63e6be' },
          { label: 'Errors',   value: errorCount,     color: '#ef4444' },
          { label: 'Waiting',  value: totalWaiting,   color: '#fbbf24' },
          { label: 'Active',   value: totalActive,    color: '#a78bfa' },
        ].map((k) => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[22px] font-bold tabular-nums" style={{ color: k.color }}>
              {k.value}
            </div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* DLQ alert banner */}
      {totalFailed > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30">
          <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse shrink-0" />
          <div className="text-[13px] text-[#ef4444]">
            <span className="font-semibold">{totalFailed} failed job{totalFailed > 1 ? 's' : ''}</span>
            {' '}across queues — check the DLQ tab to replay or investigate.
          </div>
          <button
            type="button"
            onClick={() => setTab('dlq')}
            className="ml-auto text-[11px] font-medium text-[#ef4444] hover:text-[#fca5a5] underline"
          >
            View DLQ →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
        {(['overview', 'dlq'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === t
                ? 'bg-[#1a2f48] text-[#f0f6ff]'
                : 'text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {t === 'overview' ? 'All Queues' : `Dead Letter (${dlq.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#4d6a87] text-[13px]">
          <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
          Loading queue data…
        </div>
      ) : tab === 'overview' ? (
        <div className="space-y-4">
          {Object.entries(groupedQueues).map(([category, items]) => {
            const catColor = CATEGORY_COLORS[category] ?? '#4d6a87';
            return (
              <div key={category} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a2f48] bg-[#07111f]/50">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: catColor }}>
                    {category}
                  </span>
                  <span className="text-[10px] text-[#4d6a87] ml-auto">{items.length} queue{items.length > 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-4 px-4 py-2 border-b border-[#1a2f48]/30 text-[10px] text-[#4d6a87] uppercase tracking-wider">
                  <div className="w-2 shrink-0" />
                  <div className="w-44 shrink-0">Queue</div>
                  <div className="flex-1 grid grid-cols-5 gap-2 text-center">
                    <span>Waiting</span><span>Active</span><span>Done</span><span>Failed</span><span>Delayed</span>
                  </div>
                  <div className="w-24 shrink-0 text-center">Throughput</div>
                  <div className="w-14 shrink-0 text-center">Status</div>
                </div>

                {items.map((q) => <QueueRow key={q.name} q={q} />)}
              </div>
            );
          })}

          {queues.length === 0 && (
            <div className="text-center py-16 text-[#4d6a87] text-[13px]">
              No queue data — check API connection and Redis config.
            </div>
          )}
        </div>
      ) : (
        /* DLQ tab */
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-[#1a2f48] text-[10px] text-[#4d6a87] uppercase tracking-wider bg-[#07111f]/50">
            <span>Job ID / Name</span>
            <span>Original Queue</span>
            <span>Failure Reason</span>
            <span>Action</span>
          </div>

          {dlq.length === 0 ? (
            <div className="text-center py-12 text-[#4d6a87] text-[13px]">
              <div className="text-[#63e6be] text-[20px] mb-2">✓</div>
              Dead Letter Queue is empty — all systems healthy.
            </div>
          ) : (
            dlq.map((item) => (
              <DlqRow key={item.id} item={item} onReplay={replayDlqItem} />
            ))
          )}

          {dlq.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a2f48] bg-[#07111f]/30">
              <span className="text-[11px] text-[#4d6a87]">{dlq.length} item{dlq.length > 1 ? 's' : ''} in DLQ</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
