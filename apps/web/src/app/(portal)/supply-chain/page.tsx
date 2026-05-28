'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, springSnappy } from '@/lib/motion';

// ── OMEGA X — S7: Supply Chain Command Center ─────────────────────────────────

type Risk = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  risk_type: string;
  severity: string;
  title: string;
  description: string | null;
  affected_skus: string[] | null;
  probability: number | null;
  impact_score: number | null;
  risk_score: number | null;
  mitigation: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
};

type Alternative = {
  id: string;
  risk_id: string;
  alt_supplier_name: string;
  price_delta_pct: number | null;
  lead_time_days: number | null;
  quality_score: number | null;
  ai_recommendation: string | null;
  status: string;
};

type Scorecard = {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  period: string;
  on_time_rate: number | null;
  quality_score: number | null;
  price_index: number | null;
  responsiveness: number | null;
  overall_score: number | null;
  ai_summary: string | null;
};

type Dashboard = {
  summary: {
    total_risks: number; open_risks: number; critical_risks: number;
    avg_risk_score: number; resilience_score: number;
    alternatives_pending: number; scorecards_count: number;
  };
  risks_by_type: Record<string, number>;
  top_risks: Risk[];
  recent_scorecards: Scorecard[];
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-500/20 text-red-300',
  mitigating: 'bg-amber-500/20 text-amber-300',
  resolved: 'bg-emerald-500/20 text-emerald-300',
  dismissed: 'bg-white/10 text-white/40',
};

const RISK_TYPE_ICON: Record<string, string> = {
  geo_political: '🌍', logistics: '🚢', financial: '💰',
  quality: '🔬', capacity: '⚡', weather: '🌩️', regulatory: '📋',
};

function ResilienceGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="80" height="80" className="transform -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="40" y="45" textAnchor="middle" className="rotate-90"
        style={{ transform: 'rotate(90deg) translate(0px,-80px)', fill: color, fontSize: 18, fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

export default function SupplyChainPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [view, setView] = useState<'dashboard' | 'risks' | 'scorecards'>('dashboard');
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [mitigating, setMitigating] = useState<string | null>(null);

  // New risk form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    supplier_name: '', risk_type: 'logistics', severity: 'medium',
    title: '', description: '', probability: '0.5', impact_score: '50',
  });

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/supply-chain?mode=dashboard');
      if (res.ok) setDashboard(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadRisks = useCallback(async () => {
    try {
      const res = await fetch(`/api/supply-chain?mode=risks&status=${statusFilter}`);
      if (res.ok) {
        const d = await res.json();
        setRisks(d.risks ?? []);
      }
    } catch { /* ignore */ }
  }, [statusFilter]);

  const loadScorecards = useCallback(async () => {
    try {
      const res = await fetch('/api/supply-chain?mode=scorecards');
      if (res.ok) {
        const d = await res.json();
        setScorecards(d.scorecards ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadRiskDetail = useCallback(async (risk: Risk) => {
    setSelectedRisk(risk);
    try {
      const res = await fetch(`/api/supply-chain?mode=risk&id=${risk.id}`);
      if (res.ok) {
        const d = await res.json();
        setAlternatives(d.alternatives ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDashboard(), loadRisks()]).finally(() => setLoading(false));
  }, [loadDashboard, loadRisks]);

  useEffect(() => {
    if (view === 'scorecards') loadScorecards();
  }, [view, loadScorecards]);

  async function createRisk() {
    setCreating(true);
    try {
      await fetch('/api/supply-chain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_risk', ...form,
          probability: Number(form.probability), impact_score: Number(form.impact_score) }),
      });
      setShowCreate(false);
      setForm({ supplier_name: '', risk_type: 'logistics', severity: 'medium',
        title: '', description: '', probability: '0.5', impact_score: '50' });
      await Promise.all([loadDashboard(), loadRisks()]);
    } finally { setCreating(false); }
  }

  async function handleMitigate(riskId: string) {
    setMitigating(riskId);
    try {
      const res = await fetch('/api/supply-chain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ai_mitigate', id: riskId }),
      });
      if (res.ok) {
        const d = await res.json();
        if (selectedRisk?.id === riskId) {
          setSelectedRisk(prev => prev ? { ...prev, mitigation: d.plan?.mitigation_summary ?? prev.mitigation } : prev);
        }
      }
    } finally { setMitigating(null); }
  }

  async function resolveRisk(riskId: string) {
    await fetch('/api/supply-chain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_risk', id: riskId, status: 'resolved' }),
    });
    await Promise.all([loadDashboard(), loadRisks()]);
    if (selectedRisk?.id === riskId) setSelectedRisk(null);
  }

  if (loading) return null;

  const dash = dashboard;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex gap-4 items-center">
          {dash && (
            <div className="relative w-20 h-20 flex items-center justify-center">
              <ResilienceGauge score={dash.summary.resilience_score} />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/70 mt-1">
                {/* score shown in SVG */}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white">Supply Chain</h1>
            <p className="text-xs text-white/40 mt-0.5">Resilience score {dash?.summary.resilience_score ?? '—'}/100</p>
            {dash && dash.summary.critical_risks > 0 && (
              <p className="text-xs text-red-400 font-medium mt-0.5">
                ⚠ {dash.summary.critical_risks} risco{dash.summary.critical_risks > 1 ? 's' : ''} crítico{dash.summary.critical_risks > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(['dashboard', 'risks', 'scorecards'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                view === v ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40 hover:text-white/70'}`}>
              {v === 'dashboard' ? 'Dashboard' : v === 'risks' ? 'Riscos' : 'Scorecards'}
            </button>
          ))}
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors">
            + Novo Risco
          </button>
        </div>
      </div>

      {/* Dashboard view */}
      {view === 'dashboard' && dash && (
        <motion.div {...fadeUp} className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Riscos abertos', value: dash.summary.open_risks, color: dash.summary.open_risks > 0 ? 'text-red-300' : 'text-emerald-300' },
              { label: 'Críticos', value: dash.summary.critical_risks, color: dash.summary.critical_risks > 0 ? 'text-red-400' : 'text-white/60' },
              { label: 'Score médio risco', value: `${dash.summary.avg_risk_score}/100`, color: 'text-amber-300' },
              { label: 'Alternativas pendentes', value: dash.summary.alternatives_pending, color: 'text-blue-300' },
              { label: 'Scorecards', value: dash.summary.scorecards_count, color: 'text-white/60' },
            ].map((kpi, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/5 bg-white/3 p-4">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-white/40 mt-1">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Risk by type + top risks */}
          <div className="grid grid-cols-2 gap-4">
            {/* By type */}
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">Riscos por Tipo</p>
              <div className="space-y-2">
                {Object.entries(dash.risks_by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-base">{RISK_TYPE_ICON[type] ?? '⚠'}</span>
                    <span className="text-xs text-white/60 capitalize flex-1">
                      {type.replace('_', ' ')}
                    </span>
                    <div className="flex-1 bg-white/5 rounded-full h-1.5">
                      <div className="bg-amber-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, count * 25)}%` }} />
                    </div>
                    <span className="text-xs text-white/50 w-4 text-right">{count}</span>
                  </div>
                ))}
                {Object.keys(dash.risks_by_type).length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">Sem riscos activos</p>
                )}
              </div>
            </div>

            {/* Top risks */}
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">Top Riscos</p>
              <div className="space-y-2">
                {dash.top_risks.map(risk => (
                  <button key={risk.id} onClick={() => { setView('risks'); loadRiskDetail(risk); }}
                    className="w-full text-left rounded-xl bg-white/3 border border-white/5 p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-white/80 line-clamp-1">{risk.title}</p>
                        <p className="text-xs text-white/40 mt-0.5">{risk.supplier_name ?? 'Fornecedor desconhecido'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs border shrink-0 ${SEVERITY_COLOR[risk.severity]}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-white/5 rounded-full h-1">
                        <div className="bg-red-400 h-1 rounded-full" style={{ width: `${risk.risk_score ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-white/40">{risk.risk_score}/100</span>
                    </div>
                  </button>
                ))}
                {dash.top_risks.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">✅ Sem riscos activos</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Risks view */}
      {view === 'risks' && (
        <motion.div {...fadeUp} className="flex gap-4">
          {/* Risk list */}
          <div className="flex-1 space-y-3">
            {/* Filter */}
            <div className="flex gap-2">
              {['open', 'mitigating', 'resolved', 'all'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    statusFilter === s ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40 hover:text-white/60'}`}>
                  {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {risks.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/3 p-12 text-center">
                <p className="text-3xl mb-3">✅</p>
                <p className="text-sm text-white/50">Sem riscos com status "{statusFilter}"</p>
              </div>
            )}

            {risks.map((risk, i) => (
              <motion.button key={risk.id} {...fadeUp} transition={{ delay: i * 0.04 }}
                onClick={() => loadRiskDetail(risk)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  selectedRisk?.id === risk.id
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-white/5 bg-white/3 hover:border-white/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{RISK_TYPE_ICON[risk.risk_type] ?? '⚠'}</span>
                      <p className="text-sm font-medium text-white/90 truncate">{risk.title}</p>
                    </div>
                    {risk.supplier_name && (
                      <p className="text-xs text-white/40 mt-0.5 ml-6">{risk.supplier_name}</p>
                    )}
                    {risk.affected_skus && risk.affected_skus.length > 0 && (
                      <p className="text-xs text-white/30 mt-0.5 ml-6">
                        SKUs: {risk.affected_skus.slice(0, 3).join(', ')}{risk.affected_skus.length > 3 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${SEVERITY_COLOR[risk.severity]}`}>
                      {risk.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[risk.status]}`}>
                      {risk.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${risk.risk_score ?? 0}%` }} />
                  </div>
                  <span className="text-xs text-white/40 w-14 text-right">Score {risk.risk_score}/100</span>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Risk detail panel */}
          <AnimatePresence>
            {selectedRisk && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }} transition={springSnappy}
                className="w-96 shrink-0 rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4 self-start">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/90">{selectedRisk.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{selectedRisk.supplier_name ?? '—'}</p>
                  </div>
                  <button onClick={() => setSelectedRisk(null)} className="text-white/30 hover:text-white/60 text-lg">×</button>
                </div>

                {selectedRisk.description && (
                  <p className="text-xs text-white/60 leading-relaxed">{selectedRisk.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: 'Probabilidade', v: `${Math.round(Number(selectedRisk.probability ?? 0) * 100)}%` },
                    { l: 'Impacto', v: `${selectedRisk.impact_score}/100` },
                    { l: 'Score Risco', v: `${selectedRisk.risk_score}/100` },
                    { l: 'Tipo', v: selectedRisk.risk_type.replace('_', ' ') },
                  ].map(m => (
                    <div key={m.l} className="rounded-lg bg-white/3 p-2.5">
                      <p className="text-xs text-white/30">{m.l}</p>
                      <p className="text-sm font-semibold text-white/80 mt-0.5">{m.v}</p>
                    </div>
                  ))}
                </div>

                {/* Mitigation */}
                {selectedRisk.mitigation ? (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs font-medium text-amber-300 mb-1.5">🛡 Mitigação</p>
                    <p className="text-xs text-white/60 leading-relaxed">{selectedRisk.mitigation}</p>
                  </div>
                ) : (
                  <button onClick={() => handleMitigate(selectedRisk.id)}
                    disabled={mitigating === selectedRisk.id}
                    className="w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                    {mitigating === selectedRisk.id ? '✨ A gerar plano...' : '✨ Gerar plano AI'}
                  </button>
                )}

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-white/50 mb-2">Alternativas ({alternatives.length})</p>
                    <div className="space-y-2">
                      {alternatives.map(alt => (
                        <div key={alt.id} className="rounded-lg bg-white/3 border border-white/5 p-2.5">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-medium text-white/80">{alt.alt_supplier_name}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              alt.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
                              {alt.status}
                            </span>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-xs text-white/40">
                            {alt.quality_score != null && <span>Q: {alt.quality_score}</span>}
                            {alt.price_delta_pct != null && (
                              <span className={Number(alt.price_delta_pct) <= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {Number(alt.price_delta_pct) > 0 ? '+' : ''}{alt.price_delta_pct}%
                              </span>
                            )}
                            {alt.lead_time_days != null && <span>{alt.lead_time_days}d</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRisk.status !== 'resolved' && (
                  <button onClick={() => resolveRisk(selectedRisk.id)}
                    className="w-full py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors">
                    ✅ Marcar como Resolvido
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Scorecards view */}
      {view === 'scorecards' && (
        <motion.div {...fadeUp}>
          {scorecards.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm text-white/50">Nenhum scorecard gerado ainda</p>
              <p className="text-xs text-white/30 mt-1">Use POST /api/supply-chain action:generate_scorecard</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {scorecards.map((sc, i) => (
                <motion.div key={sc.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-white/5 bg-white/3 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white/90">{sc.supplier_name ?? sc.supplier_id}</p>
                      <p className="text-xs text-white/40 mt-0.5">{sc.period}</p>
                    </div>
                    <div className={`text-xl font-bold ${
                      Number(sc.overall_score) >= 80 ? 'text-emerald-400'
                      : Number(sc.overall_score) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {sc.overall_score != null ? Number(sc.overall_score).toFixed(0) : '—'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { l: 'On-time', v: sc.on_time_rate, unit: '%' },
                      { l: 'Qualidade', v: sc.quality_score, unit: '/100' },
                      { l: 'Preço idx', v: sc.price_index, unit: '' },
                      { l: 'Responsivo', v: sc.responsiveness, unit: '/100' },
                    ].map(m => (
                      <div key={m.l} className="rounded-lg bg-white/3 p-2">
                        <p className="text-xs text-white/30">{m.l}</p>
                        <p className="text-sm font-semibold text-white/70">
                          {m.v != null ? `${Number(m.v).toFixed(0)}${m.unit}` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                  {sc.ai_summary && (
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{sc.ai_summary}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Create risk modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-sm font-semibold text-white">Registar Risco</h2>

              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Título do risco *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />

              <input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))}
                placeholder="Fornecedor afetado" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />

              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descrição" rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none resize-none" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.risk_type} onChange={e => setForm(p => ({ ...p, risk_type: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                  {['logistics', 'geo_political', 'financial', 'quality', 'capacity', 'weather', 'regulatory'].map(t => (
                    <option key={t} value={t} className="bg-[#1a1a1a]">{t.replace('_', ' ')}</option>
                  ))}
                </select>
                <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                  {['low', 'medium', 'high', 'critical'].map(s => (
                    <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/30 mb-1 block">Probabilidade (0-1)</label>
                  <input type="number" min="0" max="1" step="0.1" value={form.probability}
                    onChange={e => setForm(p => ({ ...p, probability: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-white/30 mb-1 block">Impacto (0-100)</label>
                  <input type="number" min="0" max="100" value={form.impact_score}
                    onChange={e => setForm(p => ({ ...p, impact_score: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors">
                  Cancelar
                </button>
                <button onClick={createRisk} disabled={!form.title || creating}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-40">
                  {creating ? 'A registar...' : 'Registar Risco'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
