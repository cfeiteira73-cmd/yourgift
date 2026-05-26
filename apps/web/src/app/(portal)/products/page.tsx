import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ProductFiltersBar } from '@/components/ProductFiltersBar';
import { getProducts, getCategories } from '@/lib/catalog';
import { PortalLayout } from '@/components/portal/PortalLayout';

export const metadata = { title: 'Catálogo — YourGift OS' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/products');

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, tier')
    .eq('auth_user_id', user.id)
    .single();

  // ── Catalog data ──────────────────────────────────────────────────────────
  const [result, categories] = await Promise.all([
    getProducts({
      search: searchParams.search,
      categoryGroup: searchParams.categoryGroup,
      eco: searchParams.eco === 'true',
      minPrice: searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined,
      maxPrice: searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined,
      sort: searchParams.sort,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
      limit: 24,
    }),
    getCategories(),
  ]);

  const { data: products, total, totalPages } = result;
  const currentPage = parseInt(searchParams.page ?? '1', 10);

  return (
    <PortalLayout
      userName={(client as { name?: string } | null)?.name ?? undefined}
      companyName={(client as { company?: string } | null)?.company ?? undefined}
      tier={(client as { tier?: string } | null)?.tier ?? undefined}
    >
      <div style={{ padding: '2rem 2rem 3rem' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem',
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Catálogo
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'rgb(80,92,110)' }}>
              {total > 0
                ? <>{total.toLocaleString('pt-PT')} produtos disponíveis</>
                : 'Explora o nosso catálogo de merchandising'}
            </p>
          </div>
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
        </div>

        {/* Filters */}
        <Suspense fallback={null}>
          <ProductFiltersBar categories={categories} searchParams={searchParams} />
        </Suspense>

        {/* Product grid */}
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'rgb(245,247,251)', marginBottom: '0.5rem' }}>
              Nenhum produto encontrado
            </p>
            <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)', marginBottom: '1.5rem' }}>
              Tenta ajustar os filtros de pesquisa.
            </p>
            <Link
              href="/products"
              style={{
                color: 'rgb(77,163,255)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Limpar filtros →
            </Link>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))',
              gap: '0.875rem',
              marginBottom: '2rem',
            }}>
              {products.map((product) => {
                const image = product.images?.[0];
                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    style={{
                      display: 'block',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      textDecoration: 'none',
                      transition: 'border-color 150ms ease, background 150ms ease, transform 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.25)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(77,163,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    {/* Image */}
                    <div style={{
                      aspectRatio: '1',
                      background: 'rgba(255,255,255,0.04)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={product.title}
                          referrerPolicy="no-referrer"
                          style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 300ms ease',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>🎁</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.supplierRef}
                      </p>
                      <p style={{
                        fontSize: '0.75rem', fontWeight: 600, color: 'rgb(200,210,225)',
                        lineHeight: 1.35, marginBottom: '0.5rem',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {product.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(77,163,255)' }}>
                        Sob consulta
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', paddingBottom: '1rem' }}>
                {currentPage > 1 && (
                  <Link
                    href={`/products?${new URLSearchParams({ ...searchParams, page: String(currentPage - 1) })}`}
                    style={{
                      padding: '0.4rem 1rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '9px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'rgb(160,170,190)',
                      textDecoration: 'none',
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    ← Anterior
                  </Link>
                )}
                <span style={{ fontSize: '0.8rem', color: 'rgb(80,92,110)', padding: '0 0.75rem' }}>
                  Página {currentPage} de {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link
                    href={`/products?${new URLSearchParams({ ...searchParams, page: String(currentPage + 1) })}`}
                    style={{
                      padding: '0.4rem 1rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '9px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'rgb(160,170,190)',
                      textDecoration: 'none',
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    Seguinte →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
