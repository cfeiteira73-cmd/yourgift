'use client';

// ── OMEGA PROTOCOL — S13: Mobile Command Center ───────────────────────────────
//
// Adaptive touch-optimised mobile portal — shown when screen < 768px.
// Swipeable KPI cards · Quick actions · Recent activity feed · Pull-to-refresh
// Uses CSS classes from globals.css (S1 Visual OS) for consistent motion.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, tapScale } from '@/lib/motion';

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }
interface ActivityEvent { id: string; type: string; description: string; amount?: number; status?: string; timestamp: string; }

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

const EVENT_ICONS: Record<string, string> = {
  order_created: '📦', order_status_change: '🔄', quote_submitted: '📋',
  quote_status_change: '💬', client_joined: '👤', delivery: '✅',
};

const QUICK_ACTIONS = [
  { label: 'Nova Encomenda', href: '/orders/new', emoji: '📦', color: 'rgb(77,163,255)' },
  { label: 'Orçamento',     href: '/quotes/new',  emoji: '📋', color: 'rgb(116,231,255)' },
  { label: 'Cockpit',       href: '/cockpit',     emoji: '🎯', color: 'rgb(99,230,190)' },
  { label: 'Estratega AI',  href: '/strategist',  emoji: '🧠', color: 'rgb(167,139,250)' },
  { label: 'Produção',      href: '/production',  emoji: '⚙️', color: 'rgb(245,158,11)' },
  { label: 'Relatórios',    href: '/reports',     emoji: '📊', color: 'rgb(99,230,190)' },
];

export default function MobileCommandPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [summary, setSummary] = useState<{ totalRevenue: number; activeOrders: number; totalOrders: number; totalQuotes: number } | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiIndex, setKpiIndex] = useState(0);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [analyticsRes, activityRes] = await Promise.all([
        fetch('/api/analytics?period=30d&scope=auto'),
        fetch('/api/activity?limit=10'),
      ]);
      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setSummary(d.summary ?? null);
      }
      if (activityRes.ok) {
        const d = await activityRes.json();
        setActivity(d.events ?? []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login?next=/mobile'); return; }
        const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);
        await loadData();
      } catch (err) {
        console.error('[mobile] init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, loadData]);

  // Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (delta > 80 && scrollTop === 0 && !refreshing) {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    }
  };

  const kpis = summary ? [
    { label: 'Receita 30d',    value: fmtEur(summary.totalRevenue), color: 'rgb(99,230,190)',  icon: '💰' },
    { label: 'Encomendas',     value: String(summary.totalOrders),   color: 'rgb(77,163,255)',  icon: '📦' },
    { label: 'Activas',        value: String(summary.activeOrders),  color: 'rgb(245,158,11)', icon: '⚙️' },
    { label: 'Orçamentos',     value: String(summary.totalQuotes),   color: 'rgb(116,231,255)', icon: '📋' },
  ] : [];

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ padding: '1rem 1rem 5rem', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Pull-to-refresh indicator */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: '40px' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(77,163,255)', fontSize: '0.72rem', fontWeight: 600 }}
            >
              <span className="animate-spin-slow" style={{ marginRight: '0.5rem', display: 'inline-block' }}>↻</span>
              A actualizar…
            </motion.div>
          )}
        </AnimatePresence>

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={springSnappy} style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em' }}>
            Olá{client?.name ? `, ${client.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)' }}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </motion.div>

        {/* KPI carousel */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSnappy, delay: i * 0.07 }}
                whileTap={{ scale: 0.97 }}
                className="yg-card"
                style={{ padding: '0.875rem 1rem', position: 'relative', overflow: 'hidden', cursor: 'default' }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${kpi.color},transparent)` }} />
                <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{kpi.icon}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.035em', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginTop: '0.2rem' }}>{kpi.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Quick actions grid */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSnappy, delay: 0.15 }} style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
            Ações Rápidas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {QUICK_ACTIONS.map((action, i) => (
              <motion.div key={action.href} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springSnappy, delay: 0.18 + i * 0.05 }}>
                <Link href={action.href} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileTap={tapScale}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '0.875rem 0.5rem', borderRadius: '14px', gap: '0.35rem',
                      background: 'linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{action.emoji}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgb(170,185,205)', lineHeight: 1.2 }}>{action.label}</span>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSnappy, delay: 0.28 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Actividade Recente</span>
            <Link href="/cockpit" style={{ fontSize: '0.65rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 700 }}>Ver tudo →</Link>
          </div>
          <div className="yg-card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '1rem' }}>
                {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: '0.5rem' }} />)}
              </div>
            ) : activity.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.75rem' }}>Sem actividade recente.</div>
            ) : (
              activity.slice(0, 8).map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springSnappy, delay: 0.3 + i * 0.04 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                    padding: '0.625rem 0.875rem',
                    borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', flexShrink: 0 }}>{EVENT_ICONS[ev.type] ?? '●'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgb(200,215,235)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</div>
                    {ev.amount && ev.amount > 0 && (
                      <div style={{ fontSize: '0.62rem', color: 'rgb(99,230,190)', fontWeight: 700 }}>{fmtEur(ev.amount)}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'rgb(60,72,90)', flexShrink: 0 }}>{fmtTime(ev.timestamp)}</div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

      </div>
    </PortalLayout>
  );
}
