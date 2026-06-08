'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Icon helper ───────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string | string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICONS = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  orders:    ['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 01-8 0'],
  quotes:    ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  assets:    ['M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'],
  products:  ['M4 6h16M4 12h16M4 18h16'],
  billing:   ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
  settings:  ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  logout:    ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  support:   ['M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z'],
};

const NAV = [
  { href: '/client-portal',          label: 'Dashboard',        icon: 'dashboard', exact: true },
  { href: '/client-portal/orders',   label: 'Encomendas',       icon: 'orders',    badge: 'orders' },
  { href: '/client-portal/quotes',   label: 'Orçamentos',       icon: 'quotes',    badge: 'quotes' },
  { href: '/client-portal/assets',   label: 'Maquetes & Assets', icon: 'assets' },
  { href: '/client-portal/products', label: 'Catálogo',         icon: 'products' },
  { href: '/client-portal/billing',  label: 'Faturação',        icon: 'billing' },
  { href: '/client-portal/settings', label: 'Definições',       icon: 'settings' },
];

const MOBILE_NAV = [
  { href: '/client-portal',          label: 'Início',      icon: 'dashboard', exact: true },
  { href: '/client-portal/orders',   label: 'Encomendas',  icon: 'orders' },
  { href: '/client-portal/quotes',   label: 'Orçamentos',  icon: 'quotes' },
  { href: '/client-portal/assets',   label: 'Assets',      icon: 'assets' },
  { href: '/client-portal/settings', label: 'Definições',  icon: 'settings' },
];

interface Props {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  companyName?: string;
}

function NavItem({ href, label, iconKey, exact, badge, badges }: {
  href: string; label: string; iconKey: string;
  exact?: boolean; badge?: string; badges: Record<string, number>;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const d = ICONS[iconKey as keyof typeof ICONS];
  const count = badge ? badges[badge] ?? 0 : 0;

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.425rem 0.625rem', borderRadius: '0px',
          fontSize: '0.8rem', fontWeight: isActive ? 600 : 400,
          color: isActive ? 'rgb(255,255,255)' : 'rgba(240,236,228,0.45)',
          background: isActive ? 'rgba(77,163,255,0.14)' : 'transparent',
          border: isActive ? '1px solid rgba(154,124,74,0.18)' : '1px solid transparent',
          transition: 'all 120ms', cursor: 'pointer', position: 'relative',
        }}
        onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.72)'; (e.currentTarget as HTMLElement).style.background = 'rgba(240,236,228,0.04)'; }}}
        onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.45)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
      >
        {isActive && (
          <motion.div layoutId="client-active-bar" style={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%',
            width: '2.5px', background: '#d4b47a', borderRadius: '0 2px 2px 0',
            boxShadow: '0 0 8px rgba(77,163,255,0.7)',
          }} />
        )}
        <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7, color: isActive ? '#d4b47a' : 'inherit' }}>
          <Icon d={d} size={15} />
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {count > 0 && (
          <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#d4b47a', color: '#090907', borderRadius: '9999px', padding: '0.15rem 0.45rem', flexShrink: 0 }}>{count}</span>
        )}
      </motion.div>
    </Link>
  );
}

export function ClientPortalLayout({ children, userName, userEmail, companyName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = userName || userEmail?.split('@')[0] || 'Cliente';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'CL';

  useEffect(() => {
    async function fetchBadges() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: client } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      if (!client) return;
      const [ordersRes, quotesRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', client.id).not('status', 'in', '(delivered,cancelled)'),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', client.id).in('status', ['submitted', 'pricing', 'proposed']),
      ]);
      setBadges({ orders: ordersRes.count ?? 0, quotes: quotesRes.count ?? 0 });
    }
    fetchBadges();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#090907' }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex" style={{
        width: '196px', flexShrink: 0, flexDirection: 'column',
        background: '#0f0f0c', borderRight: '1px solid rgba(240,236,228,0.06)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '1.125rem 1rem 0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0, background: 'linear-gradient(135deg, #d4b47a, #b8975e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(154,124,74,0.28)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#090907" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
                <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f0ece4', letterSpacing: '-0.02em', lineHeight: 1 }}>
                your<span style={{ color: '#d4b47a' }}>gift</span>
              </div>
              <div style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '1px' }}>Portal Cliente</div>
            </div>
          </div>
        </div>

        {/* Client info */}
        <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '0px', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '0px', flexShrink: 0, background: 'linear-gradient(135deg, #d4b47a, #b8975e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#090907' }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(210,225,245)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName || userEmail}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0.625rem', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.24)', padding: '0.75rem 0.625rem 0.25rem' }}>Menu</div>
          {NAV.map(item => (
            <NavItem key={item.href} href={item.href} label={item.label} iconKey={item.icon} exact={item.exact} badge={item.badge} badges={badges} />
          ))}
          <div style={{ margin: '0.75rem 0', height: '1px', background: 'rgba(240,236,228,0.06)' }} />
          <Link href="mailto:geral@yourgift.pt" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.425rem 0.625rem', borderRadius: '0px', fontSize: '0.8rem', color: 'rgba(240,236,228,0.45)', cursor: 'pointer', transition: 'all 120ms' }}
              onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.72)'; (e.currentTarget as HTMLElement).style.background = 'rgba(240,236,228,0.04)'; }}
              onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.45)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <span style={{ opacity: 0.7 }}><Icon d={ICONS.support} size={15} /></span>
              <span>Suporte</span>
            </div>
          </Link>
        </nav>

        {/* Logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(240,236,228,0.06)' }}>
          <button type="button" onClick={handleLogout} disabled={loggingOut} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)', padding: '0.375rem', borderRadius: '6px', transition: 'color 150ms',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(239,68,68)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.24)'; }}>
            <Icon d={ICONS.logout} size={12} />
            {loggingOut ? 'A sair...' : 'Terminar sessão'}
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="flex md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '52px', background: 'rgba(8,15,28,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(240,236,228,0.06)', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#f0ece4', letterSpacing: '-0.02em' }}>
          your<span style={{ color: '#d4b47a' }}>gift</span>
          <span style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.28)', marginLeft: '0.375rem', background: 'rgba(240,236,228,0.06)', borderRadius: '4px', padding: '0.1rem 0.4rem', verticalAlign: 'middle' }}>Cliente</span>
        </span>
        <div style={{ width: '32px', height: '32px', borderRadius: '0px', background: 'linear-gradient(135deg, #d4b47a, #b8975e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#090907' }}>{initials}</div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="flex md:hidden" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, height: '64px', background: 'rgba(8,15,28,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(240,236,228,0.06)', alignItems: 'center', justifyContent: 'space-around', padding: '0 0.25rem' }}>
        {MOBILE_NAV.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const d = ICONS[item.icon as keyof typeof ICONS];
          const count = item.icon === 'orders' ? badges.orders ?? 0 : item.icon === 'quotes' ? badges.quotes ?? 0 : 0;
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 0.75rem', borderRadius: '0px', color: isActive ? '#d4b47a' : 'rgba(240,236,228,0.42)', background: isActive ? 'rgba(154,124,74,0.10)' : 'transparent', textDecoration: 'none', position: 'relative', minWidth: '52px', flexShrink: 0 }}>
              <Icon d={d} size={20} />
              <span style={{ fontSize: '0.55rem', fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
              {count > 0 && <div style={{ position: 'absolute', top: '4px', right: '8px', width: '14px', height: '14px', borderRadius: '50%', background: '#d4b47a', border: '2px solid #0f0f0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontWeight: 700, color: '#090907' }}>{count > 9 ? '9+' : count}</div>}
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, minWidth: 0 }} className="pt-[52px] md:pt-0 pb-[64px] md:pb-0">
        {children}
      </main>
    </div>
  );
}
