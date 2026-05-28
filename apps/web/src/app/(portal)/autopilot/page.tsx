'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Capability {
  type: string;
  label: string;
  active: boolean;
  note?: string;
}

interface AutopilotRun {
  id: string;
  run_type: string;
  trigger_source: string;
  status: string;
  entities_scanned: number;
  actions_taken: number;
  actions_skipped: number;
  value_protected: number | null;
  summary: string | null;
  duration_ms: number | null;
  completed_at: string | null;
  created_at: string;
}

interface AutopilotAction {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  result: string;
  ai_reasoning: string | null;
  created_at: string;
}

interface StatusData {
  capabilities: Capability[];
  stats: {
    total_actions_today: number;
    total_value_protected_eur: number;
    recent_runs: AutopilotRun[];
  };
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400',
  running:   'bg-blue-500/15 text-blue-400',
  failed:    'bg-red-500/15 text-red-400',
  partial:   'bg-amber-500/15 text-amber-400',
};

const RUN_TYPE_ICONS: Record<string, string> = {
  churn_prevention:   '🔮',
  sla_remediation:    '⚡',
  anomaly_resolution: '🔍',
  quote_optimization: '💰',
  supplier_fallback:  '🔄',
  procurement_assist: '📦',
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

export default function AutopilotPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [runs, setRuns] = useState<AutopilotRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutopilotRun | null>(null);
  const [runActions, setRunActions] = useState<AutopilotAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, runsRes] = await Promise.all([
        fetch('/api/autopilot?mode=status'),
        fetch('/api/autopilot?mode=runs'),
      ]);
      const [sd, rd] = await Promise.all([statusRes.json(), runsRes.json()]);
      setStatus(sd);
      setRuns(rd.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openRun(run: AutopilotRun) {
    setSelectedRun(run);
    const res = await fetch(`/api/autopilot?mode=run&id=${run.id}`);
    const d = await res.json();
    setRunActions(d.actions ?? []);
  }

  async function triggerRun(runType: string) {
    setRunning(runType);
    try {
      await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run', run_type: runType }),
      });
      load();
    } finally {
      setRunning('');
    }
  }

  async function triggerAll() {
    setRunning('all');
    try {
      await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run_all' }),
      });
      load();
    } finally {
      setRunning('');
    }
  }

  const stats = status?.stats;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">AI Autopilot</h1>
          <p className="text-white/40 text-xs mt-0.5">Execução autónoma · AI como operador, não assistente</p>
        </div>
        <button type="button" onClick={triggerAll} disabled={!!running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
          {running === 'all' ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A executar tudo…
            </>
          ) : '⚡ Executar Tudo'}
        </button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className="text-2xl font-bold text-violet-400">{stats?.total_actions_today ?? 0}</p>
          <p className="text-white/40 text-[10px] mt-1">Acções hoje</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className="text-2xl font-bold text-emerald-400">
            {stats?.total_value_protected_eur
              ? `€${stats.total_value_protected_eur.toLocaleString('pt-PT')}`
              : '€0'}
          </p>
          <p className="text-white/40 text-[10px] mt-1">Valor protegido</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className="text-2xl font-bold text-blue-400">{runs.length}</p>
          <p className="text-white/40 text-[10px] mt-1">Runs executados</p>
        </div>
      </div>

      {/* Capabilities grid */}
      <div>
        <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-3">Capacidades Autónomas</p>
        <div className="grid grid-cols-3 gap-3">
          {(status?.capabilities ?? []).map(cap => (
            <div key={cap.type}
              className={`rounded-2xl border p-5 space-y-3 ${
                cap.active ? 'border-white/8 bg-white/3' : 'border-white/3 bg-white/1 opacity-60'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-xl">{RUN_TYPE_ICONS[cap.type] ?? '🤖'}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  cap.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/30'
                }`}>
                  {cap.active ? 'Ativo' : 'Indisponível'}
                </span>
              </div>
              <div>
                <p className="text-white text-xs font-medium">{cap.label}</p>
                {cap.note && <p className="text-white/30 text-[10px] mt-0.5">{cap.note}</p>}
              </div>
              {cap.active && (
                <button type="button"
                  disabled={!!running}
                  onClick={() => triggerRun(cap.type)}
                  className="w-full py-1.5 rounded-lg border border-white/10 hover:bg-white/8 disabled:opacity-50 text-white/60 text-[10px] font-medium transition-colors">
                  {running === cap.type ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/30 border-t-white animate-spin" />
                      A executar…
                    </span>
                  ) : 'Executar agora'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Run history + detail */}
      <div className="grid grid-cols-3 gap-5">
        <div className="space-y-2">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Histórico de Runs</p>
          {loading ? (
            <p className="text-white/30 text-xs text-center py-8">A carregar…</p>
          ) : runs.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-8">Sem runs ainda</p>
          ) : runs.map(run => (
            <motion.button key={run.id} type="button" whileHover={{ x: 2 }}
              onClick={() => openRun(run)}
              className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                selectedRun?.id === run.id ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'
              }`}>
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{RUN_TYPE_ICONS[run.run_type] ?? '🤖'}</span>
                  <span className="text-white text-[10px] font-medium truncate">{run.run_type.replace(/_/g, ' ')}</span>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[run.status] ?? ''}`}>
                  {run.status}
                </span>
              </div>
              <div className="flex gap-3 text-[9px] text-white/30">
                <span>{run.actions_taken} acções</span>
                {run.duration_ms && <span>{run.duration_ms}ms</span>}
                <span>{timeAgo(run.created_at)}</span>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="col-span-2">
          <AnimatePresence mode="wait">
            {selectedRun ? (
              <motion.div key={selectedRun.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{RUN_TYPE_ICONS[selectedRun.run_type] ?? '🤖'}</span>
                      <div>
                        <p className="text-white text-xs font-semibold capitalize">{selectedRun.run_type.replace(/_/g, ' ')}</p>
                        <p className="text-white/40 text-[10px]">{timeAgo(selectedRun.created_at)} · {selectedRun.trigger_source}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[selectedRun.status] ?? ''}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  {selectedRun.summary && (
                    <p className="text-white/60 text-xs">{selectedRun.summary}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/5 p-2.5 text-center">
                      <p className="text-white font-bold text-sm">{selectedRun.actions_taken}</p>
                      <p className="text-white/30 text-[9px]">Acções</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5 text-center">
                      <p className="text-white font-bold text-sm">{selectedRun.entities_scanned}</p>
                      <p className="text-white/30 text-[9px]">Entidades</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5 text-center">
                      <p className="text-white font-bold text-sm">{selectedRun.duration_ms ?? '—'}ms</p>
                      <p className="text-white/30 text-[9px]">Duração</p>
                    </div>
                  </div>
                </div>

                {/* Actions list */}
                {runActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                      Acções Executadas ({runActions.length})
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {runActions.map(act => (
                        <div key={act.id} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <p className="text-white text-[10px] font-medium leading-snug">{act.description}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                              act.result === 'executed' ? 'bg-emerald-500/15 text-emerald-400' :
                              act.result === 'failed' ? 'bg-red-500/15 text-red-400' :
                              'bg-white/10 text-white/30'
                            }`}>{act.result}</span>
                          </div>
                          {act.ai_reasoning && (
                            <p className="text-white/40 text-[10px] leading-relaxed border-t border-white/5 pt-2">
                              {act.ai_reasoning}
                            </p>
                          )}
                          {act.entity_type && (
                            <p className="text-white/25 text-[9px]">
                              {act.entity_type}{act.entity_id ? ` · ${act.entity_id.slice(0, 12)}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-4xl">🤖</div>
                <p className="text-white/30 text-xs">Seleciona um run para ver as acções executadas pelo AI</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
