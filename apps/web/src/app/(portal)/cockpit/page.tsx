'use client';

// ── OMEGA PROTOCOL — S2: Executive Cockpit ────────────────────────────────────
//
// War room · SLA radar · Profitability radar · Operations grid · Live alerts
// Admin-only: shows platform-wide intelligence; client: shows personal metrics
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, fadeUp, staggerContainer, staggerItem, delayedFadeUp, tapScale } from '@/lib/motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  totalRevenue: number;
  avgOrderValue: number;
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  deliveryRate: number;
  totalQuotes: number;
}

interface PipelineStage {
  status: string;
  count: number;
  revenue: number;
}

interface SlaCompliance {
  onTime: number;
  atRisk: number;
  violated: number;
  complianceRate: number;
}

interface QuoteFunnel {
  total: number;
  pending: number;
  approved: number;
  converted: number;
  rejected: number;
  conversionRate: number;
  totalPipelineValue: number;
}

interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  amount?: number;
  clientName?: string;
  status?: string;
  entityRef?: string;
  timestamp: string;
}

interface AnalyticsData {
  scope: string;
  summary: AnalyticsSummary;
  pipeline: PipelineStage[];
  slaCompliance: SlaCompliance;
  quotes: QuoteFunnel;
  clients?: { newClients: number; byTier: Record<string, number> } | null;
  alerts?: { total: number; critical: number; lowStock: number; resolved: number } | null;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', producing: 'Em produção',
  shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado', draft: 'Rascunho',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'rgb(245,158,11)', confirmed: '#d4b47a', producing: '#b8975e',
  shipped: 'rgb(167,139,250)', delivered: '#b8975e', cancelled: 'rgb(239,68,68)', draft: 'rgba(240,236,228,0.24)',
};

const EVENT_ICONS: Record<string, string> = {
  order_created: '📦', order_status_change: '🔄', quote_submitted: '📋',
  quote_status_change: '💬', client_joined: '👤', delivery: '✅',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `há ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `há ${Math.floor(diff / 3600000)}h`;
  return `há ${Math.floor(diff / 86400000)}d`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCell({ label, value, sub, color, delay = 0, glow = false }: {
  label: string; value: string; sub?: string; color: string; delay?: number; glow?: boolean;
}) {
  return (
    <motion.div
      {...delayedFadeUp(0, delay)}
      whileHover={{ y: -1 }}
      transition={springSnappy}
      className="yg-card"
      style={{ padding: '1rem 1.125rem', position: 'relative', overflow: 'hidden' }}
    >
      {glow && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }} />
      )}
      <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color, letterSpacing: '-0.035em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.25rem' }}>{sub}</div>}
    </motion.div>
  );
}

function SlaRadar({ compliance }: { compliance: SlaCompliance }) {
  const total = compliance.onTime + compliance.atRisk + compliance.violated;
  if (total === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'rgba(240,236,228,0.24)' }}>
      <div style={{ fontSize: '2rem' }}>✓</div>
      <div style={{ fontSize: '0.72rem' }}>Nenhuma encomenda activa</div>
    </div>
  );

  const onTimePct = Math.round((compliance.onTime / total) * 100);
  const atRiskPct = Math.round((compliance.atRisk / total) * 100);
  const violatedPct = 100 - onTimePct - atRiskPct;

  // SVG donut
  const radius = 52;
  const cx = 70; const cy = 70;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { pct: onTimePct, color: '#b8975e', label: 'No prazo' },
    { pct: atRiskPct, color: 'rgb(245,158,11)', label: 'Em risco' },
    { pct: violatedPct, color: 'rgb(239,68,68)', label: 'Violado' },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dasharray = `${(seg.pct / 100) * circumference} ${circumference}`;
    const dashoffset = -offset * circumference / 100;
    offset += seg.pct;
    return { ...seg, dasharray, dashoffset };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '100%' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth="14" />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray: '0 999' }}
            animate={{ strokeDasharray: arc.dasharray }}
            transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {/* Center */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#f0ece4" fontSize="18" fontWeight="800">{compliance.complianceRate}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(240,236,228,0.24)" fontSize="9">SLA</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.42)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: seg.color }}>{seg.pct}%</span>
          </div>
        ))}
        <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Total activas: {total}</div>
        </div>
      </div>
    </div>
  );
}

function PipelineBar({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(...stages.map(s => s.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {stages.slice(0, 6).map((stage, i) => (
        <motion.div key={stage.status} {...delayedFadeUp(i, 0.1, 0.07)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.42)' }}>{STATUS_LABELS[stage.status] ?? stage.status}</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: STATUS_COLORS[stage.status] ?? 'rgba(240,236,228,0.42)', fontWeight: 700 }}>{stage.count}</span>
              <span style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{fmtEur(stage.revenue)}</span>
            </div>
          </div>
          <div className="prog-track">
            <motion.div
              className="prog-fill"
              style={{ background: STATUS_COLORS[stage.status] ?? '#d4b47a', opacity: 0.85 }}
              initial={{ width: 0 }}
              animate={{ width: `${(stage.count / max) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {events.slice(0, 8).map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springSnappy, delay: i * 0.05 }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            padding: '0.625rem 0',
            borderBottom: i < events.length - 1 ? '1px solid rgba(240,236,228,0.06)' : 'none',
          }}
        >
          <div style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: '0.05rem' }}>
            {EVENT_ICONS[ev.type] ?? '●'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'rgb(200,215,235)', lineHeight: 1.4 }}>{ev.description}</div>
            {ev.amount && ev.amount > 0 && (
              <div style={{ fontSize: '0.65rem', color: '#b8975e', fontWeight: 700, marginTop: '0.1rem' }}>{fmtEur(ev.amount)}</div>
            )}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', flexShrink: 0 }}>{fmtTime(ev.timestamp)}</div>
        </motion.div>
      ))}
      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>
          Sem eventos recentes
        </div>
      )}
    </div>
  );
}

function AlertBanner({ alerts }: { alerts: { total: number; critical: number; lowStock: number; resolved: number } }) {
  if (alerts.critical === 0 && alerts.lowStock === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.625rem 1rem',
        background: alerts.critical > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${alerts.critical > 0 ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`,
        borderRadius: '12px',
        marginBottom: '1rem',
      }}
    >
      <div style={{ fontSize: '1rem' }}>{alerts.critical > 0 ? '🚨' : '⚠️'}</div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: alerts.critical > 0 ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}>
          {alerts.critical > 0 && `${alerts.critical} produto(s) sem stock`}
          {alerts.critical > 0 && alerts.lowStock > 0 && ' · '}
          {alerts.lowStock > 0 && `${alerts.lowStock} com stock baixo`}
        </span>
      </div>
      <Link href="/products" style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d4b47a', textDecoration: 'none' }}>Ver inventário →</Link>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(null!);

  const load = useCallback(async (p: string) => {
    try {
      const [analyticsRes, activityRes] = await Promise.all([
        fetch(`/api/analytics?period=${p}&scope=auto`),
        fetch('/api/activity?limit=20'),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (activityRes.ok) {
        const d = await activityRes.json();
        setActivity(d.events ?? []);
      }
      setLastRefresh(new Date());
    } catch {
      // non-fatal — data stays stale
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login?next=/cockpit'); return; }
        const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
        setIsAdmin(admin);
        const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);
        await load(period);
      } catch (err) {
        console.error('[cockpit] init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    refreshTimer.current = setInterval(() => load(period), 60000);
    return () => clearInterval(refreshTimer.current);
  }, [load, period]);

  const handlePeriodChange = (p: '7d' | '30d' | '90d') => {
    setPeriod(p);
    load(p);
  };

  const s = analytics?.summary;
  const sla = analytics?.slaCompliance;
  const pipeline = analytics?.pipeline ?? [];
  const quotes = analytics?.quotes;
  const alerts = analytics?.alerts;

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>

        {/* Header */}
        <motion.div
          variants={fadeUp(0)}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>
                Cockpit Executivo
              </h1>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.62rem', fontWeight: 700, color: '#b8975e', background: 'rgba(184,151,94,0.10)', border: '1px solid rgba(184,151,94,0.18)', borderRadius: '9999px', padding: '0.2rem 0.5rem' }}>
                <span className="status-pulse status-pulse-green" style={{ width: '5px', height: '5px' }} />
                LIVE
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.24)' }}>
              {isAdmin ? 'Vista global da plataforma' : 'A tua actividade'}
              {' · '}Actualizado: {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            {(['7d', '30d', '90d'] as const).map(p => (
              <motion.button
                key={p}
                type="button"
                whileTap={tapScale}
                onClick={() => handlePeriodChange(p)}
                style={{
                  padding: '0.3rem 0.625rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  background: period === p ? 'rgba(154,124,74,0.14)' : 'rgba(240,236,228,0.04)',
                  color: period === p ? '#d4b47a' : 'rgba(240,236,228,0.42)',
                  border: period === p ? '1px solid rgba(154,124,74,0.28)' : '1px solid rgba(240,236,228,0.06)',
                  transition: 'all 150ms',
                }}
              >
                {p}
              </motion.button>
            ))}
            <motion.button
              type="button"
              whileTap={tapScale}
              onClick={() => load(period)}
              style={{ padding: '0.3rem 0.625rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(240,236,228,0.04)', color: 'rgba(240,236,228,0.42)', border: '1px solid rgba(240,236,228,0.06)', transition: 'all 150ms' }}
            >
              ↺ Actualizar
            </motion.button>
          </div>
        </motion.div>

        {/* Alerts banner (admin) */}
        {!loading && alerts && <AlertBanner alerts={alerts} />}

        {/* Loading skeletons */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="skeleton" style={{ height: '220px' }} />
              <div className="skeleton" style={{ height: '220px' }} />
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <KpiCell label="Receita Total" value={s ? fmtEur(s.totalRevenue) : '—'} sub={`${period}`} color="#b8975e" delay={0} glow />
                <KpiCell label="Encomendas" value={s ? String(s.totalOrders) : '—'} sub={`${s?.activeOrders ?? 0} ativas`} color="#d4b47a" delay={0.06} />
                <KpiCell label="Valor Médio" value={s ? fmtEur(s.avgOrderValue) : '—'} sub="por encomenda" color="#b8975e" delay={0.12} />
                <KpiCell label="Taxa Entrega" value={s ? `${s.deliveryRate}%` : '—'} sub={`${s?.deliveredOrders ?? 0} entregues`} color={s && s.deliveryRate >= 80 ? '#b8975e' : 'rgb(245,158,11)'} delay={0.18} />
              </div>

              {/* Row 2: SLA Radar + Pipeline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>

                {/* SLA Radar */}
                <motion.div {...delayedFadeUp(0, 0.2)} className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0ece4' }}>Radar SLA</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Conformidade operacional</div>
                    </div>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      color: sla && sla.complianceRate >= 85 ? '#b8975e' : sla && sla.complianceRate >= 65 ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
                      background: sla && sla.complianceRate >= 85 ? 'rgba(184,151,94,0.10)' : 'rgba(245,158,11,0.1)',
                      border: '1px solid currentColor', borderRadius: '9999px', padding: '0.15rem 0.45rem',
                    }}>
                      {sla ? `${sla.complianceRate}%` : '—'}
                    </span>
                  </div>
                  {sla ? <SlaRadar compliance={sla} /> : <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Dados SLA indisponíveis</div>}
                </motion.div>

                {/* Order Pipeline */}
                <motion.div {...delayedFadeUp(1, 0.2)} className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0ece4' }}>Pipeline de Encomendas</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Distribuição por estado</div>
                    </div>
                    <Link href="/orders" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver tudo →</Link>
                  </div>
                  {pipeline.length > 0 ? <PipelineBar stages={pipeline} /> : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Sem encomendas no período</div>
                  )}
                </motion.div>
              </div>

              {/* Row 3: Quote Funnel + Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.75rem', marginBottom: '0.875rem' }}>

                {/* Quote conversion funnel */}
                <motion.div {...delayedFadeUp(0, 0.32)} className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ marginBottom: '0.875rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0ece4' }}>Funil de Orçamentos</div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Taxa de conversão</div>
                  </div>
                  {quotes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { label: 'Total', value: quotes.total, color: 'rgba(240,236,228,0.42)', width: 100 },
                        { label: 'Em análise', value: quotes.pending, color: '#d4b47a', width: quotes.total > 0 ? (quotes.pending / quotes.total) * 100 : 0 },
                        { label: 'Aprovados', value: quotes.approved, color: '#b8975e', width: quotes.total > 0 ? (quotes.approved / quotes.total) * 100 : 0 },
                        { label: 'Convertidos', value: quotes.converted, color: '#b8975e', width: quotes.total > 0 ? (quotes.converted / quotes.total) * 100 : 0 },
                        { label: 'Rejeitados', value: quotes.rejected, color: 'rgb(239,68,68)', width: quotes.total > 0 ? (quotes.rejected / quotes.total) * 100 : 0 },
                      ].map((row, i) => (
                        <div key={row.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.67rem', color: 'rgba(240,236,228,0.42)' }}>{row.label}</span>
                            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: row.color }}>{row.value}</span>
                          </div>
                          <div className="prog-track">
                            <motion.div
                              className="prog-fill"
                              style={{ background: row.color, opacity: i === 0 ? 0.35 : 0.8 }}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.width}%` }}
                              transition={{ duration: 0.7, delay: 0.2 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(240,236,228,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Taxa conversão</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: quotes.conversionRate >= 40 ? '#b8975e' : 'rgb(245,158,11)' }}>
                          {quotes.conversionRate}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Valor pipeline</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d4b47a' }}>{fmtEur(quotes.totalPipelineValue)}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Dados indisponíveis</div>
                  )}
                </motion.div>

                {/* Activity feed */}
                <motion.div {...delayedFadeUp(1, 0.32)} className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0ece4' }}>Feed de Actividade</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Últimos 20 eventos</div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', color: '#b8975e' }}>
                      <span className="status-pulse status-pulse-green" style={{ width: '5px', height: '5px' }} />
                      Live
                    </span>
                  </div>
                  <ActivityFeed events={activity} />
                </motion.div>
              </div>

              {/* Row 4: Admin client grid OR client quick stats */}
              {isAdmin && analytics?.clients && (
                <motion.div {...delayedFadeUp(0, 0.45)} className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0ece4' }}>Novos Clientes · {period}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Aquisição por tier</div>
                    </div>
                    <Link href="/clients" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Gerir clientes →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.5rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d4b47a', letterSpacing: '-0.03em' }}>{analytics.clients.newClients}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>Total novos</div>
                    </div>
                    {(['standard', 'premium', 'enterprise', 'vip'] as const).map(tier => {
                      const count = analytics.clients!.byTier[tier] ?? 0;
                      const tierColors: Record<string, string> = { standard: 'rgb(160,172,190)', premium: '#d4b47a', enterprise: '#b8975e', vip: 'rgb(245,158,11)' };
                      return (
                        <div key={tier} style={{ padding: '0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tierColors[tier], letterSpacing: '-0.03em' }}>{count}</div>
                          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem', textTransform: 'capitalize' }}>{tier}</div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Quick actions row */}
              <motion.div {...delayedFadeUp(0, 0.55)} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                {[
                  { label: '+ Nova Encomenda', href: '/orders/new', color: '#d4b47a', bg: 'rgba(154,124,74,0.12)', border: 'rgba(154,124,74,0.22)' },
                  { label: '+ Novo Orçamento', href: '/quotes/new', color: '#b8975e', bg: 'rgba(184,151,94,0.10)', border: 'rgba(184,151,94,0.18)' },
                  { label: 'Ver Relatórios', href: '/reports', color: '#b8975e', bg: 'rgba(184,151,94,0.08)', border: 'rgba(184,151,94,0.18)' },
                  { label: 'Produção', href: '/production', color: 'rgb(167,139,250)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
                ].map((action, i) => (
                  <motion.div key={action.href} {...delayedFadeUp(i, 0.55, 0.06)}>
                    <Link href={action.href} style={{ textDecoration: 'none' }}>
                      <motion.div
                        whileHover={{ y: -1 }}
                        whileTap={tapScale}
                        transition={springSnappy}
                        style={{ padding: '0.45rem 0.875rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, color: action.color, background: action.bg, border: `1px solid ${action.border}`, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {action.label}
                      </motion.div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </PortalLayout>
  );
}
