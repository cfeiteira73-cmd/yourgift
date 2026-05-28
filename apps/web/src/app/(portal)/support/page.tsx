'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Ticket {
  id: string;
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  actor_email: string;
  assignee_email: string | null;
  resolution: string | null;
  entity_id: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
  slaBreached: boolean;
  hoursOpen: number;
  slaTargets: { first_response: number; resolution: number };
}

const PRIORITY_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: 'Crítico',  color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25',     dot: 'bg-red-500' },
  high:     { label: 'Alto',     color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25', dot: 'bg-amber-500' },
  normal:   { label: 'Normal',   color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',   dot: 'bg-blue-500' },
  low:      { label: 'Baixo',    color: 'text-white/40',    bg: 'bg-white/5 border-white/10',          dot: 'bg-white/30' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: 'Aberto',       color: 'text-amber-400' },
  in_progress: { label: 'Em curso',     color: 'text-blue-400' },
  waiting:     { label: 'Aguarda',      color: 'text-purple-400' },
  resolved:    { label: 'Resolvido',    color: 'text-emerald-400' },
  closed:      { label: 'Fechado',      color: 'text-white/30' },
};

const CATEGORIES = ['order', 'quote', 'billing', 'product', 'artwork', 'technical', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function slaCountdown(ticket: Ticket): { text: string; urgent: boolean; breached: boolean } {
  if (!ticket.sla_due_at) return { text: '—', urgent: false, breached: false };
  if (ticket.slaBreached) return { text: 'SLA expirado', urgent: true, breached: true };
  const ms = new Date(ticket.sla_due_at).getTime() - Date.now();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return { text: `${Math.floor(ms / 60000)}m`, urgent: true, breached: false };
  if (h < 4) return { text: `${h}h`, urgent: true, breached: false };
  return { text: `${h}h`, urgent: false, breached: false };
}

// ── New Ticket Modal ─────────────────────────────────────────────────────────
function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ subject: '', body: '', priority: 'normal', category: 'other', entity_id: '' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.subject.trim() || !form.body.trim()) return;
    setLoading(true);
    await fetch('/api/support', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, entity_id: form.entity_id || null }),
    });
    setLoading(false);
    onCreated();
    onClose();
  }

  const pm = PRIORITY_META[form.priority];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Novo Ticket de Suporte</h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white text-lg">×</button>
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Assunto *</label>
          <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="Descreve o problema brevemente…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-[10px] block mb-1">Prioridade</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/40 text-[10px] block mb-1">Categoria</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs capitalize">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* SLA preview */}
        <div className={`rounded-lg border px-3 py-2 ${pm.bg}`}>
          <p className={`text-[10px] font-medium ${pm.color}`}>
            SLA: primeira resposta em {form.priority === 'critical' ? '1h' : form.priority === 'high' ? '4h' : form.priority === 'normal' ? '8h' : '24h'}
            {' '}· resolução em {form.priority === 'critical' ? '4h' : form.priority === 'high' ? '24h' : form.priority === 'normal' ? '72h' : '168h'}
          </p>
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Descrição detalhada *</label>
          <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            rows={4} placeholder="Descreve o problema com o máximo de detalhe possível…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" />
        </div>

        <div>
          <label className="text-white/40 text-[10px] block mb-1">Entity ID (opcional)</label>
          <input value={form.entity_id} onChange={e => setForm(p => ({ ...p, entity_id: e.target.value }))}
            placeholder="ID da encomenda, orçamento, etc."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
        </div>

        <button type="button" onClick={submit}
          disabled={loading || !form.subject.trim() || !form.body.trim()}
          className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
          {loading ? 'A criar…' : 'Criar Ticket'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Resolve Modal ────────────────────────────────────────────────────────────
function ResolveModal({ ticket, onClose, onDone }: { ticket: Ticket; onClose: () => void; onDone: () => void }) {
  const [resolution, setResolution] = useState('');
  const [loading, setLoading] = useState(false);

  async function resolve() {
    setLoading(true);
    await fetch('/api/support', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: ticket.id, status: 'resolved', resolution }),
    });
    setLoading(false);
    onDone();
    onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Resolver Ticket</h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white">×</button>
        </div>
        <p className="text-white/50 text-xs">{ticket.subject}</p>
        <div>
          <label className="text-white/40 text-[10px] block mb-1">Nota de resolução</label>
          <textarea value={resolution} onChange={e => setResolution(e.target.value)}
            rows={3} placeholder="Como foi resolvido…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-white/40 text-xs hover:bg-white/5">Cancelar</button>
          <button type="button" onClick={resolve} disabled={loading}
            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40">
            {loading ? '…' : '✓ Resolver'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'waiting' | 'resolved' | 'all'>('open');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [resolving, setResolving] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/support?status=${statusFilter}&limit=50`);
      const d = await res.json();
      setTickets(d.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Stats across current load
  const criticalCount = tickets.filter(t => t.priority === 'critical').length;
  const highCount = tickets.filter(t => t.priority === 'high').length;
  const breachedCount = tickets.filter(t => t.slaBreached).length;
  const resolvedToday = tickets.filter(t => t.status === 'resolved' && (Date.now() - new Date(t.updated_at).getTime()) < 86400000).length;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Support Center</h1>
          <p className="text-white/40 text-xs mt-0.5">Tickets · SLA tracking · Escalações</p>
        </div>
        <button type="button" onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
          + Novo Ticket
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Abertos',  value: tickets.length,   color: 'text-white' },
          { label: 'Críticos',       value: criticalCount,    color: criticalCount > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Alta Prioridade',value: highCount,        color: highCount > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'SLA Expirado',   value: breachedCount,    color: breachedCount > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Resolvidos Hoje',value: resolvedToday,    color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : value}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {([
          ['open', 'Abertos'],
          ['in_progress', 'Em curso'],
          ['waiting', 'A aguardar'],
          ['resolved', 'Resolvidos'],
          ['all', 'Todos'],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              statusFilter === key ? 'text-white bg-white/8 border-b-2 border-blue-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/5" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/2 p-12 text-center">
          <p className="text-white/30 text-sm">Sem tickets nesta categoria</p>
          <p className="text-white/20 text-xs mt-1">Tudo resolvido ✓</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META.normal;
            const sm = STATUS_META[ticket.status] ?? STATUS_META.open;
            const sla = slaCountdown(ticket);
            const isSelected = selected?.id === ticket.id;

            return (
              <motion.div key={ticket.id} layout
                className={`rounded-2xl border p-4 cursor-pointer transition-colors ${
                  isSelected ? 'border-blue-500/30 bg-blue-500/5' : `${pm.bg} hover:bg-opacity-60`
                } ${ticket.slaBreached ? 'ring-1 ring-red-500/30' : ''}`}
                onClick={() => setSelected(isSelected ? null : ticket)}>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${pm.dot} shrink-0`} />
                      <span className={`text-[9px] font-medium ${pm.color}`}>{pm.label}</span>
                      <span className="text-white/20 text-[9px]">·</span>
                      <span className="text-white/40 text-[9px] capitalize">{ticket.category}</span>
                      <span className="text-white/20 text-[9px]">·</span>
                      <span className={`text-[9px] font-medium ${sm.color}`}>{sm.label}</span>
                      {ticket.slaBreached && (
                        <span className="text-red-400 text-[9px] font-semibold animate-pulse">⚠ SLA</span>
                      )}
                    </div>
                    <p className="text-white text-xs font-medium truncate">{ticket.subject}</p>
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-white/30">
                      <span>{ticket.actor_email}</span>
                      <span>·</span>
                      <span>{timeAgo(ticket.created_at)}</span>
                      <span>·</span>
                      <span>{ticket.hoursOpen}h aberto</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[10px] font-medium ${sla.breached ? 'text-red-400' : sla.urgent ? 'text-amber-400' : 'text-white/40'}`}>
                      {sla.text}
                    </p>
                    <p className="text-white/20 text-[9px]">SLA</p>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-white/10 space-y-3 overflow-hidden">

                      <p className="text-white/50 text-[10px] leading-relaxed">{ticket.body}</p>

                      {ticket.resolution && (
                        <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-2.5">
                          <p className="text-emerald-400 text-[10px] font-medium mb-1">Resolução</p>
                          <p className="text-emerald-300/60 text-[10px]">{ticket.resolution}</p>
                        </div>
                      )}

                      {ticket.entity_id && (
                        <p className="text-white/30 text-[9px]">Entity: <span className="font-mono">{ticket.entity_id}</span></p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {[
                          { label: 'Primeira resposta', value: `${ticket.slaTargets.first_response}h` },
                          { label: 'Resolução SLA',     value: `${ticket.slaTargets.resolution}h` },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg bg-white/5 p-2">
                            <p className="text-white/30">{label}</p>
                            <p className="text-white/70 font-medium">{value}</p>
                          </div>
                        ))}
                      </div>

                      {!['resolved', 'closed'].includes(ticket.status) && (
                        <div className="flex gap-1.5">
                          <button type="button" onClick={e => { e.stopPropagation(); setResolving(ticket); }}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/30 transition-colors">
                            ✓ Resolver
                          </button>
                          <button type="button" onClick={async e => {
                            e.stopPropagation();
                            await fetch('/api/support', {
                              method: 'PATCH',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ id: ticket.id, status: 'in_progress' }),
                            });
                            load();
                          }}
                            className="flex-1 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 text-[10px] font-medium hover:bg-blue-500/25 transition-colors">
                            → Em curso
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SLA Reference */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-4">
        <p className="text-white/30 text-[10px] font-medium mb-3">SLA Targets</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { p: 'critical', resp: '1h',  res: '4h' },
            { p: 'high',     resp: '4h',  res: '24h' },
            { p: 'normal',   resp: '8h',  res: '72h' },
            { p: 'low',      resp: '24h', res: '168h' },
          ].map(({ p, resp, res }) => {
            const pm = PRIORITY_META[p];
            return (
              <div key={p} className={`rounded-lg border p-2.5 ${pm.bg}`}>
                <p className={`text-[10px] font-semibold ${pm.color} mb-1`}>{pm.label}</p>
                <p className="text-white/40 text-[9px]">1ª resp: {resp}</p>
                <p className="text-white/40 text-[9px]">Resolução: {res}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={load} />}
        {resolving && <ResolveModal ticket={resolving} onClose={() => setResolving(null)} onDone={load} />}
      </AnimatePresence>
    </div>
  );
}
