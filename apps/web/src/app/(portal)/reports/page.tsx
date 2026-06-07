'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Phase 8: Financial Intelligence ──────────────────────────────────────────
// Admin: global revenue view (all clients, tier breakdown, top clients)
// Client: full personal analytics (unchanged)

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  client_id?: string | null;
}

interface Quote {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  client_id?: string | null;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  budget_limit: number | null;
}

interface ClientRow {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  spend: number;
  orderCount: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      if (now < t0) { raf.current = requestAnimationFrame(step); return; }
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, delay]);
  return val;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtEurFull(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
}

// ── Charts ───────────────────────────────────────────────────────────────────

function BarChart({ data, color = '#d4b47a', height = 120 }: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 28;
  const gap = 12;
  const totalW = data.length * (barW + gap) - gap;
  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${height + 24}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const bh = Math.max((d.value / max) * height, 2);
        const x = i * (barW + gap);
        const y = height - bh;
        return (
          <g key={i}>
            <rect x={x} y={0} width={barW} height={height} rx={6} fill="rgba(240,236,228,0.04)" />
            <rect x={x} y={y} width={barW} height={bh} rx={6} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="rgba(240,236,228,0.24)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, color = '#b8975e', height = 80, width = 300 }: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
    d += ` C ${cp1x} ${pts[i - 1].y} ${cp2x} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${d} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`lg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#lg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={color} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon, color, trend, delay = 0 }: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  trend?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="yg-card"
      style={{ padding: '1.25rem 1.375rem', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: color, opacity: 0.06, filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'absolute', top: '-4px', right: '0.875rem', fontSize: '2rem', opacity: 0.1 }}>{icon}</div>
      <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.42)' }}>{sub}</span>
        {trend !== undefined && trend !== 0 && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '9999px',
            background: trend > 0 ? 'rgba(184,151,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: trend > 0 ? '#b8975e' : 'rgb(239,68,68)',
          }}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Tier colour ───────────────────────────────────────────────────────────────

function tierColor(tier: string | null | undefined) {
  switch (tier) {
    case 'premium': return 'rgb(245,158,11)';
    case 'enterprise': return 'rgb(167,139,250)';
    case 'vip': return '#b8975e';
    default: return '#d4b47a';
  }
}

// ── Admin Financial Intelligence View ─────────────────────────────────────────

function AdminReports({ allOrders, allQuotes, allClients }: {
  allOrders: Order[];
  allQuotes: Quote[];
  allClients: ClientRow[];
}) {
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const [activeTab, setActiveTab] = useState<'revenue' | 'clients' | 'funnel'>('revenue');

  const analytics = useMemo(() => {
    const now = new Date();
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;

    const validOrders = allOrders.filter(o => o.status !== 'cancelled' && o.total_amount != null);

    // Global revenue totals
    const totalRevenue = validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const thisMonthRev = validOrders.filter(o => o.created_at >= thisMonthStart).reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const lastMonthRev = validOrders.filter(o => o.created_at >= lastMonthStart && o.created_at < thisMonthStart).reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const monthTrend = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : 0;

    // Monthly revenue chart
    const monthlyData = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const label = d.toLocaleDateString('pt-PT', { month: 'short' });
      const start = d.toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const value = validOrders.filter(o => o.created_at >= start && o.created_at < end).reduce((s, o) => s + (o.total_amount ?? 0), 0);
      return { label: label.charAt(0).toUpperCase() + label.slice(1, 3), value };
    });

    // Revenue by tier
    const tierRevenue: Record<string, number> = {};
    for (const client of allClients) {
      const key = client.tier ?? 'standard';
      tierRevenue[key] = (tierRevenue[key] ?? 0) + client.spend;
    }
    const tierData = Object.entries(tierRevenue)
      .sort(([, a], [, b]) => b - a)
      .map(([tier, value]) => ({ label: tier.charAt(0).toUpperCase() + tier.slice(1), value, color: tierColor(tier) }));

    // Top 5 clients by spend
    const topClients = [...allClients].sort((a, b) => b.spend - a.spend).slice(0, 8);
    const maxSpend = Math.max(...topClients.map(c => c.spend), 1);

    // Quote funnel
    const totalQuotes = allQuotes.length;
    const pendingQ = allQuotes.filter(q => ['submitted', 'pricing', 'proposed'].includes(q.status)).length;
    const approvedQ = allQuotes.filter(q => q.status === 'approved').length;
    const convertedQ = allQuotes.filter(q => q.status === 'converted').length;
    const conversionRate = totalQuotes > 0 ? Math.round((convertedQ / totalQuotes) * 100) : 0;
    const quoteValue = allQuotes.filter(q => q.total_amount).reduce((s, q) => s + (q.total_amount ?? 0), 0);

    // Active orders
    const activeOrders = allOrders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status)).length;
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

    // 30-day sparkline
    const sparkline = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
      return validOrders.filter(o => o.created_at.startsWith(day)).reduce((s, o) => s + (o.total_amount ?? 0), 0);
    });

    return { totalRevenue, thisMonthRev, monthTrend, monthlyData, tierData, topClients, maxSpend, totalQuotes, pendingQ, approvedQ, convertedQ, conversionRate, quoteValue, activeOrders, avgOrderValue, sparkline };
  }, [allOrders, allQuotes, allClients, period]);

  const animTotal = useCountUp(Math.round(analytics.totalRevenue), 1600, 100);
  const animMonth = useCountUp(Math.round(analytics.thisMonthRev), 1400, 250);
  const animAvg   = useCountUp(Math.round(analytics.avgOrderValue), 1200, 400);

  const TABS = [
    { id: 'revenue' as const, label: 'Receita' },
    { id: 'clients' as const, label: 'Clientes' },
    { id: 'funnel' as const, label: 'Funil' },
  ];

  return (
    <div style={{ padding: '2rem 2rem 4rem', maxWidth: '1140px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>Inteligência Financeira</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: 'rgba(167,139,250,0.15)', color: 'rgb(167,139,250)', border: '1px solid rgba(167,139,250,0.2)' }}>ADMIN</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.24)' }}>Vista global da plataforma — receita, clientes e pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', background: 'rgba(240,236,228,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
          {(['3m', '6m', '12m'] as const).map((p) => (
            <motion.button key={p} type="button" onClick={() => setPeriod(p)} whileTap={{ scale: 0.95 }}
              style={{ padding: '0.3rem 0.75rem', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', background: period === p ? 'rgba(154,124,74,0.16)' : 'transparent', color: period === p ? '#d4b47a' : 'rgba(240,236,228,0.42)', border: 'none' }}>
              {p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : '12 meses'}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Global KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <KPICard label="Receita Total" value={fmtEur(animTotal)} sub="toda a plataforma" icon="💰" color="#b8975e" delay={0.05} />
        <KPICard label="Este mês" value={fmtEur(animMonth)} sub="receita corrente" icon="📅" color="#d4b47a" trend={analytics.monthTrend} delay={0.1} />
        <KPICard label="Ticket médio" value={fmtEur(animAvg)} sub="por encomenda" icon="📊" color="rgb(167,139,250)" delay={0.15} />
        <KPICard label="Conversão" value={`${analytics.conversionRate}%`} sub="orçamentos→pedidos" icon="🎯" color="rgb(245,158,11)" delay={0.2} />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Clientes ativos', value: allClients.length, color: '#d4b47a' },
          { label: 'Encomendas ativas', value: analytics.activeOrders, color: '#b8975e' },
          { label: 'Orçamentos totais', value: analytics.totalQuotes, color: 'rgb(245,158,11)' },
          { label: 'Pipeline orçamentos', value: `€${(analytics.quoteValue / 1000).toFixed(0)}k`, color: '#b8975e', isString: true },
          { label: 'Taxa conversão', value: `${analytics.conversionRate}%`, color: 'rgb(167,139,250)', isString: true },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '12px', padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              {typeof k.value === 'number' ? k.value.toLocaleString('pt-PT') : k.value}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', fontWeight: 500 }}>{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {TABS.map(tab => (
          <motion.button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} whileTap={{ scale: 0.96 }}
            style={{ padding: '0.375rem 1rem', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 150ms', background: activeTab === tab.id ? 'rgba(154,124,74,0.16)' : 'transparent', color: activeTab === tab.id ? '#d4b47a' : 'rgba(240,236,228,0.42)' }}>
            {tab.label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* REVENUE TAB */}
        {activeTab === 'revenue' && (
          <motion.div key="revenue" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Monthly bar chart */}
              <div className="yg-card" style={{ padding: '1.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Receita mensal</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>
                      {period === '3m' ? '3' : period === '6m' ? '6' : '12'} meses
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Máximo</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#d4b47a' }}>{fmtEur(Math.max(...analytics.monthlyData.map(d => d.value), 0))}</p>
                  </div>
                </div>
                <div style={{ height: '140px' }}>
                  <BarChart data={analytics.monthlyData} color="#d4b47a" height={120} />
                </div>
              </div>

              {/* Revenue by tier */}
              <div className="yg-card" style={{ padding: '1.375rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Receita por tier</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>Distribuição</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analytics.tierData.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.24)' }}>Sem dados suficientes</p>
                  ) : analytics.tierData.map((t) => {
                    const totalTierRev = analytics.tierData.reduce((s, x) => s + x.value, 0);
                    const pct = totalTierRev > 0 ? (t.value / totalTierRev) * 100 : 0;
                    return (
                      <div key={t.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.42)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                            {t.label}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: t.color }}>{fmtEur(t.value)}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            style={{ height: '100%', borderRadius: '9999px', background: t.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 30-day sparkline */}
            <div className="yg-card" style={{ padding: '1.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Tendência 30 dias</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b8975e', letterSpacing: '-0.04em' }}>{fmtEur(analytics.sparkline.reduce((s, v) => s + v, 0))}</p>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>receita diária acumulada</span>
              </div>
              <div style={{ height: '80px' }}>
                <LineChart data={analytics.sparkline} color="#b8975e" height={80} width={600} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>Há 30 dias</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>Hoje</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* CLIENTS TAB */}
        {activeTab === 'clients' && (
          <motion.div key="clients" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div className="yg-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.375rem', borderBottom: '1px solid rgba(240,236,228,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.15rem' }}>Top Clientes</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>Por receita gerada</p>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)' }}>{allClients.length} clientes totais</span>
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                {analytics.topClients.map((c, i) => {
                  const pct = analytics.maxSpend > 0 ? (c.spend / analytics.maxSpend) * 100 : 0;
                  const tc = tierColor(c.tier);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto auto', alignItems: 'center', gap: '0.875rem', padding: '0.625rem 1.375rem', borderBottom: i < analytics.topClients.length - 1 ? '1px solid rgba(240,236,228,0.04)' : 'none' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: i === 0 ? 'rgb(245,158,11)' : 'rgba(240,236,228,0.24)', textAlign: 'center' }}>#{i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name ?? 'N/A'} {c.company ? <span style={{ color: 'rgba(240,236,228,0.24)', fontWeight: 400 }}>· {c.company}</span> : null}
                        </div>
                        <div style={{ height: '4px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                            style={{ height: '100%', borderRadius: '9999px', background: tc }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '9999px', background: `${tc}18`, color: tc, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{c.tier ?? 'std'}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#b8975e', whiteSpace: 'nowrap' }}>{fmtEur(c.spend)}</span>
                    </motion.div>
                  );
                })}
                {analytics.topClients.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.82rem' }}>Sem dados de clientes disponíveis</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* FUNNEL TAB */}
        {activeTab === 'funnel' && (
          <motion.div key="funnel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Quote funnel */}
              <div className="yg-card" style={{ padding: '1.375rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Funil de orçamentos</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>{analytics.totalQuotes} total</p>
                {[
                  { label: 'Submetidos', value: analytics.totalQuotes, color: '#d4b47a' },
                  { label: 'Em análise', value: analytics.pendingQ, color: 'rgb(245,158,11)' },
                  { label: 'Aprovados', value: analytics.approvedQ, color: '#b8975e' },
                  { label: 'Convertidos', value: analytics.convertedQ, color: 'rgb(167,243,208)' },
                ].map((step, i) => {
                  const pct = analytics.totalQuotes > 0 ? (step.value / analytics.totalQuotes) * 100 : 0;
                  return (
                    <div key={step.label} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.42)' }}>{step.label}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: step.color }}>{step.value}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                          style={{ height: '100%', borderRadius: '9999px', background: step.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Revenue breakdown stats */}
              <div className="yg-card" style={{ padding: '1.375rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>KPIs de pipeline</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>Performance global</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { label: 'Taxa de conversão', value: `${analytics.conversionRate}%`, color: analytics.conversionRate >= 30 ? '#b8975e' : analytics.conversionRate >= 15 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' },
                    { label: 'Pipeline activo (€)', value: fmtEur(analytics.quoteValue), color: '#d4b47a' },
                    { label: 'Orçamentos pendentes', value: String(analytics.pendingQ), color: 'rgb(245,158,11)' },
                    { label: 'Orçamentos aprovados', value: String(analytics.approvedQ), color: '#b8975e' },
                    { label: 'Total convertidos', value: String(analytics.convertedQ), color: 'rgb(167,139,250)' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.42)' }}>{kpi.label}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Client Analytics View ─────────────────────────────────────────────────────

function ClientReports({ client, orders, quotes }: {
  client: ClientProfile;
  orders: Order[];
  quotes: Quote[];
}) {
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  const analytics = useMemo(() => {
    const now = new Date();
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;

    const monthlyData = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const label = d.toLocaleDateString('pt-PT', { month: 'short' });
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const startMonth = d.toISOString();
      const value = orders.filter(o => o.created_at >= startMonth && o.created_at < nextMonth && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
      return { label: label.charAt(0).toUpperCase() + label.slice(1, 3), value };
    });

    const totalSpend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const thisMonth = orders.filter(o => o.created_at >= thisMonthStart && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const lastMonth = orders.filter(o => o.created_at >= lastMonthStart && o.created_at < thisMonthStart && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const monthTrend = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

    const statusCounts: Record<string, number> = {};
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

    const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

    const totalQuotes = quotes.length;
    const pendingQuotes = quotes.filter(q => ['submitted', 'pricing', 'proposed'].includes(q.status)).length;
    const approvedQuotes = quotes.filter(q => q.status === 'approved').length;
    const convertedQuotes = quotes.filter(q => q.status === 'converted').length;
    const conversionRate = totalQuotes > 0 ? Math.round((convertedQuotes / totalQuotes) * 100) : 0;

    const validOrders = orders.filter(o => o.total_amount && o.status !== 'cancelled');
    const avgOrderValue = validOrders.length > 0 ? validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0) / validOrders.length : 0;

    const sparkDays = 30;
    const sparklineData = Array.from({ length: sparkDays }, (_, i) => {
      const d = new Date(Date.now() - (sparkDays - 1 - i) * 86400000);
      const day = d.toISOString().slice(0, 10);
      return orders.filter(o => o.created_at.startsWith(day) && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount ?? 0), 0);
    });

    const budgetPct = client.budget_limit ? Math.min(Math.round((totalSpend / client.budget_limit) * 100), 100) : null;

    return { monthlyData, totalSpend, thisMonth, monthTrend, activeOrders, deliveredOrders, totalOrders: orders.length, totalQuotes, pendingQuotes, approvedQuotes, convertedQuotes, conversionRate, avgOrderValue, sparklineData, budgetPct, statusCounts };
  }, [orders, quotes, period, client]);

  const animTotal = useCountUp(Math.round(analytics.totalSpend), 1400, 200);
  const animThisMonth = useCountUp(Math.round(analytics.thisMonth), 1200, 350);
  const animAvg = useCountUp(Math.round(analytics.avgOrderValue), 1200, 500);

  const funnelSteps = [
    { label: 'Submetidos', value: analytics.totalQuotes, color: '#d4b47a' },
    { label: 'Em análise', value: analytics.pendingQuotes, color: 'rgb(245,158,11)' },
    { label: 'Aprovados', value: analytics.approvedQuotes, color: '#b8975e' },
    { label: 'Convertidos', value: analytics.convertedQuotes, color: 'rgb(167,243,208)' },
  ];
  const funnelMax = Math.max(analytics.totalQuotes, 1);

  const pipelineStages = [
    { key: 'pending', label: 'Pendente', color: 'rgba(240,236,228,0.42)' },
    { key: 'confirmed', label: 'Confirmado', color: '#d4b47a' },
    { key: 'producing', label: 'Produção', color: 'rgb(245,158,11)' },
    { key: 'shipped', label: 'Enviado', color: '#b8975e' },
    { key: 'delivered', label: 'Entregue', color: '#b8975e' },
  ];

  return (
    <div style={{ padding: '2rem 2rem 4rem', maxWidth: '1100px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Relatórios</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.24)' }}>Análise financeira e operacional da tua conta</p>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', background: 'rgba(240,236,228,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
          {(['3m', '6m', '12m'] as const).map((p) => (
            <motion.button key={p} type="button" onClick={() => setPeriod(p)} whileTap={{ scale: 0.95 }}
              style={{ padding: '0.3rem 0.75rem', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', background: period === p ? 'rgba(154,124,74,0.16)' : 'transparent', color: period === p ? '#d4b47a' : 'rgba(240,236,228,0.42)', border: 'none' }}>
              {p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : '12 meses'}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <KPICard label="Total gasto" value={fmtEur(animTotal)} sub="acumulado histórico" icon="💶" color="#b8975e" delay={0.05} />
        <KPICard label="Este mês" value={fmtEur(animThisMonth)} sub="mês corrente" icon="📅" color="#d4b47a" trend={analytics.monthTrend} delay={0.1} />
        <KPICard label="Valor médio" value={fmtEur(animAvg)} sub="por encomenda" icon="📊" color="rgb(167,139,250)" delay={0.15} />
        <KPICard label="Conversão" value={`${analytics.conversionRate}%`} sub="orçamentos → pedidos" icon="🎯" color="rgb(245,158,11)" delay={0.2} />
      </div>

      <AnimatePresence>
        {analytics.budgetPct !== null && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="yg-card" style={{ padding: '1rem 1.375rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(240,236,228,0.42)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Budget anual utilizado</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: analytics.budgetPct > 80 ? 'rgb(239,68,68)' : analytics.budgetPct > 60 ? 'rgb(245,158,11)' : '#b8975e' }}>{analytics.budgetPct}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${analytics.budgetPct}%` }} transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', borderRadius: '9999px', background: analytics.budgetPct > 80 ? 'linear-gradient(90deg, rgb(245,158,11), rgb(239,68,68))' : 'linear-gradient(90deg, #d4b47a, #b8975e)' }} />
            </div>
            {client.budget_limit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>{fmtEurFull(analytics.totalSpend)} gastos</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>Limite: {fmtEurFull(client.budget_limit)}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }} className="yg-card" style={{ padding: '1.375rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Gasto mensal</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>{period === '3m' ? '3' : period === '6m' ? '6' : '12'} meses</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Máximo</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#d4b47a' }}>{fmtEur(Math.max(...analytics.monthlyData.map(d => d.value), 0))}</p>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={period} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }} style={{ height: '140px' }}>
              <BarChart data={analytics.monthlyData} color="#d4b47a" height={120} />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} className="yg-card" style={{ padding: '1.375rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Funil de orçamentos</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1.125rem' }}>{analytics.totalQuotes} total</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {funnelSteps.map((step, i) => {
              const pct = funnelMax > 0 ? (step.value / funnelMax) * 100 : 0;
              return (
                <div key={step.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.42)' }}>{step.label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: step.color }}>{step.value}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.4 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', borderRadius: '9999px', background: step.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.35, ease: [0.16, 1, 0.3, 1] }} className="yg-card" style={{ padding: '1.375rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Pipeline de encomendas</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>{analytics.totalOrders} encomendas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pipelineStages.map(stage => {
              const count = analytics.statusCounts[stage.key] ?? 0;
              const pct = analytics.totalOrders > 0 ? (count / analytics.totalOrders) * 100 : 0;
              return (
                <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.42)', width: '72px', flexShrink: 0 }}>{stage.label}</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', borderRadius: '9999px', background: stage.color }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: stage.color, width: '20px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} className="yg-card" style={{ padding: '1.375rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)' }}>Tendência 30 dias</p>
            <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>diário</span>
          </div>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b8975e', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            {fmtEur(analytics.sparklineData.reduce((s, v) => s + v, 0))}
          </p>
          <div style={{ height: '100px' }}>
            <LineChart data={analytics.sparklineData} color="#b8975e" height={100} width={340} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.625rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>Há 30 dias</span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>Hoje</span>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
        style={{ marginTop: '0.75rem', padding: '0.875rem 1.375rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '14px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Encomendas ativas', value: analytics.activeOrders },
          { label: 'Entregues', value: analytics.deliveredOrders },
          { label: 'Orçamentos pendentes', value: analytics.pendingQuotes },
          { label: 'Orçamentos aprovados', value: analytics.approvedQuotes },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f0ece4' }}>{s.value}</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)' }}>{s.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allClients, setAllClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/reports'); return; }

      const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
      setIsAdmin(admin);

      if (admin) {
        // Admin: fetch all orders, all quotes, all clients + their spend
        const [ordersRes, quotesRes, clientsRes] = await Promise.all([
          supabase.from('orders').select('id, status, total_amount, created_at, client_id').order('created_at', { ascending: false }),
          supabase.from('quotes').select('id, status, total_amount, created_at, client_id').order('created_at', { ascending: false }),
          supabase.from('clients').select('id, name, company, tier').order('created_at', { ascending: false }),
        ]);

        const rawOrders = (ordersRes.data ?? []) as Order[];
        const rawQuotes = (quotesRes.data ?? []) as Quote[];
        const rawClients = (clientsRes.data ?? []) as Array<{ id: string; name: string | null; company: string | null; tier: string | null }>;

        // Build spend per client
        const spendMap: Record<string, number> = {};
        const countMap: Record<string, number> = {};
        for (const o of rawOrders) {
          if (o.client_id && o.status !== 'cancelled' && o.total_amount) {
            spendMap[o.client_id] = (spendMap[o.client_id] ?? 0) + (o.total_amount ?? 0);
            countMap[o.client_id] = (countMap[o.client_id] ?? 0) + 1;
          }
        }

        setOrders(rawOrders);
        setQuotes(rawQuotes);
        setAllClients(rawClients.map(c => ({
          id: c.id,
          name: c.name,
          company: c.company,
          tier: c.tier,
          spend: spendMap[c.id] ?? 0,
          orderCount: countMap[c.id] ?? 0,
        })));
      } else {
        // Client: own data only
        const { data: clientData } = await supabase.from('clients').select('id, name, company, tier, budget_limit').eq('auth_user_id', user.id).single();
        if (!clientData) { setLoading(false); return; }
        setClient(clientData as ClientProfile);

        const [ordersRes, quotesRes] = await Promise.all([
          supabase.from('orders').select('id, status, total_amount, created_at').eq('client_id', clientData.id).order('created_at', { ascending: false }),
          supabase.from('quotes').select('id, status, total_amount, created_at').eq('client_id', clientData.id).order('created_at', { ascending: false }),
        ]);

        setOrders((ordersRes.data ?? []) as Order[]);
        setQuotes((quotesRes.data ?? []) as Quote[]);
      }

            } catch (err) {
        console.error("[reports] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <PortalLayout userName={undefined} companyName={undefined} tier={undefined}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        <div style={{ padding: '2rem', maxWidth: '1100px' }}>
          <div style={{ height: '32px', width: '200px', borderRadius: '8px', background: 'rgba(240,236,228,0.06)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: '2rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ height: '100px', borderRadius: '16px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <div style={{ height: '280px', borderRadius: '16px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: '280px', borderRadius: '16px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (isAdmin) {
    return (
      <PortalLayout userName="Admin" companyName="YourGift" tier="admin">
        <AdminReports allOrders={orders} allQuotes={quotes} allClients={allClients} />
      </PortalLayout>
    );
  }

  if (!client) {
    return (
      <PortalLayout userName={undefined} companyName={undefined} tier={undefined}>
        <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)' }}>Perfil não encontrado.</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout userName={client.name ?? undefined} companyName={client.company ?? undefined} tier={client.tier ?? undefined}>
      <ClientReports client={client} orders={orders} quotes={quotes} />
    </PortalLayout>
  );
}
