'use client';

// ── OMEGA PROTOCOL — S8: Financial Intelligence Supremacy — UI ────────────────
//
// Margin health dashboard · Revenue trend · Cashflow forecast
// Margin leak alerts · Top clients (admin) · Fraud signals
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { fadeUp, delayedFadeUp, tapScale, springSnappy } from '@/lib/motion';
import { SparklineCard } from '@/components/portal/RevenueSparkline';

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

interface FinancialSummary {
  currentRevenue: number; prevRevenue: number; revenueGrowth: number;
  grossMargin: number; grossMarginPct: number; targetMarginPct: number;
  marginHealth: 'healthy' | 'at_risk' | 'critical';
  totalOrders: number; cancellationRate: number;
}

interface RevenuePoint { label: string; revenue: number; }
interface MarginLeak { id: string; ref: string; revenue: number; estimatedMargin: number; marginPct: number; flag: 'warning' | 'critical'; }
interface ClientRow { name: string; revenue: number; orders: number; }

interface FinancialData {
  period: string;
  summary: FinancialSummary;
  revenueTimeline: RevenuePoint[];
  marginLeaks: MarginLeak[];
  topClients: ClientRow[];
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function GrowthBadge({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: pos ? '#b8975e' : 'rgb(239,68,68)', background: pos ? 'rgba(184,151,94,0.10)' : 'rgba(239,68,68,0.1)', borderRadius: '6px', padding: '0.15rem 0.4rem' }}>
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function FinancialsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'30d' | '90d' | '12m'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'margins' | 'clients'>('overview');

  const load = useCallback(async (p: string) => {
    try {
      const resp = await fetch(`/api/financial?period=${p}&mode=overview`);
      if (resp.ok) setData(await resp.json());
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login?next=/financials'); return; }
        const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
        setIsAdmin(admin);
        const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);
        await load(period);
      } catch (err) {
        console.error('[financials] init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = data?.summary;
  const marginColor = s?.marginHealth === 'healthy' ? '#b8975e' : s?.marginHealth === 'at_risk' ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  const maxRev = data ? Math.max(...data.revenueTimeline.map(p => p.revenue), 1) : 1;

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>

        {/* Header */}
        <motion.div variants={fadeUp(0)} initial="hidden" animate="visible" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Inteligência Financeira</h1>
            <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.24)' }}>Margens · Receita · Cashflow · Detecção de Anomalias</p>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {(['30d', '90d', '12m'] as const).map(p => (
              <motion.button key={p} type="button" whileTap={tapScale}
                onClick={() => { setPeriod(p); load(p); }}
                style={{ padding: '0.3rem 0.625rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: period === p ? 'rgba(77,163,255,0.16)' : 'rgba(240,236,228,0.04)', color: period === p ? '#d4b47a' : 'rgba(240,236,228,0.42)', border: period === p ? '1px solid rgba(154,124,74,0.28)' : '1px solid rgba(240,236,228,0.06)', transition: 'all 150ms' }}>
                {p}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
            </div>
            <div className="skeleton" style={{ height: '200px' }} />
          </div>
        ) : data ? (
          <>
            {/* Revenue sparkline row */}
            {data.revenueTimeline.length > 0 && (
              <motion.div {...delayedFadeUp(0, 0.03)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <SparklineCard
                  title="Receita no período"
                  value={fmtEur(s?.currentRevenue ?? 0)}
                  trend={s?.revenueGrowth}
                  subtitle="vs. período anterior"
                  data={data.revenueTimeline.map(p => ({ label: p.label, value: p.revenue }))}
                  color="#b8975e"
                  width={140}
                />
                <SparklineCard
                  title="Margem bruta"
                  value={`${s?.grossMarginPct?.toFixed(1) ?? 0}%`}
                  subtitle={`Target: ${s?.targetMarginPct}%`}
                  data={data.revenueTimeline.map(p => ({ label: p.label, value: p.revenue * (s?.grossMarginPct ?? 30) / 100 }))}
                  color={marginColor}
                  width={140}
                />
              </motion.div>
            )}

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
              {[
                { label: 'Receita', value: fmtEur(s?.currentRevenue ?? 0), sub: <GrowthBadge pct={s?.revenueGrowth ?? 0} />, color: '#b8975e' },
                { label: 'Margem Bruta', value: `${s?.grossMarginPct?.toFixed(1) ?? 0}%`, sub: fmtEur(s?.grossMargin ?? 0), color: marginColor },
                { label: 'Encomendas', value: String(s?.totalOrders ?? 0), sub: `Cancelamento: ${s?.cancellationRate ?? 0}%`, color: '#d4b47a' },
                { label: 'Saúde Margem', value: s?.marginHealth === 'healthy' ? 'Saudável' : s?.marginHealth === 'at_risk' ? 'Em risco' : 'Crítico', sub: `Target: ${s?.targetMarginPct}%`, color: marginColor },
              ].map((kpi, i) => (
                <motion.div key={kpi.label} {...delayedFadeUp(i, 0.06, 0.07)} className="yg-card" style={{ padding: '1rem 1.125rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${kpi.color},transparent)` }} />
                  <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{kpi.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '0.25rem' }}>{kpi.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)' }}>{kpi.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* Tab bar */}
            <motion.div {...delayedFadeUp(0, 0.2)} style={{ display: 'flex', gap: '0.3rem', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '12px', padding: '0.3rem', marginBottom: '0.875rem' }}>
              {([
                { id: 'overview', label: 'Visão Geral' },
                { id: 'margins', label: `Fugas de Margem (${data.marginLeaks.length})` },
                { id: 'clients', label: 'Top Clientes', adminOnly: true },
              ] as const).filter(t => !('adminOnly' in t) || !t.adminOnly || isAdmin).map(tab => (
                <button type="button" key={tab.id}  onClick={() => setActiveTab(tab.id)}
                  style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: activeTab === tab.id ? 'rgba(77,163,255,0.16)' : 'transparent', color: activeTab === tab.id ? '#d4b47a' : 'rgba(240,236,228,0.42)', transition: 'all 150ms' }}>
                  {tab.label}
                </button>
              ))}
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div key={activeTab + period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springSnappy}>

                {/* Overview: revenue sparkline */}
                {activeTab === 'overview' && (
                  <div className="yg-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.875rem' }}>RECEITA — {period.toUpperCase()}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', marginBottom: '0.5rem' }}>
                      {data.revenueTimeline.map((pt, i) => {
                        const h = pt.revenue > 0 ? Math.max((pt.revenue / maxRev) * 100, 4) : 4;
                        const isLast = i === data.revenueTimeline.length - 1;
                        return (
                          <motion.div
                            key={i}
                            title={`${pt.label}: ${fmtEur(pt.revenue)}`}
                            style={{ flex: 1, minWidth: '3px', background: isLast ? '#b8975e' : 'rgba(154,124,74,0.45)', borderRadius: '2px 2px 0 0', cursor: 'default' }}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 0.5, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          />
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)' }}>
                      <span>{data.revenueTimeline[0]?.label ?? ''}</span>
                      <span>{data.revenueTimeline[data.revenueTimeline.length - 1]?.label ?? ''}</span>
                    </div>
                  </div>
                )}

                {/* Margin leaks */}
                {activeTab === 'margins' && (
                  <div className="yg-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.875rem' }}>ALERTAS DE MARGEM</div>
                    {data.marginLeaks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem', color: 'rgba(240,236,228,0.24)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                        <div style={{ fontSize: '0.78rem' }}>Sem fugas de margem detectadas no período.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {data.marginLeaks.map((leak, i) => (
                          <motion.div key={leak.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springSnappy, delay: i * 0.06 }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', background: leak.flag === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${leak.flag === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '10px' }}>
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(240,236,228,0.75)' }}>{leak.ref}</div>
                              <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)' }}>Receita: {fmtEur(leak.revenue)} · Margem est.: {fmtEur(leak.estimatedMargin)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: leak.flag === 'critical' ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}>{leak.marginPct}%</div>
                              <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>margem</div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Top clients (admin) */}
                {activeTab === 'clients' && isAdmin && (
                  <div className="yg-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.875rem' }}>TOP CLIENTES POR RECEITA</div>
                    {data.topClients.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Sem dados de clientes.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {data.topClients.map((c, i) => {
                          const maxClientRev = Math.max(...data.topClients.map(x => x.revenue), 1);
                          return (
                            <motion.div key={c.name + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springSnappy, delay: i * 0.05 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)' }}>{i + 1}. {c.name}</span>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>{c.orders} enc.</span>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b8975e' }}>{fmtEur(c.revenue)}</span>
                                </div>
                              </div>
                              <div className="prog-track">
                                <motion.div className="prog-fill" style={{ background: `rgba(99,230,190,${0.9 - i * 0.08})` }}
                                  initial={{ width: 0 }} animate={{ width: `${(c.revenue / maxClientRev) * 100}%` }}
                                  transition={{ duration: 0.6, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }} />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Quick links */}
            <motion.div {...delayedFadeUp(0, 0.4)} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <Link href="/billing" style={{ textDecoration: 'none' }}>
                <motion.div whileTap={tapScale} style={{ padding: '0.4rem 0.875rem', borderRadius: '9px', fontSize: '0.72rem', fontWeight: 700, color: '#d4b47a', background: 'rgba(154,124,74,0.10)', border: '1px solid rgba(154,124,74,0.18)', cursor: 'pointer' }}>Ver Faturação →</motion.div>
              </Link>
              <Link href="/reports" style={{ textDecoration: 'none' }}>
                <motion.div whileTap={tapScale} style={{ padding: '0.4rem 0.875rem', borderRadius: '9px', fontSize: '0.72rem', fontWeight: 700, color: '#b8975e', background: 'rgba(184,151,94,0.08)', border: '1px solid rgba(184,151,94,0.18)', cursor: 'pointer' }}>Relatórios Completos →</motion.div>
              </Link>
            </motion.div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(240,236,228,0.24)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <div>Dados financeiros indisponíveis. Tenta novamente.</div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
