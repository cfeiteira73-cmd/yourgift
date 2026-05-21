'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, formatDateTime, API_BASE, getAdminToken } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApprovalOrder {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt?: string;
  client?: { name?: string; email?: string; company?: string };
  items?: { productTitle?: string; quantity: number; imageUrl?: string }[];
  approvalStage?: 'HR' | 'MANAGER' | 'FINANCE';
  approvalNotes?: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

// ── Reject Modal ───────────────────────────────────────────────────────────────

function RejectModal({
  orderId,
  orderRef,
  onClose,
  onConfirm,
}: {
  orderId: string;
  orderRef: string;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-base font-bold text-white mb-1">Rejeitar encomenda</h3>
        <p className="text-sm text-[#4d6a87] mb-4">
          Referência:{' '}
          <span className="font-mono text-[#f87171]">
            {orderRef}
          </span>
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo da rejeição (opcional)..."
          rows={3}
          className="w-full px-4 py-3 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#f87171]/50 resize-none transition-colors"
        />
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[#1a2f48] text-sm text-[#8ba8c7] hover:bg-[#102131] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes)}
            className="flex-1 px-4 py-2 rounded-lg bg-[#f87171] text-white text-sm font-semibold hover:bg-[#ef4444] transition-colors"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approval Card ─────────────────────────────────────────────────────────────

function ApprovalCard({
  order,
  tab,
  onApprove,
  onReject,
}: {
  order: ApprovalOrder;
  tab: Tab;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const waitingSince = order.paidAt ?? order.createdAt;
  const diff = Date.now() - new Date(waitingSince).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const waitLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const isUrgent = hours >= 24;

  const stageColors: Record<string, string> = {
    HR: 'bg-[#0d1f3a] text-[#4da3ff] border-[#1a3a5c]',
    MANAGER: 'bg-[#1a0f3a] text-[#a78bfa] border-[#2a1f4a]',
    FINANCE: 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
  };
  const stage = order.approvalStage ?? 'MANAGER';

  return (
    <div
      className={`rounded-xl border bg-[#0b1526] overflow-hidden transition-all ${
        isUrgent && tab === 'pending'
          ? 'border-[#f59e0b]/30'
          : 'border-[#1a2f48]'
      }`}
    >
      <div className="px-5 py-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-[#4da3ff] font-bold">
                {order.ref ?? order.id.slice(0, 8).toUpperCase()}
              </span>
              <StatusBadge status={order.status} size="sm" />
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  stageColors[stage] ?? stageColors.MANAGER
                }`}
              >
                {stage}
              </span>
            </div>
            <p className="text-xs text-[#8ba8c7] mt-1">
              {order.client?.name ?? order.client?.company ?? '—'}
              {order.client?.email && (
                <span className="text-[#4d6a87] ml-1">· {order.client.email}</span>
              )}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black text-white tabular-nums">
              {formatCurrency(order.totalAmount)}
            </p>
            {tab === 'pending' && (
              <p
                className={`text-[10px] font-semibold mt-0.5 ${
                  isUrgent ? 'text-[#f59e0b]' : 'text-[#4d6a87]'
                }`}
              >
                {isUrgent ? '⚠ ' : ''}Aguardando {waitLabel}
              </p>
            )}
          </div>
        </div>

        {/* Product thumbnails */}
        {order.items && order.items.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              {order.items.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg border-2 border-[#0b1526] bg-[#102131] overflow-hidden flex-shrink-0"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productTitle ?? ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px]">
                      🎁
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs text-[#4d6a87]">
              {order.items.map((it) => `${it.quantity}× ${it.productTitle ?? '?'}`).join(', ')}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-[10px] text-[#4d6a87] mb-4">
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        {/* Actions */}
        {tab === 'pending' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onApprove(order.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#063e1f] text-[#63e6be] text-xs font-semibold border border-[#63e6be]/20 hover:bg-[#0a5a2a] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => onReject(order.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2a0a0a] text-[#f87171] text-xs font-semibold border border-[#f87171]/20 hover:bg-[#3a1010] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
              Rejeitar
            </button>
          </div>
        )}

        {tab === 'approved' && (
          <div className="flex items-center gap-2 text-xs text-[#63e6be]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
            Aprovado
          </div>
        )}

        {tab === 'rejected' && (
          <div>
            <div className="flex items-center gap-2 text-xs text-[#f87171]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
              Rejeitado
            </div>
            {order.approvalNotes && (
              <p className="text-xs text-[#4d6a87] mt-1.5 bg-[#102131] rounded px-2 py-1.5 border border-[#1a2f48]">
                {order.approvalNotes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [rejectModal, setRejectModal] = useState<{
    id: string;
    ref: string;
  } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/orders?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const all: ApprovalOrder[] = Array.isArray(data) ? data : data.data ?? [];
      setOrders(all);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(
    () =>
      orders.filter((o) => o.status === 'paid' || o.status === 'payment_confirmed'),
    [orders]
  );
  const approved = useMemo(
    () => orders.filter((o) => o.status === 'approved'),
    [orders]
  );
  const rejected = useMemo(
    () => orders.filter((o) => o.status === 'cancelled'),
    [orders]
  );

  const tabData: Record<Tab, ApprovalOrder[]> = {
    pending,
    approved,
    rejected,
  };

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/orders/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  }

  async function handleRejectConfirm(notes: string) {
    if (!rejectModal) return;
    const { id } = rejectModal;
    setRejectModal(null);
    setProcessing(id);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/orders/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'cancelled', notes }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  }

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    {
      key: 'pending',
      label: 'Pendentes',
      count: pending.length,
      color: pending.length > 5 ? 'text-[#f59e0b]' : 'text-[#4da3ff]',
    },
    { key: 'approved', label: 'Aprovadas', count: approved.length, color: 'text-[#63e6be]' },
    { key: 'rejected', label: 'Rejeitadas', count: rejected.length, color: 'text-[#f87171]' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Aprovações</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            Workflow de aprovação de encomendas
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Urgent banner */}
      {!loading && pending.filter((o) => {
        const hrs = (Date.now() - new Date(o.paidAt ?? o.createdAt).getTime()) / 3_600_000;
        return hrs > 24;
      }).length > 0 && (
        <div className="mb-6 rounded-xl border border-[#f59e0b]/20 bg-[#2a1f00]/50 px-5 py-4 flex items-center gap-3">
          <span className="text-[#f59e0b] text-lg">⚠</span>
          <p className="text-sm text-[#f59e0b]">
            {pending.filter((o) => {
              const hrs = (Date.now() - new Date(o.paidAt ?? o.createdAt).getTime()) / 3_600_000;
              return hrs > 24;
            }).length}{' '}
            encomenda(s) aguardam aprovação há mais de 24h. Ação necessária.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-[#102131] text-white border border-[#1a2f48]'
                : 'text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {t.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                tab === t.key ? t.color : 'text-[#4d6a87]'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-xl h-48" />
          ))}
        </div>
      ) : tabData[tab].length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1a2f48] py-20 text-center">
          <p className="text-3xl mb-3 text-[#4d6a87]">
            {tab === 'pending' ? '✓' : tab === 'approved' ? '🎉' : '—'}
          </p>
          <p className="text-sm text-[#4d6a87]">
            {tab === 'pending'
              ? 'Sem aprovações pendentes'
              : tab === 'approved'
              ? 'Sem encomendas aprovadas'
              : 'Sem encomendas rejeitadas'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tabData[tab].map((order) => (
            <div key={order.id} className="relative">
              {processing === order.id && (
                <div className="absolute inset-0 z-10 bg-[#07111f]/60 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <div className="text-[#4da3ff] text-sm font-semibold animate-pulse">
                    A processar...
                  </div>
                </div>
              )}
              <ApprovalCard
                order={order}
                tab={tab}
                onApprove={handleApprove}
                onReject={(id) =>
                  setRejectModal({
                    id,
                    ref: order.ref ?? order.id.slice(0, 8).toUpperCase(),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <RejectModal
          orderId={rejectModal.id}
          orderRef={rejectModal.ref}
          onClose={() => setRejectModal(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}
