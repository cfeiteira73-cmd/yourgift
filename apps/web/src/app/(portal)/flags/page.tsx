'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, springSnappy } from '@/lib/motion';

// ── OMEGA X — S11: Feature Flags & Experimentation ───────────────────────────

type Flag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout_pct: number;
  targeting: Record<string, unknown>;
  variants: Record<string, number>;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  omega_x_experiments?: Experiment[];
};

type Experiment = {
  id: string;
  flag_id: string;
  name: string;
  hypothesis: string | null;
  metric: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  winner: string | null;
  results: Record<string, unknown>;
  ai_analysis: string | null;
  created_at: string;
};

const EXP_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-white/40',
  running: 'bg-emerald-500/20 text-emerald-300',
  paused: 'bg-amber-500/20 text-amber-300',
  concluded: 'bg-blue-500/20 text-blue-300',
};

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);

  const [flagForm, setFlagForm] = useState({
    key: '', name: '', description: '', rollout_pct: '0',
  });
  const [expForm, setExpForm] = useState({
    name: '', hypothesis: '', metric: 'conversion_rate',
  });

  const loadFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/flags?mode=list');
      if (res.ok) {
        const d = await res.json();
        setFlags(d.flags ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadFlagDetail = useCallback(async (flag: Flag) => {
    try {
      const res = await fetch(`/api/flags?mode=flag&id=${flag.id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedFlag(d.flag);
        setExperiments(d.experiments ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFlags().finally(() => setLoading(false));
  }, [loadFlags]);

  async function toggleFlag(flag: Flag) {
    setToggling(flag.id);
    try {
      await fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: flag.id, enabled: !flag.enabled }),
      });
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
      if (selectedFlag?.id === flag.id) setSelectedFlag(prev => prev ? { ...prev, enabled: !prev.enabled } : prev);
    } finally { setToggling(null); }
  }

  async function updateRollout(flag: Flag, pct: number) {
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: flag.id, rollout_pct: pct }),
    });
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rollout_pct: pct } : f));
    if (selectedFlag?.id === flag.id) setSelectedFlag(prev => prev ? { ...prev, rollout_pct: pct } : prev);
  }

  async function createFlag() {
    if (!flagForm.key || !flagForm.name) return;
    setCreating(true);
    try {
      await fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...flagForm, rollout_pct: Number(flagForm.rollout_pct) }),
      });
      setShowCreate(false);
      setFlagForm({ key: '', name: '', description: '', rollout_pct: '0' });
      await loadFlags();
    } finally { setCreating(false); }
  }

  async function createExperiment() {
    if (!selectedFlag || !expForm.name || !expForm.metric) return;
    setCreating(true);
    try {
      await fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_experiment', flag_id: selectedFlag.id, ...expForm }),
      });
      setShowExpForm(false);
      setExpForm({ name: '', hypothesis: '', metric: 'conversion_rate' });
      await loadFlagDetail(selectedFlag);
    } finally { setCreating(false); }
  }

  async function startExperiment(expId: string) {
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start_experiment', id: expId }),
    });
    if (selectedFlag) await loadFlagDetail(selectedFlag);
  }

  const enabledCount = flags.filter(f => f.enabled).length;
  const runningExps = flags.reduce((s, f) => s + (f.omega_x_experiments?.filter(e => e.status === 'running').length ?? 0), 0);

  if (loading) return null;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-lg font-semibold text-white">Feature Flags</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {enabledCount} activas · {flags.length} total · {runningExps} experimentos a correr
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors">
          + Nova Flag
        </button>
      </div>

      <div className="flex gap-4">
        {/* Flag list */}
        <div className="flex-1 space-y-2">
          {flags.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">🚩</p>
              <p className="text-sm text-white/50">Nenhuma feature flag criada</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-500/30 transition-colors">
                Criar primeira flag
              </button>
            </div>
          )}

          {flags.map((flag, i) => {
            const expCount = flag.omega_x_experiments?.length ?? 0;
            const runningExp = flag.omega_x_experiments?.find(e => e.status === 'running');
            return (
              <motion.div key={flag.id} {...fadeUp} transition={{ delay: i * 0.04 }}
                className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                  selectedFlag?.id === flag.id
                    ? 'border-violet-500/40 bg-violet-500/5'
                    : 'border-white/5 bg-white/3 hover:border-white/10'}`}
                onClick={() => loadFlagDetail(flag)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${flag.enabled ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      <p className="text-sm font-medium text-white/90 truncate">{flag.name}</p>
                      {runningExp && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 shrink-0">
                          A/B
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 mt-0.5 ml-4 font-mono">{flag.key}</p>
                    {flag.description && (
                      <p className="text-xs text-white/40 mt-1 ml-4 line-clamp-1">{flag.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {expCount > 0 && (
                      <span className="text-xs text-white/30">{expCount} exp</span>
                    )}
                    {/* Toggle switch */}
                    <button onClick={e => { e.stopPropagation(); toggleFlag(flag); }}
                      disabled={toggling === flag.id}
                      className={`relative w-10 h-5 rounded-full transition-colors ${flag.enabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        flag.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                {/* Rollout bar */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className="bg-violet-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${flag.rollout_pct}%` }} />
                  </div>
                  <span className="text-xs text-white/30 w-8 text-right">{flag.rollout_pct}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Flag detail panel */}
        <AnimatePresence>
          {selectedFlag && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={springSnappy}
              className="w-96 shrink-0 rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4 self-start">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/90">{selectedFlag.name}</p>
                  <p className="text-xs text-white/30 mt-0.5 font-mono">{selectedFlag.key}</p>
                </div>
                <button onClick={() => setSelectedFlag(null)} className="text-white/30 hover:text-white/60 text-lg">×</button>
              </div>

              {selectedFlag.description && (
                <p className="text-xs text-white/50 leading-relaxed">{selectedFlag.description}</p>
              )}

              {/* Rollout control */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-white/50">Rollout %</p>
                  <span className="text-xs font-semibold text-violet-300">{selectedFlag.rollout_pct}%</span>
                </div>
                <input type="range" min="0" max="100" value={selectedFlag.rollout_pct}
                  onChange={e => updateRollout(selectedFlag, Number(e.target.value))}
                  className="w-full accent-violet-400 cursor-pointer" />
                <div className="flex justify-between text-xs text-white/20 mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* Variants */}
              {selectedFlag.variants && Object.keys(selectedFlag.variants).length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">Variantes</p>
                  <div className="space-y-1.5">
                    {Object.entries(selectedFlag.variants).map(([name, weight]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 w-20 truncate">{name}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-1.5">
                          <div className="bg-violet-400 h-1.5 rounded-full"
                            style={{ width: `${Number(weight) * 100}%` }} />
                        </div>
                        <span className="text-xs text-white/40 w-8 text-right">{Math.round(Number(weight) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experiments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-white/50">Experimentos</p>
                  <button onClick={() => setShowExpForm(true)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    + Novo
                  </button>
                </div>

                {experiments.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-3">Nenhum experimento</p>
                ) : (
                  <div className="space-y-2">
                    {experiments.map(exp => (
                      <div key={exp.id} className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-white/80">{exp.name}</p>
                            <p className="text-xs text-white/35 mt-0.5">Métrica: {exp.metric}</p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${EXP_STATUS_COLOR[exp.status]}`}>
                            {exp.status}
                          </span>
                        </div>
                        {exp.hypothesis && (
                          <p className="text-xs text-white/40 italic line-clamp-2">{exp.hypothesis}</p>
                        )}
                        {exp.ai_analysis && (
                          <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{exp.ai_analysis}</p>
                        )}
                        {exp.winner && (
                          <p className="text-xs text-emerald-400 font-medium">🏆 Vencedor: {exp.winner}</p>
                        )}
                        {exp.status === 'draft' && (
                          <button onClick={() => startExperiment(exp.id)}
                            className="w-full py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/20 transition-colors">
                            ▶ Iniciar Experimento
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* New experiment form (inline) */}
                <AnimatePresence>
                  {showExpForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 overflow-hidden">
                      <input value={expForm.name} onChange={e => setExpForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do experimento *"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 outline-none" />
                      <input value={expForm.hypothesis} onChange={e => setExpForm(p => ({ ...p, hypothesis: e.target.value }))}
                        placeholder="Hipótese"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 outline-none" />
                      <select value={expForm.metric} onChange={e => setExpForm(p => ({ ...p, metric: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 outline-none">
                        {['conversion_rate', 'revenue', 'retention', 'engagement', 'quote_acceptance'].map(m => (
                          <option key={m} value={m} className="bg-[#1a1a1a]">{m.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => setShowExpForm(false)}
                          className="flex-1 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs hover:text-white/60 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={createExperiment} disabled={!expForm.name || creating}
                          className="flex-1 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-500/30 transition-colors disabled:opacity-40">
                          {creating ? 'A criar...' : 'Criar'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Created by */}
              {selectedFlag.created_by && (
                <p className="text-xs text-white/20 border-t border-white/5 pt-3">
                  Criado por {selectedFlag.created_by}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create flag modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-sm font-semibold text-white">Nova Feature Flag</h2>

              <input value={flagForm.key} onChange={e => setFlagForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="chave_unica (snake_case) *"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none font-mono" />

              <input value={flagForm.name} onChange={e => setFlagForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome legível *"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />

              <input value={flagForm.description} onChange={e => setFlagForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descrição"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />

              <div>
                <label className="text-xs text-white/30 mb-1.5 block">Rollout inicial: {flagForm.rollout_pct}%</label>
                <input type="range" min="0" max="100" value={flagForm.rollout_pct}
                  onChange={e => setFlagForm(p => ({ ...p, rollout_pct: e.target.value }))}
                  className="w-full accent-violet-400 cursor-pointer" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors">
                  Cancelar
                </button>
                <button onClick={createFlag} disabled={!flagForm.key || !flagForm.name || creating}
                  className="flex-1 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors disabled:opacity-40">
                  {creating ? 'A criar...' : 'Criar Flag'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
