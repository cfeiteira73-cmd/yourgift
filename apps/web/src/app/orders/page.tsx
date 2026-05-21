'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { StatusBadge } from '@/components/portal/StatusBadge';

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

// ── skeleton ───────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="yg-card"
      style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.05)',
          flexShrink: 0,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ width: '120px', height: '14px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '200px', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '80px', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
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
    <Link
      href={`/orders/${order.id}`}
      className="yg-card yg-card-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1.25rem',
        textDecoration: 'none',
      }}
    >
      {/* Thumbnails */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {thumbs.length === 0 ? (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
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
                width: '56px',
                height: '56px',
                borderRadius: '10px',
                objectFit: 'cover',
                background: 'rgba(255,255,255,0.04)',
              }}
            />
          ))
        )}
        {extraImages > 0 && (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'rgb(120,130,150)',
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
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.3rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'rgb(245,247,251)',
            }}
          >
            {order.ref}
          </span>
          <StatusBadge status={order.status} size="sm" />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
          {new Date(order.created_at).toLocaleDateString('pt-PT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {order.order_items?.length > 0 &&
            ` · ${order.order_items.length} artigo${order.order_items.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Amount + arrow */}
      <div
        style={{
          textAlign: 'right',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>
          {order.total_amount ? formatPrice(order.total_amount) : 'Sob consulta'}
        </p>
        <svg
          style={{ color: 'rgb(120,130,150)' }}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/orders');
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company, tier')
        .eq('auth_user_id', user.id)
        .single();

      setClient(clientData as ClientProfile | null);

      if (!clientData) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(
          `id, ref, status, total_amount, created_at,
           order_items ( id, quantity, products ( title, images ) )`
        )
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError('Erro ao carregar encomendas.');
      } else {
        setOrders((data ?? []) as unknown as Order[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    let list = orders;

    // text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.ref.toLowerCase().includes(q) ||
          o.order_items?.some((i) => i.products?.title?.toLowerCase().includes(q))
      );
    }

    // status filter
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
      <div style={{ padding: '2rem 2rem 3rem', maxWidth: '900px' }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'rgb(245,247,251)',
              letterSpacing: '-0.03em',
            }}
          >
            Encomendas
          </h1>
          <Link
            href="/quotes/new"
            style={{
              background: 'rgb(77,163,255)',
              color: 'rgb(7,17,31)',
              padding: '0.5rem 1.125rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            + Pedir Orçamento
          </Link>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <svg
            style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgb(120,130,150)',
              pointerEvents: 'none',
            }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  padding: '0.375rem 0.875rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  background: isActive ? 'rgba(77,163,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? 'rgb(77,163,255)' : 'rgb(120,130,150)',
                  border: isActive
                    ? '1px solid rgba(77,163,255,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : error ? (
          <div
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
          </div>
        ) : filtered.length === 0 ? (
          <div className="yg-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</p>
            <p
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'rgb(245,247,251)',
                marginBottom: '0.5rem',
              }}
            >
              {search || activeFilter !== 'all'
                ? 'Nenhuma encomenda encontrada'
                : 'Ainda não tens encomendas'}
            </p>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgb(120,130,150)',
                marginBottom: '1.5rem',
              }}
            >
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
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'rgb(120,130,150)',
                marginTop: '0.5rem',
              }}
            >
              {filtered.length} encomenda{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
