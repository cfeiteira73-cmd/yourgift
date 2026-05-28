'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HealthScore {
  id: string;
  client_id: string;
  client_email: string | null;
  overall_score: number;
  revenue_score: number;
  engagement_score: number;
  payment_score: number;
  growth_score: number;
  risk_level: string;
  churn_probability: number;
  next_action: string | null;
  ai_summary: string | null;
  scored_at: string;
}

interface MaturityScore {
  id: string;
  dimension: string;
  score: number;
  status: string;
  notes: string | null;
  scored_at: string;
}

interface RealityCheck {
  checks: Array<{ dimension: string; status: string; evidence: string; score: number }>;
  overall_score: number;
  generated_at: string;
}

const RISK_STYLES: Record<string, string> = {
  low:      'bg-emerald-500/15 text-emerald-400',
  medium:   'bg-amber-500/15 text-amber-400',
  high:     'bg-orange-500/15 text-orange-400',
  critical: 'bg-red-500/15 text-red-400',
};

const STATUS_STYLES: Record<string, string> = {
  production_proven: 'bg-emerald-500/15 text-emerald-400',
  validated:         'bg-blue-500/15 text-blue-400',
  simulated:         'bg-amber-500/15 text-amber-400',
  theoretical:       'bg-white/10 text-white/40',
};

const STATUS_LABELS: Record<string, string> = {
  production_proven: 'Produção',
  validated:         'Validado',
  simulated:         'Simulado',
  theoretical:       'Teórico',
};

function ScoreBar({ value, label, color = 'bg-blue-500' }: { value: number; label: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/70 font-medium">{value}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function IntelPage() {
  const [tab, setTab] = useState<'health' | 'maturity' | 'reality'>('health');
  const [healthScores, setHealthScores] = useState<HealthScore[]>([]);
  const [maturityScores, setMaturityScores] = useState<MaturityScore[]>([]);
  const [maturityOverall, setMaturityOverall] = useState(0);
  const [reality, setReality] = useState<RealityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<HealthScore | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [scoring, setScoring] = useState(false);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [avgScore, setAvgScore] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, maturityRes, realityRes] = await Promise.all([
        fetch(`/api/intel?mode=health_scores${riskFilter !== 'all' ? `&risk=${riskFilter}` : ''}`),
        fetch('/api/intel?mode=maturity'),
        fetch('/api/intel?mode=reality_check'),
      ]);
      const [hd, md, rd] = await Promise.all([healthRes.json(), maturityRes.json(), realityRes.json()]);
      setHealthScores(hd.scores ?? []);
      setDistribution(hd.distribution ?? {});
      setAvgScore(hd.avg_score ?? 0);
      setMaturityScores(md.scores ?? []);
      setMaturityOverall(md.overall_maturity ?? 0);
      setReality(rd);
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  useEffect(() => { load(); }, [load]);

  async function scoreAll() {
    setScoring(true);
    await fetch('/api/intel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'score_all' }),
    });
    setScoring(false);
    load();
  }

  async function generateRealityReport() {
    await fetch('/api/intel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reality_report' }),
    });
    load();
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Intelligence Layer</h1>
          <p className="text-white/40 text-xs mt-0.5">Customer health · platform maturity · reality validation</p>
        </div>
        <div className="flex gap-2">
          {(['health', 'maturity', 'reality'] as const).map(t => (
            <button type="button" key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {t === 'health' ? 'Customer Health' : t === 'maturity' ? 'Maturidade' : 'Reality Check'}
            </button>
          ))}
        </div>
      </div>

      {/* ── HEALTH TAB ── */}
      {tab === 'health' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/3 p-4">
              <p className="text-2xl font-bold text-white">{avgScore}</p>
              <p className="text-white/40 text-[10px] mt-1">Score médio</p>
            </div>
            {(['low', 'medium', 'high', 'critical'] as const).map((risk, i) => {
              const colors = ['text-emerald-400', 'text-amber-400', 'text-orange-400', 'text-red-400'];
              return (
                <button type="button" key={risk} type="button"
                  onClick={() => setRiskFilter(riskFilter === risk ? 'all' : risk)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    riskFilter === risk ? 'border-white/20 bg-white/8' : 'border-white/5 bg-white/3 hover:bg-white/5'
                  }`}>
                  <p className={`text-2xl font-bold ${colors[i]}`}>{distribution[risk] ?? 0}</p>
                  <p className="text-white/40 text-[10px] mt-1 capitalize">{risk}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-white/40 text-xs">
              {healthScores.length} clientes scored
              {riskFilter !== 'all' && ` · filtro: ${riskFilter}`}
            </p>
            <button type="button" onClick={scoreAll} disabled={scoring}
              className="px-3 py-1.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
              {scoring ? 'A calcular scores…' : '⚡ Score All Clients'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-2">
              {loading ? (
                <p className="text-white/30 text-xs text-center py-10">A carregar…</p>
              ) : healthScores.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/3 p-8 text-center space-y-3">
                  <p className="text-white/30 text-xs">Sem scores calculados</p>
                  <button type="button" onClick={scoreAll} disabled={scoring}
                    className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
                    Calcular scores agora
                  </button>
                </div>
              ) : healthScores.map(s => (
                <motion.button key={s.id} type="button" whileHover={{ x: 2 }}
                  onClick={() => setSelectedClient(s)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    selectedClient?.id === s.id ? 'border-white/20 bg-white/8' : 'border-white/5 bg-white/3 hover:bg-white/5'
                  }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`text-lg font-black w-12 text-center tabular-nums ${
                        s.overall_score >= 70 ? 'text-emerald-400' :
                        s.overall_score >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {s.overall_score}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {s.client_email ?? `Client ${s.client_id.slice(0, 8)}`}
                        </p>
                        <p className="text-white/40 text-[10px] truncate">{s.next_action}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${RISK_STYLES[s.risk_level] ?? ''}`}>
                      {s.risk_level}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Client detail */}
            <div>
              <AnimatePresence mode="wait">
                {selectedClient ? (
                  <motion.div key={selectedClient.id}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                    <div>
                      <p className="text-white text-xs font-semibold">{selectedClient.client_email ?? selectedClient.client_id}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_STYLES[selectedClient.risk_level]}`}>
                          {selectedClient.risk_level}
                        </span>
                        <span className="text-white/30 text-[10px]">
                          churn {(selectedClient.churn_probability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <ScoreBar value={selectedClient.overall_score} label="Score geral"
                        color={selectedClient.overall_score >= 70 ? 'bg-emerald-500' : selectedClient.overall_score >= 50 ? 'bg-amber-500' : 'bg-red-500'} />
                      <ScoreBar value={selectedClient.revenue_score} label="Revenue" color="bg-violet-500" />
                      <ScoreBar value={selectedClient.engagement_score} label="Engagement" color="bg-blue-500" />
                      <ScoreBar value={selectedClient.payment_score} label="Pagamentos" color="bg-emerald-500" />
                      <ScoreBar value={selectedClient.growth_score} label="Crescimento" color="bg-orange-500" />
                    </div>

                    {selectedClient.next_action && (
                      <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
                        <p className="text-violet-300 text-[9px] font-medium uppercase tracking-wider mb-1">Próxima Acção</p>
                        <p className="text-white/70 text-[10px]">{selectedClient.next_action}</p>
                      </div>
                    )}

                    {selectedClient.ai_summary && (
                      <p className="text-white/50 text-[10px] leading-relaxed border-t border-white/5 pt-3">
                        {selectedClient.ai_summary}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-2xl border border-white/5 bg-white/3 p-8 flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl">🎯</div>
                    <p className="text-white/30 text-xs text-center">Seleciona um cliente</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* ── MATURITY TAB ── */}
      {tab === 'maturity' && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-white/5 bg-white/3 px-6 py-4">
              <p className={`text-3xl font-black ${
                maturityOverall >= 80 ? 'text-emerald-400' :
                maturityOverall >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{maturityOverall}/100</p>
              <p className="text-white/40 text-[10px] mt-1">Maturidade geral da plataforma</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <span key={status} className={`text-[10px] px-2 py-1 rounded-full ${STATUS_STYLES[status]}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {maturityScores.map(score => (
              <div key={score.id} className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs font-semibold capitalize">{score.dimension}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[score.status] ?? ''}`}>
                    {STATUS_LABELS[score.status] ?? score.status}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Score</span>
                    <span className="text-white font-bold">{score.score}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score.score}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        score.score >= 80 ? 'bg-emerald-500' :
                        score.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
                {score.notes && <p className="text-white/40 text-[10px] leading-relaxed">{score.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REALITY CHECK TAB ── */}
      {tab === 'reality' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {reality && (
                <div className="rounded-xl border border-white/5 bg-white/3 px-6 py-4">
                  <p className={`text-3xl font-black ${
                    reality.overall_score >= 80 ? 'text-emerald-400' :
                    reality.overall_score >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>{reality.overall_score}/100</p>
                  <p className="text-white/40 text-[10px] mt-1">Reality score</p>
                </div>
              )}
              <div className="text-white/30 text-xs">
                <p>O que está provado vs simulado vs teórico</p>
                {reality?.generated_at && (
                  <p className="text-[10px] mt-0.5">Gerado: {new Date(reality.generated_at).toLocaleString('pt-PT')}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={generateRealityReport}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-white/40 text-xs transition-colors">
              Regenerar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(reality?.checks ?? []).map(check => (
              <div key={check.dimension} className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs font-semibold">{check.dimension}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[check.status] ?? ''}`}>
                    {STATUS_LABELS[check.status] ?? check.status}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${check.score}%` }}
                    transition={{ duration: 0.7 }}
                    className={`h-full rounded-full ${check.score >= 80 ? 'bg-emerald-500' : check.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                </div>
                <p className="text-white/40 text-[10px]">{check.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
