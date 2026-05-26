'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { API_BASE, getAdminToken, formatCurrency, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  ref?: string;
  status: string;
  totalAmount?: number | null;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
  client?: { name?: string | null; email?: string | null; company?: string | null };
  clientId?: string;
}

interface PaymentStats {
  totalRevenueMtd: number;
  totalRevenueYtd: number;
  pendingPayments: number;
  overduePayments: number;
  avgOrderValue: number;
  conversionRate: number;
}

type FilterStatus = 'all' | 'paid' | 'pending' | 'failed' | 'refunded';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  paid:      { label: 'Paid',      bg: 'rgba(99,230,190,0.1)', text: '#63e6be' },
  pending:   { label: 'Pending',   bg: 'rgba(251,191,36,0.1)', text: '#fbbf24' },
  failed:    { label: 'Failed',    bg: 'rgba(239,68,68,0.1)',  text: '#ef4444' },
  refunded:  { label: 'Refunded',  bg: 'rgba(167,139,250,0.1)', text: '#a78bfa' },
  cancelled: { label: 'Cancelled', bg: 'rgba(77,99,135,0.1)',  text: '#4d6a87' },
};

function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, analyticsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/orders?limit=200&sortBy=createdAt&sortDir=desc`, {
          headers: authHeaders(),
        }),
        fetch(`${API_BASE}/api/v1/orders/analytics`, { headers: authHeaders() }),
      ]);

      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const data = await ordersRes.value.json() as { orders?: Payment[]; data?: Payment[] } | Payment[];
        const list = Array.isArray(data) ? data : (data.orders ?? data.data ?? []);
        setOrders(list);
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
        const analytics = await analyticsRes.value.json() as Record<string, unknown>;
        setStats({
          totalRevenueMtd: Number(analytics.revenueMtd ?? analytics.totalRevenueMtd ?? 0),
          totalRevenueYtd: Number(analytics.revenueYtd ?? analytics.totalRevenueYtd ?? 0),
          pendingPayments: Number(analytics.pendingOrders ?? analytics.pendingPayments ?? 0),
          overduePayments: Number(analytics.overduePayments ?? 0),
          avgOrderValue: Number(analytics.avgOrderValue ?? 0),
          conversionRate: Number(analytics.conversionRate ?? 0),
        });
      }
    } catch { /* graceful */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Filter logic ───────────────────────────────────��────────────────────────

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || (
      o.ref?.toLowerCase().includes(q) ||
      o.client?.email?.toLowerCase().includes(q) ||
      o.client?.company?.toLowerCase().includes(q) ||
      o.id.includes(q)
    );
    return matchStatus && matchSearch;
  });

  const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'delivered');
  const totalRevenue = paidOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const failedCount = orders.filter(o => o.status === 'failed').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Payments</h1>
          <p className="text-[12px] text-[#4d6a87] mt-0.5">Order revenue · Stripe invoices · payment status</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
          >
            Stripe Dashboard →
          </a>
          <button
            type="button"
            onClick={() => { setLoading(true); void load(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Revenue (All)',  value: formatCurrency(stats?.totalRevenueYtd ?? totalRevenue), color: '#63e6be' },
          { label: 'Revenue MTD',          value: formatCurrency(stats?.totalRevenueMtd ?? 0),            color: '#4da3ff' },
          { label: 'Avg Order Value',      value: formatCurrency(stats?.avgOrderValue ?? 0),              color: '#f0f6ff' },
          { label: 'Pending',              value: String(stats?.pendingPayments ?? pendingCount),         color: '#fbbf24' },
          { label: 'Failed',               value: String(failedCount),                                    color: failedCount > 0 ? '#ef4444' : '#4d6a87' },
        ].map(k => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[20px] font-bold tabular-nums leading-tight" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stripe alert */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#a78bfa]/5 border border-[#a78bfa]/20">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#a78bfa] mt-0.5 shrink-0">
          <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 10h3M10 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <div className="text-[12px] text-[#8ba8c7]">
          Payment processing via <strong className="text-[#f0f6ff]">Stripe</strong>. Webhooks at{' '}
          <code className="bg-[#07111f] px-1.5 py-0.5 rounded text-[11px] text-[#4da3ff]">POST /api/v1/payments/webhook</code>.
          Configure your Stripe webhook endpoint and set <code className="bg-[#07111f] px-1.5 py-0.5 rounded text-[11px] text-[#4da3ff]">STRIPE_WEBHOOK_SECRET</code>.
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1">
          {(['all', 'paid', 'pending', 'failed', 'refunded'] as FilterStatus[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                filterStatus === f ? 'bg-[#1a2f48] text-[#f0f6ff]' : 'text-[#4d6a87] hover:text-[#8ba8c7]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ref, email, company…"
          className="flex-1 max-w-xs bg-[#0b1526] border border-[#1a2f48] rounded-xl px-3 py-2 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
        />

        <span className="text-[11px] text-[#4d6a87] ml-auto">{filtered.length} payments</span>
      </div>

      {/* Table */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        {/* Headers */}
        <div className="grid grid-cols-[1fr_120px_80px_120px_100px_auto] gap-4 px-4 py-2.5 border-b border-[#1a2f48] text-[10px] text-[#4d6a87] uppercase tracking-wider bg-[#07111f]/50">
          <span>Order / Client</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Payment Method</span>
          <span>Date</span>
          <span>Invoice</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#4d6a87] text-[13px]">
            <span className="inline-block w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
            Loading payments…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#4d6a87] text-[13px]">
            {orders.length === 0 ? 'No orders yet' : `No ${filterStatus} payments`}
          </div>
        ) : (
          filtered.map(order => (
            <div
              key={order.id}
              className="grid grid-cols-[1fr_120px_80px_120px_100px_auto] gap-4 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors"
            >
              <div>
                <Link href={`/orders/${order.id}`} className="text-[13px] font-medium text-[#4da3ff] hover:text-[#f0f6ff] transition-colors">
                  {order.ref ?? order.id.slice(0, 12)}…
                </Link>
                <div className="text-[11px] text-[#4d6a87] mt-0.5">
                  {order.client?.company ?? order.client?.email ?? order.clientId?.slice(0, 12) ?? '—'}
                </div>
              </div>

              <div className="text-[14px] font-semibold text-[#f0f6ff] tabular-nums">
                {order.totalAmount != null ? formatCurrency(order.totalAmount) : '—'}
              </div>

              <div><PaymentStatusBadge status={order.status} /></div>

              <div className="text-[11px] text-[#4d6a87]">
                {order.paymentMethod ?? (order.stripePaymentIntentId ? 'Stripe' : '—')}
              </div>

              <div className="text-[11px] text-[#4d6a87] whitespace-nowrap">
                {order.paidAt ? formatDate(order.paidAt) : formatDate(order.createdAt)}
              </div>

              <div>
                <a
                  href={`${API_BASE}/api/v1/orders/${order.id}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#4da3ff] hover:text-[#f0f6ff] transition-colors"
                  title="Download Invoice"
                >
                  ↓ Invoice
                </a>
              </div>
            </div>
          ))
        )}

        {/* Summary footer */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a2f48] bg-[#07111f]/30">
            <span className="text-[11px] text-[#4d6a87]">{filtered.length} payments shown</span>
            <span className="text-[12px] font-semibold text-[#63e6be]">
              Total: {formatCurrency(filtered.filter(o => o.status === 'paid' || o.status === 'delivered').reduce((s, o) => s + (o.totalAmount ?? 0), 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
