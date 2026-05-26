'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  products: { title: string; images: string[] } | null;
}

export interface RecentOrder {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  order_items: OrderItem[];
}

export interface CommandCenterProps {
  userName?: string;
  companyName?: string;
  tier?: string;
  totalThisMonth: number;
  activeOrders: number;
  pendingQuotes: number;
  budgetDisplay: string;
  orders: RecentOrder[];
  pipeline: Record<string, number>;
  dailyRevenue: number[];
}

// ── Counter hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) frame.current = requestAnimationFrame(animate);
      };
      frame.current = requestAnimationFrame(animate);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, delay]);

  return value;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 120, height = 40 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * w,
    y: pad + h - ((v - min) / range) * h,
  }));

  const linePath = points.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, '');

  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:      { label: 'Rascunho',   color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.1)', border: 'rgba(120,130,150,0.2)' },
  submitted:  { label: 'Submetido',  color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  confirmed:  { label: 'Confirmado', color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.1)',  border: 'rgba(77,163,255,0.2)'  },
  production: { label: 'Produção',   color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.1)', border: 'rgba(116,231,255,0.2)' },
  shipped:    { label: 'Enviado',    color: 'rgb(167,243,208)', bg: 'rgba(167,243,208,0.1)', border: 'rgba(167,243,208,0.2)' },
  delivered:  { label: 'Entregue',   color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)',  border: 'rgba(99,230,190,0.2)'  },
  cancelled:  { label: 'Cancelado',  color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'   },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
      textTransform: 'uppercase', color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: '6px', padding: '0.2rem 0.5rem',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon, accentColor, sparkData, index, isCurrency,
}: {
  label: string; value: number; sub?: string; icon: React.ReactNode;
  accentColor: string; sparkData?: number[]; index: number; isCurrency?: boolean;
}) {
  const animated = useCountUp(value, 1200, index * 120);

  const display = isCurrency
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(animated)
    : String(animated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: '18px',
        padding: '1.375rem 1.5rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 24px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: `${accentColor}18`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `${accentColor}15`, border: `1px solid ${accentColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor, flexShrink: 0,
        }}>
          {icon}
        </div>
        {sparkData && sparkData.some(v => v > 0) && (
          <Sparkline data={sparkData} color={accentColor} width={80} height={32} />
        )}
      </div>

      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'rgb(245,247,251)', lineHeight: 1, marginBottom: '0.25rem' }}>
        {display}
      </div>
      {sub && (
        <div style={{ fontSize: '0.73rem', color: 'rgb(90,102,120)' }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

// ── Pipeline bar ──────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'draft',      label: 'Rascunho',   color: 'rgb(80,92,110)' },
  { key: 'submitted',  label: 'Submetido',  color: 'rgb(245,158,11)' },
  { key: 'production', label: 'Produção',   color: 'rgb(116,231,255)' },
  { key: 'shipped',    label: 'Enviado',    color: 'rgb(167,243,208)' },
  { key: 'delivered',  label: 'Entregue',   color: 'rgb(99,230,190)' },
];

function PipelineViz({ pipeline }: { pipeline: Record<string, number> }) {
  const total = Object.values(pipeline).reduce((s, v) => s + v, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px', padding: '1.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>
            Pipeline de Encomendas
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(220,228,238)' }}>
            {total} encomendas
          </div>
        </div>
        <Link href="/orders" style={{ fontSize: '0.78rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 500 }}>
          Ver todas →
        </Link>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: '2px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.25rem', height: '6px' }}>
          {PIPELINE_STAGES.map((stage) => {
            const count = pipeline[stage.key] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <motion.div
                key={stage.key}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.6, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                style={{ height: '100%', width: `${pct}%`, background: stage.color, transformOrigin: 'left' }}
              />
            );
          })}
        </div>
      )}

      {/* Stage cards */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {PIPELINE_STAGES.map((stage, i) => {
          const count = pipeline[stage.key] ?? 0;
          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.06, duration: 0.3 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.25rem', padding: '0.625rem 1rem',
                background: count > 0 ? `${stage.color}10` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${count > 0 ? `${stage.color}25` : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '10px', minWidth: '70px',
              }}
            >
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: count > 0 ? stage.color : 'rgb(60,72,88)', lineHeight: 1 }}>
                {count}
              </span>
              <span style={{ fontSize: '0.65rem', color: count > 0 ? 'rgb(140,152,168)' : 'rgb(60,72,88)', fontWeight: 500, textAlign: 'center' }}>
                {stage.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ orders }: { orders: RecentOrder[] }) {
  const events = orders.map((o) => ({
    id: o.id,
    ref: o.ref,
    status: o.status,
    amount: o.total_amount,
    date: new Date(o.created_at),
    product: o.order_items?.[0]?.products?.title ?? 'Produto',
    extraCount: Math.max(0, (o.order_items?.length ?? 1) - 1),
  })).sort((a, b) => b.date.getTime() - a.date.getTime());

  const relativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'agora mesmo';
    if (mins < 60) return `há ${mins}m`;
    if (hours < 24) return `há ${hours}h`;
    if (days < 7) return `há ${days}d`;
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px', padding: '1.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>
            Atividade Recente
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(220,228,238)' }}>
            Últimas encomendas
          </div>
        </div>
        <Link href="/orders" style={{ fontSize: '0.78rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 500 }}>
          Ver todas →
        </Link>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>📦</div>
          <p style={{ color: 'rgb(80,92,110)', fontSize: '0.875rem' }}>Ainda não tens encomendas.</p>
          <Link href="/quotes/new" style={{ display: 'inline-block', marginTop: '1rem', color: 'rgb(77,163,255)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
            Criar primeiro orçamento →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {events.map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.05, duration: 0.3 }}
            >
              <Link href={`/orders/${ev.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.75rem 0',
                    borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 150ms',
                    borderRadius: '8px', margin: '0 -0.5rem', padding: '0.75rem 0.5rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: `${STATUS_CONFIG[ev.status]?.bg ?? 'rgba(255,255,255,0.05)'}`,
                    border: `1px solid ${STATUS_CONFIG[ev.status]?.border ?? 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: STATUS_CONFIG[ev.status]?.color ?? 'rgb(120,130,150)',
                    fontSize: '0.85rem',
                  }}>
                    📦
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, color: 'rgb(200,210,225)' }}>
                        {ev.ref}
                      </span>
                      <StatusPill status={ev.status} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgb(90,102,120)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.product}{ev.extraCount > 0 ? ` +${ev.extraCount} mais` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {ev.amount != null && ev.amount > 0 && (
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'rgb(99,230,190)', marginBottom: '0.1rem' }}>
                        {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(ev.amount)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'rgb(70,82,100)' }}>
                      {relativeTime(ev.date)}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: '/quotes/new',
    label: 'Novo Orçamento',
    desc: 'Proposta em 24h',
    color: 'rgb(77,163,255)',
    emoji: '📋',
  },
  {
    href: '/products',
    label: 'Ver Catálogo',
    desc: '2.400+ produtos',
    color: 'rgb(116,231,255)',
    emoji: '🛍️',
  },
  {
    href: '/assets',
    label: 'Ficheiros',
    desc: 'Logos e artes',
    color: 'rgb(99,230,190)',
    emoji: '🎨',
  },
  {
    href: '/orders/new',
    label: 'Encomenda',
    desc: 'Direto do catálogo',
    color: 'rgb(245,158,11)',
    emoji: '⚡',
  },
];

function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(80,92,110)', marginBottom: '0.75rem' }}>
        Ações Rápidas
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        {QUICK_ACTIONS.map((action, i) => (
          <motion.div
            key={action.href}
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + i * 0.06, duration: 0.3 }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link href={action.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                padding: '1rem', borderRadius: '14px',
                background: `${action.color}08`,
                border: `1px solid ${action.color}18`,
                cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = `${action.color}12`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${action.color}30`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = `${action.color}08`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${action.color}18`;
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{action.emoji}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(220,228,238)', marginBottom: '0.15rem' }}>
                  {action.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgb(90,102,120)' }}>
                  {action.desc}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main CommandCenter ────────────────────────────────────────────────────────

export function CommandCenter({
  userName, companyName, tier,
  totalThisMonth, activeOrders, pendingQuotes, budgetDisplay,
  orders, pipeline, dailyRevenue,
}: CommandCenterProps) {
  const firstName = userName?.split(' ')[0] ?? 'bem-vindo';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const kpis = [
    {
      label: 'Gasto este mês',
      value: totalThisMonth,
      sub: 'atualizado agora',
      accentColor: 'rgb(99,230,190)',
      sparkData: dailyRevenue,
      isCurrency: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      label: 'Encomendas ativas',
      value: activeOrders,
      sub: 'em produção ou envio',
      accentColor: 'rgb(77,163,255)',
      sparkData: undefined,
      isCurrency: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      label: 'Orçamentos pendentes',
      value: pendingQuotes,
      sub: 'a aguardar proposta',
      accentColor: 'rgb(245,158,11)',
      sparkData: undefined,
      isCurrency: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      label: 'Budget disponível',
      value: 0,
      sub: budgetDisplay,
      accentColor: 'rgb(116,231,255)',
      sparkData: undefined,
      isCurrency: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 2rem 4rem', maxWidth: '1200px' }}>

      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{ marginBottom: '2rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.3rem' }}>
              {greeting}, {firstName} 👋
            </h1>
            {companyName && (
              <p style={{ fontSize: '0.875rem', color: 'rgb(100,112,130)' }}>
                {companyName}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <Link href="/quotes/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgb(77,163,255)', color: 'rgb(7,17,31)',
              padding: '0.625rem 1.125rem', borderRadius: '10px',
              fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
              boxShadow: '0 0 20px rgba(77,163,255,0.25)',
            }}>
              + Novo Orçamento
            </Link>
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {kpis.map((kpi, i) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={kpi.isCurrency ? kpi.value : kpi.value}
            sub={kpi.sub}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            sparkData={kpi.sparkData}
            index={i}
            isCurrency={kpi.isCurrency}
          />
        ))}
      </div>

      {/* Middle row: Pipeline + Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: '1rem',
        marginBottom: '1rem',
        alignItems: 'start',
      }}
        className="flex-col-on-mobile"
      >
        <PipelineViz pipeline={pipeline} />
        <QuickActions />
      </div>

      {/* Activity feed */}
      <ActivityFeed orders={orders} />
    </div>
  );
}
