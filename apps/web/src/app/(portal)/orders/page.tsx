'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { ReorderIntelligence } from '@/components/portal/ReorderIntelligence';

// ── types ─────────────────────────────────────────────────────────────────

interface OrderProduct {
  title: string;
  images: string[];
}

interface OrderItem {
  id: string;
  quantity: number;
  products: OrderProduct | null;
}

interface Order {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  order_items: OrderItem[];
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

// ── filter tabs ────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'processing', label: 'A processar', statuses: ['created', 'paid', 'approved', 'pending', 'confirmed', 'payment_confirmed'] },
  { key: 'producing', label: 'Em Produção', statuses: ['producing', 'in_production'] },
  { key: 'shipped', label: 'Enviados', statuses: ['shipped'] },
  { key: 'done', label: 'Concluídos', statuses: ['delivered'] },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];

// ── animation variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2, ease: 'easeIn' } },
};

const headerVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const summaryVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.1 } },
};

// ── skeleton ───────────────────────────────────────────────────────────────

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
      className="yg-card"
      style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}
    >
      <div
        style={{
          width: '64px', height: '64px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.05)', flexShrink: 0,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ width: '120px', height: '14px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '200px', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '80px', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </motion.div>
  );
}

// ── summary bar ────────────────────────────────────────────────────────────

function SummaryBar({ orders, filtered }: { orders: Order[]; filtered: Order[] }) {
  const totalValue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const activeCount = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  const stats = [
    { label: 'Total', value: String(orders.length), sub: 'encomendas', icon: '📦', color: 'rgb(77,163,255)' },
    { label: 'Ativas', value: String(activeCount), sub: 'em curso', icon: '⚡', color: 'rgb(245,158,11)' },
    { label: 'Entregues', value: String(deliveredCount), sub: 'concluídas', icon: '✅', color: 'rgb(99,230,190)' },
    { label: 'Valor total', value: totalValue > 0 ? formatPrice(totalValue) : '—', sub: 'acumulado', icon: '💶', color: 'rgb(167,139,250)' },
  ];

  return (
    <motion.div
      variants={summaryVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.75rem',
        marginBottom: '1.75rem',
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="yg-card"
          style={{
            padding: '1rem 1.125rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '1.75rem', opacity: 0.12 }}>{s.icon}</div>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(120,130,150)' }}>{s.label}</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</span>
          <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>{s.sub}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ── order card ─────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const thumbs = order.order_items
    ?.flatMap((i) => i.products?.images?.[0] ?? [])
    .filter(Boolean)
    .slice(0, 3) as string[];
  const extraImages = Math.max(0, (order.order_items?.length ?? 0) - 3);

  return (
    <motion.div variants={cardVariants} layout>
      <Link
        href={`/orders/${order.id}`}
        className="yg-card yg-card-hover"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem',
          textDecoration: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle left accent */}
        <div style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: '2px', borderRadius: '2px',
          background: order.status === 'delivered' ? 'rgb(99,230,190)'
            : order.status === 'shipped' ? 'rgb(77,163,255)'
            : order.status === 'producing' || order.status === 'in_production' ? 'rgb(245,158,11)'
            : 'rgba(255,255,255,0.1)',
        }} />

        {/* Thumbnails */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '0.5rem' }}>
          {thumbs.length === 0 ? (
            <div
              style={{
                width: '56px', height: '56px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              }}
            >
              🎁
            </div>
          ) : (
            thumbs.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  width: '56px', height: '56px', borderRadius: '10px',
                  objectFit: 'cover', background: 'rgba(255,255,255,0.04)',
                }}
              />
            ))
          )}
          {extraImages > 0 && (
            <div
              style={{
                width: '56px', height: '56px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, color: 'rgb(120,130,150)',
              }}
            >
              +{extraImages}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '0.3rem', flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace', fontSize: '0.85rem',
                fontWeight: 700, color: 'rgb(245,247,251)',
              }}
            >
              {order.ref}
            </span>
            <StatusBadge status={order.status} size="sm" />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
            {new Date(order.created_at).toLocaleDateString('pt-PT', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {order.order_items?.length > 0 &&
              ` · ${order.order_items.length} artigo${order.order_items.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Amount + arrow */}
        <div
          style={{
            textAlign: 'right', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>
            {order.total_amount ? formatPrice(order.total_amount) : 'Sob consulta'}
          </p>
          <svg
            style={{ color: 'rgb(120,130,150)' }}
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </Link>
    </motion.div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/orders'); return; }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company, tier')
        .eq('auth_user_id', user.id)
        .single();

      setClient(clientData as ClientProfile | null);
      if (!clientData) { setLoading(false); return; }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`id, ref, status, total_amount, created_at,
                 order_items ( id, quantity, products ( title, images ) )`)
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (fetchError) setError('Erro ao carregar encomendas.');
      else setOrders((data ?? []) as unknown as Order[]);
            } catch (err) {
        console.error("[orders] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    let list = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.ref.toLowerCase().includes(q) ||
          o.order_items?.some((i) => i.products?.title?.toLowerCase().includes(q))
      );
    }
    const tab = FILTER_TABS.find((t) => t.key === activeFilter);
    if (tab && tab.key !== 'all' && 'statuses' in tab) {
      list = list.filter((o) => (tab.statuses as readonly string[]).includes(o.status));
    }
    return list;
  }, [orders, search, activeFilter]);

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div style={{ padding: '2rem 2rem 3rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', maxWidth: '1280px' }}>
        {/* ── Main orders column ───────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Encomendas
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'rgb(80,92,110)' }}>
              Acompanha o estado de todas as tuas encomendas
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/quotes/new"
              style={{
                background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,100,255))',
                color: '#fff',
                padding: '0.5rem 1.125rem',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                boxShadow: '0 4px 16px rgba(77,163,255,0.25)',
              }}
            >
              + Pedir Orçamento
            </Link>
          </motion.div>
        </motion.div>

        {/* Summary bar — only when loaded with data */}
        {!loading && orders.length > 0 && (
          <SummaryBar orders={orders} filtered={filtered} />
        )}

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          style={{ position: 'relative', marginBottom: '1.25rem' }}
        >
          <svg
            style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,130,150)', pointerEvents: 'none' }}
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por referência ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '0.625rem 1rem 0.625rem 2.5rem',
              fontSize: '0.875rem',
              color: 'rgb(245,247,251)',
              outline: 'none',
              transition: 'border-color 150ms ease',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          />
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <motion.button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: '0.375rem 0.875rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  background: isActive ? 'rgba(77,163,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? 'rgb(77,163,255)' : 'rgb(120,130,150)',
                  border: isActive ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[0, 1, 2].map((n) => <SkeletonCard key={n} index={n} />)}
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              padding: '1.25rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '12px',
              color: 'rgb(239,68,68)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="yg-card"
            style={{ padding: '4rem 2rem', textAlign: 'center' }}
          >
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'rgb(245,247,251)', marginBottom: '0.5rem' }}>
              {search || activeFilter !== 'all' ? 'Nenhuma encomenda encontrada' : 'Ainda não tens encomendas'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)', marginBottom: '1.5rem' }}>
              {search || activeFilter !== 'all'
                ? 'Tenta mudar os filtros ou a pesquisa.'
                : 'Começa por pedir um orçamento ou explorar o catálogo.'}
            </p>
            {!search && activeFilter === 'all' && (
              <Link
                href="/quotes/new"
                style={{
                  display: 'inline-block',
                  background: 'rgb(77,163,255)',
                  color: 'rgb(7,17,31)',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Pedir orçamento →
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${activeFilter}-${search}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              {filtered.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: filtered.length * 0.06 + 0.1 }}
                style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgb(80,92,110)', marginTop: '0.5rem' }}
              >
                {filtered.length} encomenda{filtered.length !== 1 ? 's' : ''}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        )}
        </div>{/* end main orders column */}

        {/* ── Reorder Intelligence sidebar ────────────────────────────── */}
        <div style={{ width: '320px', flexShrink: 0, display: 'none', position: 'sticky', top: '1.5rem' }}
          className="orders-intel-panel">
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: '20px',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              ✦ Inteligência de Compra
            </p>
            <ReorderIntelligence />
          </div>
        </div>
        <style>{`
          @media (min-width: 1024px) {
            .orders-intel-panel { display: block !important; }
          }
        `}</style>
      </div>
    </PortalLayout>
  );
}
