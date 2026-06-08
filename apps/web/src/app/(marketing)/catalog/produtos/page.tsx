import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getProducts, getCategories, CATEGORY_GROUP_LABELS } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Catálogo de Produtos — YourGift',
  description: '20.000+ produtos premium para personalização. Vestuário, tech, drinkware, kits de oferta e muito mais.',
};

export default async function PublicCatalogPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const [result, categories] = await Promise.all([
    getProducts({
      search: searchParams.search,
      categoryGroup: searchParams.cat,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
      limit: 24,
    }),
    getCategories(),
  ]);

  const { data: products, total, totalPages } = result;
  const currentPage = parseInt(searchParams.page ?? '1', 10);
  const currentCat = searchParams.cat ?? 'all';
  const searchQuery = searchParams.search ?? '';

  const catGroups = [
    { key: 'all', label: 'Todos' },
    ...Object.entries(CATEGORY_GROUP_LABELS).map(([k, v]) => ({ key: k, label: v })),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#090907', color: '#f0ece4', paddingTop: '5rem' }}>
      <style>{`
        .pub-prod-card:hover {
          border-color: rgba(154,124,74,0.32) !important;
          background: rgba(154,124,74,0.06) !important;
        }
        .pub-cat-btn:hover { color: #f0ece4 !important; }
        .pub-search-input:focus { border-color: rgba(154,124,74,0.45) !important; outline: none; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <section style={{ padding: '3rem 1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 28, height: 1, background: '#9a7c4a' }} />
          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#9a7c4a' }}>
            Catálogo Premium
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontFamily: "'Libre Baskerville',serif", fontSize: 'clamp(1.75rem,3.5vw,2.75rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
              {total > 0 ? <>{total.toLocaleString('pt-PT')} produtos</> : 'Catálogo'}
              <em style={{ fontStyle: 'italic', color: '#d4b47a' }}> disponíveis</em>
            </h1>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, color: 'rgba(240,236,228,0.42)', fontWeight: 300 }}>
              Selecciona um produto e pede orçamento gratuito
            </p>
          </div>
          <Link
            href="/auth/register"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: "'Montserrat',sans-serif",
              fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#090907', background: '#b8975e',
              padding: '12px 24px', textDecoration: 'none', flexShrink: 0,
            }}
          >
            Criar Conta &amp; Pedir →
          </Link>
        </div>

        {/* Search */}
        <form method="GET" style={{ display: 'flex', gap: 8, maxWidth: 520, marginBottom: '1.5rem' }}>
          <input
            name="search"
            defaultValue={searchQuery}
            placeholder="Pesquisar produtos..."
            className="pub-search-input"
            style={{
              flex: 1, padding: '11px 16px',
              background: '#1a1a16', border: '1px solid rgba(154,124,74,0.18)',
              color: '#f0ece4', fontFamily: "'Montserrat',sans-serif", fontSize: 13,
              transition: 'border-color 0.2s',
            }}
          />
          {searchParams.cat && <input type="hidden" name="cat" value={searchParams.cat} />}
          <button
            type="submit"
            style={{
              padding: '11px 20px',
              fontFamily: "'Montserrat',sans-serif",
              fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#090907', background: '#b8975e', border: 'none', cursor: 'pointer',
            }}
          >
            Buscar
          </button>
          {searchQuery && (
            <Link
              href={`/catalog/produtos${searchParams.cat ? `?cat=${searchParams.cat}` : ''}`}
              style={{
                padding: '11px 16px',
                fontFamily: "'Montserrat',sans-serif",
                fontSize: 10, color: 'rgba(240,236,228,0.42)', textDecoration: 'none',
                border: '1px solid rgba(240,236,228,0.10)',
                display: 'flex', alignItems: 'center',
              }}
            >
              ✕
            </Link>
          )}
        </form>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(154,124,74,0.14)', overflowX: 'auto', marginBottom: '2rem', scrollbarWidth: 'none' }}>
          {catGroups.map((cat) => (
            <Link
              key={cat.key}
              href={`/catalog/produtos?cat=${cat.key}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`}
              className="pub-cat-btn"
              style={{
                fontFamily: "'Montserrat',sans-serif",
                fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase',
                padding: '10px 18px', textDecoration: 'none', whiteSpace: 'nowrap',
                borderBottom: currentCat === cat.key ? '2px solid #b8975e' : '2px solid transparent',
                marginBottom: -1,
                color: currentCat === cat.key ? '#f0ece4' : 'rgba(240,236,228,0.35)',
                transition: 'color 0.2s',
              }}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Product Grid ──────────────────────────────────────────────── */}
      <section style={{ padding: '0 1.5rem 4rem', maxWidth: '1200px', margin: '0 auto' }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</p>
            <h2 style={{ fontFamily: "'Libre Baskerville',serif", fontSize: '1.5rem', fontWeight: 400, color: '#f0ece4', marginBottom: '0.5rem' }}>
              Nenhum produto encontrado
            </h2>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, color: 'rgba(240,236,228,0.42)', marginBottom: '1.5rem' }}>
              Tenta ajustar a pesquisa ou categoria.
            </p>
            <Link href="/catalog/produtos" style={{ color: '#d4b47a', fontFamily: "'Montserrat',sans-serif", fontSize: 12, textDecoration: 'none' }}>
              Ver todos os produtos →
            </Link>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1rem', marginBottom: '2.5rem',
            }}>
              {products.map((product) => {
                const rawImage = product.images?.[0];
                const image = rawImage?.includes('apis.makito.es')
                  ? `/api/images/makito?url=${encodeURIComponent(rawImage)}`
                  : rawImage;
                return (
                  <Link
                    key={product.id}
                    href={`/auth/register?next=/client-portal/quotes/new&product=${encodeURIComponent(product.title)}&ref=${encodeURIComponent(product.supplierRef ?? '')}`}
                    className="pub-prod-card"
                    style={{
                      display: 'block', textDecoration: 'none',
                      background: '#141411',
                      border: '1px solid rgba(154,124,74,0.14)',
                      overflow: 'hidden',
                      transition: 'border-color 200ms ease, background 200ms ease',
                    }}
                  >
                    {/* Image */}
                    <div style={{ aspectRatio: '1', background: '#1a1a16', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={product.title} referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '2.5rem', opacity: 0.2 }}>🎁</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '0.875rem' }}>
                      <p style={{
                        fontFamily: "'Montserrat',sans-serif",
                        fontSize: '0.72rem', fontWeight: 400, color: 'rgba(240,236,228,0.72)',
                        lineHeight: 1.4, marginBottom: '0.5rem',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {product.title}
                      </p>
                      <span style={{
                        fontFamily: "'Montserrat',sans-serif",
                        fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
                        color: '#d4b47a',
                      }}>
                        Pedir orçamento →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                {currentPage > 1 && (
                  <Link
                    href={`/catalog/produtos?page=${currentPage - 1}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}${currentCat !== 'all' ? `&cat=${currentCat}` : ''}`}
                    style={{
                      fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: '#d4b47a', textDecoration: 'none',
                      padding: '10px 20px', border: '1px solid rgba(154,124,74,0.28)',
                    }}
                  >
                    ← Anterior
                  </Link>
                )}
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: 'rgba(240,236,228,0.38)' }}>
                  Página {currentPage} de {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link
                    href={`/catalog/produtos?page=${currentPage + 1}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}${currentCat !== 'all' ? `&cat=${currentCat}` : ''}`}
                    style={{
                      fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: '#d4b47a', textDecoration: 'none',
                      padding: '10px 20px', border: '1px solid rgba(154,124,74,0.28)',
                    }}
                  >
                    Seguinte →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f0f0c', borderTop: '1px solid rgba(154,124,74,0.14)', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Libre Baskerville',serif", fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', fontWeight: 400, color: '#f0ece4', marginBottom: '1.25rem' }}>
          Não encontras o que procuras?
          <em style={{ fontStyle: 'italic', color: '#d4b47a' }}> Fala connosco.</em>
        </p>
        <Link href="/rfq" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: "'Montserrat',sans-serif",
          fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#090907', background: '#b8975e', padding: '14px 32px', textDecoration: 'none',
        }}>
          Pedir Orçamento Personalizado →
        </Link>
      </section>
    </div>
  );
}
