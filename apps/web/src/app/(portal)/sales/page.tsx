'use client';

// ── OMEGA X — S13: AI Sales + Customer Success Intelligence ──────────────────
//
// Customer health dashboard with churn prediction, upsell detection,
// AI-generated sales action queue, and RFM-based health scoring.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerHealth {
  id: string; client_id: string; client_name: string; client_email?: string;
  health_score: number; churn_risk: string; churn_probability: number;
  upsell_score: number; engagement_score: number; ltv_estimate: number;
  last_order_days?: number; total_orders: number; total_spent: number;
  alert_type?: string; alert_priority: string;
  ai_recommendations?: string; last_computed_at: string;
}

interface SalesAction {
  id: string; client_id: string; client_name: string;
  action_type: string; priority: string; subject?: string;
  ai_script?: string; status: string; due_date?: string; notes?: string;
  created_at: string;
}

interface Summary {
  total_clients: number; avg_health_score: number;
  at_risk: number; upsell_opportunities: number;
  vip_clients: number; total_ltv: number;
}

type ViewMode = 'health' | 'actions';
type SortKey = 'health_score' | 'churn_risk' | 'upsell_score' | 'ltv_estimate' | 'last_order_days';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHURN_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: 'Baixo',     color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)' },
  medium:   { label: 'Médio',     color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)' },
  high:     { label: 'Alto',      color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.1)' },
  critical: { label: 'Crítico',   color: 'rgb(220,38,38)',   bg: 'rgba(220,38,38,0.16)' },
};

const ALERT_ICONS: Record<string, string> = {
  at_risk: '⚠️', win_back: '🔄', upsell: '📈', vip_nurture: '⭐',
};

const ACTION_ICONS: Record<string, string> = {
  call: '📞', email: '📧', proposal: '📋', follow_up: '🔔', check_in: '💬',
  discount_offer: '🏷️', demo: '🎯',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: 'rgb(80,92,110)', medium: 'rgb(77,163,255)', high: 'rgb(245,158,11)', critical: 'rgb(239,68,68)',
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'rgb(99,230,190)' : score >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  return (
    <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
        style={{ height: '100%', background: color, borderRadius: '9999px' }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalesIntelligencePage() {
  const router = useRouter();
  const [health, setHealth] = useState<CustomerHealth[]>([]);
  const [actions, setActions] = useState<SalesAction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('health');
  const [sortKey, setSortKey] = useState<SortKey>('health_score');
  const [churnFilter, setChurnFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');
  const [selected, setSelected] = useState<CustomerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-intelligence?mode=dashboard');
      if (res.ok) {
        const d = await res.json();
        setHealth(d.health ?? []);
        setActions(d.actions ?? []);
        setSummary(d.summary ?? null);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login?next=/sales');
    });
    loadDashboard();
  }, [router, loadDashboard]);

  async function computeAll() {
    setComputing(true);
    const res = await fetch('/api/sales-intelligence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compute_all' }),
    });
    if (res.ok) {
      const d = await res.json();
      setActionSuccess(`✓ ${d.computed} clientes analisados`);
      await loadDashboard();
    }
    setComputing(false);
  }

  async function generateActions() {
    setGenerating(true);
    const res = await fetch('/api/sales-intelligence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_actions' }),
    });
    if (res.ok) {
      const d = await res.json();
      setActionSuccess(`✓ ${d.generated} ações geradas pela AI`);
      await loadDashboard();
      setViewMode('actions');
    }
    setGenerating(false);
  }

  async function completeAction(id: string) {
    await fetch('/api/sales-intelligence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete_action', id }),
    });
    setActionSuccess('Ação marcada como concluída');
    await loadDashboard();
  }

  // Sort + filter health
  const filteredHealth = health
    .filter(h => churnFilter === 'all' || h.churn_risk === churnFilter)
    .filter(h => alertFilter === 'all' || h.alert_type === alertFilter)
    .sort((a, b) => {
      if (sortKey === 'health_score') return a.health_score - b.health_score;
      if (sortKey === 'churn_risk') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.churn_risk as keyof typeof order] ?? 4) - (order[b.churn_risk as keyof typeof order] ?? 4);
      }
      if (sortKey === 'upsell_score') return b.upsell_score - a.upsell_score;
      if (sortKey === 'ltv_estimate') return b.ltv_estimate - a.ltv_estimate;
      if (sortKey === 'last_order_days') return (b.last_order_days ?? 999) - (a.last_order_days ?? 999);
      return 0;
    });

  const pendingActions = actions.filter(a => a.status === 'pending');

  return (
    <PortalLayout>
      <div style={{ padding: '1.5rem', background: 'rgb(7,17,31)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: '0 0 0.2rem' }}>🎯 AI Sales Intelligence</h1>
            <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)' }}>
              Saúde de clientes · Previsão de churn · Oportunidades de upsell · Ações automatizadas
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <motion.button whileTap={tapScale} onClick={computeAll} disabled={computing}
              style={{ padding: '0.4rem 0.875rem', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: 'rgb(167,139,250)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              {computing ? '⏳ A calcular…' : '🧮 Recalcular Scores'}
            </motion.button>
            <motion.button whileTap={tapScale} onClick={generateActions} disabled={generating}
              style={{ padding: '0.4rem 0.875rem', background: 'rgba(77,163,255,0.12)', border: '1px solid rgba(77,163,255,0.3)', borderRadius: '8px', color: 'rgb(77,163,255)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              {generating ? '⏳ A gerar…' : '🤖 Gerar Ações AI'}
            </motion.button>
          </div>
        </div>

        {actionSuccess && (
          <motion.div {...fadeUp}
            style={{ marginBottom: '1rem', padding: '0.625rem 1rem', background: 'rgba(99,230,190,0.08)', border: '1px solid rgba(99,230,190,0.2)', borderRadius: '10px', color: 'rgb(99,230,190)', fontSize: '0.75rem', fontWeight: 600 }}>
            {actionSuccess}
          </motion.div>
        )}

        {/* KPI Summary */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Total Clientes', value: String(summary.total_clients), color: 'rgb(77,163,255)' },
              { label: 'Health Score Médio', value: `${summary.avg_health_score.toFixed(0)}/100`, color: summary.avg_health_score >= 65 ? 'rgb(99,230,190)' : 'rgb(245,158,11)' },
              { label: 'Em Risco', value: String(summary.at_risk), color: summary.at_risk > 0 ? 'rgb(239,68,68)' : 'rgb(99,230,190)' },
              { label: 'Upsell Opps', value: String(summary.upsell_opportunities), color: 'rgb(245,158,11)' },
              { label: 'Clientes VIP', value: String(summary.vip_clients), color: 'rgb(167,139,250)' },
              { label: 'LTV Total', value: fmtEur(summary.total_ltv), color: 'rgb(99,230,190)' },
            ].map(k => (
              <motion.div key={k.label} {...fadeUp} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em', marginBottom: '0.15rem' }}>{k.value}</div>
                <div style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>{k.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* View Mode Tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
          {(['health','actions'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ padding: '0.4rem 0.875rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: viewMode === m ? 'rgba(77,163,255,0.15)' : 'rgba(255,255,255,0.04)', color: viewMode === m ? 'rgb(77,163,255)' : 'rgb(80,92,110)', borderColor: viewMode === m ? 'rgba(77,163,255,0.3)' : 'transparent' }}>
              {m === 'health' ? `🏥 Saúde Clientes (${filteredHealth.length})` : `📋 Fila de Ações (${pendingActions.length})`}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Health Dashboard ── */}
          {viewMode === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springGentle}>

              {/* Filters + sort */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', fontWeight: 700 }}>CHURN:</span>
                {['all','low','medium','high','critical'].map(c => (
                  <button key={c} onClick={() => setChurnFilter(c)}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: churnFilter === c ? 'rgba(77,163,255,0.15)' : 'rgba(255,255,255,0.04)', color: churnFilter === c ? 'rgb(77,163,255)' : 'rgb(80,92,110)', borderColor: churnFilter === c ? 'rgba(77,163,255,0.3)' : 'transparent' }}>
                    {c === 'all' ? 'Todos' : CHURN_CFG[c]?.label ?? c}
                  </button>
                ))}
                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
                <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', fontWeight: 700 }}>ALERTA:</span>
                {['all','at_risk','win_back','upsell','vip_nurture'].map(a => (
                  <button key={a} onClick={() => setAlertFilter(a)}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: alertFilter === a ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: alertFilter === a ? 'rgb(245,158,11)' : 'rgb(80,92,110)', borderColor: alertFilter === a ? 'rgba(245,158,11,0.3)' : 'transparent' }}>
                    {a === 'all' ? 'Todos' : `${ALERT_ICONS[a] ?? ''} ${a.replace('_',' ')}`}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', fontWeight: 700 }}>SORT:</span>
                  <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', padding: '0.2rem 0.5rem', color: 'rgb(150,165,185)', fontSize: '0.65rem' }}>
                    <option value="health_score" style={{ background: 'rgb(14,22,36)' }}>Health ↑</option>
                    <option value="churn_risk" style={{ background: 'rgb(14,22,36)' }}>Churn Risk ↓</option>
                    <option value="upsell_score" style={{ background: 'rgb(14,22,36)' }}>Upsell ↓</option>
                    <option value="ltv_estimate" style={{ background: 'rgb(14,22,36)' }}>LTV ↓</option>
                    <option value="last_order_days" style={{ background: 'rgb(14,22,36)' }}>Inativo ↓</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.625rem' }}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ height: '3.5px', width: '60%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '0.75rem' }} />
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                      <div style={{ height: '3px', width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
                    </div>
                  ))}
                </div>
              ) : filteredHealth.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'rgb(80,92,110)', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>🎯</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(140,155,175)' }}>Nenhum cliente calculado ainda</div>
                  <button onClick={computeAll} style={{ background: 'none', border: 'none', color: 'rgb(77,163,255)', cursor: 'pointer', fontSize: '0.75rem' }}>
                    → Calcular scores agora
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.625rem' }}>
                  <AnimatePresence mode="popLayout">
                    {filteredHealth.map((h, idx) => {
                      const churnCfg = CHURN_CFG[h.churn_risk] ?? CHURN_CFG.low;
                      const isSelected = selected?.id === h.id;
                      return (
                        <motion.div
                          key={h.id} layout
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ ...springSnappy, delay: idx * 0.02 }}
                          onClick={() => setSelected(isSelected ? null : h)}
                          style={{
                            padding: '1rem', borderRadius: '12px',
                            background: isSelected ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? 'rgba(77,163,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                            cursor: 'pointer', transition: 'all 120ms',
                          }}
                        >
                          {/* Client header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.15rem' }}>
                                {h.alert_type && <span style={{ fontSize: '0.75rem' }}>{ALERT_ICONS[h.alert_type]}</span>}
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(200,215,235)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.client_name}</span>
                              </div>
                              {h.client_email && <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.client_email}</div>}
                            </div>
                            <span style={{ padding: '0.18rem 0.45rem', borderRadius: '5px', background: churnCfg.bg, color: churnCfg.color, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0, marginLeft: '0.5rem' }}>
                              {churnCfg.label}
                            </span>
                          </div>

                          {/* Health bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', width: '32px' }}>Health</span>
                            <HealthBar score={h.health_score} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: h.health_score >= 70 ? 'rgb(99,230,190)' : h.health_score >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)', width: '28px', textAlign: 'right' }}>
                              {h.health_score}
                            </span>
                          </div>

                          {/* Metrics row */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                            {[
                              { label: 'Encomendas', value: String(h.total_orders) },
                              { label: 'Gasto', value: fmtEur(h.total_spent) },
                              { label: 'LTV', value: fmtEur(h.ltv_estimate) },
                              { label: 'Inativo', value: h.last_order_days != null ? `${h.last_order_days}d` : '—' },
                            ].map(m => (
                              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.3rem 0.375rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgb(150,165,185)' }}>{m.value}</div>
                                <div style={{ fontSize: '0.5rem', color: 'rgb(60,72,90)', marginTop: '0.05rem' }}>{m.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Expanded detail */}
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
                              >
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgb(245,158,11)' }}>{h.upsell_score}/100</div>
                                      <div style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)' }}>Upsell Score</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgb(77,163,255)' }}>{h.engagement_score}/100</div>
                                      <div style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)' }}>Engagement</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: churnCfg.color }}>{(h.churn_probability * 100).toFixed(0)}%</div>
                                      <div style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)' }}>Prob. Churn</div>
                                    </div>
                                  </div>
                                  {h.alert_type && (
                                    <div style={{ padding: '0.4rem 0.5rem', background: 'rgba(245,158,11,0.06)', borderRadius: '7px', border: '1px solid rgba(245,158,11,0.15)', fontSize: '0.62rem', color: 'rgb(200,175,100)' }}>
                                      {ALERT_ICONS[h.alert_type]} Alerta: <b>{h.alert_type.replace('_',' ')}</b> · Prioridade: <b>{h.alert_priority}</b>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Actions Queue ── */}
          {viewMode === 'actions' && (
            <motion.div key="actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springGentle}>
              {pendingActions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'rgb(80,92,110)', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>📋</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(140,155,175)' }}>Sem ações pendentes</div>
                  <button onClick={generateActions} style={{ background: 'none', border: 'none', color: 'rgb(77,163,255)', cursor: 'pointer', fontSize: '0.75rem' }}>
                    → Gerar ações com AI
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '900px' }}>
                  {pendingActions.map((act, idx) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ ...springSnappy, delay: idx * 0.04 }}
                      style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '0.1rem' }}>{ACTION_ICONS[act.action_type] ?? '•'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{act.client_name}</span>
                            <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.35rem', borderRadius: '5px' }}>{act.action_type.replace('_',' ')}</span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: PRIORITY_COLOR[act.priority] ?? 'rgb(80,92,110)' }}>● {act.priority}</span>
                            {act.due_date && <span style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>📅 {fmtDate(act.due_date)}</span>}
                          </div>
                          {act.subject && <div style={{ fontSize: '0.68rem', color: 'rgb(140,155,175)', marginBottom: '0.25rem' }}>{act.subject}</div>}

                          {/* AI Script (expandable) */}
                          {act.ai_script && (
                            <div>
                              <button onClick={() => setExpandedAction(expandedAction === act.id ? null : act.id)}
                                style={{ background: 'none', border: 'none', color: 'rgb(167,139,250)', fontSize: '0.62rem', cursor: 'pointer', padding: 0 }}>
                                {expandedAction === act.id ? '▲ Ocultar script AI' : '▼ Ver script AI →'}
                              </button>
                              <AnimatePresence>
                                {expandedAction === act.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    style={{ overflow: 'hidden' }}
                                  >
                                    <div style={{ marginTop: '0.5rem', padding: '0.625rem', background: 'rgba(167,139,250,0.06)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.15)', fontSize: '0.68rem', color: 'rgb(170,185,210)', lineHeight: 1.6 }}>
                                      {act.ai_script}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                        <motion.button whileTap={tapScale} onClick={() => completeAction(act.id)}
                          style={{ padding: '0.35rem 0.625rem', background: 'rgba(99,230,190,0.12)', border: '1px solid rgba(99,230,190,0.25)', borderRadius: '7px', color: 'rgb(99,230,190)', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                          ✓ Feito
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PortalLayout>
  );
}
