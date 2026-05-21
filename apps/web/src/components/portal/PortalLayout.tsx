'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchExact?: boolean;
}

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const OrdersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);
const QuotesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);
const CatalogIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon />, matchExact: true },
  { href: '/orders', label: 'Encomendas', icon: <OrdersIcon /> },
  { href: '/quotes', label: 'Orçamentos', icon: <QuotesIcon /> },
  { href: '/products', label: 'Catálogo', icon: <CatalogIcon /> },
];

interface PortalLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  companyName?: string;
  tier?: string;
}

export function PortalLayout({ children, userName, userEmail, companyName, tier }: PortalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const displayName = userName || userEmail || 'Utilizador';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgb(var(--bg))' }}>

      {/* ── SIDEBAR ── */}
      <aside
        style={{
          width: '240px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: 'rgb(11,21,38)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
        className="hidden md:flex"
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.5rem 1rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: 'rgb(245,247,251)',
                letterSpacing: '-0.02em',
              }}
            >
              your
              <span style={{ color: 'rgb(77,163,255)' }}>gift</span>
            </span>
          </Link>
          <p style={{ fontSize: '0.65rem', color: 'rgb(120,130,150)', marginTop: '0.15rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Portal do cliente
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.matchExact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  color: isActive ? 'rgb(77,163,255)' : 'rgb(170,180,198)',
                  background: isActive ? 'rgba(77,163,255,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(77,163,255,0.15)' : '1px solid transparent',
                  transition: 'all 150ms ease',
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'rgb(7,17,31)',
                flexShrink: 0,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(245,247,251)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
              {companyName && (
                <p style={{ fontSize: '0.7rem', color: 'rgb(120,130,150)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {companyName}
                </p>
              )}
            </div>
            {tier === 'premium' && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'rgba(99,230,190,0.12)',
                  color: 'rgb(99,230,190)',
                  border: '1px solid rgba(99,230,190,0.2)',
                  borderRadius: '9999px',
                  padding: '0.15rem 0.45rem',
                  flexShrink: 0,
                }}
              >
                PRO
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: 'rgb(120,130,150)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.375rem 0',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(239,68,68)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(120,130,150)')}
          >
            <LogoutIcon />
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div
        className="flex md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '56px',
          background: 'rgb(11,21,38)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgb(245,247,251)' }}>
            your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
          </span>
        </Link>
        {/* Mobile nav pills */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {NAV_ITEMS.slice(0, 3).map((item) => {
            const isActive = item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.375rem',
                  borderRadius: '8px',
                  color: isActive ? 'rgb(77,163,255)' : 'rgb(120,130,150)',
                  background: isActive ? 'rgba(77,163,255,0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {item.icon}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main
        style={{ flex: 1, minWidth: 0 }}
        className="pt-14 md:pt-0"
      >
        {children}
      </main>
    </div>
  );
}
