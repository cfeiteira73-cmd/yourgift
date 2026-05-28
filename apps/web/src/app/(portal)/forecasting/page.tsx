'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveData {
  revenue: {
    last30: number; last60: number; last90: number;
    avg_monthly: number; trend_pct: number;
  };
  orders: { count30: number; count60: number };
  clients: { total: number; at_risk: number; healthy: number };
  pipeline: { value: number; count: number };
  churn: { avg_probability: number };
}

interface Projections {
  next30d: number;
  next60d: number;
  next90d: number;
  confidence: 'low' | 'medium' | 'high';
}

interface Signals {
  pipeline_value: number;
  pipeline_conversion_est: number;
  at_risk_clients: number;
  churn_risk_revenue_est: number;
}

interface Summary {
  live: LiveData;
  projections: Projections;
  signals: Signals;
}

interface Forecasts {
  revenue: string;
  churn: string;
  strategy: string;
  generated_at: string;
}

function fmt(n: number) {
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function TrendBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
      positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ScenarioModal({ live, onClose }: { live: LiveData; onClose: () => void }) {
  const [scenario, setScenario] = useState('');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);

  async function run() {
    if (!scenario) return;
    setRunning(true);
    try {
      const res = await fetch('/api/forecasting', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'scenario', scenario }),
      });
      const d = await res.json();
      setResult(d.analysis ?? '');
    } finally {
      setRunning(false);
    }
  }

  const SCENARIOS = [
    'Ganhar 5 novos clientes enterprise no próximo mês',
    'Perder o nosso maior cliente (20% da receita)',
    'Aumentar preços em 10% em Julho',
    'Lançar novo produto no Q3',
    'Entrada de um concorrente directo no mercado português',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-sm font-semibold">Análise de Cenário What-If</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <div>
          <label className="text-white/50 text-[10px] uppercase tracking-wider">Descreve o Cenário</label>
          <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={3}
            placeholder="Ex: O que acontece se perdermos o nosso maior cliente?"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map(s => (
            <button type="button" key={s}  onClick={() => setScenario(s)}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-[9px] transition-colors">
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={run} disabled={running || !scenario}
          className="w-full py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A analisar…
            </span>
          ) : '🔮 Analisar Cenário'}
        </button>
        {result && (
          <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 p-4">
            <p className="text-violet-400 text-[10px] font-medium mb-2">Análise AI</p>
            <p className="text-white/70 text-xs leading-relaxed">{result}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ForecastingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forecasts, setForecasts] = useState<Forecasts | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showScenario, setShowScenario] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/forecasting?mode=summary');
      const d = await res.json();
      setSummary(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runForecasts() {
    setRunning(true);
    try {
      const res = await fetch('/api/forecasting', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const d = await res.json();
      setForecasts(d.forecasts);
    } finally {
      setRunning(false);
    }
  }

  const live = summary?.live;
  const proj = summary?.projections;
  const signals = summary?.signals;

  const CONF_COLORS = { low: 'text-amber-400', medium: 'text-blue-400', high: 'text-emerald-400' };

  return (
    <div className="p-6 space-y-5 min-h-full">
      {showScenario && summary && <ScenarioModal live={summary.live} onClose={() => setShowScenario(false)} />}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">AI Forecasting Engine</h1>
          <p className="text-white/40 text-xs mt-0.5">Previsões de receita · Risco de churn · Estratégia AI</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowScenario(true)}
            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
            🔮 What-If
          </button>
          <button type="button" onClick={runForecasts} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {running ? (
              <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />A prever…</>
            ) : '✨ Gerar Previsões AI'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Receita Últ. 30d', value: live ? fmt(live.revenue.last30) : '—', color: 'text-emerald-400', extra: live ? <TrendBadge pct={live.revenue.trend_pct} /> : null },
          { label: 'Receita Média/Mês', value: live ? fmt(live.revenue.avg_monthly) : '—', color: 'text-white' },
          { label: 'Pipeline Total', value: signals ? fmt(signals.pipeline_value) : '—', color: 'text-blue-400' },
          { label: 'Clientes em Risco', value: live?.clients.at_risk ?? '—', color: 'text-amber-400' },
        ].map(({ label, value, color, extra }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <div className="flex items-center gap-2 mb-1">
              <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
              {extra}
            </div>
            <p className="text-white/40 text-[10px]">{label}</p>
          </div>
        ))}
      </div>

      {/* Projections */}
      {proj && (
        <div>
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-3">
            Projeções de Receita · Confiança: <span className={CONF_COLORS[proj.confidence]}>{proj.confidence}</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Próximos 30 dias', value: proj.next30d, color: 'text-emerald-400', border: 'border-emerald-500/20' },
              { label: 'Próximos 60 dias', value: proj.next60d, color: 'text-blue-400', border: 'border-blue-500/20' },
              { label: 'Próximos 90 dias', value: proj.next90d, color: 'text-violet-400', border: 'border-violet-500/20' },
            ].map(({ label, value, color, border }) => (
              <div key={label} className={`rounded-2xl border ${border} bg-white/3 p-5`}>
                <p className={`text-3xl font-bold ${color}`}>{fmt(value)}</p>
                <p className="text-white/40 text-xs mt-2">{label}</p>
                {live && (
                  <p className={`text-[10px] mt-1 ${value > live.revenue.last30 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {value > live.revenue.last30 ? '▲' : '▼'} {Math.abs(((value - live.revenue.last30) / Math.max(live.revenue.last30, 1)) * 100).toFixed(0)}% vs atual
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals */}
      {signals && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '💼 Pipeline — Conversão Estimada (35%)', value: fmt(signals.pipeline_conversion_est), sub: `${signals.pipeline_value > 0 ? fmt(signals.pipeline_value) : '—'} total em orçamentos abertos`, color: 'text-blue-400' },
            { label: '⚠️ Receita em Risco de Churn', value: fmt(signals.churn_risk_revenue_est), sub: `${signals.at_risk_clients} clientes com risco alto/crítico`, color: 'text-amber-400' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
              <p className="text-white/50 text-[10px] mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-white/30 text-[10px] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Forecasts */}
      <AnimatePresence>
        {forecasts && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Análise AI · Gerado {new Date(forecasts.generated_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '📈', label: 'Previsão de Receita', content: forecasts.revenue, color: 'border-emerald-500/20 bg-emerald-500/5' },
                { icon: '⚠️', label: 'Análise de Churn', content: forecasts.churn, color: 'border-amber-500/20 bg-amber-500/5' },
                { icon: '🎯', label: 'Recomendação Estratégica', content: forecasts.strategy, color: 'border-violet-500/20 bg-violet-500/5' },
              ].map(({ icon, label, content, color }) => (
                <div key={label} className={`rounded-2xl border ${color} p-4 space-y-2`}>
                  <p className="text-white/60 text-[10px] font-medium">{icon} {label}</p>
                  <p className="text-white/70 text-xs leading-relaxed">{content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!forecasts && !running && (
        <div className="rounded-2xl border border-white/5 bg-white/3 p-8 text-center space-y-3">
          <p className="text-3xl">🔮</p>
          <p className="text-white/40 text-xs">Clica em "Gerar Previsões AI" para análise de receita, churn e estratégia</p>
        </div>
      )}
    </div>
  );
}
