'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SupplyRisk {
  id: string;
  title: string;
  risk_type: string;
  severity: string;
  status: string;
  affected_supplier: string | null;
  affected_product: string | null;
  probability: number | null;
  impact_score: number | null;
  mitigation_plan: string | null;
  ai_analysis: string | null;
  detected_at: string;
  created_at: string;
}

interface Scorecard {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  overall_score: number;
  quality_score: number | null;
  delivery_score: number | null;
  price_score: number | null;
  reliability_score: number | null;
  risk_level: string | null;
  ai_narrative: string | null;
  computed_at: string;
}

interface Dashboard {
  health_score: number;
  total_risks: number;
  critical_risks: number;
  active_suppliers: number;
  avg_supplier_score: number;
  risks: SupplyRisk[];
  scorecards: Scorecard[];
}

const SEVERITY_META: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'Crítico',  color: 'bg-red-500/15 text-red-400',    dot: 'bg-red-500' },
  high:     { label: 'Alto',     color: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-500' },
  medium:   { label: 'Médio',    color: 'bg-yellow-500/15 text-yellow-400', dot: 'bg-yellow-400' },
  low:      { label: 'Baixo',    color: 'bg-blue-500/15 text-blue-400',   dot: 'bg-blue-400' },
};

const STATUS_META: Record<string, string> = {
  active:     'bg-red-500/15 text-red-400',
  monitoring: 'bg-amber-500/15 text-amber-400',
  mitigating: 'bg-blue-500/15 text-blue-400',
  resolved:   'bg-emerald-500/15 text-emerald-400',
  dismissed:  'bg-white/10 text-white/30',
};

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/60">{pct}/100</span>
      </div>
      <div className="h-1 rounded-full bg-white/10">
        <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x={45} y={49} textAnchor="middle" fill="white" fontSize={16} fontWeight="700">{score}</text>
      </svg>
      <p className="text-white/40 text-[9px] mt-1">Health Score</p>
    </div>
  );
}

export default function ControlTowerPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState<SupplyRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [mitigating, setMitigating] = useState('');
  const [tab, setTab] = useState<'risks' | 'scorecards'>('risks');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supply-chain?mode=dashboard');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function requestMitigation(riskId: string) {
    setMitigating(riskId);
    try {
      await fetch('/api/supply-chain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ai_mitigate', risk_id: riskId }),
      });
      load();
    } finally {
      setMitigating('');
    }
  }

  async function updateRiskStatus(riskId: string, status: string) {
    await fetch('/api/supply-chain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_risk', risk_id: riskId, status }),
    });
    load();
    setSelected(null);
  }

  const risks = data?.risks ?? [];
  const scorecards = data?.scorecards ?? [];
  const health = data?.health_score ?? 0;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Supply Chain Control Tower</h1>
          <p className="text-white/40 text-xs mt-0.5">Riscos em tempo real · Scorecards de fornecedor · AI Mitigation</p>
        </div>
        <button type="button" onClick={load}
          className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/3 p-4 flex items-center justify-center">
          <HealthGauge score={health} />
        </div>
        {[
          { label: 'Riscos Ativos', value: data?.total_risks ?? '—', color: 'text-white' },
          { label: 'Riscos Críticos', value: data?.critical_risks ?? '—', color: data && data.critical_risks > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Fornecedores', value: data?.active_suppliers ?? '—', color: 'text-blue-400' },
          { label: 'Score Médio', value: data ? `${Math.round(data.avg_supplier_score)}/100` : '—', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {(['risks', 'scorecards'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === t ? 'text-white bg-white/8 border-b-2 border-blue-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {t === 'risks' ? `Riscos (${risks.length})` : `Scorecards (${scorecards.length})`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'risks' && (
          <motion.div key="risks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-5">
            {/* Risk list */}
            <div className="col-span-1 space-y-2">
              {risks.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/3 p-8 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-white/30 text-xs">Sem riscos ativos</p>
                </div>
              ) : risks.filter(r => r.status !== 'dismissed').map(r => {
                const sev = SEVERITY_META[r.severity] ?? SEVERITY_META.medium;
                return (
                  <motion.button key={r.id} type="button" whileHover={{ x: 2 }}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                      selected?.id === r.id ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                        <span className="text-white text-[10px] font-medium truncate">{r.title}</span>
                      </div>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_META[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.affected_supplier && (
                      <p className="text-white/40 text-[9px]">🏭 {r.affected_supplier}</p>
                    )}
                    <div className="flex gap-2 text-[9px] text-white/25">
                      <span className={sev.color.split(' ')[1]}>{r.severity}</span>
                      {r.probability != null && <span>{r.probability}% prob.</span>}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Risk detail */}
            <div className="col-span-2">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div key={selected.id}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-semibold">{selected.title}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_META[selected.severity]?.color ?? ''}`}>
                            {selected.severity}
                          </span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_META[selected.status] ?? ''}`}>
                            {selected.status}
                          </span>
                        </div>
                      </div>
                      {selected.impact_score != null && (
                        <div className="text-right">
                          <p className="text-white/40 text-[9px]">Impact</p>
                          <p className="text-white font-bold">{selected.impact_score}/10</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      {[
                        { label: 'Fornecedor', value: selected.affected_supplier ?? '—' },
                        { label: 'Produto', value: selected.affected_product ?? '—' },
                        { label: 'Probabilidade', value: selected.probability != null ? `${selected.probability}%` : '—' },
                        { label: 'Tipo de Risco', value: selected.risk_type },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg bg-white/5 p-2.5">
                          <p className="text-white/40 mb-0.5">{label}</p>
                          <p className="text-white font-medium">{value}</p>
                        </div>
                      ))}
                    </div>

                    {selected.mitigation_plan && (
                      <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3">
                        <p className="text-blue-400 text-[10px] font-medium mb-1.5">📋 Plano de Mitigação</p>
                        <p className="text-white/70 text-xs leading-relaxed">{selected.mitigation_plan}</p>
                      </div>
                    )}

                    {selected.ai_analysis && (
                      <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 p-3">
                        <p className="text-violet-400 text-[10px] font-medium mb-1.5">🤖 Análise AI</p>
                        <p className="text-white/70 text-xs leading-relaxed">{selected.ai_analysis}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button type="button"
                        onClick={() => requestMitigation(selected.id)}
                        disabled={mitigating === selected.id}
                        className="px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 text-violet-400 text-[10px] font-medium transition-colors disabled:opacity-50">
                        {mitigating === selected.id ? 'A gerar…' : '✨ Gerar Mitigação AI'}
                      </button>
                      {['monitoring', 'mitigating', 'resolved'].map(s => (
                        <button key={s} type="button"
                          onClick={() => updateRiskStatus(selected.id, s)}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ${
                            selected.status === s ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 hover:bg-white/5 text-white/40'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="text-4xl">🗼</div>
                    <p className="text-white/30 text-xs">Seleciona um risco para ver detalhes e mitigação AI</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {tab === 'scorecards' && (
          <motion.div key="scorecards" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-4">
            {scorecards.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-white/5 bg-white/3 p-8 text-center">
                <p className="text-white/30 text-xs">Sem scorecards · Gera via Supply Chain → Scorecards</p>
              </div>
            ) : scorecards.map(s => (
              <div key={s.id} className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xs font-semibold">{s.supplier_name ?? `Fornecedor ${s.supplier_id.slice(0, 8)}`}</p>
                    {s.risk_level && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_META[s.risk_level]?.color ?? ''}`}>
                        {s.risk_level}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-xl font-bold ${s.overall_score >= 80 ? 'text-emerald-400' : s.overall_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {s.overall_score}
                    </p>
                    <p className="text-white/30 text-[9px]">score</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <ScoreBar score={s.quality_score} label="Qualidade" />
                  <ScoreBar score={s.delivery_score} label="Entrega" />
                  <ScoreBar score={s.price_score} label="Preço" />
                  <ScoreBar score={s.reliability_score} label="Fiabilidade" />
                </div>
                {s.ai_narrative && (
                  <p className="text-white/40 text-[9px] leading-relaxed border-t border-white/5 pt-2">
                    {s.ai_narrative.slice(0, 120)}…
                  </p>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
