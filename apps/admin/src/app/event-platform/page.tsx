'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Types ────────────────────────────────────────────────────────────────────

interface StreamHealth {
  totalEvents: number;
  totalStreams: number;
  latestEventAt: string | null;
  oldestEventAt: string | null;
  byStreamType: Array<{
    streamType: string;
    eventCount: number;
    maxSequence: number | null;
  }>;
}

interface ConsumerOffset {
  id: string;
  consumerGroup: string;
  streamType: string | null;
  lastSequenceNum: number;
  lastEventId: string | null;
  lastProcessedAt: string | null;
  eventsProcessed: number;
  errors: number;
  isActive: boolean;
}

interface DLQEntry {
  id: string;
  streamId: string;
  streamType: string;
  eventType: string;
  eventId: string;
  failureReason: string;
  failureCategory: string;
  consumerGroup: string;
  attemptCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  status: string;
}

interface DLQStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byConsumerGroup: Record<string, number>;
}

interface RebuildResult {
  totalEvents: number;
  streams: number;
  dryRun: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function categoryBadge(cat: string): string {
  const map: Record<string, string> = {
    transient: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    permanent: 'bg-red-500/15 text-red-300 border-red-500/30',
    schema_mismatch: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    timeout: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    unknown: 'bg-[#1a2f48] text-[#8ba8c7] border-[#1a2f48]',
  };
  return map[cat] ?? map['unknown']!;
}

function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('adminToken') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...options, headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#f0f6ff]">{value}</p>
    </div>
  );
}

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
      {msg}
    </div>
  );
}

// ── Tab 1: Event Stream Health ────────────────────────────────────────────────

function HealthTab() {
  const [health, setHealth] = useState<StreamHealth | null>(null);
  const [offsets, setOffsets] = useState<ConsumerOffset[]>([]);
  const [lags, setLags] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [h, o] = await Promise.all([
        apiFetch<StreamHealth>('/api/v1/event-platform/health'),
        apiFetch<ConsumerOffset[]>('/api/v1/event-platform/consumers'),
      ]);
      setHealth(h);
      setOffsets(o);
      // fetch lags for each consumer group
      const lagEntries = await Promise.all(
        o.map(async (c) => {
          try {
            const lag = await apiFetch<number>(
              `/api/v1/event-platform/consumers/${encodeURIComponent(c.consumerGroup)}/lag${c.streamType ? `?streamType=${c.streamType}` : ''}`,
            );
            return [`${c.consumerGroup}__${c.streamType ?? ''}`, lag] as [string, number];
          } catch {
            return [`${c.consumerGroup}__${c.streamType ?? ''}`, 0] as [string, number];
          }
        }),
      );
      setLags(Object.fromEntries(lagEntries));
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load health data');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const maxCount = health ? Math.max(...health.byStreamType.map((s) => s.eventCount), 1) : 1;

  return (
    <div className="space-y-6">
      {err && <SectionError msg={err} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Events" value={health?.totalEvents.toLocaleString() ?? '—'} />
        <KpiCard label="Total Streams" value={health?.totalStreams.toLocaleString() ?? '—'} />
        <KpiCard label="Latest Event" value={timeAgo(health?.latestEventAt ?? null)} />
        <KpiCard label="Oldest Event" value={timeAgo(health?.oldestEventAt ?? null)} />
      </div>

      {/* By Stream Type */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a2f48]">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">By Stream Type</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Stream Type</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Events</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Max Seq</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87] w-40">Volume</th>
            </tr>
          </thead>
          <tbody>
            {(health?.byStreamType ?? []).map((s) => (
              <tr key={s.streamType} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                <td className="px-5 py-3 text-[#f0f6ff] font-mono text-xs">{s.streamType}</td>
                <td className="px-5 py-3 text-right text-[#8ba8c7]">{s.eventCount.toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-[#8ba8c7]">{s.maxSequence ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="h-1.5 bg-[#1a2f48] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4da3ff] rounded-full"
                      style={{ width: `${(s.eventCount / maxCount) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!health?.byStreamType.length && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-[#4d6a87] text-sm">No events yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Consumer Group Offsets */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a2f48]">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Consumer Group Offsets</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Group</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Stream</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Last Seq</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Processed</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Errors</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Lag</th>
            </tr>
          </thead>
          <tbody>
            {offsets.map((c) => {
              const lagKey = `${c.consumerGroup}__${c.streamType ?? ''}`;
              const lag = lags[lagKey] ?? 0;
              return (
                <tr key={c.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                  <td className="px-5 py-3 text-[#f0f6ff] font-mono text-xs">{c.consumerGroup}</td>
                  <td className="px-5 py-3 text-[#8ba8c7] text-xs">{c.streamType ?? <span className="text-[#4d6a87]">all</span>}</td>
                  <td className="px-5 py-3 text-right text-[#8ba8c7]">{c.lastSequenceNum}</td>
                  <td className="px-5 py-3 text-right text-[#8ba8c7]">{c.eventsProcessed.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={c.errors > 0 ? 'text-red-400' : 'text-[#8ba8c7]'}>{c.errors}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${lag > 100 ? 'bg-red-500/15 text-red-300' : 'bg-[#1a2f48] text-[#8ba8c7]'}`}>
                      {lag}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!offsets.length && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-[#4d6a87] text-sm">No consumer groups registered</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#4d6a87] text-right">Auto-refreshes every 15s</p>
    </div>
  );
}

// ── Tab 2: Dead Letter Queue ──────────────────────────────────────────────────

function DLQTab() {
  const [entries, setEntries] = useState<DLQEntry[]>([]);
  const [stats, setStats] = useState<DLQStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('failed');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([
        apiFetch<DLQEntry[]>(`/api/v1/event-platform/dlq?status=${statusFilter}&limit=50`),
        apiFetch<DLQStats>('/api/v1/event-platform/dlq/stats'),
      ]);
      setEntries(e);
      setStats(s);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load DLQ');
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleReplay(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/v1/event-platform/dlq/${id}/replay`, {
        method: 'POST',
        body: JSON.stringify({ replayedBy: 'admin' }),
      });
      setMsg('Replayed successfully');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard(id: string) {
    if (!confirm('Discard this DLQ entry?')) return;
    setBusy(id);
    try {
      await apiFetch(`/api/v1/event-platform/dlq/${id}`, { method: 'DELETE' });
      setMsg('Discarded');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Discard failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleReplayAll() {
    if (!confirm('Replay up to 10 failed DLQ entries?')) return;
    setBusy('batch');
    try {
      const result = await apiFetch<{ replayed: number; failed: number }>(
        '/api/v1/event-platform/dlq/replay-batch',
        { method: 'POST', body: JSON.stringify({ limit: 10, replayedBy: 'admin' }) },
      );
      setMsg(`Batch replay: ${result.replayed} replayed, ${result.failed} failed`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Batch replay failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {err && <SectionError msg={err} />}
      {msg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400 flex items-center justify-between">
          {msg}
          <button type="button" onClick={() => setMsg('')} className="text-emerald-400/50 hover:text-emerald-400">✕</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Total" value={stats.total} />
          <KpiCard label="Failed" value={stats.byStatus['failed'] ?? 0} />
          <KpiCard label="Resolved" value={stats.byStatus['resolved'] ?? 0} />
          <KpiCard label="Discarded" value={stats.byStatus['discarded'] ?? 0} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0b1526] border border-[#1a2f48] text-[#8ba8c7] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="failed">Failed</option>
          <option value="replaying">Replaying</option>
          <option value="resolved">Resolved</option>
          <option value="discarded">Discarded</option>
        </select>
        <button
          type="button"
          onClick={() => void handleReplayAll()}
          disabled={busy === 'batch'}
          className="ml-auto px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
        >
          {busy === 'batch' ? 'Replaying…' : 'Replay All Failed (10)'}
        </button>
      </div>

      {/* Entries */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Event Type</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Group</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Category</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Attempts</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Last Failed</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4d6a87]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-mono text-xs text-[#f0f6ff]">{e.eventType}</p>
                  <p className="text-[11px] text-[#4d6a87] truncate max-w-[180px]" title={e.failureReason}>{e.failureReason}</p>
                </td>
                <td className="px-5 py-3 text-[#8ba8c7] text-xs">{e.consumerGroup}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadge(e.failureCategory)}`}>
                    {e.failureCategory}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-[#8ba8c7]">{e.attemptCount}</td>
                <td className="px-5 py-3 text-right text-[#8ba8c7] text-xs">{timeAgo(e.lastFailedAt)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReplay(e.id)}
                      disabled={busy === e.id || e.status === 'resolved'}
                      className="px-2.5 py-1 rounded bg-[#4da3ff]/10 text-[#4da3ff] text-xs font-medium hover:bg-[#4da3ff]/20 disabled:opacity-40 transition-colors"
                    >
                      Replay
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDiscard(e.id)}
                      disabled={busy === e.id}
                      className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[#4d6a87] text-sm">
                  No DLQ entries for the selected filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 3: Replay Engine ──────────────────────────────────────────────────────

function ReplayTab() {
  const [offsets, setOffsets] = useState<ConsumerOffset[]>([]);
  // Stream replay form
  const [streamId, setStreamId] = useState('');
  const [fromSeq, setFromSeq] = useState('');
  const [toSeq, setToSeq] = useState('');
  const [streamResult, setStreamResult] = useState<{ replayed: number; lastSequence: number } | null>(null);
  // Consumer catch-up
  const [selectedGroup, setSelectedGroup] = useState('');
  const [catchUpResult, setCatchUpResult] = useState<{ replayed: number } | null>(null);
  // Full rebuild
  const [dryRun, setDryRun] = useState(true);
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch<ConsumerOffset[]>('/api/v1/event-platform/consumers')
      .then((o) => { setOffsets(o); if (o[0]) setSelectedGroup(o[0].consumerGroup); })
      .catch(() => null);
  }, []);

  async function handleStreamReplay(e: React.FormEvent) {
    e.preventDefault();
    if (!streamId.trim()) return;
    setBusy('stream');
    setErr('');
    setStreamResult(null);
    try {
      const result = await apiFetch<{ replayed: number; lastSequence: number }>(
        '/api/v1/event-platform/replay/stream',
        {
          method: 'POST',
          body: JSON.stringify({
            streamId: streamId.trim(),
            ...(fromSeq ? { fromSequence: Number(fromSeq) } : {}),
            ...(toSeq ? { toSequence: Number(toSeq) } : {}),
          }),
        },
      );
      setStreamResult(result);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Stream replay failed');
    } finally {
      setBusy('');
    }
  }

  async function handleCatchUp() {
    if (!selectedGroup) return;
    setBusy('catchup');
    setErr('');
    setCatchUpResult(null);
    try {
      const result = await apiFetch<{ replayed: number }>(
        '/api/v1/event-platform/replay/consumer-group',
        { method: 'POST', body: JSON.stringify({ consumerGroup: selectedGroup }) },
      );
      setCatchUpResult(result);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Catch-up failed');
    } finally {
      setBusy('');
    }
  }

  async function handleRebuild() {
    if (!dryRun && !confirm('This will replay ALL events across ALL streams. Confirm?')) return;
    setBusy('rebuild');
    setErr('');
    setRebuildResult(null);
    try {
      const result = await apiFetch<RebuildResult>(
        '/api/v1/event-platform/replay/full-rebuild',
        { method: 'POST', body: JSON.stringify({ dryRun }) },
      );
      setRebuildResult(result);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Rebuild failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      {err && <SectionError msg={err} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Stream Replay */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Stream Replay</h3>
          <p className="text-xs text-[#4d6a87]">Re-emit all events for a specific stream from a given sequence.</p>
          <form onSubmit={(e) => void handleStreamReplay(e)} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#4d6a87] mb-1 uppercase tracking-wider">Stream ID</label>
              <input
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                placeholder="e.g. order-uuid-here"
                className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-[#4d6a87] mb-1 uppercase tracking-wider">From Seq</label>
                <input
                  type="number"
                  value={fromSeq}
                  onChange={(e) => setFromSeq(e.target.value)}
                  placeholder="1"
                  className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#4d6a87] mb-1 uppercase tracking-wider">To Seq</label>
                <input
                  type="number"
                  value={toSeq}
                  onChange={(e) => setToSeq(e.target.value)}
                  placeholder="∞"
                  className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy === 'stream' || !streamId.trim()}
              className="w-full py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
            >
              {busy === 'stream' ? 'Replaying…' : 'Replay Stream'}
            </button>
          </form>
          {streamResult && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400 space-y-1">
              <p>Replayed: <strong>{streamResult.replayed}</strong> events</p>
              <p>Last Sequence: <strong>{streamResult.lastSequence}</strong></p>
            </div>
          )}
        </div>

        {/* Consumer Catch-up */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Consumer Catch-up</h3>
          <p className="text-xs text-[#4d6a87]">Replay all unprocessed events for a consumer group from its last committed offset.</p>
          <div>
            <label className="block text-[11px] font-medium text-[#4d6a87] mb-1 uppercase tracking-wider">Consumer Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-[#07111f] border border-[#1a2f48] text-[#f0f6ff] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da3ff]"
            >
              {offsets.map((o) => (
                <option key={o.id} value={o.consumerGroup}>
                  {o.consumerGroup}{o.streamType ? ` (${o.streamType})` : ' (all)'}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleCatchUp()}
            disabled={busy === 'catchup' || !selectedGroup}
            className="w-full py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74b8ff] disabled:opacity-50 transition-colors"
          >
            {busy === 'catchup' ? 'Catching up…' : 'Catch Up'}
          </button>
          {catchUpResult && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
              Replayed <strong>{catchUpResult.replayed}</strong> events
            </div>
          )}
        </div>

        {/* Full System Rebuild */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f0f6ff]">Full System Rebuild</h3>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
            WARNING: Replays ALL events across ALL streams. Use only for disaster recovery.
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setDryRun((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${dryRun ? 'bg-[#4da3ff]' : 'bg-red-500'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dryRun ? 'left-0.5' : 'left-5'}`} />
            </div>
            <span className="text-sm text-[#8ba8c7]">{dryRun ? 'Dry Run (safe)' : 'Live Execution'}</span>
          </label>
          <button
            type="button"
            onClick={() => void handleRebuild()}
            disabled={busy === 'rebuild'}
            className={`w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors ${dryRun ? 'bg-[#4da3ff] text-[#07111f] hover:bg-[#74b8ff]' : 'bg-red-500 text-white hover:bg-red-400'}`}
          >
            {busy === 'rebuild' ? 'Running…' : dryRun ? 'Execute Dry Run' : 'Execute Rebuild'}
          </button>
          {rebuildResult && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400 space-y-1">
              <p>Total Events: <strong>{rebuildResult.totalEvents.toLocaleString()}</strong></p>
              <p>Streams: <strong>{rebuildResult.streams}</strong></p>
              <p>Mode: <strong>{rebuildResult.dryRun ? 'Dry Run' : 'Live'}</strong></p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'health', label: 'Event Stream Health' },
  { id: 'dlq', label: 'Dead Letter Queue' },
  { id: 'replay', label: 'Replay Engine' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function EventPlatformPage() {
  const [activeTab, setActiveTab] = useState<TabId>('health');

  return (
    <div className="min-h-screen bg-[#07111f] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#4da3ff]/10 border border-[#4da3ff]/20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4da3ff" strokeWidth="1.5" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f0f6ff]">Event Platform</h1>
          <p className="text-xs text-[#4d6a87]">Kafka-style consumer offsets · Dead Letter Queue · Replay Engine</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#4da3ff] text-[#07111f]'
                : 'text-[#8ba8c7] hover:text-[#f0f6ff] hover:bg-[#102131]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'health' && <HealthTab />}
      {activeTab === 'dlq' && <DLQTab />}
      {activeTab === 'replay' && <ReplayTab />}
    </div>
  );
}
