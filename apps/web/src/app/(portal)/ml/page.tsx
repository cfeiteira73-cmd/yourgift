'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MLModel {
  id: string;
  name: string;
  model_type: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  accuracy: number | null;
  f1_score: number | null;
  training_samples: number | null;
  artifact_url: string | null;
  trained_at: string | null;
  updated_at: string;
  created_at: string;
}

interface MLPrediction {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  confidence: number | null;
  latency_ms: number | null;
  created_at: string;
  omega_x_ml_models?: { name: string; model_type: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:     'bg-emerald-500/15 text-emerald-400',
  draft:      'bg-amber-500/15 text-amber-400',
  deprecated: 'bg-white/10 text-white/30',
};

const MODEL_TYPE_LABELS: Record<string, string> = {
  demand_forecast:    'Demand Forecast',
  churn_prediction:   'Churn Prediction',
  price_optimization: 'Price Optimisation',
  lead_scoring:       'Lead Scoring',
};

const FEATURE_DEFAULTS: Record<string, Record<string, string>> = {
  demand_forecast:    { avg_monthly_qty: '100', trend: '1.05', seasonal_factor: '1.0' },
  churn_prediction:   { days_since_last_order: '60', health_score: '60' },
  price_optimization: { unit_cost: '10', market_price: '25', price_elasticity: '-1.5' },
  lead_scoring:       { company_size: '150', industry_fit: '0.7', engagement_score: '0.6' },
};

function pct(n: number | null) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function MetricBar({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const pctVal = Math.round(value * 100);
  const color = pctVal >= 80 ? 'bg-emerald-500' : pctVal >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/70 font-medium">{pctVal}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  );
}

// ── Register Modal ────────────────────────────────────────────────────────────

function RegisterModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: () => void }) {
  const [form, setForm] = useState({
    name: '', model_type: 'demand_forecast', version: '1.0.0',
    accuracy: '', f1_score: '', training_samples: '', artifact_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ml', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: form.name,
          model_type: form.model_type,
          version: form.version,
          accuracy: form.accuracy ? Number(form.accuracy) : null,
          f1_score: form.f1_score ? Number(form.f1_score) : null,
          training_samples: form.training_samples ? Number(form.training_samples) : null,
          artifact_url: form.artifact_url || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-[#0e1015] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-sm">Registar Modelo</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-white/50 text-xs block mb-1">Nome *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
              placeholder="ex: DemandForecast v2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1">Tipo *</label>
              <select value={form.model_type} onChange={e => setForm(f => ({ ...f, model_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                {Object.entries(MODEL_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Versão</label>
              <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                placeholder="1.0.0" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Accuracy (0-1)</label>
              <input type="number" step="0.001" min="0" max="1" value={form.accuracy}
                onChange={e => setForm(f => ({ ...f, accuracy: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                placeholder="0.850" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">F1 Score (0-1)</label>
              <input type="number" step="0.001" min="0" max="1" value={form.f1_score}
                onChange={e => setForm(f => ({ ...f, f1_score: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                placeholder="0.820" />
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1">Amostras treino</label>
            <input type="number" value={form.training_samples}
              onChange={e => setForm(f => ({ ...f, training_samples: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              placeholder="10000" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {loading ? 'A registar…' : 'Registar Modelo'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MLPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [modelPredictions, setModelPredictions] = useState<MLPrediction[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [tab, setTab] = useState<'models' | 'predictions'>('models');

  // Predict panel state
  const [predictType, setPredictType] = useState<string>('demand_forecast');
  const [predictFeatures, setPredictFeatures] = useState<Record<string, string>>(FEATURE_DEFAULTS.demand_forecast);
  const [predicting, setPredicting] = useState(false);
  const [predResult, setPredResult] = useState<Record<string, unknown> | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, predsRes] = await Promise.all([
        fetch('/api/ml?mode=models'),
        fetch('/api/ml?mode=predictions'),
      ]);
      const [md, pd] = await Promise.all([modelsRes.json(), predsRes.json()]);
      setModels(md.models ?? []);
      setPredictions(pd.predictions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  async function openModel(model: MLModel) {
    setSelectedModel(model);
    const res = await fetch(`/api/ml?mode=model&id=${model.id}`);
    const d = await res.json();
    setModelPredictions(d.recent_predictions ?? []);
  }

  async function activateModel(id: string) {
    await fetch('/api/ml', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'activate', id }),
    });
    loadModels();
    if (selectedModel?.id === id) {
      setSelectedModel(m => m ? { ...m, status: 'active' } : null);
    }
  }

  async function runPredict(e: React.FormEvent) {
    e.preventDefault();
    setPredicting(true); setPredResult(null);
    try {
      const features: Record<string, number> = {};
      for (const [k, v] of Object.entries(predictFeatures)) {
        features[k] = Number(v);
      }
      const res = await fetch('/api/ml', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'predict', model_type: predictType, features }),
      });
      const d = await res.json();
      setPredResult(d.prediction ?? null);
    } finally {
      setPredicting(false);
    }
  }

  function handleTypeChange(type: string) {
    setPredictType(type);
    setPredictFeatures(FEATURE_DEFAULTS[type] ?? {});
    setPredResult(null);
  }

  // Stats
  const activeModels = models.filter(m => m.status === 'active').length;
  const draftModels = models.filter(m => m.status === 'draft').length;
  const avgAccuracy = models.filter(m => m.accuracy != null).reduce((a, m) => a + (m.accuracy ?? 0), 0) / (models.filter(m => m.accuracy != null).length || 1);
  const totalPredictions = predictions.length;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">ML Platform</h1>
          <p className="text-white/40 text-xs mt-0.5">Registo de modelos · versões · predições em tempo real</p>
        </div>
        <div className="flex gap-2">
          {(['models', 'predictions'] as const).map(t => (
            <button type="button" key={t} type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {t === 'models' ? 'Modelos' : 'Predições'}
            </button>
          ))}
          <button type="button"
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
            <span className="text-base leading-none">+</span> Registar Modelo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Modelos Ativos', val: activeModels, color: 'text-emerald-400' },
          { label: 'Em Draft', val: draftModels, color: 'text-amber-400' },
          { label: 'Avg Accuracy', val: isNaN(avgAccuracy) ? '—' : `${(avgAccuracy * 100).toFixed(1)}%`, color: 'text-blue-400' },
          { label: 'Predições (log)', val: totalPredictions, color: 'text-violet-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-xl font-bold ${color}`}>{val}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {tab === 'models' && (
        <div className="grid grid-cols-5 gap-5">
          {/* Model list */}
          <div className="col-span-2 space-y-2">
            {loading ? (
              <p className="text-white/30 text-xs text-center py-10">A carregar modelos…</p>
            ) : models.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-10">Nenhum modelo registado</p>
            ) : models.map(model => (
              <motion.button
                key={model.id}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => openModel(model)}
                className={`w-full text-left rounded-2xl border p-4 space-y-2 transition-colors ${
                  selectedModel?.id === model.id
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-white/5 bg-white/3 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-xs font-medium truncate">{model.name}</p>
                  <span className={`text-[10px] shrink-0 font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[model.status] ?? 'bg-white/10 text-white/40'}`}>
                    {model.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/40">
                  <span>{MODEL_TYPE_LABELS[model.model_type] ?? model.model_type}</span>
                  <span>v{model.version}</span>
                </div>
                <div className="flex gap-3">
                  {model.accuracy != null && (
                    <span className="text-[10px] text-white/50">Acc: <span className="text-white/70">{pct(model.accuracy)}</span></span>
                  )}
                  {model.f1_score != null && (
                    <span className="text-[10px] text-white/50">F1: <span className="text-white/70">{pct(model.f1_score)}</span></span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Detail + Predict panel */}
          <div className="col-span-3 space-y-4">
            <AnimatePresence mode="wait">
              {selectedModel ? (
                <motion.div key={selectedModel.id}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white text-sm font-semibold">{selectedModel.name}</p>
                      <p className="text-white/40 text-[10px] mt-0.5">
                        {MODEL_TYPE_LABELS[selectedModel.model_type] ?? selectedModel.model_type} · v{selectedModel.version}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[selectedModel.status]}`}>
                        {selectedModel.status}
                      </span>
                      {selectedModel.status !== 'active' && (
                        <button type="button"
                          onClick={() => activateModel(selectedModel.id)}
                          className="text-[10px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-medium">
                          Ativar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <MetricBar value={selectedModel.accuracy} label="Accuracy" />
                    <MetricBar value={selectedModel.f1_score} label="F1 Score" />
                  </div>

                  {selectedModel.training_samples != null && (
                    <p className="text-white/40 text-xs">
                      Treino: <span className="text-white/60 font-medium">{selectedModel.training_samples.toLocaleString('pt-PT')}</span> amostras
                    </p>
                  )}

                  {/* Recent predictions */}
                  {modelPredictions.length > 0 && (
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Predições recentes</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {modelPredictions.map(pred => (
                          <div key={pred.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5">
                            <span className="text-white/50 text-[10px]">
                              {pred.entity_type ?? 'anon'}{pred.entity_id ? ` · ${pred.entity_id}` : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              {pred.confidence != null && (
                                <span className="text-white/40 text-[10px]">{pct(pred.confidence)}</span>
                              )}
                              {pred.latency_ms != null && (
                                <span className="text-white/30 text-[9px]">{pred.latency_ms}ms</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/5 bg-white/3 p-6 flex items-center justify-center">
                  <p className="text-white/30 text-xs">Seleciona um modelo para ver detalhes</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Predict panel */}
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
              <p className="text-white text-xs font-semibold">Executar Predição</p>
              <form onSubmit={runPredict} className="space-y-3">
                <div>
                  <label className="text-white/50 text-[10px] block mb-1">Tipo de modelo</label>
                  <select value={predictType} onChange={e => handleTypeChange(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/30">
                    {Object.entries(MODEL_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(predictFeatures).map(([k, v]) => (
                    <div key={k}>
                      <label className="text-white/40 text-[10px] block mb-0.5">{k}</label>
                      <input
                        type="number" step="any" value={v}
                        onChange={e => setPredictFeatures(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                      />
                    </div>
                  ))}
                </div>

                <button type="submit" disabled={predicting}
                  className="w-full py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                  {predicting ? 'A calcular…' : 'Executar Predição'}
                </button>
              </form>

              <AnimatePresence>
                {predResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 space-y-2"
                  >
                    <p className="text-violet-300 text-[10px] font-medium uppercase tracking-wider">Resultado</p>
                    <div className="space-y-1">
                      {Object.entries(predResult).map(([k, v]) => {
                        if (k === 'drivers' || k === 'top_factors' || k === 'price_range') {
                          const displayVal = Array.isArray(v)
                            ? v.join(', ')
                            : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
                          return (
                            <div key={k} className="flex justify-between text-xs">
                              <span className="text-white/40">{k}</span>
                              <span className="text-white/70 text-right max-w-[60%] text-[10px]">{displayVal}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-white/40">{k}</span>
                            <span className="text-white font-semibold">{typeof v === 'number' ? v.toLocaleString('pt-PT') : String(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {tab === 'predictions' && (
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="grid grid-cols-5 gap-0 px-4 py-2.5 border-b border-white/5 text-[10px] text-white/30 font-medium uppercase tracking-wider">
            <span className="col-span-2">Modelo</span>
            <span>Entidade</span>
            <span>Confiança</span>
            <span>Latência</span>
          </div>
          {loading ? (
            <p className="text-white/30 text-xs text-center py-10">A carregar predições…</p>
          ) : predictions.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-10">Nenhuma predição registada</p>
          ) : (
            <div className="divide-y divide-white/3 max-h-96 overflow-y-auto">
              {predictions.map((pred) => (
                <div key={pred.id} className="grid grid-cols-5 gap-0 px-4 py-2.5 hover:bg-white/3 transition-colors">
                  <span className="col-span-2 text-xs text-white/70 truncate">
                    {pred.omega_x_ml_models?.name ?? '—'}
                  </span>
                  <span className="text-xs text-white/50 truncate">
                    {pred.entity_type ? `${pred.entity_type}${pred.entity_id ? ` #${pred.entity_id}` : ''}` : '—'}
                  </span>
                  <span className="text-xs text-white/60">
                    {pred.confidence != null ? `${(pred.confidence * 100).toFixed(0)}%` : '—'}
                  </span>
                  <span className="text-xs text-white/40">
                    {pred.latency_ms != null ? `${pred.latency_ms}ms` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Register Modal */}
      <AnimatePresence>
        {showRegister && (
          <RegisterModal
            onClose={() => setShowRegister(false)}
            onRegistered={() => { setShowRegister(false); loadModels(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
