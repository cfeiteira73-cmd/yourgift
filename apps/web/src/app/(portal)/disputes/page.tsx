'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DisputeStats {
  total: number;
  open: number;
  won: number;
  lost: number;
  total_at_risk: number;
  total_lost: number;
}

interface Dispute {
  id: string;
  stripe_dispute_id: string | null;
  order_id: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  due_by: string | null;
  evidence_submitted: boolean;
  ai_recommendation: string | null;
  resolved_at: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  needs_response:          { label: 'Resposta Necessária', color: 'bg-red-500/15 text-red-400' },
  under_review:            { label: 'Em Revisão',          color: 'bg-blue-500/15 text-blue-400' },
  warning_needs_response:  { label: 'Aviso: Responder',    color: 'bg-amber-500/15 text-amber-400' },
  warning_under_review:    { label: 'Aviso: Em Revisão',   color: 'bg-amber-500/15 text-amber-400' },
  won:                     { label: 'Ganha',               color: 'bg-emerald-500/15 text-emerald-400' },
  lost:                    { label: 'Perdida',             color: 'bg-red-500/15 text-red-400' },
  charge_refunded:         { label: 'Reembolsado',         color: 'bg-white/10 text-white/40' },
  warning_closed:          { label: 'Aviso Fechado',       color: 'bg-white/10 text-white/40' },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function daysTill(d: string | null) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.floor(diff / 86400000);
}

function OpenDisputeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    amount: '', currency: 'eur', reason: '', order_id: '',
    stripe_dispute_id: '', stripe_charge_id: '', due_by: '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount) return;
    setSaving(true);
    try {
      await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'open', ...form, amount: parseFloat(form.amount) }),
      });
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-sm font-semibold">Registar Disputa</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {[
            { label: 'Montante (€) *', key: 'amount', type: 'number', required: true },
            { label: 'Razão da Disputa', key: 'reason', type: 'text' },
            { label: 'Order ID', key: 'order_id', type: 'text' },
            { label: 'Stripe Dispute ID', key: 'stripe_dispute_id', type: 'text' },
            { label: 'Stripe Charge ID', key: 'stripe_charge_id', type: 'text' },
            { label: 'Prazo de Resposta', key: 'due_by', type: 'datetime-local' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-white/50 text-[10px] uppercase tracking-wider">{label}</label>
              <input type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-red-500/50" />
            </div>
          ))}
          <button type="submit" disabled={saving || !form.amount}
            className="w-full py-2 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {saving ? 'A registar…' : 'Registar Disputa'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function DisputesPage() {
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('open');

  const STATUS_FILTERS = [
    { key: 'open',  label: 'Abertas' },
    { key: 'needs_response', label: 'Urgentes' },
    { key: 'won',   label: 'Ganhas' },
    { key: 'lost',  label: 'Perdidas' },
    { key: '',      label: 'Todas' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/disputes?mode=stats'),
        fetch(`/api/disputes?mode=list${statusFilter === 'open' ? '&status=needs_response' : statusFilter ? `&status=${statusFilter}` : ''}`),
      ]);
      const [sd, ld] = await Promise.all([statsRes.json(), listRes.json()]);
      setStats(sd.stats);
      setDisputes(ld.disputes ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function generateEvidence(id: string) {
    setGenerating(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ai_evidence', id }),
      });
      const d = await res.json();
      if (selected?.id === id) {
        setSelected(prev => prev ? { ...prev, ai_recommendation: d.recommendation } : prev);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function resolveDispute(id: string, outcome: 'won' | 'lost') {
    await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id, outcome }),
    });
    load();
    setSelected(null);
  }

  async function markEvidenceSubmitted(id: string) {
    await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, evidence_submitted: true }),
    });
    setSelected(prev => prev ? { ...prev, evidence_submitted: true } : prev);
    load();
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      {showModal && <OpenDisputeModal onClose={() => setShowModal(false)} onDone={load} />}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Gestão de Disputas</h1>
          <p className="text-white/40 text-xs mt-0.5">Chargebacks · Evidências · AI Recommendations</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-colors">
          + Nova Disputa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',         value: stats?.total ?? '—', color: 'text-white' },
          { label: 'Em Aberto',     value: stats?.open ?? '—',  color: stats && stats.open > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Ganhas',        value: stats?.won ?? '—',   color: 'text-emerald-400' },
          { label: 'Valor em Risco',value: stats ? `€${stats.total_at_risk.toFixed(0)}` : '—', color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {STATUS_FILTERS.map(f => (
          <button type="button" key={f.key}  onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
              statusFilter === f.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-white/30 text-xs text-center py-8">A carregar…</p>
          ) : disputes.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/3 p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-white/30 text-xs">Sem disputas neste filtro</p>
            </div>
          ) : disputes.map(d => {
            const meta = STATUS_META[d.status] ?? { label: d.status, color: 'bg-white/10 text-white/40' };
            const till = daysTill(d.due_by);
            return (
              <motion.button key={d.id} type="button" whileHover={{ x: 2 }}
                onClick={() => setSelected(d)}
                className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                  selected?.id === d.id ? 'border-red-500/30 bg-red-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'
                }`}>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-red-400 font-bold text-sm">€{Number(d.amount).toFixed(0)}</p>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                </div>
                <p className="text-white/60 text-[10px] truncate">{d.reason ?? 'Razão não especificada'}</p>
                <div className="flex gap-3 text-[9px] text-white/30">
                  <span>{timeAgo(d.created_at)}</span>
                  {till !== null && (
                    <span className={till <= 3 ? 'text-red-400' : 'text-white/30'}>
                      {till < 0 ? 'Expirado' : `${till}d restantes`}
                    </span>
                  )}
                  {d.evidence_submitted && <span className="text-emerald-400">✓ Evidências</span>}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="col-span-2">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-red-400 font-bold text-xl">€{Number(selected.amount).toFixed(2)}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_META[selected.status]?.color ?? ''}`}>
                          {STATUS_META[selected.status]?.label ?? selected.status}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs">{selected.reason ?? 'Razão não especificada'}</p>
                    </div>
                    {selected.due_by && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-white/40">Prazo</p>
                        {(() => {
                          const till = daysTill(selected.due_by);
                          return (
                            <p className={`text-xs font-medium ${till !== null && till <= 3 ? 'text-red-400' : 'text-white'}`}>
                              {till !== null && till < 0 ? 'Expirado' : till !== null ? `${till}d` : '—'}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-3 gap-3 text-[10px]">
                    {[
                      { label: 'Order ID', value: selected.order_id?.slice(0, 16) ?? '—' },
                      { label: 'Stripe Dispute', value: selected.stripe_dispute_id?.slice(0, 16) ?? '—' },
                      { label: 'Evidências', value: selected.evidence_submitted ? '✓ Submetidas' : '✗ Pendentes' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-white/5 p-2.5">
                        <p className="text-white/40 mb-0.5">{label}</p>
                        <p className="text-white font-medium">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI Recommendation */}
                  <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4 space-y-2">
                    <p className="text-amber-400 text-[10px] font-medium uppercase tracking-wider">🤖 Recomendação AI</p>
                    {selected.ai_recommendation ? (
                      <p className="text-white/70 text-xs leading-relaxed">{selected.ai_recommendation}</p>
                    ) : (
                      <p className="text-white/30 text-[10px]">Sem recomendação ainda</p>
                    )}
                    <button type="button" onClick={() => generateEvidence(selected.id)} disabled={generating}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 text-[10px] font-medium transition-colors disabled:opacity-50">
                      {generating ? (
                        <><span className="w-2.5 h-2.5 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin" />A gerar…</>
                      ) : '✨ Gerar Nova Recomendação'}
                    </button>
                  </div>

                  {/* Actions */}
                  {!['won', 'lost', 'charge_refunded', 'warning_closed'].includes(selected.status) && (
                    <div className="flex gap-2 flex-wrap">
                      {!selected.evidence_submitted && (
                        <button type="button" onClick={() => markEvidenceSubmitted(selected.id)}
                          className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 text-[10px] font-medium transition-colors">
                          ✓ Marcar Evidências Submetidas
                        </button>
                      )}
                      <button type="button" onClick={() => resolveDispute(selected.id, 'won')}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 text-[10px] font-medium transition-colors">
                        ✓ Marcar como Ganha
                      </button>
                      <button type="button" onClick={() => resolveDispute(selected.id, 'lost')}
                        className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-400 text-[10px] font-medium transition-colors">
                        ✗ Marcar como Perdida
                      </button>
                    </div>
                  )}

                  {selected.outcome && (
                    <p className="text-white/40 text-[10px]">
                      Resultado: <span className={selected.outcome === 'won' ? 'text-emerald-400' : 'text-red-400'}>{selected.outcome}</span>
                      {selected.resolved_at && ` · ${timeAgo(selected.resolved_at)}`}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-4xl">⚖️</div>
                <p className="text-white/30 text-xs">Seleciona uma disputa para ver detalhes e recomendações AI</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
