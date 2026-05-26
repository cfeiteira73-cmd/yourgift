'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

interface Quote {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  budget_limit: number | null;
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
  if (n >= 1000) return `€${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtEurFull(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
}

// ── Custom SVG Bar Chart ──────────────────────────────────────────────────────

function BarChart({ data, color = 'rgb(77,163,255)', height = 120 }: {
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
            {/* track */}
            <rect x={x} y={0} width={barW} height={height} rx={6} fill="rgba(255,255,255,0.04)" />
            {/* bar */}
            <rect x={x} y={y} width={barW} height={bh} rx={6} fill={color} opacity={0.85} />
            {/* label */}
            <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="rgb(80,92,110)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Custom SVG Line Chart ─────────────────────────────────────────────────────

function LineChart({ data, color = 'rgb(99,230,190)', height = 80, width = 300 }: {
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
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: color, opacity: 0.06, filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'absolute', top: '-4px', right: '0.875rem', fontSize: '2rem', opacity: 0.1 }}>{icon}</div>

      <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.4rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgb(100,112,130)' }}>{sub}</span>
        {trend !== undefined && trend !== 0 && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem',
            borderRadius: '9999px',
            background: trend > 0 ? 'rgba(99,230,190,0.12)' : 'rgba(239,68,68,0.12)',
            color: trend > 0 ? 'rgb(99,230,190)' : 'rgb(239,68,68)',
          }}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/reports'); return; }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company, tier, budget_limit')
        .eq('auth_user_id', user.id)
        .single();

      if (!clientData) { setLoading(false); return; }
      setClient(clientData as ClientProfile);

      const [ordersRes, quotesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, total_amount, created_at')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('quotes')
          .select('id, status, total_amount, created_at')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false }),
      ]);

      setOrders((ordersRes.data ?? []) as Order[]);
      setQuotes((quotesRes.data ?? []) as Quote[]);
      setLoading(false);
    }
    load();
  }, [router]);

  // ── Derived analytics ────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const now = new Date();
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;

    // Monthly spend data for bar chart
    const monthlyData = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const label = d.toLocaleDateString('pt-PT', { month: 'short' });
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const startMonth = d.toISOString();
      const value = orders
        .filter((o) => o.created_at >= startMonth && o.created_at < nextMonth && o.status !== 'cancelled')
        .reduce((s, o) => s + (o.total_amount ?? 0), 0);
      return { label: label.charAt(0).toUpperCase() + label.slice(1, 3), value };
    });

    // Total spend (non-cancelled)
    const totalSpend = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);

    // This month vs last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const thisMonth = orders
      .filter((o) => o.created_at >= thisMonthStart && o.status !== 'cancelled')
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const lastMonth = orders
      .filter((o) => o.created_at >= lastMonthStart && o.created_at < thisMonthStart && o.status !== 'cancelled')
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const monthTrend = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

    // Order counts by status
    const statusCounts: Record<string, number> = {};
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

    // Active orders
    const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'draft'].includes(o.status)).length;
    const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;

    // Quote funnel
    const totalQuotes = quotes.length;
    const pendingQuotes = quotes.filter((q) => ['submitted', 'pricing', 'proposed'].includes(q.status)).length;
    const approvedQuotes = quotes.filter((q) => q.status === 'approved').length;
    const convertedQuotes = quotes.filter((q) => q.status === 'converted').length;
    const conversionRate = totalQuotes > 0 ? Math.round((convertedQuotes / totalQuotes) * 100) : 0;

    // Avg order value
    const validOrders = orders.filter((o) => o.total_amount && o.status !== 'cancelled');
    const avgOrderValue = validOrders.length > 0
      ? validOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0) / validOrders.length
      : 0;

    // Daily revenue last N days for sparkline
    const sparkDays = 30;
    const sparklineData = Array.from({ length: sparkDays }, (_, i) => {
      const d = new Date(Date.now() - (sparkDays - 1 - i) * 86400000);
      const day = d.toISOString().slice(0, 10);
      return orders
        .filter((o) => o.created_at.startsWith(day) && o.status !== 'cancelled')
        .reduce((s, o) => s + (o.total_amount ?? 0), 0);
    });

    // Budget usage
    const budgetPct = client?.budget_limit
      ? Math.min(Math.round((totalSpend / client.budget_limit) * 100), 100)
      : null;

    return {
      monthlyData, totalSpend, thisMonth, monthTrend,
      activeOrders, deliveredOrders, totalOrders: orders.length,
      totalQuotes, pendingQuotes, approvedQuotes, convertedQuotes, conversionRate,
      avgOrderValue, sparklineData, budgetPct, statusCounts,
    };
  }, [orders, quotes, period, client]);

  const animTotal = useCountUp(Math.round(analytics.totalSpend), 1400, 200);
  const animThisMonth = useCountUp(Math.round(analytics.thisMonth), 1200, 350);
  const animAvg = useCountUp(Math.round(analytics.avgOrderValue), 1200, 500);

  // Quote funnel steps
  const funnelSteps = [
    { label: 'Submetidos', value: analytics.totalQuotes, color: 'rgb(77,163,255)' },
    { label: 'Em análise', value: analytics.pendingQuotes, color: 'rgb(245,158,11)' },
    { label: 'Aprovados', value: analytics.approvedQuotes, color: 'rgb(99,230,190)' },
    { label: 'Convertidos', value: analytics.convertedQuotes, color: 'rgb(167,243,208)' },
  ];
  const funnelMax = Math.max(analytics.totalQuotes, 1);

  // Order pipeline
  const pipelineStages = [
    { key: 'pending', label: 'Pendente', color: 'rgb(120,130,150)' },
    { key: 'confirmed', label: 'Confirmado', color: 'rgb(77,163,255)' },
    { key: 'producing', label: 'Produção', color: 'rgb(245,158,11)' },
    { key: 'shipped', label: 'Enviado', color: 'rgb(116,231,255)' },
    { key: 'delivered', label: 'Entregue', color: 'rgb(99,230,190)' },
  ];

  if (loading) {
    return (
      <PortalLayout userName={undefined} companyName={undefined} tier={undefined}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        <div style={{ padding: '2rem', maxWidth: '1100px' }}>
          <div style={{ height: '32px', width: '180px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: '2rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: '100px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <div style={{ height: '280px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: '280px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div style={{ padding: '2rem 2rem 4rem', maxWidth: '1100px' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Relatórios
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'rgb(80,92,110)' }}>
              Análise financeira e operacional da tua conta
            </p>
          </div>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: '0.375rem', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['3m', '6m', '12m'] as const).map((p) => (
              <motion.button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '7px',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 150ms ease',
                  background: period === p ? 'rgba(77,163,255,0.18)' : 'transparent',
                  color: period === p ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
                  border: 'none',
                }}
              >
                {p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : '12 meses'}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <KPICard
            label="Total gasto"
            value={fmtEur(animTotal)}
            sub="acumulado histórico"
            icon="💶"
            color="rgb(99,230,190)"
            delay={0.05}
          />
          <KPICard
            label="Este mês"
            value={fmtEur(animThisMonth)}
            sub="mês corrente"
            icon="📅"
            color="rgb(77,163,255)"
            trend={analytics.monthTrend}
            delay={0.1}
          />
          <KPICard
            label="Valor médio"
            value={fmtEur(animAvg)}
            sub="por encomenda"
            icon="📊"
            color="rgb(167,139,250)"
            delay={0.15}
          />
          <KPICard
            label="Conversão"
            value={`${analytics.conversionRate}%`}
            sub="orçamentos → pedidos"
            icon="🎯"
            color="rgb(245,158,11)"
            delay={0.2}
          />
        </div>

        {/* ── Budget bar (if has limit) ─────────────────────────────────────── */}
        <AnimatePresence>
          {analytics.budgetPct !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="yg-card"
              style={{ padding: '1rem 1.375rem', marginBottom: '1.25rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgb(120,130,150)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Budget anual utilizado
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: analytics.budgetPct > 80 ? 'rgb(239,68,68)' : analytics.budgetPct > 60 ? 'rgb(245,158,11)' : 'rgb(99,230,190)' }}>
                  {analytics.budgetPct}%
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${analytics.budgetPct}%` }}
                  transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: '100%', borderRadius: '9999px',
                    background: analytics.budgetPct > 80
                      ? 'linear-gradient(90deg, rgb(245,158,11), rgb(239,68,68))'
                      : 'linear-gradient(90deg, rgb(77,163,255), rgb(99,230,190))',
                  }}
                />
              </div>
              {client?.budget_limit && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>{fmtEurFull(analytics.totalSpend)} gastos</span>
                  <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>Limite: {fmtEurFull(client.budget_limit)}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Charts row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>

          {/* Monthly spend bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="yg-card"
            style={{ padding: '1.375rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>
                  Gasto mensal
                </p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em' }}>
                  {period === '3m' ? '3' : period === '6m' ? '6' : '12'} meses
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>Máximo</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'rgb(77,163,255)' }}>
                  {fmtEur(Math.max(...analytics.monthlyData.map((d) => d.value), 0))}
                </p>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={period}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                style={{ height: '140px' }}
              >
                <BarChart data={analytics.monthlyData} color="rgb(77,163,255)" height={120} />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Quote funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="yg-card"
            style={{ padding: '1.375rem' }}
          >
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>
              Funil de orçamentos
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '1.125rem' }}>
              {analytics.totalQuotes} total
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {funnelSteps.map((step, i) => {
                const pct = funnelMax > 0 ? (step.value / funnelMax) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgb(120,130,150)' }}>{step.label}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: step.color }}>{step.value}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, delay: 0.4 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: '100%', borderRadius: '9999px', background: step.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Bottom row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

          {/* Order pipeline breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="yg-card"
            style={{ padding: '1.375rem' }}
          >
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>
              Pipeline de encomendas
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
              {analytics.totalOrders} encomendas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pipelineStages.map((stage) => {
                const count = analytics.statusCounts[stage.key] ?? 0;
                const pct = analytics.totalOrders > 0 ? (count / analytics.totalOrders) * 100 : 0;
                return (
                  <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgb(100,112,130)', width: '72px', flexShrink: 0 }}>{stage.label}</span>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: '100%', borderRadius: '9999px', background: stage.color }}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: stage.color, width: '20px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* 30-day revenue trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="yg-card"
            style={{ padding: '1.375rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(80,92,110)' }}>
                Tendência 30 dias
              </p>
              <span style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>diário</span>
            </div>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(99,230,190)', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
              {fmtEur(analytics.sparklineData.reduce((s, v) => s + v, 0))}
            </p>
            <div style={{ height: '100px' }}>
              <LineChart data={analytics.sparklineData} color="rgb(99,230,190)" height={100} width={340} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.625rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>Há 30 dias</span>
              <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>Hoje</span>
            </div>
          </motion.div>
        </div>

        {/* ── Stats footer ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{
            marginTop: '0.75rem',
            padding: '0.875rem 1.375rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px',
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Encomendas ativas', value: analytics.activeOrders },
            { label: 'Entregues', value: analytics.deliveredOrders },
            { label: 'Orçamentos pendentes', value: analytics.pendingQuotes },
            { label: 'Orçamentos aprovados', value: analytics.approvedQuotes },
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'rgb(245,247,251)' }}>{s.value}</span>
              <span style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)' }}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </PortalLayout>
  );
}
