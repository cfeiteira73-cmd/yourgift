import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/server';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { StatusBadge } from '@/components/portal/StatusBadge';

export const metadata = { title: 'Dashboard' };

// ── helpers ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="yg-card" style={{ padding: '1.25rem 1.5rem' }}>
      <p
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgb(120,130,150)',
          marginBottom: '0.5rem',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: accent ? 'rgb(99,230,190)' : 'rgb(245,247,251)',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="yg-card yg-card-hover"
      style={{
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'rgba(77,163,255,0.1)',
          border: '1px solid rgba(77,163,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgb(77,163,255)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(245,247,251)' }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)', marginTop: '0.1rem' }}>{description}</p>
      </div>
      <svg
        style={{ marginLeft: 'auto', color: 'rgb(120,130,150)', flexShrink: 0 }}
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
    </Link>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, tier, budget_limit')
    .eq('auth_user_id', user.id)
    .single();

  // fetch last 5 orders
  const { data: orders } = await supabase
    .from('orders')
    .select(
      `id, ref, status, total_amount, created_at,
       order_items ( id, quantity, unit_price, products ( title, images ) )`
    )
    .eq('client_id', client?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(5);

  // fetch pending quotes count
  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client?.id ?? '')
    .in('status', ['submitted', 'pricing']);

  // KPIs — spend this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('client_id', client?.id ?? '')
    .gte('created_at', monthStart);

  const totalThisMonth = (monthOrders ?? []).reduce(
    (s, o) => s + ((o as { total_amount: number | null }).total_amount ?? 0),
    0
  );

  const { data: allOrders } = await supabase
    .from('orders')
    .select('status')
    .eq('client_id', client?.id ?? '');

  const activeOrders = (allOrders ?? []).filter(
    (o) => !['delivered', 'cancelled'].includes((o as { status: string }).status)
  ).length;

  const budgetDisplay =
    (client as { budget_limit?: number | null } | null)?.budget_limit != null
      ? formatPrice((client as { budget_limit: number }).budget_limit)
      : 'Ilimitado';

  return (
    <PortalLayout
      userName={(client as { name?: string } | null)?.name ?? undefined}
      userEmail={user.email ?? undefined}
      companyName={(client as { company?: string } | null)?.company ?? undefined}
      tier={(client as { tier?: string } | null)?.tier ?? undefined}
    >
      <div style={{ padding: '2rem 2rem 3rem', maxWidth: '1100px' }}>

        {/* Welcome header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'rgb(245,247,251)',
              letterSpacing: '-0.03em',
              marginBottom: '0.25rem',
            }}
          >
            Olá,{' '}
            {(client as { name?: string } | null)?.name?.split(' ')[0] ?? 'bem-vindo'}
          </h1>
          {(client as { company?: string } | null)?.company && (
            <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)' }}>
              {(client as { company: string }).company}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          <StatCard
            label="Total gasto este mês"
            value={totalThisMonth > 0 ? formatPrice(totalThisMonth) : '—'}
            accent
          />
          <StatCard label="Encomendas ativas" value={String(activeOrders)} />
          <StatCard label="Orçamentos pendentes" value={String(pendingQuotes ?? 0)} />
          <StatCard label="Saldo budget disponível" value={budgetDisplay} />
        </div>

        {/* Recent orders table */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'rgb(245,247,251)',
                letterSpacing: '-0.01em',
              }}
            >
              Encomendas recentes
            </h2>
            <Link
              href="/orders"
              style={{
                fontSize: '0.8rem',
                color: 'rgb(77,163,255)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Ver todas →
            </Link>
          </div>

          {!orders || orders.length === 0 ? (
            <div className="yg-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</p>
              <p
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'rgb(245,247,251)',
                  marginBottom: '0.4rem',
                }}
              >
                Ainda não tens encomendas
              </p>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'rgb(120,130,150)',
                  marginBottom: '1.25rem',
                }}
              >
                Explora o catálogo ou pede um orçamento.
              </p>
              <Link
                href="/products"
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
                Ver catálogo →
              </Link>
            </div>
          ) : (
            <div className="yg-card" style={{ overflow: 'hidden' }}>
              {/* Table header — hidden on small screens */}
              <div
                className="hidden md:grid"
                style={{
                  gridTemplateColumns: '130px 1fr 130px 110px 110px 90px',
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  gap: '0.5rem',
                }}
              >
                {['Ref', 'Produto(s)', 'Estado', 'Valor', 'Data', 'Ação'].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgb(120,130,150)',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {(orders as unknown as Array<{
                id: string;
                ref: string;
                status: string;
                total_amount: number | null;
                created_at: string;
                order_items: Array<{
                  id: string;
                  products: { title: string; images: string[] } | null;
                }>;
              }>).map((order, idx) => {
                const firstTitle = order.order_items?.[0]?.products?.title ?? '—';
                const extraCount = Math.max(0, (order.order_items?.length ?? 1) - 1);

                return (
                  <div key={order.id}>
                    {/* Desktop row */}
                    <div
                      className="hidden md:grid"
                      style={{
                        gridTemplateColumns: '130px 1fr 130px 110px 110px 90px',
                        padding: '1rem 1.25rem',
                        gap: '0.5rem',
                        alignItems: 'center',
                        borderBottom:
                          idx < orders.length - 1
                            ? '1px solid rgba(255,255,255,0.04)'
                            : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'rgb(245,247,251)',
                        }}
                      >
                        {order.ref}
                      </span>
                      <span
                        style={{
                          fontSize: '0.875rem',
                          color: 'rgb(170,180,198)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {firstTitle}
                        {extraCount > 0 && (
                          <span
                            style={{
                              color: 'rgb(120,130,150)',
                              marginLeft: '0.375rem',
                              fontSize: '0.75rem',
                            }}
                          >
                            +{extraCount}
                          </span>
                        )}
                      </span>
                      <span>
                        <StatusBadge status={order.status} size="sm" />
                      </span>
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'rgb(99,230,190)',
                        }}
                      >
                        {order.total_amount ? formatPrice(order.total_amount) : '—'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
                        {new Date(order.created_at).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <Link
                        href={`/orders/${order.id}`}
                        style={{
                          fontSize: '0.8rem',
                          color: 'rgb(77,163,255)',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        Ver detalhes
                      </Link>
                    </div>

                    {/* Mobile card */}
                    <div
                      className="flex md:hidden"
                      style={{
                        padding: '0.875rem 1rem',
                        gap: '0.75rem',
                        alignItems: 'center',
                        borderBottom:
                          idx < orders.length - 1
                            ? '1px solid rgba(255,255,255,0.04)'
                            : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'rgb(245,247,251)',
                            }}
                          >
                            {order.ref}
                          </span>
                          <StatusBadge status={order.status} size="sm" />
                        </div>
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: 'rgb(120,130,150)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {firstTitle}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'rgb(99,230,190)',
                            marginBottom: '0.2rem',
                          }}
                        >
                          {order.total_amount ? formatPrice(order.total_amount) : '—'}
                        </p>
                        <Link
                          href={`/orders/${order.id}`}
                          style={{
                            fontSize: '0.75rem',
                            color: 'rgb(77,163,255)',
                            textDecoration: 'none',
                          }}
                        >
                          Ver →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'rgb(245,247,251)',
              letterSpacing: '-0.01em',
              marginBottom: '1rem',
            }}
          >
            Ações rápidas
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            <QuickActionCard
              href="/quotes/new"
              label="Pedir Orçamento"
              description="Recebe um preço personalizado"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              }
            />
            <QuickActionCard
              href="/products"
              label="Ver Catálogo"
              description="2.400+ produtos Midocean"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" />
                </svg>
              }
            />
            <QuickActionCard
              href="/orders/new"
              label="Nova Encomenda"
              description="Encomendar diretamente do catálogo"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            />
          </div>
        </section>
      </div>
    </PortalLayout>
  );
}
