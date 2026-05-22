import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EmployeeLoginForm } from './LoginForm';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.yourgift.pt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreBasic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
  isActive: boolean;
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchStoreBasic(slug: string): Promise<StoreBasic | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/company-stores/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: 120 } },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json() as Promise<StoreBasic>;
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
  const store = await fetchStoreBasic(params.slug);
  return {
    title: store
      ? `Entrar em ${store.name} — YourGift`
      : 'Loja não encontrada — YourGift',
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StoreLoginPage({
  params,
}: {
  params: { slug: string };
}) {
  const store = await fetchStoreBasic(params.slug);

  if (!store) notFound();

  if (!store.isActive) {
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
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 800, color: '#07111f' }}>
            Loja Indisponível
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            A loja <strong>{store.name}</strong> não está disponível de momento.
          </p>
        </div>
      </div>
    );
  }

  const accent = store.primaryColor ?? '#4da3ff';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Banner strip */}
      {store.bannerUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${store.bannerUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(12px) brightness(0.3)',
            zIndex: 0,
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Brand card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Top color bar */}
          <div style={{ height: '5px', background: accent }} />

          <div style={{ padding: '40px 36px 36px' }}>
            {/* Logo + name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '32px',
                gap: '14px',
              }}
            >
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logoUrl}
                  alt={`${store.name} logo`}
                  width={72}
                  height={72}
                  style={{
                    objectFit: 'contain',
                    borderRadius: '14px',
                    border: '1px solid #e8ecf2',
                    padding: '6px',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    background: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  🏪
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <h1
                  style={{
                    margin: '0 0 4px',
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#07111f',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {store.name}
                </h1>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Portal de Colaboradores
                </p>
              </div>
            </div>

            <EmployeeLoginForm slug={store.slug} accent={accent} />
          </div>
        </div>

        <p
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            textShadow: store.bannerUrl ? '0 1px 4px rgba(0,0,0,0.6)' : 'none',
          }}
        >
          Powered by{' '}
          <a
            href="https://yourgift.pt"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}
          >
            YourGift
          </a>
        </p>
      </div>
    </div>
  );
}
