import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/server';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { OrderTimeline, type TimelineStep } from '@/components/portal/OrderTimeline';
import { CostBreakdown, type CostBreakdownData } from '@/components/portal/CostBreakdown';

export const metadata = { title: 'Detalhe da Encomenda' };

// ── helpers ────────────────────────────────────────────────────────────────

const TIMELINE_DEFINITIONS: TimelineStep[] = [
  { key: 'created',   label: 'Encomenda criada' },
  { key: 'paid',      label: 'Pagamento confirmado' },
  { key: 'approved',  label: 'Aprovação interna' },
  { key: 'producing', label: 'Em produção' },
  { key: 'shipped',   label: 'Enviada' },
  { key: 'delivered', label: 'Entregue' },
];

function canonicalStatus(status: string): string {
  const map: Record<string, string> = {
    pending:           'created',
    confirmed:         'paid',
    payment_confirmed: 'paid',
    in_production:     'producing',
  };
  return map[status] ?? status;
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/orders/' + params.id);

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, tier')
    .eq('auth_user_id', user.id)
    .single();

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, ref, status, total_amount, created_at, tracking_number, shipping_address,
       supplier, supplier_order_id, notes,
       order_items (
         id, quantity, unit_price,
         products ( id, title, images, supplier_ref ),
         product_variants ( sku, color )
       ),
       artworks ( id, url, filename, status, notes )`
    )
    .eq('id', params.id)
    .eq('client_id', client?.id ?? '')
    .single();

  if (!order) notFound();

  const canonStatus = canonicalStatus(order.status as string);

  const timelineSteps: TimelineStep[] = TIMELINE_DEFINITIONS.map((def) => {
    const enriched: TimelineStep = { ...def };
    if (def.key === 'created') {
      enriched.timestamp = order.created_at as string;
      enriched.actor = (client as { name?: string } | null)?.name ?? 'Cliente';
    }
    if (def.key === 'shipped' && order.tracking_number) {
      enriched.trackingNumber = order.tracking_number as string;
    }
    return enriched;
  });

  const items = (order.order_items ?? []) as Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products: { id: string; title: string; images: string[]; supplier_ref: string } | null;
    product_variants: { sku: string; color: string | null } | null;
  }>;

  const artworks = (order.artworks ?? []) as Array<{
    id: string;
    url: string;
    filename: string;
    status: string;
    notes: string | null;
  }>;

  const itemsSubtotal = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);
  const shippingCost = 12;
  const marginRate = 0.35;
  const vatRate = 0.23;
  const margin = Math.round(itemsSubtotal * marginRate * 100) / 100;
  const taxable = itemsSubtotal + margin + shippingCost;
  const tax = Math.round(taxable * vatRate * 100) / 100;
  const computedTotal = Math.round((taxable + tax) * 100) / 100;
  const displayTotal = (order.total_amount as number | null) ?? computedTotal;

  const costData: CostBreakdownData = {
    baseCost: itemsSubtotal,
    printCost: 0,
    shippingCost,
    margin,
    tax,
    total: displayTotal,
  };

  const shippingAddr = order.shipping_address as {
    name?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  } | null;

  const supplierLabels: Record<string, string> = {
    midocean: 'Midocean',
    pf_concept: 'PF Concept',
    stricker: 'Stricker',
  };

  return (
    <PortalLayout
      userName={(client as { name?: string } | null)?.name ?? undefined}
      companyName={(client as { company?: string } | null)?.company ?? undefined}
      tier={(client as { tier?: string } | null)?.tier ?? undefined}
    >
      <div style={{ padding: '2rem 2rem 3rem', maxWidth: '960px' }}>

        {/* Breadcrumb */}
        <Link
          href="/orders"
          style={{
            fontSize: '0.8rem',
            color: 'rgb(120,130,150)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginBottom: '1.5rem',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Encomendas
        </Link>

        {/* Header — ref + status + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'rgb(245,247,251)',
                  letterSpacing: '-0.02em',
                  fontFamily: 'monospace',
                }}
              >
                {order.ref as string}
              </h1>
              <StatusBadge status={order.status as string} />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
              Criada em{' '}
              {new Date(order.created_at as string).toLocaleDateString('pt-PT', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'not-allowed',
                opacity: 0.4,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgb(170,180,198)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
            <a
              href="mailto:hello@yourgift.pt"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(77,163,255,0.1)',
                border: '1px solid rgba(77,163,255,0.2)',
                color: 'rgb(77,163,255)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                textDecoration: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Contactar Suporte
            </a>
          </div>
        </div>

        {/* Two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr)',
            gap: '1.5rem',
          }}
          id="order-detail-grid"
        >
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Timeline */}
            <div className="yg-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1.25rem' }}>
                Histórico
              </h2>
              <OrderTimeline steps={timelineSteps} currentStatus={canonStatus} />
            </div>

            {/* Items */}
            <div className="yg-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1rem' }}>
                Artigos
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)' }}>Nenhum artigo registado.</p>
                ) : items.map((item) => {
                  const thumb = item.products?.images?.[0];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        gap: '0.875rem',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.05)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.25rem' }}>🎁</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(245,247,251)', marginBottom: '0.15rem' }}>
                          {item.products?.title ?? '—'}
                        </p>
                        {item.product_variants?.color && (
                          <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>
                            {item.product_variants.color} · {item.product_variants.sku}
                          </p>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>{item.quantity} un.</p>
                      </div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(99,230,190)', flexShrink: 0 }}>
                        {item.unit_price > 0 ? formatPrice(item.unit_price * item.quantity) : 'Sob consulta'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Artworks */}
            {artworks.length > 0 && (
              <div className="yg-card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1rem' }}>
                  Artes
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {artworks.map((art) => {
                    const artStatusColors: Record<string, string> = {
                      pending: 'rgb(245,158,11)',
                      approved: 'rgb(99,230,190)',
                      rejected: 'rgb(239,68,68)',
                      revision_requested: 'rgb(239,68,68)',
                    };
                    const artStatusLabel: Record<string, string> = {
                      pending: 'Pendente',
                      approved: 'Aprovada',
                      rejected: 'Rejeitada',
                      revision_requested: 'Revisão',
                    };
                    return (
                      <div
                        key={art.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <svg
                          style={{ color: artStatusColors[art.status] ?? 'rgb(120,130,150)', flexShrink: 0 }}
                          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                          <polyline points="13,2 13,9 20,9" />
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.875rem',
                              color: 'rgb(77,163,255)',
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {art.filename}
                          </a>
                          {art.notes && art.status === 'revision_requested' && (
                            <p style={{ fontSize: '0.75rem', color: 'rgb(239,68,68)', marginTop: '0.2rem' }}>
                              Revisão necessária: {art.notes}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: artStatusColors[art.status] ?? 'rgb(120,130,150)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                          {artStatusLabel[art.status] ?? art.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <CostBreakdown data={costData} />

            {/* Supplier */}
            <div className="yg-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.875rem' }}>
                Fornecedor
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'rgb(120,130,150)' }}>Fornecedor</span>
                  <span style={{ color: 'rgb(245,247,251)', fontWeight: 500 }}>
                    {supplierLabels[(order.supplier as string) ?? ''] ?? (order.supplier as string) ?? '—'}
                  </span>
                </div>
                {order.supplier_order_id && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'rgb(120,130,150)' }}>ID Fornecedor</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgb(170,180,198)' }}>
                      {order.supplier_order_id as string}
                    </span>
                  </div>
                )}
                {order.tracking_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', alignItems: 'center' }}>
                    <span style={{ color: 'rgb(120,130,150)' }}>Tracking</span>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(order.tracking_number as string)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgb(116,231,255)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                    >
                      {order.tracking_number as string}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping */}
            {shippingAddr && (
              <div className="yg-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.875rem' }}>
                  Morada de Entrega
                </h3>
                <address style={{ fontStyle: 'normal', fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.6 }}>
                  {shippingAddr.name && <p style={{ fontWeight: 600, color: 'rgb(245,247,251)' }}>{shippingAddr.name}</p>}
                  {shippingAddr.street && <p>{shippingAddr.street}</p>}
                  {(shippingAddr.city || shippingAddr.postalCode) && (
                    <p>{shippingAddr.city}{shippingAddr.postalCode && ` ${shippingAddr.postalCode}`}</p>
                  )}
                  {shippingAddr.country && <p>{shippingAddr.country}</p>}
                </address>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="yg-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
                  Notas
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.6 }}>
                  {order.notes as string}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          #order-detail-grid { grid-template-columns: minmax(0,1fr) 320px; }
        }
      `}</style>
    </PortalLayout>
  );
}
