'use client';

// ── OMEGA X — S17: Executive Superintelligence ────────────────────────────────
//
// CEO-level "one screen" aggregating all OS signals — revenue, procurement,
// inventory, QC, customer health — with AI strategic brief, risks, opportunities.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIs {
  revenue_mtd: number; revenue_prev_month: number; revenue_mom_pct: number;
  orders_mtd: number; orders_7d: number; orders_in_progress: number;
  quotes_pending: number; clients_total: number;
  rfqs_active: number; savings_mtd: number;
  inventory_alerts: number; inventory_value: number;
  qc_avg_score: number; qc_pass_rate: number;
  avg_customer_health: number; at_risk_clients: number; upsell_opportunities: number;
  artwork_pending: number; benchmark_score: number; computed_at: string;
}

interface ExecSnapshot {
  ai_brief?: string;
  ai_risks?: Array<{ title: string; description: string; severity: string }>;
  ai_opportunities?: Array<{ title: string; description: string; potential: string }>;
  ai_actions?: Array<{ action: string; owner: string; deadline: string; impact: string }>;
  kpis?: KPIs; benchmark_score?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function Trend({ pct }: { pct: number }) {
  const color = pct >= 0 ? 'rgb(99,230,190)' : 'rgb(239,68,68)';
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color, marginLeft: '0.25rem' }}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function BenchmarkGauge({ score }: { score: number }) {
  const color = score >= 75 ? 'rgb(99,230,190)' : score >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  const label = score >= 75 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 45 ? 'Atenção' : 'Crítico';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <svg viewBox="0 0 72 72" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <motion.circle
            cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDasharray: '0 188.5' }}
            animate={{ strokeDasharray: `${(score / 100) * 188.5} 188.5` }}
            transition={{ duration: 1.2, ease: [0.16,1,0.3,1] }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: '0.45rem', color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color }}>{label}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExecutivePage() {
  const router = useRouter();
  const [kpis, setKPIs] = useState<KPIs | null>(null);
  const [snapshot, setSnapshot] = useState<ExecSnapshot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try snapshot first
      const res = await fetch('/api/executive?mode=snapshot');
      if (res.ok) {
        const d = await res.json();
        if (d.snapshot) {
          setSnapshot(d.snapshot);
          setKPIs(d.snapshot.kpis ?? null);
        } else {
          setKPIs(d.kpis ?? null);
          setSnapshot(null);
        }
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login?next=/executive');
    });
    load();
  }, [router, load]);

  async function refreshLive() {
    setRefreshing(true);
    const res = await fetch('/api/executive?mode=live');
    if (res.ok) {
      const d = await res.json();
      setKPIs(d.kpis ?? null);
    }
    setRefreshing(false);
  }

  async function generateBrief() {
    setGenerating(true);
    const res = await fetch('/api/executive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate' }),
    });
    if (res.ok) {
      const d = await res.json();
      setSnapshot(d.snapshot ?? null);
      setKPIs(d.snapshot?.kpis ?? kpis);
    }
    setGenerating(false);
  }

  async function getForecast() {
    setForecasting(true);
    const res = await fetch('/api/executive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forecast' }),
    });
    if (res.ok) {
      const d = await res.json();
      setForecast(d.forecast ?? null);
    }
    setForecasting(false);
  }

  const benchmarkScore = snapshot?.benchmark_score ?? kpis?.benchmark_score ?? 0;

  return (
    <PortalLayout>
      <div style={{ padding: '1.5rem', background: 'rgb(7,17,31)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <BenchmarkGauge score={benchmarkScore} />
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: '0 0 0.2rem' }}>🧠 Executive Superintelligence</h1>
              <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', marginBottom: '0.375rem' }}>
                YourGift OS · Todos os sistemas · Visão 360°
              </div>
              {kpis?.computed_at && (
                <div style={{ fontSize: '0.62rem', color: 'rgb(60,72,90)' }}>
                  Actualizado: {new Date(kpis.computed_at).toLocaleTimeString('pt-PT')}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <motion.button whileTap={tapScale} onClick={refreshLive} disabled={refreshing}
              style={{ padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgb(140,155,175)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
              {refreshing ? '⏳' : '↻'} Refresh
            </motion.button>
            <motion.button whileTap={tapScale} onClick={generateBrief} disabled={generating}
              style={{ padding: '0.4rem 0.875rem', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: 'rgb(167,139,250)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
              {generating ? '⏳ A gerar…' : '🧠 Gerar Brief AI'}
            </motion.button>
            <motion.button whileTap={tapScale} onClick={getForecast} disabled={forecasting}
              style={{ padding: '0.4rem 0.875rem', background: 'rgba(99,230,190,0.1)', border: '1px solid rgba(99,230,190,0.25)', borderRadius: '8px', color: 'rgb(99,230,190)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
              {forecasting ? '⏳ A prever…' : '🔮 Forecast'}
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgb(80,92,110)', fontSize: '0.75rem' }}>
            A carregar dados executivos…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── AI Brief ── */}
            <AnimatePresence>
              {snapshot?.ai_brief && (
                <motion.div {...fadeUp} style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(77,163,255,0.06) 100%)', borderRadius: '16px', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgb(167,139,250)', boxShadow: '0 0 6px rgba(167,139,250,0.6)' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(167,139,250)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Briefing Executivo AI</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'rgb(190,205,230)', lineHeight: 1.7, margin: 0 }}>{snapshot.ai_brief}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── KPI Grid — Revenue ── */}
            {kpis && (
              <>
                {/* Revenue Row */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(60,72,90)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>💰 RECEITA</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
                    {[
                      {
                        label: 'Receita MTD',
                        value: fmtEur(kpis.revenue_mtd),
                        sub: <><Trend pct={kpis.revenue_mom_pct} /> vs mês anterior</>,
                        color: 'rgb(99,230,190)',
                      },
                      { label: 'Encomendas MTD', value: String(kpis.orders_mtd), sub: `${kpis.orders_7d} últimos 7d`, color: 'rgb(77,163,255)' },
                      { label: 'Em Processamento', value: String(kpis.orders_in_progress), sub: 'encomendas activas', color: 'rgb(116,231,255)' },
                      { label: 'Orçamentos Pendentes', value: String(kpis.quotes_pending), sub: 'aguardam resposta', color: 'rgb(245,158,11)' },
                    ].map(k => (
                      <motion.div key={k.label} {...fadeUp} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>{k.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginBottom: '0.15rem' }}>{k.label}</div>
                        <div style={{ fontSize: '0.62rem', color: 'rgb(100,112,130)' }}>{k.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Procurement + Inventory Row */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(60,72,90)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>🏭 PROCUREMENT + INVENTÁRIO</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
                    {[
                      { label: 'RFQs Ativos', value: String(kpis.rfqs_active), sub: 'em negociação', color: 'rgb(167,139,250)' },
                      { label: 'Poupanças MTD', value: fmtEur(kpis.savings_mtd), sub: 'via procurement AI', color: 'rgb(99,230,190)' },
                      { label: 'Alertas Inventário', value: String(kpis.inventory_alerts), sub: 'stock baixo/esgotado', color: kpis.inventory_alerts > 0 ? 'rgb(245,158,11)' : 'rgb(99,230,190)' },
                      { label: 'Valor Inventário', value: fmtEur(kpis.inventory_value), sub: 'total em stock', color: 'rgb(245,158,11)' },
                    ].map(k => (
                      <motion.div key={k.label} {...fadeUp} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>{k.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginBottom: '0.15rem' }}>{k.label}</div>
                        <div style={{ fontSize: '0.62rem', color: 'rgb(100,112,130)' }}>{k.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* QC + Customer Row */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(60,72,90)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>🎯 QUALIDADE + CLIENTES</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
                    {[
                      { label: 'Score QC Médio', value: `${kpis.qc_avg_score.toFixed(0)}/100`, sub: `Pass rate ${kpis.qc_pass_rate.toFixed(0)}%`, color: kpis.qc_avg_score >= 75 ? 'rgb(99,230,190)' : 'rgb(245,158,11)' },
                      { label: 'Saúde Clientes', value: `${kpis.avg_customer_health.toFixed(0)}/100`, sub: `${kpis.clients_total} clientes total`, color: kpis.avg_customer_health >= 65 ? 'rgb(77,163,255)' : 'rgb(245,158,11)' },
                      { label: 'Clientes em Risco', value: String(kpis.at_risk_clients), sub: 'churn risk alto/crítico', color: kpis.at_risk_clients > 0 ? 'rgb(239,68,68)' : 'rgb(99,230,190)' },
                      { label: 'Opport. Upsell', value: String(kpis.upsell_opportunities), sub: 'prontos para upgrade', color: 'rgb(167,139,250)' },
                    ].map(k => (
                      <motion.div key={k.label} {...fadeUp} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>{k.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginBottom: '0.15rem' }}>{k.label}</div>
                        <div style={{ fontSize: '0.62rem', color: 'rgb(100,112,130)' }}>{k.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Risks + Opportunities + Actions ── */}
            <AnimatePresence>
              {snapshot && (
                <motion.div {...fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>

                  {/* Risks */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(239,68,68)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>⚠️ Riscos Identificados</h3>
                    {!snapshot.ai_risks?.length ? (
                      <div style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)' }}>Nenhum risco identificado.</div>
                    ) : (
                      snapshot.ai_risks.map((r, i) => (
                        <div key={i} style={{ marginBottom: '0.625rem', padding: '0.625rem', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.12)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{r.title}</span>
                            <span style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: r.severity === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: r.severity === 'high' ? 'rgb(239,68,68)' : 'rgb(245,158,11)', fontWeight: 700 }}>{r.severity}</span>
                          </div>
                          <div style={{ fontSize: '0.63rem', color: 'rgb(120,135,155)', lineHeight: 1.5 }}>{r.description}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Opportunities */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(99,230,190)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>📈 Oportunidades</h3>
                    {!snapshot.ai_opportunities?.length ? (
                      <div style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)' }}>Nenhuma oportunidade identificada.</div>
                    ) : (
                      snapshot.ai_opportunities.map((o, i) => (
                        <div key={i} style={{ marginBottom: '0.625rem', padding: '0.625rem', background: 'rgba(99,230,190,0.05)', borderRadius: '8px', border: '1px solid rgba(99,230,190,0.12)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{o.title}</span>
                            <span style={{ fontSize: '0.58rem', color: 'rgb(99,230,190)', fontWeight: 700 }}>{o.potential}</span>
                          </div>
                          <div style={{ fontSize: '0.63rem', color: 'rgb(120,135,155)', lineHeight: 1.5 }}>{o.description}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Recommended Actions */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(77,163,255)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>⚡ Ações Prioritárias</h3>
                    {!snapshot.ai_actions?.length ? (
                      <div style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)' }}>Sem ações recomendadas.</div>
                    ) : (
                      snapshot.ai_actions.map((a, i) => (
                        <div key={i} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.625rem', background: 'rgba(77,163,255,0.05)', borderRadius: '8px', border: '1px solid rgba(77,163,255,0.1)' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(190,205,225)', marginBottom: '0.15rem' }}>{a.action}</div>
                          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>
                            <span>👤 {a.owner}</span>
                            <span>📅 {a.deadline}</span>
                            <span style={{ color: 'rgb(99,230,190)' }}>↑ {a.impact}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── AI Forecast ── */}
            <AnimatePresence>
              {forecast && (
                <motion.div {...fadeUp} className="yg-card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>🔮 Forecast AI — Próximos 30/90 dias</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem', marginBottom: '0.875rem' }}>
                    {[
                      { label: 'Receita 30d', value: fmtEur(Number(forecast.revenue_next_30d ?? 0)), color: 'rgb(99,230,190)' },
                      { label: 'Receita 90d', value: fmtEur(Number(forecast.revenue_next_90d ?? 0)), color: 'rgb(77,163,255)' },
                      { label: 'Encomendas 30d', value: String(forecast.orders_next_30d ?? '—'), color: 'rgb(167,139,250)' },
                      { label: 'Trajectória', value: String(forecast.growth_trajectory ?? '—'), color: forecast.growth_trajectory === 'accelerating' ? 'rgb(99,230,190)' : forecast.growth_trajectory === 'declining' ? 'rgb(239,68,68)' : 'rgb(245,158,11)' },
                    ].map(k => (
                      <div key={k.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em', marginBottom: '0.15rem', textTransform: 'capitalize' }}>{k.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                  {Array.isArray(forecast.key_drivers) && (forecast.key_drivers as string[]).length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', fontWeight: 700 }}>Drivers:</span>
                      {(forecast.key_drivers as string[]).map((d, i) => (
                        <span key={i} style={{ fontSize: '0.62rem', padding: '0.15rem 0.5rem', background: 'rgba(99,230,190,0.08)', borderRadius: '5px', color: 'rgb(99,230,190)', border: '1px solid rgba(99,230,190,0.15)' }}>{d}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state if no brief yet */}
            {!snapshot && !loading && (
              <motion.div {...fadeUp} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', background: 'rgba(167,139,250,0.04)', borderRadius: '16px', border: '1px dashed rgba(167,139,250,0.2)', gap: '0.875rem' }}>
                <div style={{ fontSize: '2rem' }}>🧠</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(140,155,175)', textAlign: 'center' }}>Sem briefing executivo gerado hoje</div>
                <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', textAlign: 'center', maxWidth: '320px' }}>
                  Clica em &quot;Gerar Brief AI&quot; para analisar todos os sistemas e obter insights estratégicos.
                </div>
                <motion.button whileTap={tapScale} onClick={generateBrief} disabled={generating}
                  style={{ padding: '0.625rem 1.25rem', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '10px', color: 'rgb(167,139,250)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                  {generating ? '⏳ A gerar…' : '🧠 Gerar Brief AI'}
                </motion.button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
