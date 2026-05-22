'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { formatCurrency, formatDateTime, timeAgo, API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type HistoryTab = 'approved' | 'rejected';

interface ApprovalRecord {
  id: string;
  stage: string;
  status: ApprovalStatus;
  notes: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  approvedById: string | null;
  order?: {
    id: string;
    ref: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    client?: { id: string; name?: string; email?: string; company?: string };
    company?: { id: string; name: string };
  };
  requestedBy?: { id: string; name: string; email: string };
}

// ── Reject Modal ───────────────────────────────────────────────────────────────

function RejectModal({
  approval,
  onClose,
  onConfirm,
}: {
  approval: ApprovalRecord;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-base font-bold text-white mb-1">Rejeitar aprovação</h3>
        <p className="text-sm text-[#4d6a87] mb-4">
          Encomenda{' '}
          <span className="font-mono text-[#f87171]">
            {approval.order?.ref ?? approval.id.slice(0, 8).toUpperCase()}
          </span>
          {' · '}
          <span className="text-[#8ba8c7] uppercase text-xs">{approval.stage}</span>
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

// ── Stage badge ────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  hr: 'bg-[#0d1f3a] text-[#4da3ff] border-[#1a3a5c]',
  manager: 'bg-[#1a0f3a] text-[#a78bfa] border-[#2a1f4a]',
  finance: 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
};

function StageBadge({ stage }: { stage: string }) {
  const color = STAGE_COLORS[stage.toLowerCase()] ?? STAGE_COLORS.manager;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${color}`}>
      {stage}
    </span>
  );
}

// ── Pending Table ──────────────────────────────────────────────────────────────

function PendingTable({
  items,
  processing,
  onApprove,
  onReject,
}: {
  items: ApprovalRecord[];
  processing: string | null;
  onApprove: (a: ApprovalRecord) => void;
  onReject: (a: ApprovalRecord) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a2f48] py-16 text-center">
        <p className="text-3xl mb-3 text-[#4d6a87]">✓</p>
        <p className="text-sm text-[#4d6a87]">Sem aprovações pendentes</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              {['Ref', 'Cliente', 'Empresa', 'Etapa', 'Solicitado por', 'Há quanto tempo', 'Total', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const hrs = (Date.now() - new Date(a.requestedAt).getTime()) / 3_600_000;
              const isUrgent = hrs >= 24;
              const isProcessing = processing === a.id;
              return (
                <tr
                  key={a.id}
                  className={`border-b border-[#0f1f35] last:border-0 transition-colors ${isUrgent ? 'bg-[#2a1f00]/10' : 'hover:bg-[#102131]/40'}`}
                >
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs text-[#4da3ff] font-bold">
                      {a.order?.ref ?? a.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-white font-medium truncate max-w-[140px]">
                      {a.order?.client?.name ?? a.order?.client?.company ?? '—'}
                    </p>
                    {a.order?.client?.email && (
                      <p className="text-xs text-[#4d6a87] truncate max-w-[140px]">{a.order.client.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-xs text-[#8ba8c7]">{a.order?.company?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <StageBadge stage={a.stage} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-[#8ba8c7] truncate max-w-[120px] block">
                      {a.requestedBy?.name ?? a.requestedBy?.email ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${isUrgent ? 'text-[#f59e0b]' : 'text-[#4d6a87]'}`}>
                      {isUrgent ? '⚠ ' : ''}{timeAgo(a.requestedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-white tabular-nums">
                      {a.order?.totalAmount != null ? formatCurrency(a.order.totalAmount) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {isProcessing ? (
                      <span className="text-xs text-[#4da3ff] animate-pulse">A processar...</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApprove(a)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#063e1f] text-[#63e6be] text-xs font-semibold border border-[#63e6be]/20 hover:bg-[#0a5a2a] transition-colors whitespace-nowrap"
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1.5 5.5l2.5 2.5 5-5" />
                          </svg>
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(a)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2a0a0a] text-[#f87171] text-xs font-semibold border border-[#f87171]/20 hover:bg-[#3a1010] transition-colors whitespace-nowrap"
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2.5 2.5l6 6M8.5 2.5l-6 6" />
                          </svg>
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── History Table ──────────────────────────────────────────────────────────────

function HistoryTable({ items, type }: { items: ApprovalRecord[]; type: HistoryTab }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a2f48] py-12 text-center">
        <p className="text-sm text-[#4d6a87]">
          {type === 'approved' ? 'Sem aprovações hoje' : 'Sem rejeições hoje'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              {['Ref', 'Etapa', 'Resolvido por', 'Quando', 'Notas'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-[#0f1f35] last:border-0 hover:bg-[#102131]/40 transition-colors">
                <td className="px-4 py-3.5">
                  <span className="font-mono text-xs text-[#4da3ff]">
                    {a.order?.ref ?? a.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <StageBadge stage={a.stage} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-[#8ba8c7]">{a.approvedById?.slice(0, 8) ?? '—'}</span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className="text-xs text-[#4d6a87]">
                    {a.resolvedAt ? formatDateTime(a.resolvedAt) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3.5 max-w-[200px]">
                  {a.notes ? (
                    <span className="text-xs text-[#8ba8c7] line-clamp-2">{a.notes}</span>
                  ) : (
                    <span className="text-xs text-[#4d6a87]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const AUTO_REFRESH_SECS = 30;

export default function ApprovalsPage() {
  const [pending, setPending] = useState<ApprovalRecord[]>([]);
  const [approved, setApproved] = useState<ApprovalRecord[]>([]);
  const [rejected, setRejected] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('approved');
  const [rejectTarget, setRejectTarget] = useState<ApprovalRecord | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCountdown(AUTO_REFRESH_SECS);
    try {
      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/approvals?status=pending`, { headers }),
        fetch(`${API_BASE}/api/v1/approvals?status=approved`, { headers }),
        fetch(`${API_BASE}/api/v1/approvals?status=rejected`, { headers }),
      ]);

      const [pendingData, approvedData, rejectedData] = await Promise.all([
        pendingRes.json() as Promise<ApprovalRecord[]>,
        approvedRes.json() as Promise<ApprovalRecord[]>,
        rejectedRes.json() as Promise<ApprovalRecord[]>,
      ]);

      setPending(Array.isArray(pendingData) ? pendingData : []);
      setApproved(Array.isArray(approvedData) ? approvedData : []);
      setRejected(Array.isArray(rejectedData) ? rejectedData : []);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh countdown
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          load();
          return AUTO_REFRESH_SECS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load]);

  // KPIs
  const approvedToday = useMemo(() => {
    const today = new Date().toDateString();
    return approved.filter((a) => a.resolvedAt && new Date(a.resolvedAt).toDateString() === today).length;
  }, [approved]);

  const rejectedToday = useMemo(() => {
    const today = new Date().toDateString();
    return rejected.filter((a) => a.resolvedAt && new Date(a.resolvedAt).toDateString() === today).length;
  }, [rejected]);

  const urgentCount = useMemo(
    () => pending.filter((a) => (Date.now() - new Date(a.requestedAt).getTime()) / 3_600_000 >= 24).length,
    [pending],
  );

  async function handleApprove(approval: ApprovalRecord) {
    setProcessing(approval.id);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/approvals/${approval.id}`, {
        method: 'PATCH',
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
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    setProcessing(target.id);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/approvals/${target.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'rejected', notes }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Aprovações</h1>
          <p className="text-sm text-[#4d6a87] mt-1">Workflow de aprovação de encomendas</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Countdown indicator */}
          <div className="flex items-center gap-1.5 text-xs text-[#4d6a87]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="5" />
              <path d="M6 3.5V6l1.5 1.5" />
            </svg>
            <span className="tabular-nums">Atualiza em {countdown}s</span>
          </div>
          <button
            type="button"
            onClick={() => { load(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl border bg-[#0b1526] px-5 py-4 ${pending.length > 0 ? 'border-[#f87171]/30' : 'border-[#1a2f48]'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Pendentes</p>
          <p className={`text-3xl font-black tabular-nums ${pending.length > 0 ? 'text-[#f87171]' : 'text-white'}`}>
            {loading ? '—' : pending.length}
          </p>
          {urgentCount > 0 && (
            <p className="text-xs text-[#f59e0b] mt-0.5 font-semibold">⚠ {urgentCount} com +24h</p>
          )}
        </div>
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Aprovadas Hoje</p>
          <p className="text-3xl font-black text-[#63e6be] tabular-nums">{loading ? '—' : approvedToday}</p>
          <p className="text-xs text-[#4d6a87] mt-0.5">{approved.length} total</p>
        </div>
        <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Rejeitadas Hoje</p>
          <p className="text-3xl font-black text-white tabular-nums">{loading ? '—' : rejectedToday}</p>
          <p className="text-xs text-[#4d6a87] mt-0.5">{rejected.length} total</p>
        </div>
      </div>

      {/* Urgent banner */}
      {!loading && urgentCount > 0 && (
        <div className="mb-6 rounded-xl border border-[#f59e0b]/20 bg-[#2a1f00]/50 px-5 py-4 flex items-center gap-3">
          <span className="text-[#f59e0b] text-lg">⚠</span>
          <p className="text-sm text-[#f59e0b]">
            {urgentCount} aprovação(ões) aguardam há mais de 24h. Ação necessária.
          </p>
        </div>
      )}

      {/* Priority queue — pending */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">
            Fila de Aprovações Pendentes
            {pending.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20">
                {pending.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-14" />
            ))}
          </div>
        ) : (
          <PendingTable
            items={pending}
            processing={processing}
            onApprove={handleApprove}
            onReject={(a) => setRejectTarget(a)}
          />
        )}
      </div>

      {/* History section */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Histórico</h2>

        {/* History tabs */}
        <div className="flex gap-1 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] mb-4 w-fit">
          {([
            { key: 'approved' as HistoryTab, label: 'Aprovadas', count: approved.length, color: 'text-[#63e6be]' },
            { key: 'rejected' as HistoryTab, label: 'Rejeitadas', count: rejected.length, color: 'text-[#f87171]' },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setHistoryTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                historyTab === t.key
                  ? 'bg-[#102131] text-white border border-[#1a2f48]'
                  : 'text-[#4d6a87] hover:text-[#8ba8c7]'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${historyTab === t.key ? t.color : 'text-[#4d6a87]'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="skeleton rounded-xl h-32" />
        ) : (
          <HistoryTable
            items={historyTab === 'approved' ? approved : rejected}
            type={historyTab}
          />
        )}
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          approval={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}
