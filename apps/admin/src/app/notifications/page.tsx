'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationLog {
  id: string;
  type: string;
  email?: string;
  orderId?: string;
  status: 'sent' | 'failed' | 'skipped';
  createdAt: string;
  subject?: string;
}

interface NotifStats {
  sentToday: number;
  sentThisMonth: number;
  failedToday: number;
  templates: { name: string; count: number }[];
}

type FilterStatus = 'all' | 'sent' | 'failed' | 'skipped';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NotificationLog['status'] }) {
  const cfg = {
    sent: { bg: 'rgba(99,230,190,0.1)', text: '#63e6be', label: 'Sent' },
    failed: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', label: 'Failed' },
    skipped: { bg: 'rgba(77,163,255,0.1)', text: '#4d6a87', label: 'Skipped' },
  }[status];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    order_created: '#4da3ff', order_paid: '#63e6be', order_shipped: '#a78bfa',
    order_delivered: '#fbbf24', magic_link: '#f97316', notification: '#4d6a87',
  };
  const color = colors[type] ?? '#4d6a87';
  return (
    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${color}15`, color }}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

// ── Manual send form ──────────────────────────────────────────────────────────

function ManualSendForm({ onSent }: { onSent: () => void }) {
  const [email, setEmail] = useState('');
  const [type, setType] = useState('notification');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'ok' | 'err' | null>(null);

  const send = async () => {
    if (!email.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/notifications/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type, email: email.trim() }),
      });
      setResult(res.ok ? 'ok' : 'err');
      if (res.ok) { setEmail(''); onSent(); }
    } catch { setResult('err'); }
    setSending(false);
  };

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
      <h3 className="text-[13px] font-semibold text-[#f0f6ff] mb-4">Send Test Notification</h3>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="recipient@company.com"
          className="flex-1 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[13px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[13px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]/60"
        >
          <option value="notification">Notification</option>
          <option value="order_created">Order Created</option>
          <option value="order_paid">Order Paid</option>
          <option value="order_shipped">Order Shipped</option>
        </select>
        <button
          type="button"
          onClick={send}
          disabled={sending || !email.trim()}
          className="px-4 py-2 bg-[#4da3ff] text-[#07111f] rounded-lg text-[12px] font-semibold hover:bg-[#3a92ee] disabled:opacity-50 transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
      {result === 'ok' && <p className="text-[11px] text-[#63e6be] mt-2">✓ Sent via Resend</p>}
      {result === 'err' && <p className="text-[11px] text-[#ef4444] mt-2">✗ Failed — check RESEND_API_KEY</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotifStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/notifications/stats`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/notifications/logs?limit=200`, { headers: authHeaders() }),
      ]);
      if (sRes.status === 'fulfilled' && sRes.value.ok) {
        setStats(await sRes.value.json() as NotifStats);
      }
      if (lRes.status === 'fulfilled' && lRes.value.ok) {
        setLogs(await lRes.value.json() as NotificationLog[]);
      }
    } catch { /* graceful */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = logs.filter(l => filterStatus === 'all' || l.status === filterStatus);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Notifications</h1>
          <p className="text-[12px] text-[#4d6a87] mt-0.5">Email delivery via Resend · transactional templates · audit log</p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sent Today',      value: stats?.sentToday ?? sentCount,     color: '#63e6be' },
          { label: 'Sent This Month', value: stats?.sentThisMonth ?? sentCount,  color: '#4da3ff' },
          { label: 'Failed Today',    value: stats?.failedToday ?? failedCount,  color: failedCount > 0 ? '#ef4444' : '#4d6a87' },
          { label: 'Total Logged',    value: logs.length,                        color: '#f0f6ff' },
        ].map(k => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[24px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Template breakdown */}
      {stats?.templates && stats.templates.length > 0 && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
          <div className="text-[11px] text-[#4d6a87] uppercase tracking-wider mb-3">Emails by Template</div>
          <div className="flex flex-wrap gap-2">
            {stats.templates.map(t => (
              <div key={t.name} className="flex items-center gap-2 px-3 py-1.5 bg-[#07111f] border border-[#1a2f48] rounded-lg">
                <span className="text-[11px] text-[#f0f6ff]">{t.name.replace(/_/g, ' ')}</span>
                <span className="text-[11px] font-bold text-[#4da3ff]">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual send */}
      <ManualSendForm onSent={() => void load()} />

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
        {(['all', 'sent', 'failed', 'skipped'] as FilterStatus[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilterStatus(f); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
              filterStatus === f ? 'bg-[#1a2f48] text-[#f0f6ff]' : 'text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {f} {f !== 'all' && <span className="ml-1 opacity-60">{logs.filter(l => l.status === f).length}</span>}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        {/* Headers */}
        <div className="grid grid-cols-[1fr_100px_100px_1fr_auto] gap-4 px-4 py-2.5 border-b border-[#1a2f48] text-[10px] text-[#4d6a87] uppercase tracking-wider bg-[#07111f]/50">
          <span>Recipient</span><span>Type</span><span>Status</span><span>Subject / Order</span><span>Time</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#4d6a87] text-[13px]">
            <span className="inline-block w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
            Loading logs…
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-16 text-[#4d6a87] text-[13px]">
            {filterStatus === 'all' ? 'No notifications logged yet' : `No ${filterStatus} notifications`}
          </div>
        ) : (
          paged.map(log => (
            <div
              key={log.id}
              className="grid grid-cols-[1fr_100px_100px_1fr_auto] gap-4 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors"
            >
              <div className="text-[12px] text-[#8ba8c7] truncate" title={log.email}>{log.email ?? '—'}</div>
              <div><TypeBadge type={log.type} /></div>
              <div><StatusBadge status={log.status} /></div>
              <div className="text-[11px] text-[#4d6a87] truncate">
                {log.subject ?? (log.orderId ? `Order #${log.orderId.slice(0, 8)}` : '—')}
              </div>
              <div className="text-[11px] text-[#4d6a87] whitespace-nowrap">{formatDate(log.createdAt)}</div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a2f48] bg-[#07111f]/30">
            <span className="text-[11px] text-[#4d6a87]">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-[11px] text-[#4d6a87] hover:text-[#f0f6ff] disabled:opacity-30 transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-[11px] text-[#4d6a87] hover:text-[#f0f6ff] disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
