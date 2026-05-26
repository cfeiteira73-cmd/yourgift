import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { StorePageSkeleton } from './loading';
import { AddToCartButton } from './add-to-cart-button';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.yourgift.pt';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Store {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
  isActive: boolean;
  products: StoreProductEntry[];
}

export interface StoreProductEntry {
  id: string;
  customPrice: number | null;
  sortOrder: number;
  isAvailable: boolean;
  product: StoreProduct;
}

export interface StoreProduct {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  basePrice: number | null;
  variants: Array<{ id: string; price: number; color?: string | null; sku?: string | null }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchStore(slug: string): Promise<Store | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/company-stores/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Store API responded ${res.status}`);
    return res.json() as Promise<Store>;
  } catch {
    return null;
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const store = await fetchStore(params.slug);
  if (!store) return { title: 'Loja não encontrada — YourGift' };

  return {
    title: `${store.name} — Loja de Empresa | YourGift`,
    description:
      store.welcomeMessage ??
      `Explore os artigos personalizados da loja ${store.name}, em parceria com YourGift.`,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StoreSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const store = await fetchStore(params.slug);

  if (!store) notFound();

  if (!store.isActive) {
    return <StoreUnavailable storeName={store.name} />;
  }

  const accent = store.primaryColor ?? '#4da3ff';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'relative',
          background: store.bannerUrl
            ? 'transparent'
            : `linear-gradient(135deg, #07111f 0%, #0d1f3c 100%)`,
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px 40px',
          overflow: 'hidden',
        }}
      >
        {/* Banner image */}
        {store.bannerUrl && (
          <Image
            src={store.bannerUrl}
            alt={`${store.name} banner`}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
            unoptimized={store.bannerUrl.startsWith('http')}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(7,17,31,0.3) 0%, rgba(7,17,31,0.75) 100%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center',
            maxWidth: '640px',
          }}
        >
          {/* Logo */}
          {store.logoUrl && (
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={80}
                height={80}
                style={{ objectFit: 'contain', padding: '8px' }}
                unoptimized={store.logoUrl.startsWith('http')}
              />
            </div>
          )}

          <div>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: 'clamp(24px, 4vw, 36px)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
              }}
            >
              {store.name}
            </h1>
            {store.welcomeMessage && (
              <p
                style={{
                  margin: 0,
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.6,
                  maxWidth: '540px',
                }}
              >
                {store.welcomeMessage}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Product grid ───────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            Catálogo
          </h2>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#07111f', letterSpacing: '-0.03em' }}>
            {store.products.length} {store.products.length === 1 ? 'artigo disponível' : 'artigos disponíveis'}
          </p>
        </div>

        {store.products.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e8ecf2',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
              Ainda não há artigos nesta loja. Volte em breve!
            </p>
          </div>
        ) : (
          <Suspense fallback={<StorePageSkeleton />}>
            <div id="store-product-grid">
              {store.products.map(({ id, customPrice, product }) => {
                const displayPrice = customPrice ?? product.basePrice ?? null;
                const thumb = product.images?.[0] ?? null;

                return (
                  <ProductCard
                    key={id}
                    product={product}
                    displayPrice={displayPrice}
                    thumb={thumb}
                    accent={accent}
                  />
                );
              })}
            </div>
          </Suspense>
        )}
      </main>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid #e8ecf2',
          padding: '24px',
          textAlign: 'center',
          background: '#ffffff',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
          Powered by{' '}
          <a
            href="https://yourgift.pt"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}
          >
            YourGift
          </a>
          {' '}— Plataforma B2B de Corporate Gifts & Branded Merchandise
        </p>
      </footer>

      {/* Responsive grid styles */}
      <style>{`
        #store-product-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1024px) {
          #store-product-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          #store-product-grid { grid-template-columns: 1fr; }
        }
        .store-product-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important;
        }
        .store-add-btn:hover {
          opacity: 0.88;
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  displayPrice,
  thumb,
  accent,
}: {
  product: StoreProduct;
  displayPrice: number | null;
  thumb: string | null;
  accent: string;
}) {
  return (
    <div
      className="store-product-card"
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e8ecf2',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          background: '#f1f5f9',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={product.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={thumb.startsWith('http')}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '48px', opacity: 0.3 }}>🎁</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#07111f',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.title}
          </h3>
          {product.description && (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: '#64748b',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {product.description}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: displayPrice != null ? '#07111f' : '#94a3b8',
              letterSpacing: '-0.03em',
            }}
          >
            {displayPrice != null
              ? `€${displayPrice.toFixed(2)}`
              : 'Sob consulta'}
          </span>

          {/* AddToCartButton is a client component so it can handle onClick */}
          <AddToCartButton accent={accent} productTitle={product.title} />
        </div>
      </div>
    </div>
  );
}

function StoreUnavailable({ storeName }: { storeName: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        padding: '24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '420px',
        }}
      >
        <div style={{ fontSize: '56px', marginBottom: '24px' }}>🔒</div>
        <h1 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#07111f', letterSpacing: '-0.03em' }}>
          Loja Indisponível
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#64748b', lineHeight: 1.6 }}>
          A loja <strong>{storeName}</strong> não está disponível de momento.
          Por favor contacte o seu gestor de conta ou tente mais tarde.
        </p>
        <a
          href="https://yourgift.pt"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 700,
            background: '#07111f',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Ir para YourGift.pt
        </a>
      </div>
    </div>
  );
}
