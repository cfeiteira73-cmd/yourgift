'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReconciliationRun {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_stripe: number | null;
  total_internal: number | null;
  drift_amount: number | null;
  drift_count: number;
  entries_checked: number;
  run_by: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Discrepancy {
  id: string;
  type: string;
  stripe_id: string | null;
  internal_id: string | null;
  stripe_amount: number | null;
  internal_amount: number | null;
  delta: number | null;
  resolved: boolean;
  notes: string | null;
}

interface Stats {
  latest_run: ReconciliationRun | null;
  open_discrepancies: number;
  total_drift_eur: number;
  discrepancy_by_type: Record<string, number>;
  recent_runs: ReconciliationRun[];
}

const STATUS_STYLES: Record<string, string> = {
  clean:          'bg-emerald-500/15 text-emerald-400',
  drift_detected: 'bg-red-500/15 text-red-400',
  running:        'bg-blue-500/15 text-blue-400',
  pending:        'bg-white/10 text-white/40',
  error:          'bg-red-500/15 text-red-400',
};

const TYPE_LABELS: Record<string, string> = {
  missing_internal: 'Falta no sistema',
  missing_stripe:   'Falta no Stripe',
  amount_mismatch:  'Valor diferente',
  duplicate:        'Duplicado',
};

function fmt(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
}

export default function ReconciliationPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ReconciliationRun | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showNewRun, setShowNewRun] = useState(false);
  const [form, setForm] = useState({
    period_start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, runsRes] = await Promise.all([
        fetch('/api/reconciliation?mode=stats'),
        fetch('/api/reconciliation?mode=runs'),
      ]);
      const [sd, rd] = await Promise.all([statsRes.json(), runsRes.json()]);
      setStats(sd);
      setRuns(rd.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openRun(run: ReconciliationRun) {
    setSelectedRun(run);
    const res = await fetch(`/api/reconciliation?mode=run&id=${run.id}`);
    const d = await res.json();
    setDiscrepancies(d.discrepancies ?? []);
  }

  async function startRun() {
    setRunning(true);
    try {
      await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start_run', ...form }),
      });
      setShowNewRun(false);
      load();
    } finally {
      setRunning(false);
    }
  }

  async function resolveDiscrepancy(id: string) {
    await fetch('/api/reconciliation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id }),
    });
    setDiscrepancies(d => d.map(x => x.id === id ? { ...x, resolved: true } : x));
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Reconciliação Financeira</h1>
          <p className="text-white/40 text-xs mt-0.5">Stripe vs ledger interno · drift detection · replay safety</p>
        </div>
        <button type="button" onClick={() => setShowNewRun(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
          <span className="text-base leading-none">+</span> Nova Reconciliação
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className={`text-xl font-bold ${stats?.latest_run?.status === 'clean' ? 'text-emerald-400' : stats?.latest_run?.status === 'drift_detected' ? 'text-red-400' : 'text-white/40'}`}>
            {stats?.latest_run?.status === 'clean' ? 'Limpo' : stats?.latest_run?.status === 'drift_detected' ? 'Drift' : '—'}
          </p>
          <p className="text-white/40 text-[10px] mt-1">Último resultado</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className={`text-xl font-bold ${(stats?.open_discrepancies ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats?.open_discrepancies ?? 0}
          </p>
          <p className="text-white/40 text-[10px] mt-1">Discrepâncias abertas</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className={`text-xl font-bold ${(stats?.total_drift_eur ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {fmt(stats?.total_drift_eur ?? 0)}
          </p>
          <p className="text-white/40 text-[10px] mt-1">Drift total €</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className="text-xl font-bold text-blue-400">{stats?.recent_runs?.length ?? 0}</p>
          <p className="text-white/40 text-[10px] mt-1">Runs executados</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Runs list */}
        <div className="space-y-2">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider px-1">Histórico de Runs</p>
          {loading ? (
            <p className="text-white/30 text-xs text-center py-10">A carregar…</p>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/3 p-6 text-center">
              <p className="text-white/30 text-xs">Sem runs executados</p>
            </div>
          ) : runs.map(run => (
            <motion.button key={run.id} type="button" whileHover={{ x: 2 }}
              onClick={() => openRun(run)}
              className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                selectedRun?.id === run.id ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-white/3 hover:bg-white/5'
              }`}>
              <div className="flex justify-between items-center gap-2">
                <span className="text-white text-xs font-medium">
                  {run.period_start} → {run.period_end}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[run.status] ?? ''}`}>
                  {run.status === 'clean' ? '✓ Limpo' : run.status === 'drift_detected' ? '⚠ Drift' : run.status}
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-white/30">
                <span>{run.entries_checked} entradas</span>
                {run.drift_count > 0 && <span className="text-red-400">{run.drift_count} discrepâncias</span>}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Detail */}
        <div className="col-span-2">
          <AnimatePresence mode="wait">
            {selectedRun ? (
              <motion.div key={selectedRun.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                {/* Run summary */}
                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-xs font-semibold">
                        {selectedRun.period_start} → {selectedRun.period_end}
                      </p>
                      <p className="text-white/40 text-[10px] mt-0.5">
                        {selectedRun.entries_checked} entradas analisadas · por {selectedRun.run_by ?? '—'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[selectedRun.status] ?? ''}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-white/40 text-[10px]">Total interno</p>
                      <p className="text-white text-sm font-bold mt-0.5">{fmt(selectedRun.total_internal)}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-white/40 text-[10px]">Drift €</p>
                      <p className={`text-sm font-bold mt-0.5 ${(selectedRun.drift_amount ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmt(selectedRun.drift_amount)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-white/40 text-[10px]">Discrepâncias</p>
                      <p className={`text-sm font-bold mt-0.5 ${selectedRun.drift_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {selectedRun.drift_count}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Discrepancies */}
                {discrepancies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                      Discrepâncias ({discrepancies.length})
                    </p>
                    {discrepancies.map(d => (
                      <div key={d.id} className={`rounded-xl border p-3 space-y-2 ${d.resolved ? 'border-white/5 bg-white/3 opacity-50' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                              {TYPE_LABELS[d.type] ?? d.type}
                            </span>
                            {d.resolved && <span className="text-emerald-400 text-[10px]">✓ Resolvido</span>}
                          </div>
                          {!d.resolved && (
                            <button type="button" onClick={() => resolveDiscrepancy(d.id)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                              Resolver
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <span className="text-white/40">Interno: </span>
                            <span className="text-white/70">{d.internal_id ? `#${d.internal_id.slice(0, 8)}` : '—'} {fmt(d.internal_amount)}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Stripe: </span>
                            <span className="text-white/70">{d.stripe_id ? `${d.stripe_id.slice(0, 12)}…` : '—'}</span>
                          </div>
                          {d.delta != null && (
                            <div>
                              <span className="text-white/40">Delta: </span>
                              <span className="text-red-400 font-medium">{fmt(d.delta)}</span>
                            </div>
                          )}
                        </div>
                        {d.notes && <p className="text-white/40 text-[10px]">{d.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-3xl">💳</div>
                <p className="text-white/30 text-xs">Seleciona um run para ver os detalhes e discrepâncias</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Run Modal */}
      <AnimatePresence>
        {showNewRun && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowNewRun(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-[#0e1015] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold text-sm">Nova Reconciliação</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs block mb-1">Data início</label>
                  <input type="date" value={form.period_start}
                    onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
                </div>
                <div>
                  <label className="text-white/50 text-xs block mb-1">Data fim</label>
                  <input type="date" value={form.period_end}
                    onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewRun(false)}
                  className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-sm transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={startRun} disabled={running}
                  className="flex-1 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {running ? 'A reconciliar…' : 'Executar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
