'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApprovalRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_ref: string | null;
  requester_id: string;
  requester_email: string;
  approver_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  amount: number;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  client_id: string | null;
}

interface ApprovalChainItem {
  id: string;
  requester_email: string;
  approver_email: string | null;
  status: string;
  amount: number;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

const BUDGET_THRESHOLDS = {
  standard:   1000,
  premium:    5000,
  enterprise: 20000,
  vip:        50000,
};

function getBudgetTier(amount: number): { label: string; color: string; bg: string } {
  if (amount >= BUDGET_THRESHOLDS.vip)        return { label: 'VIP',        color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/25' };
  if (amount >= BUDGET_THRESHOLDS.enterprise) return { label: 'Enterprise', color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/25' };
  if (amount >= BUDGET_THRESHOLDS.premium)    return { label: 'Premium',    color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/25' };
  return                                              { label: 'Standard',   color: 'text-white/50',   bg: 'bg-white/5 border-white/10' };
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function hoursLeft(expires: string | null): { text: string; urgent: boolean } {
  if (!expires) return { text: '—', urgent: false };
  const diff = new Date(expires).getTime() - Date.now();
  if (diff <= 0) return { text: 'Expirado', urgent: true };
  const h = Math.floor(diff / 3600000);
  if (h < 2) return { text: `${h}h restantes`, urgent: true };
  if (h < 24) return { text: `${h}h restantes`, urgent: false };
  return { text: `${Math.floor(h / 24)}d restantes`, urgent: false };
}

function fmt(n: number) {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ── Request Approval Modal ───────────────────────────────────────────────────
function RequestModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (p: object) => void }) {
  const [form, setForm] = useState({
    entity_type: 'order',
    entity_id: '',
    entity_ref: '',
    amount: '',
    note: '',
    approver_email: '',
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.entity_id) return;
    setLoading(true);
    await onSubmit({
      action: 'request',
      entity_type: form.entity_type,
      entity_id: form.entity_id,
      entity_ref: form.entity_ref || null,
      amount: parseFloat(form.amount) || 0,
      note: form.note || null,
      approver_email: form.approver_email || undefined,
    });
    setLoading(false);
    onClose();
  }

  const tier = getBudgetTier(parseFloat(form.amount) || 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Nova Aprovação</h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white text-lg">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-[10px] block mb-1">Tipo</label>
            <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="order">Order</option>
              <option value="quote">Quote</option>
              <option value="project">Project</option>
            </select>
          </div>
          <div>
            <label className="text-white/40 text-[10px] block mb-1">Entity ID *</label>
            <input value={form.entity_id} onChange={e => setForm(p => ({ ...p, entity_id: e.target.value }))}
              placeholder="ID do registo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
          </div>
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Referência</label>
          <input value={form.entity_ref} onChange={e => setForm(p => ({ ...p, entity_ref: e.target.value }))}
            placeholder="ORD-2026-001 ou similar"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Montante (€)</label>
          <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            placeholder="0"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
          {parseFloat(form.amount) > 0 && (
            <div className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-medium ${tier.bg} ${tier.color}`}>
              <span className="w-1 h-1 rounded-full bg-current" />
              {tier.label}
            </div>
          )}
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Approver Email (opcional)</label>
          <input value={form.approver_email} onChange={e => setForm(p => ({ ...p, approver_email: e.target.value }))}
            placeholder="gestor@empresa.pt"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Nota (opcional)</label>
          <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            rows={2} placeholder="Justificação ou contexto…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" />
        </div>

        <button type="button" onClick={submit} disabled={loading || !form.entity_id}
          className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
          {loading ? 'A enviar…' : 'Criar Pedido de Aprovação'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Resolve Modal ────────────────────────────────────────────────────────────
function ResolveModal({
  approval, action, onClose, onSubmit,
}: {
  approval: ApprovalRequest;
  action: 'approve' | 'reject';
  onClose: () => void;
  onSubmit: (approvalId: string, action: string, note: string) => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const tier = getBudgetTier(approval.amount);
  const isApprove = action === 'approve';

  async function submit() {
    setLoading(true);
    await onSubmit(approval.id, action, note);
    setLoading(false);
    onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            {isApprove ? '✅ Aprovar' : '❌ Rejeitar'} Pedido
          </h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white text-lg">×</button>
        </div>

        <div className={`rounded-xl border p-3 ${tier.bg}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/60 text-[10px]">{approval.entity_type} · {approval.entity_ref ?? approval.entity_id.slice(0, 8)}</span>
            <span className={`text-xs font-bold ${tier.color}`}>{fmt(approval.amount)}</span>
          </div>
          <p className="text-white/40 text-[9px]">De: {approval.requester_email}</p>
          {approval.note && <p className="text-white/50 text-[9px] mt-1 italic">{approval.note}</p>}
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Nota de resolução (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={3} placeholder={isApprove ? 'Razão da aprovação…' : 'Razão da rejeição…'}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-xs hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={loading}
            className={`flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-colors disabled:opacity-40 ${
              isApprove ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
            }`}>
            {loading ? '…' : isApprove ? 'Aprovar' : 'Rejeitar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Chain Panel ──────────────────────────────────────────────────────────────
function ChainPanel({ entityType, entityId, onClose }: { entityType: string; entityId: string; onClose: () => void }) {
  const [chain, setChain] = useState<ApprovalChainItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/approvals?entityType=${entityType}&entityId=${entityId}`)
      .then(r => r.json())
      .then(d => { setChain(d.chain ?? []); setLoading(false); });
  }, [entityType, entityId]);

  const STATUS_MAP: Record<string, { color: string; label: string }> = {
    pending:   { color: 'text-amber-400',   label: 'Pendente' },
    approved:  { color: 'text-emerald-400', label: 'Aprovado' },
    rejected:  { color: 'text-red-400',     label: 'Rejeitado' },
    cancelled: { color: 'text-white/30',    label: 'Cancelado' },
    expired:   { color: 'text-white/20',    label: 'Expirado' },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-xs font-semibold">Cadeia de Aprovação</h3>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-[10px]">{entityType} · {entityId.slice(0, 12)}…</span>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white text-lg">×</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-white/5" />)}
        </div>
      ) : chain.length === 0 ? (
        <p className="text-white/30 text-xs text-center py-4">Sem histórico de aprovações</p>
      ) : (
        <div className="space-y-2">
          {chain.map((item, i) => {
            const meta = STATUS_MAP[item.status] ?? STATUS_MAP.pending;
            return (
              <div key={item.id} className="flex items-start gap-3">
                {/* Step indicator */}
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border ${
                    item.status === 'approved' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                    item.status === 'rejected' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                    'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}>{i + 1}</div>
                  {i < chain.length - 1 && <div className="w-px h-4 bg-white/10 mt-1" />}
                </div>
                <div className="flex-1 rounded-lg bg-white/3 border border-white/5 p-2.5 mb-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/60 text-[10px]">{item.requester_email}</span>
                    <span className={`text-[9px] font-medium ${meta.color}`}>{meta.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[9px]">{timeAgo(item.created_at)}</span>
                    <span className="text-white/60 text-[10px] font-medium">{fmt(item.amount)}</span>
                  </div>
                  {item.resolution_note && (
                    <p className="text-white/40 text-[9px] mt-1 italic">"{item.resolution_note}"</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [resolving, setResolving] = useState<{ approval: ApprovalRequest; action: 'approve' | 'reject' } | null>(null);
  const [chainFor, setChainFor] = useState<{ entityType: string; entityId: string } | null>(null);
  const [filterTier, setFilterTier] = useState<'all' | 'standard' | 'premium' | 'enterprise' | 'vip'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/approvals?mode=pending');
      const d = await res.json();
      setPending(d.pending ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(payload: object) {
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    load();
  }

  async function resolveApproval(approvalId: string, action: string, note: string) {
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, approval_id: approvalId, resolution_note: note }),
    });
    load();
  }

  // Tier filter
  const filtered = pending.filter(a => {
    if (filterTier === 'all') return true;
    const tier = getBudgetTier(a.amount).label.toLowerCase();
    return tier === filterTier;
  });

  // Stats
  const totalValue = pending.reduce((s, a) => s + a.amount, 0);
  const vipCount      = pending.filter(a => a.amount >= BUDGET_THRESHOLDS.vip).length;
  const enterpriseCount = pending.filter(a => a.amount >= BUDGET_THRESHOLDS.enterprise && a.amount < BUDGET_THRESHOLDS.vip).length;
  const urgentCount   = pending.filter(a => {
    if (!a.expires_at) return false;
    return (new Date(a.expires_at).getTime() - Date.now()) < 4 * 3600000;
  }).length;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Approval Center</h1>
          <p className="text-white/40 text-xs mt-0.5">Workflows de aprovação · Budget enforcement · Audit trail</p>
        </div>
        <button type="button" onClick={() => setShowRequest(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
          + Novo Pedido
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Pendentes',  value: pending.length,   color: pending.length > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'Urgentes',   value: urgentCount,      color: urgentCount > 0 ? 'text-red-400' : 'text-white' },
          { label: 'VIP',        value: vipCount,         color: vipCount > 0 ? 'text-purple-400' : 'text-white' },
          { label: 'Enterprise', value: enterpriseCount,  color: enterpriseCount > 0 ? 'text-blue-400' : 'text-white' },
          { label: 'Valor Total', value: fmt(totalValue), color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Budget Tier Legend */}
      <div className="flex items-center gap-2">
        <span className="text-white/30 text-[10px]">Filtrar:</span>
        {([
          { key: 'all',        label: 'Todos',      color: 'text-white/60',   bg: 'bg-white/5 border-white/10' },
          { key: 'standard',   label: 'Standard',   color: 'text-white/50',   bg: 'bg-white/5 border-white/10' },
          { key: 'premium',    label: 'Premium',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
          { key: 'enterprise', label: 'Enterprise', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
          { key: 'vip',        label: 'VIP',        color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ] as const).map(({ key, label, color, bg }) => (
          <button type="button" key={key}  onClick={() => setFilterTier(key)}
            className={`px-3 py-1 rounded-full border text-[10px] font-medium transition-all ${color} ${bg} ${
              filterTier === key ? 'ring-1 ring-white/20' : 'opacity-50 hover:opacity-100'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Approval cards */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/2 p-12 text-center">
          <p className="text-white/30 text-sm">Nenhum pedido de aprovação pendente</p>
          <p className="text-white/20 text-xs mt-1">Todos os workflows estão resolvidos ✓</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map(approval => {
              const tier = getBudgetTier(approval.amount);
              const expiry = hoursLeft(approval.expires_at);
              const isChainOpen = chainFor?.entityId === approval.entity_id;

              return (
                <motion.div key={approval.id}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-0">
                  <div className={`rounded-2xl border p-4 transition-colors ${tier.bg}`}>
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: entity info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold ${tier.bg} ${tier.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {tier.label}
                          </span>
                          <span className="text-white/30 text-[9px] capitalize">{approval.entity_type}</span>
                          {approval.entity_ref && (
                            <span className="text-white/50 text-[9px] font-mono">{approval.entity_ref}</span>
                          )}
                          {expiry.urgent && (
                            <span className="text-red-400 text-[9px] font-medium animate-pulse">⚠ {expiry.text}</span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-3">
                          <span className={`text-xl font-bold ${tier.color}`}>{fmt(approval.amount)}</span>
                          {!expiry.urgent && approval.expires_at && (
                            <span className="text-white/30 text-[9px]">{expiry.text}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-white/40">
                          <span>De: <span className="text-white/60">{approval.requester_email}</span></span>
                          <span>·</span>
                          <span>{timeAgo(approval.created_at)}</span>
                          {approval.client_id && (
                            <><span>·</span><span>Cliente: {approval.client_id.slice(0, 8)}</span></>
                          )}
                        </div>

                        {approval.note && (
                          <p className="text-white/40 text-[10px] mt-2 italic leading-snug">
                            "{approval.note}"
                          </p>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <div className="flex gap-1.5">
                          <button type="button"
                            onClick={() => setResolving({ approval, action: 'approve' })}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/30 transition-colors">
                            ✓ Aprovar
                          </button>
                          <button type="button"
                            onClick={() => setResolving({ approval, action: 'reject' })}
                            className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-medium hover:bg-red-500/25 transition-colors">
                            ✗ Rejeitar
                          </button>
                        </div>
                        <button type="button"
                          onClick={() => setChainFor(isChainOpen ? null : { entityType: approval.entity_type, entityId: approval.entity_id })}
                          className="text-white/30 hover:text-white/60 text-[9px] transition-colors">
                          {isChainOpen ? '▲ Fechar cadeia' : '▼ Ver cadeia'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chain panel inline */}
                  <AnimatePresence>
                    {isChainOpen && chainFor && (
                      <div className="mt-2">
                        <ChainPanel
                          entityType={chainFor.entityType}
                          entityId={chainFor.entityId}
                          onClose={() => setChainFor(null)}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Budget thresholds reference */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-4">
        <p className="text-white/30 text-[10px] font-medium mb-3">Budget Thresholds</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Standard', value: '> €1.000',  color: 'text-white/50' },
            { label: 'Premium',  value: '> €5.000',  color: 'text-amber-400' },
            { label: 'Enterprise',value: '> €20.000', color: 'text-blue-400' },
            { label: 'VIP',      value: '> €50.000', color: 'text-purple-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xs font-bold ${color}`}>{value}</p>
              <p className="text-white/30 text-[9px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showRequest && (
          <RequestModal
            onClose={() => setShowRequest(false)}
            onSubmit={handleAction}
          />
        )}
        {resolving && (
          <ResolveModal
            approval={resolving.approval}
            action={resolving.action}
            onClose={() => setResolving(null)}
            onSubmit={resolveApproval}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
