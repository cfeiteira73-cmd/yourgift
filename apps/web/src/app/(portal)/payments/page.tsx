'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KPIs {
  total_net_settled_7d: number;
  total_drift_7d: number;
  open_disputes: number;
  flagged_risks: number;
  duplicate_events: number;
}

interface PaymentEvent {
  id: string;
  event_type: string;
  amount: number | null;
  created_at: string;
  duplicate: boolean;
  object_id: string | null;
}

interface Settlement {
  settlement_date: string;
  net_settled: number;
  gross_volume: number;
  drift_amount: number;
  status: string;
}

interface Risk {
  id: string;
  risk_level: string;
  risk_score: number;
  flagged: boolean;
  reviewed: boolean;
  order_id: string | null;
}

interface Dispute {
  id: string;
  amount: number;
  status: string;
  reason: string | null;
  created_at: string;
}

interface Dashboard {
  kpis: KPIs;
  recent_events: PaymentEvent[];
  settlements: Settlement[];
  flagged_risks: Risk[];
  open_disputes: Dispute[];
}

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/15',
  high:     'text-amber-400 bg-amber-500/15',
  medium:   'text-yellow-400 bg-yellow-500/15',
  low:      'text-emerald-400 bg-emerald-500/15',
};

const STATUS_DOT: Record<string, string> = {
  paid:       'bg-emerald-500',
  in_transit: 'bg-blue-500',
  pending:    'bg-amber-500',
  failed:     'bg-red-500',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SyncSettlementModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    settlement_date: new Date().toISOString().split('T')[0],
    gross_volume: '',
    refunds: '',
    fees: '',
    net_settled: '',
    transaction_count: '',
    internal_expected: '',
    stripe_payout_id: '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sync_settlement', ...form }),
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
          <h2 className="text-white text-sm font-semibold">Sincronizar Settlement</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {[
            { label: 'Data', key: 'settlement_date', type: 'date' },
            { label: 'Volume Bruto (€)', key: 'gross_volume', type: 'number' },
            { label: 'Reembolsos (€)', key: 'refunds', type: 'number' },
            { label: 'Taxas Stripe (€)', key: 'fees', type: 'number' },
            { label: 'Net Settled (€)', key: 'net_settled', type: 'number' },
            { label: 'Nº Transações', key: 'transaction_count', type: 'number' },
            { label: 'Esperado Interno (€)', key: 'internal_expected', type: 'number' },
            { label: 'Stripe Payout ID', key: 'stripe_payout_id', type: 'text' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-white/50 text-[10px] uppercase tracking-wider">{label}</label>
              <input type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-blue-500/50" />
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="w-full py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {saving ? 'A sincronizar…' : 'Sincronizar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function PaymentsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [tab, setTab] = useState<'overview' | 'events' | 'risks' | 'settlements'>('overview');
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments?mode=dashboard');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadTab(t: typeof tab) {
    setTab(t);
    if (t === 'events') {
      const r = await fetch('/api/payments?mode=events');
      const d = await r.json();
      setEvents(d.events ?? []);
    } else if (t === 'risks') {
      const r = await fetch('/api/payments?mode=risks');
      const d = await r.json();
      setRisks(d.risks ?? []);
    } else if (t === 'settlements') {
      const r = await fetch('/api/payments?mode=settlements');
      const d = await r.json();
      setSettlements(d.settlements ?? []);
    }
  }

  async function scoreAll() {
    setScoring(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'score_all' }),
      });
      load();
    } finally {
      setScoring(false);
    }
  }

  async function reviewRisk(riskId: string) {
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review_risk', risk_id: riskId }),
    });
    load();
  }

  const kpis = data?.kpis;
  const TABS = ['overview', 'events', 'risks', 'settlements'] as const;
  const TAB_LABELS: Record<string, string> = {
    overview: 'Visão Geral',
    events: 'Eventos',
    risks: 'Riscos',
    settlements: 'Settlements',
  };

  return (
    <div className="p-6 space-y-5 min-h-full">
      {showSync && <SyncSettlementModal onClose={() => setShowSync(false)} onDone={load} />}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Live Money Validation</h1>
          <p className="text-white/40 text-xs mt-0.5">Pagamentos em tempo real · Riscos · Settlements · Disputas</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowSync(true)}
            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
            + Settlement
          </button>
          <button type="button" onClick={scoreAll} disabled={scoring}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {scoring ? (
              <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />A analisar…</>
            ) : '🔍 Score All Payments'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Net Settled 7d', value: kpis ? `€${kpis.total_net_settled_7d.toLocaleString('pt-PT')}` : '—', color: 'text-emerald-400' },
          { label: 'Drift Total 7d', value: kpis ? `€${kpis.total_drift_7d.toLocaleString('pt-PT')}` : '—', color: kpis && kpis.total_drift_7d > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'Disputas Abertas', value: kpis?.open_disputes ?? '—', color: kpis && kpis.open_disputes > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Riscos Flagged', value: kpis?.flagged_risks ?? '—', color: kpis && kpis.flagged_risks > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'Eventos Duplicados', value: kpis?.duplicate_events ?? '—', color: kpis && kpis.duplicate_events > 0 ? 'text-red-400' : 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 pb-0">
        {TABS.map(t => (
          <button type="button" key={t} type="button" onClick={() => loadTab(t)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === t ? 'text-white bg-white/8 border-b-2 border-blue-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-5">
            {/* Recent events */}
            <div className="col-span-2 space-y-2">
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Eventos Recentes</p>
              {(data?.recent_events ?? []).length === 0 ? (
                <p className="text-white/30 text-xs py-8 text-center">Sem eventos</p>
              ) : (data?.recent_events ?? []).map(ev => (
                <div key={ev.id} className="rounded-xl border border-white/5 bg-white/3 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {ev.duplicate && (
                      <span className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">DUP</span>
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-[10px] font-medium truncate">{ev.event_type}</p>
                      {ev.object_id && <p className="text-white/30 text-[9px] truncate">{ev.object_id}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {ev.amount != null && <p className="text-white text-[10px]">€{ev.amount.toFixed(2)}</p>}
                    <p className="text-white/30 text-[9px]">{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}

              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mt-4">Disputas Abertas</p>
              {(data?.open_disputes ?? []).length === 0 ? (
                <p className="text-white/30 text-xs py-4 text-center">Sem disputas abertas ✅</p>
              ) : (data?.open_disputes ?? []).map(d => (
                <div key={d.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white text-[10px] font-medium">{d.reason ?? 'Razão não especificada'}</p>
                    <p className="text-white/40 text-[9px]">{d.status} · {timeAgo(d.created_at)}</p>
                  </div>
                  <p className="text-red-400 font-bold text-sm shrink-0">€{d.amount}</p>
                </div>
              ))}
            </div>

            {/* Risks sidebar */}
            <div className="space-y-2">
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Riscos Flagged</p>
              {(data?.flagged_risks ?? []).length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/3 p-6 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-white/30 text-xs">Sem riscos flagged</p>
                </div>
              ) : (data?.flagged_risks ?? []).map(r => (
                <div key={r.id} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RISK_COLORS[r.risk_level] ?? ''}`}>
                      {r.risk_level}
                    </span>
                    <span className="text-white font-bold text-xs">{r.risk_score}/100</span>
                  </div>
                  {r.order_id && <p className="text-white/40 text-[9px] truncate">Order: {r.order_id.slice(0, 12)}</p>}
                  <button type="button" onClick={() => reviewRisk(r.id)}
                    className="w-full py-1 rounded-lg border border-white/10 hover:bg-white/5 text-white/50 text-[9px] transition-colors">
                    Marcar Revisto
                  </button>
                </div>
              ))}

              {/* Settlements summary */}
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mt-4">Settlements 7d</p>
              {(data?.settlements ?? []).map(s => (
                <div key={s.settlement_date} className="rounded-xl border border-white/5 bg-white/3 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? 'bg-white/30'}`} />
                      <span className="text-white/60 text-[10px]">{s.settlement_date}</span>
                    </div>
                    <span className="text-emerald-400 text-[10px] font-medium">€{Number(s.net_settled).toFixed(0)}</span>
                  </div>
                  {Number(s.drift_amount) > 0 && (
                    <p className="text-amber-400 text-[9px] mt-1">Drift: €{Number(s.drift_amount).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'events' && (
          <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {events.length === 0 ? (
              <p className="text-white/30 text-xs py-12 text-center">Sem eventos registados</p>
            ) : (
              <div className="rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40">
                      {['Tipo de Evento', 'Object ID', 'Montante', 'Status', 'Hora'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, i) => (
                      <tr key={ev.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/1' : ''}`}>
                        <td className="px-4 py-2.5 text-white font-medium">{ev.event_type}</td>
                        <td className="px-4 py-2.5 text-white/40">{ev.object_id?.slice(0, 16) ?? '—'}</td>
                        <td className="px-4 py-2.5 text-white">{ev.amount != null ? `€${ev.amount}` : '—'}</td>
                        <td className="px-4 py-2.5">
                          {ev.duplicate
                            ? <span className="bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">Duplicado</span>
                            : <span className="bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">OK</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-white/40">{timeAgo(ev.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'risks' && (
          <motion.div key="risks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {risks.length === 0 ? (
              <p className="text-white/30 text-xs py-12 text-center">Sem riscos registados · Corre "Score All" primeiro</p>
            ) : risks.map(r => (
              <div key={r.id} className="rounded-xl border border-white/5 bg-white/3 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[r.risk_level] ?? ''}`}>
                    {r.risk_level}
                  </span>
                  <div>
                    <p className="text-white text-xs">Order: {r.order_id?.slice(0, 16) ?? '—'}</p>
                    <p className="text-white/40 text-[9px]">Score: {r.risk_score}/100</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.reviewed
                    ? <span className="text-[9px] text-emerald-400">✓ Revisto</span>
                    : r.flagged && (
                      <button type="button" onClick={() => reviewRisk(r.id)}
                        className="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-white/50 text-[9px] transition-colors">
                        Marcar Revisto
                      </button>
                    )
                  }
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'settlements' && (
          <motion.div key="settlements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {settlements.length === 0 ? (
              <p className="text-white/30 text-xs py-12 text-center">Sem settlements · Usa "+ Settlement" para criar</p>
            ) : (
              <div className="rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40">
                      {['Data', 'Volume Bruto', 'Reembolsos', 'Taxas', 'Net Settled', 'Drift', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s, i) => (
                      <tr key={s.settlement_date} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/1' : ''}`}>
                        <td className="px-4 py-2.5 text-white font-medium">{s.settlement_date}</td>
                        <td className="px-4 py-2.5 text-white">€{Number(s.gross_volume).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-red-400">—</td>
                        <td className="px-4 py-2.5 text-amber-400">—</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-medium">€{Number(s.net_settled).toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          {Number(s.drift_amount) > 0
                            ? <span className="text-amber-400">€{Number(s.drift_amount).toFixed(2)}</span>
                            : <span className="text-white/30">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-full ${STATUS_DOT[s.status] ? `bg-${s.status === 'paid' ? 'emerald' : 'amber'}-500/15 text-${s.status === 'paid' ? 'emerald' : 'amber'}-400` : 'bg-white/10 text-white/40'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
