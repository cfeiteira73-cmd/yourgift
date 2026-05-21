'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { CostBreakdown, type CostBreakdownData } from '@/components/portal/CostBreakdown';

// ── types ─────────────────────────────────────────────────────────────────

interface QuoteItem {
  product_id: string;
  product_title: string;
  quantity: number;
  technique: string;
  unit_price?: number;
}

interface Quote {
  id: string;
  ref: string;
  status: string;
  created_at: string;
  event_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  artwork_urls: string[] | null;
  items: QuoteItem[];
  pricing?: {
    baseCost?: number;
    printCost?: number;
    printTechnique?: string;
    shippingCost?: number;
    margin?: number;
    tax?: number;
    total?: number;
  } | null;
  converted_order_ref?: string | null;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

// ── status explanations ────────────────────────────────────────────────────

const STATUS_EXPLANATIONS: Record<string, string> = {
  draft:     'Rascunho — ainda não submetido.',
  submitted: 'Recebemos o teu orçamento. Estamos a calcular o preço...',
  pricing:   'A nossa equipa está a preparar o teu orçamento personalizado.',
  approved:  'Orçamento aprovado! Podes confirmar a encomenda.',
  rejected:  'Orçamento rejeitado. Contacta-nos para mais informações.',
  converted: 'Orçamento convertido em encomenda.',
};

const TECHNIQUE_LABELS: Record<string, string> = {
  embroidery: 'Bordado',
  dtf:        'DTF — Full Color',
  laser:      'Laser',
  pad:        'Pad Printing',
  screen:     'Serigrafia',
};

// ── skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w: string; h: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.05)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/quotes/' + id);
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company, tier')
        .eq('auth_user_id', user.id)
        .single();

      setClient(clientData as ClientProfile | null);

      const { data, error: fetchErr } = await supabase
        .from('quotes')
        .select('id, ref, status, created_at, event_date, delivery_date, notes, artwork_urls, items, pricing, converted_order_ref')
        .eq('id', id)
        .eq('client_id', (clientData as { id: string } | null)?.id ?? '')
        .single();

      if (fetchErr || !data) {
        setError('Orçamento não encontrado.');
      } else {
        setQuote(data as unknown as Quote);
      }
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleAction(action: 'submit' | 'convert') {
    if (!quote) return;
    setActionLoading(true);
    setActionError('');

    const supabase = createClient();

    if (action === 'submit') {
      const { error: err } = await supabase
        .from('quotes')
        .update({ status: 'submitted' })
        .eq('id', quote.id);
      if (err) {
        setActionError('Erro ao submeter: ' + err.message);
      } else {
        setQuote((q) => q ? { ...q, status: 'submitted' } : q);
      }
    } else if (action === 'convert') {
      // Convert quote to order via API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${apiUrl}/quotes/${quote.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError((body as { message?: string }).message ?? 'Erro ao converter orçamento.');
      } else {
        const body = await res.json() as { orderId?: string; orderRef?: string };
        if (body.orderId) {
          router.push(`/orders/${body.orderId}`);
          return;
        }
        // Fallback: refresh quote
        const { data } = await supabase.from('quotes').select('*').eq('id', quote.id).single();
        if (data) setQuote(data as unknown as Quote);
      }
    }

    setActionLoading(false);
  }

  // ── render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PortalLayout>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        <div style={{ padding: '2rem', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton w="200px" h="28px" />
          <Skeleton w="300px" h="20px" />
          <Skeleton w="100%" h="200px" />
          <Skeleton w="100%" h="120px" />
        </div>
      </PortalLayout>
    );
  }

  if (error || !quote) {
    return (
      <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined}>
        <div style={{ padding: '2rem' }}>
          <p style={{ color: 'rgb(239,68,68)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error || 'Orçamento não encontrado.'}
          </p>
          <Link href="/dashboard" style={{ color: 'rgb(77,163,255)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
        </div>
      </PortalLayout>
    );
  }

  const explanation = STATUS_EXPLANATIONS[quote.status] ?? quote.status;
  const items = (quote.items ?? []) as QuoteItem[];
  const pricing = quote.pricing ?? null;

  const costData: CostBreakdownData | null = pricing?.total
    ? {
        baseCost: pricing.baseCost ?? 0,
        printCost: pricing.printCost ?? 0,
        printTechnique: pricing.printTechnique,
        shippingCost: pricing.shippingCost ?? 0,
        margin: pricing.margin ?? 0,
        tax: pricing.tax ?? 0,
        total: pricing.total,
      }
    : null;

  const statusIconColor: Record<string, string> = {
    draft:     'rgb(120,130,150)',
    submitted: 'rgb(77,163,255)',
    pricing:   'rgb(245,158,11)',
    approved:  'rgb(99,230,190)',
    rejected:  'rgb(239,68,68)',
    converted: 'rgb(116,231,255)',
  };

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div style={{ padding: '2rem 2rem 3rem', maxWidth: '860px' }}>

        {/* Breadcrumb */}
        <Link
          href="/dashboard"
          style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.5rem' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Dashboard
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                {quote.ref}
              </h1>
              <StatusBadge status={quote.status} type="quote" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
              Criado em{' '}
              {new Date(quote.created_at).toLocaleDateString('pt-PT', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Status explanation banner */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            background: `rgba(${
              quote.status === 'approved' ? '99,230,190' :
              quote.status === 'rejected' ? '239,68,68' :
              quote.status === 'submitted' ? '77,163,255' :
              quote.status === 'pricing' ? '245,158,11' :
              quote.status === 'converted' ? '116,231,255' :
              '107,114,128'
            },0.08)`,
            border: `1px solid rgba(${
              quote.status === 'approved' ? '99,230,190' :
              quote.status === 'rejected' ? '239,68,68' :
              quote.status === 'submitted' ? '77,163,255' :
              quote.status === 'pricing' ? '245,158,11' :
              quote.status === 'converted' ? '116,231,255' :
              '107,114,128'
            },0.2)`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: statusIconColor[quote.status] ?? 'rgb(120,130,150)',
              flexShrink: 0,
              ...(quote.status === 'submitted' || quote.status === 'pricing'
                ? { animation: 'pulse 2s ease-in-out infinite' }
                : {}),
            }}
          />
          <p style={{ fontSize: '0.875rem', color: 'rgb(245,247,251)', lineHeight: 1.5 }}>
            {explanation}
            {quote.status === 'converted' && quote.converted_order_ref && (
              <> {' '}
                <Link
                  href={`/orders`}
                  style={{ color: 'rgb(116,231,255)', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 600 }}
                >
                  {quote.converted_order_ref}
                </Link>
              </>
            )}
          </p>
        </div>

        <div
          id="quote-detail-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr)',
            gap: '1.5rem',
          }}
        >
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Items table */}
            <div className="yg-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)' }}>
                  Produtos
                </h2>
              </div>

              {/* Table header */}
              <div
                className="hidden md:grid"
                style={{
                  gridTemplateColumns: '1fr 80px 120px 100px 100px',
                  padding: '0.625rem 1.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  gap: '0.5rem',
                }}
              >
                {['Produto', 'Qtd.', 'Técnica', 'Preço unit.', 'Total'].map((h) => (
                  <span
                    key={h}
                    style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgb(120,130,150)' }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(120,130,150)', fontSize: '0.875rem' }}>
                  Nenhum produto no orçamento.
                </div>
              ) : (
                items.map((item, idx) => {
                  const tech = TECHNIQUE_LABELS[item.technique] ?? item.technique;
                  const rowTotal = item.unit_price != null ? item.unit_price * item.quantity : null;

                  return (
                    <div
                      key={idx}
                      style={{
                        borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      {/* Desktop */}
                      <div
                        className="hidden md:grid"
                        style={{
                          gridTemplateColumns: '1fr 80px 120px 100px 100px',
                          padding: '0.875rem 1.25rem',
                          gap: '0.5rem',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgb(245,247,251)' }}>
                          {item.product_title}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>{item.quantity}</span>
                        <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>{tech}</span>
                        <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>
                          {item.unit_price != null ? formatPrice(item.unit_price) : '—'}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: rowTotal != null ? 'rgb(99,230,190)' : 'rgb(120,130,150)' }}>
                          {rowTotal != null ? formatPrice(rowTotal) : '—'}
                        </span>
                      </div>

                      {/* Mobile */}
                      <div
                        className="flex flex-col md:hidden"
                        style={{ padding: '0.875rem 1rem', gap: '0.25rem' }}
                      >
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(245,247,251)' }}>
                          {item.product_title}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
                          {item.quantity} un. · {tech}
                        </p>
                        {rowTotal != null && (
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(99,230,190)' }}>
                            {formatPrice(rowTotal)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Additional details */}
            {(quote.event_date || quote.delivery_date || quote.notes || (quote.artwork_urls?.length ?? 0) > 0) && (
              <div className="yg-card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1rem' }}>
                  Detalhes
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {quote.event_date && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgb(120,130,150)', minWidth: '130px' }}>Data do evento</span>
                      <span style={{ color: 'rgb(245,247,251)' }}>
                        {new Date(quote.event_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {quote.delivery_date && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgb(120,130,150)', minWidth: '130px' }}>Entrega pretendida</span>
                      <span style={{ color: 'rgb(245,247,251)' }}>
                        {new Date(quote.delivery_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {quote.notes && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgb(120,130,150)', minWidth: '130px', flexShrink: 0 }}>Notas</span>
                      <span style={{ color: 'rgb(170,180,198)', lineHeight: 1.5 }}>{quote.notes}</span>
                    </div>
                  )}
                  {(quote.artwork_urls?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgb(120,130,150)', minWidth: '130px', flexShrink: 0 }}>Artes</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {quote.artwork_urls!.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'rgb(77,163,255)', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '0.8rem' }}
                          >
                            Ficheiro {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Pricing breakdown (if approved/converted) */}
            {costData && (
              <CostBreakdown data={costData} />
            )}

            {/* Action card */}
            <div className="yg-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.875rem' }}>
                Ação
              </h3>

              {actionError && (
                <p style={{ fontSize: '0.8rem', color: 'rgb(239,68,68)', marginBottom: '0.75rem' }}>{actionError}</p>
              )}

              {quote.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handleAction('submit')}
                  disabled={actionLoading}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    background: actionLoading ? 'rgba(77,163,255,0.4)' : 'rgb(77,163,255)',
                    color: 'rgb(7,17,31)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {actionLoading ? (
                    <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(7,17,31,0.3)', borderTopColor: 'rgb(7,17,31)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A submeter...</>
                  ) : 'Submeter para análise'}
                </button>
              )}

              {quote.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => handleAction('convert')}
                  disabled={actionLoading}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    background: actionLoading ? 'rgba(99,230,190,0.4)' : 'rgb(99,230,190)',
                    color: 'rgb(7,17,31)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {actionLoading ? (
                    <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(7,17,31,0.3)', borderTopColor: 'rgb(7,17,31)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A processar...</>
                  ) : 'Confirmar Encomenda →'}
                </button>
              )}

              {(quote.status === 'submitted' || quote.status === 'pricing') && (
                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid rgba(77,163,255,0.3)', borderTopColor: 'rgb(77,163,255)', borderRadius: '50%', animation: 'spin 1.4s linear infinite', margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>A aguardar resposta...</p>
                </div>
              )}

              {quote.status === 'rejected' && (
                <a
                  href="mailto:hello@yourgift.pt"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: 'rgb(239,68,68)',
                    textAlign: 'center',
                  }}
                >
                  Contactar suporte
                </a>
              )}

              {quote.status === 'converted' && (
                <Link
                  href="/orders"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: 'rgba(116,231,255,0.1)',
                    border: '1px solid rgba(116,231,255,0.2)',
                    color: 'rgb(116,231,255)',
                    textAlign: 'center',
                  }}
                >
                  Ver Encomendas →
                </Link>
              )}

              {/* Contact support always visible */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <a
                  href="mailto:hello@yourgift.pt"
                  style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  Contactar equipa
                </a>
              </div>
            </div>

            {/* New quote CTA */}
            <Link
              href="/quotes/new"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                padding: '0.625rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgb(120,130,150)',
                transition: 'all 150ms ease',
              }}
            >
              + Pedir novo orçamento
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          #quote-detail-grid { grid-template-columns: minmax(0,1fr) 300px; }
        }
      `}</style>
    </PortalLayout>
  );
}
