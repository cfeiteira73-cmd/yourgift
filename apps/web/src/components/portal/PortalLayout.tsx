'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ d, size = 18 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

const icons = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  orders: ['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 01-8 0'],
  quotes: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H9H8'],
  products: ['M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1z', 'M2 9v11a2 2 0 002 2h12a2 2 0 002-2V9H2z'],
  assets: ['M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'],
  reports: ['M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'],
  logout: ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  settings: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
};

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV = [
  {
    section: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', key: 'dashboard', exact: true },
    ],
  },
  {
    section: 'Operações',
    items: [
      { href: '/orders', label: 'Encomendas', key: 'orders' },
      { href: '/quotes', label: 'Orçamentos', key: 'quotes' },
      { href: '/products', label: 'Catálogo', key: 'products' },
    ],
  },
  {
    section: 'Recursos',
    items: [
      { href: '/assets', label: 'Ficheiros', key: 'assets' },
      { href: '/reports', label: 'Relatórios', key: 'reports' },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortalLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  companyName?: string;
  tier?: string;
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({ href, label, iconKey, exact }: { href: string; label: string; iconKey: string; exact?: boolean }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const d = icons[iconKey as keyof typeof icons];

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '10px',
          fontSize: '0.875rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'rgb(77,163,255)' : 'rgb(160,172,190)',
          background: isActive
            ? 'linear-gradient(135deg, rgba(77,163,255,0.12) 0%, rgba(77,163,255,0.06) 100%)'
            : 'transparent',
          border: isActive ? '1px solid rgba(77,163,255,0.18)' : '1px solid transparent',
          boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
          transition: 'color 150ms, background 150ms, border-color 150ms',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = 'rgb(200,210,225)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = 'rgb(160,172,190)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        {isActive && (
          <motion.div
            layoutId="nav-glow"
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: '2px', background: 'rgb(77,163,255)',
              borderRadius: '0 2px 2px 0',
              boxShadow: '0 0 8px rgba(77,163,255,0.8)',
            }}
          />
        )}
        <span style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }}>
          <Icon d={d} />
        </span>
        <span>{label}</span>
      </motion.div>
    </Link>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PortalLayout({ children, userName, userEmail, companyName, tier }: PortalLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }));
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const displayName = userName || userEmail?.split('@')[0] || 'Utilizador';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  const tierConfig = {
    premium: { label: 'PRO', color: 'rgb(99,230,190)', bg: 'rgba(99,230,190,0.12)', border: 'rgba(99,230,190,0.25)' },
    enterprise: { label: 'ENT', color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)', border: 'rgba(116,231,255,0.25)' },
    standard: { label: 'STD', color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.1)', border: 'rgba(120,130,150,0.2)' },
  };
  const tc = tierConfig[(tier as keyof typeof tierConfig) ?? 'standard'] ?? tierConfig.standard;

  // flat list of all nav items for mobile
  const allNavItems = NAV.flatMap(s => s.items);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgb(7,17,31)' }}>

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR
      ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex"
        style={{
          width: '232px',
          flexShrink: 0,
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgb(9,19,35) 0%, rgb(8,17,30) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.055)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Logo bar */}
        <div style={{
          padding: '1.375rem 1.25rem 0.875rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgb(77,163,255) 0%, rgb(99,230,190) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 0 12px rgba(77,163,255,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(7,17,31)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgb(100,112,130)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '1px' }}>
              Portal B2B
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgb(80,92,110)', fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {NAV.map((section, si) => (
            <div key={si} style={{ marginBottom: '0.25rem' }}>
              {section.section && (
                <div style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'rgb(70,82,100)',
                  padding: '0.5rem 0.75rem 0.375rem',
                  marginTop: si > 0 ? '0.5rem' : 0,
                }}>
                  {section.section}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  iconKey={item.key}
                  exact={item.exact}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div style={{
          margin: '0 0.75rem 0.75rem',
          padding: '0.875rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
            {/* Avatar */}
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, color: 'rgb(7,17,31)',
              boxShadow: '0 0 10px rgba(77,163,255,0.3)',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(230,237,245)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              {companyName && (
                <div style={{ fontSize: '0.68rem', color: 'rgb(100,112,130)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {companyName}
                </div>
              )}
            </div>
            {tier && (
              <span style={{
                fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`,
                borderRadius: '6px', padding: '0.2rem 0.4rem', flexShrink: 0,
              }}>
                {tc.label}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', color: 'rgb(90,100,118)', padding: '0.375rem 0',
              transition: 'color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(239,68,68)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = loggingOut ? 'rgb(239,68,68)' : 'rgb(90,100,118)')}
          >
            {loggingOut ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 019.6 7.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <Icon d={icons.logout} size={14} />
            )}
            {loggingOut ? 'A sair...' : 'Terminar sessão'}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          MOBILE TOP BAR
      ════════════════════════════════════════════ */}
      <div
        className="flex md:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '52px',
          background: 'rgba(9,19,35,0.95)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem',
        }}
      >
        <span style={{ fontSize: '1rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
          your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {allNavItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const d = icons[item.key as keyof typeof icons];
            return (
              <Link key={item.href} href={item.href} style={{ padding: '0.375rem', borderRadius: '8px', color: isActive ? 'rgb(77,163,255)' : 'rgb(100,112,130)', background: isActive ? 'rgba(77,163,255,0.1)' : 'transparent', display: 'flex', alignItems: 'center' }}>
                <Icon d={d} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════ */}
      <main style={{ flex: 1, minWidth: 0 }} className="pt-[52px] md:pt-0">
        {children}
      </main>
    </div>
  );
}
