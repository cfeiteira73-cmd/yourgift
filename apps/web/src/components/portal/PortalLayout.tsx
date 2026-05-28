'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlobalSearch } from './GlobalSearch';
import { AICopilot } from './AICopilot';
import { CommandPalette } from './CommandPalette';
import { NotificationCenter } from './NotificationCenter';
import { ToastContainer } from './ToastNotification';
import { RealtimeIndicator } from './RealtimeIndicator';

// ── SVG Icon helper ───────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string | string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

// ── Icon paths ─────────────────────────────────────────────────────────────────

const ICONS = {
  dashboard:    ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  orders:       ['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 01-8 0'],
  production:   ['M2 20h20M4 20V10l8-8 8 8v10', 'M9 20v-5h6v5'],
  mockups:      ['M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'],
  products:     ['M4 6h16M4 12h16M4 18h16'],
  assets:       ['M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'],
  clients:      ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75', 'M9 7a4 4 0 100 8 4 4 0 000-8z'],
  quotes:       ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  billing:      ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
  suppliers:    ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm11 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5z'],
  reports:      ['M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'],
  marketing:    ['M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'],
  integrations: ['M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'],
  settings:     ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  cockpit:      ['M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a6 6 0 110 12A6 6 0 0112 6zm0 3a3 3 0 100 6 3 3 0 000-6z', 'M12 12l4-4'],
  strategist:   ['M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18'],
  runbooks:     ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'],
  financials:   ['M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  configurator: ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  procurement:  ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', 'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'M9 12l2 2 4-4'],
  inventory:    ['M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
  qc:           ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
  sales:        ['M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'],
  executive:    ['M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'],
  supply_chain: ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12'],
  flags:        ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  org:          ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M23 21v-2a4 4 0 00-3-3.87', 'M9 7a4 4 0 100 8 4 4 0 000-8z', 'M16 3.13a4 4 0 010 7.75'],
  infra:        ['M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7', 'M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6'],
  marketplace:  ['M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', 'M12 22v-4'],
  ml:           ['M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2'],
  activity:     ['M22 12h-4l-3 9L9 3l-3 9H2'],
  ops:          ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  reconcil:     ['M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3', 'M9 7V4a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1h-3', 'M9 12l2 2 4-4'],
  autopilot:    ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 6v6l4 2'],
  intel:        ['M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'],
  payments:     ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
  disputes:     ['M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'],
  postmortems:  ['M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
  forecasting:  ['M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'],
  control_tower:['M3 21h18M9 7h6m-6 4h6m-6 4h6M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14'],
  logout:       ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  search:       ['M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z'],
  plus:         ['M12 5v14M5 12h14'],
  chevronDown:  'M19 9l-7 7-7-7',
};

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',             icon: 'dashboard',    exact: true },
  { href: '/cockpit',      label: 'Cockpit Executivo',     icon: 'cockpit' },
  { divider: 'Operações' },
  { href: '/orders',       label: 'Encomendas',            icon: 'orders',       badgeKey: 'orders' },
  { href: '/configurator', label: 'Configurador',          icon: 'configurator' },
  { href: '/production',   label: 'Produção',              icon: 'production' },
  { href: '/artwork',       label: 'Aprovação de Artes',    icon: 'mockups' },
  { href: '/assets',       label: 'Maquetes & Artes',      icon: 'assets' },
  { href: '/products',     label: 'Catálogo de Produtos',  icon: 'products' },
  { href: '/assets',       label: 'Logótipos & Assets',    icon: 'assets' },
  { divider: 'Gestão' },
  { href: '/clients',      label: 'Clientes',              icon: 'clients' },
  { href: '/quotes',       label: 'Orçamentos',            icon: 'quotes',       badgeKey: 'quotes' },
  { href: '/billing',      label: 'Faturação',             icon: 'billing' },
  { href: '/suppliers',    label: 'Fornecedores',          icon: 'suppliers' },
  { href: '/procurement',  label: 'Procurement AI',         icon: 'procurement' },
  { href: '/inventory',    label: 'Inventário & Armazém',   icon: 'inventory' },
  { href: '/qc',           label: 'Controlo Qualidade',     icon: 'qc' },
  { divider: 'Crescimento' },
  { href: '/executive',      label: 'Executive Intel',        icon: 'executive' },
  { href: '/sales',          label: 'AI Sales Intelligence',  icon: 'sales' },
  { href: '/supply-chain',   label: 'Supply Chain',           icon: 'supply_chain' },
  { href: '/flags',          label: 'Feature Flags',          icon: 'flags' },
  { href: '/org',            label: 'Org & RBAC',             icon: 'org' },
  { href: '/infra',          label: 'Infraestrutura',          icon: 'infra' },
  { href: '/marketplace',     label: 'Marketplace B2B',       icon: 'marketplace' },
  { href: '/ml',             label: 'ML Platform',           icon: 'ml' },
  { href: '/activity',       label: 'Activity Stream',       icon: 'activity' },
  { href: '/ops',            label: 'War Room Ops',          icon: 'ops' },
  { href: '/reconciliation', label: 'Reconciliação',         icon: 'reconcil' },
  { href: '/autopilot',      label: 'AI Autopilot',          icon: 'autopilot' },
  { href: '/intel',          label: 'Intelligence',          icon: 'intel' },
  { href: '/payments',       label: 'Live Money',            icon: 'payments' },
  { href: '/disputes',       label: 'Disputas',              icon: 'disputes' },
  { href: '/postmortems',    label: 'Postmortems',           icon: 'postmortems' },
  { href: '/forecasting',    label: 'AI Forecasting',        icon: 'forecasting' },
  { href: '/control-tower',  label: 'Control Tower',         icon: 'control_tower' },
  { href: '/strategist',     label: 'Estratega AI',          icon: 'strategist' },
  { href: '/financials',   label: 'Inteligência Financeira',icon: 'financials' },
  { href: '/reports',      label: 'Relatórios & Analytics',icon: 'reports' },
  { href: '/marketing',    label: 'Marketing & Promoções', icon: 'marketing' },
  { href: '/integrations', label: 'Integrações',           icon: 'integrations' },
  { href: '/runbooks',     label: 'Runbooks Ops',          icon: 'runbooks' },
  { href: '/settings',     label: 'Definições',            icon: 'settings' },
] as const;

// Mobile bottom nav items (most important 5) — S13 Mobile Command Center
const MOBILE_NAV = [
  { href: '/dashboard',  label: 'Home',      icon: 'dashboard',  exact: true },
  { href: '/cockpit',    label: 'Cockpit',   icon: 'cockpit' },
  { href: '/orders',     label: 'Encomendas',icon: 'orders' },
  { href: '/quotes',     label: 'Orçamentos',icon: 'quotes' },
  { href: '/settings',   label: 'Definições', icon: 'settings' },
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

function NavItem({
  href, label, iconKey, exact, badge,
}: { href: string; label: string; iconKey: string; exact?: boolean; badge?: number }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const d = ICONS[iconKey as keyof typeof ICONS];

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 0.625rem',
          borderRadius: '8px',
          fontSize: '0.8rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'rgb(255,255,255)' : 'rgb(140,155,175)',
          background: isActive ? 'rgba(77,163,255,0.14)' : 'transparent',
          border: isActive ? '1px solid rgba(77,163,255,0.2)' : '1px solid transparent',
          transition: 'all 120ms ease',
          cursor: 'pointer',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = 'rgb(210,220,235)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.color = 'rgb(140,155,175)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        {isActive && (
          <motion.div layoutId="active-bar" style={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%',
            width: '2.5px', background: 'rgb(77,163,255)', borderRadius: '0 2px 2px 0',
            boxShadow: '0 0 8px rgba(77,163,255,0.7)',
          }} />
        )}
        <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7, color: isActive ? 'rgb(77,163,255)' : 'inherit' }}>
          <Icon d={d} size={15} />
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {badge && badge > 0 ? (
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, lineHeight: 1,
            background: 'rgb(77,163,255)', color: 'rgb(7,17,31)',
            borderRadius: '9999px', padding: '0.15rem 0.45rem', flexShrink: 0,
          }}>{badge}</span>
        ) : null}
      </motion.div>
    </Link>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PortalLayout({ children, userName, userEmail, companyName, tier }: PortalLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Ctrl+K → CommandPalette | Ctrl+Shift+K → GlobalSearch
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch badge counts
  useEffect(() => {
    async function fetchBadges() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: client } = await supabase
        .from('clients').select('id').eq('auth_user_id', user.id).single();
      if (!client) return;

      const [ordersRes, quotesRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .not('status', 'in', '(delivered,cancelled)'),
        supabase.from('quotes').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .in('status', ['submitted', 'pricing', 'proposed']),
      ]);
      setBadges({
        orders: ordersRes.count ?? 0,
        quotes: quotesRes.count ?? 0,
      });
    }
    fetchBadges();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const displayName = userName || userEmail?.split('@')[0] || 'Utilizador';
  const displayEmail = userEmail || 'geral@yourgift.pt';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'YG';
  const company = companyName || 'YOURGIFT LDA';
  const usagePct = 78;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgb(7,17,31)' }}>

      {/* ════ COMMAND PALETTE (Cmd+K) ════ */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ════ GLOBAL SEARCH (Cmd+Shift+K) ════ */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ════ AI COPILOT ════ */}
      <AICopilot />

      {/* ════ TOAST NOTIFICATIONS ════ */}
      <ToastContainer />

      {/* ════ DESKTOP SIDEBAR ════ */}
      <aside
        className="hidden md:flex"
        style={{
          width: '196px',
          flexShrink: 0,
          flexDirection: 'column',
          background: 'rgb(8,15,28)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.125rem 1rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
              background: 'linear-gradient(135deg, rgb(77,163,255) 0%, rgb(99,230,190) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(77,163,255,0.3)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(7,17,31)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
                <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
              your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <NotificationCenter />
              <RealtimeIndicator />
            </div>
          </div>
        </div>

        {/* Company selector */}
        <div style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.625rem', borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
              background: 'rgba(77,163,255,0.2)',
              border: '1px solid rgba(77,163,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 800, color: 'rgb(77,163,255)',
            }}>
              {initials.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empresa</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgb(200,210,225)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</div>
            </div>
            <span style={{ color: 'rgb(80,92,110)', flexShrink: 0 }}>
              <Icon d={ICONS.chevronDown} size={12} />
            </span>
          </div>
        </div>

        {/* ⌘K Search trigger */}
        <div style={{ padding: '0.5rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
              padding: '0.4rem 0.625rem', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', color: 'rgb(100,112,130)', transition: 'all 150ms',
              fontSize: '0.75rem',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.3)'; (e.currentTarget as HTMLElement).style.color = 'rgb(77,163,255)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgb(100,112,130)'; }}
          >
            <Icon d={ICONS.search} size={13} />
            <span style={{ flex: 1, textAlign: 'left', fontSize: '0.72rem' }}>Pesquisar...</span>
            <kbd style={{ fontSize: '0.58rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '0.1rem 0.35rem', fontFamily: 'monospace', letterSpacing: '0.02em' }}>⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0.625rem', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item, i) => {
            if ('divider' in item) {
              return (
                <div key={i} style={{
                  fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'rgb(60,72,90)',
                  padding: '0.75rem 0.625rem 0.25rem',
                }}>
                  {item.divider}
                </div>
              );
            }
            return (
              <NavItem
                key={`${item.href}-${item.label}`}
                href={item.href}
                label={item.label}
                iconKey={item.icon}
                exact={'exact' in item ? item.exact : undefined}
                badge={'badgeKey' in item && item.badgeKey ? badges[item.badgeKey] : undefined}
              />
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Plan info */}
          <div style={{ marginBottom: '0.625rem', padding: '0 0.125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plano Empresarial</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>Enterprise</div>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'rgb(120,130,150)' }}>Utilização</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePct}%` }}
                transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, rgb(77,163,255), rgb(99,230,190))' }}
              />
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginTop: '0.2rem', textAlign: 'right' }}>{usagePct}%</div>
          </div>

          {/* User */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.5rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
          }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 800, color: 'rgb(7,17,31)',
              boxShadow: '0 0 8px rgba(77,163,255,0.25)',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgb(220,230,245)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayEmail}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>Administrador</div>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
              width: '100%', marginTop: '0.5rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.72rem', color: 'rgb(70,82,100)', padding: '0.3rem',
              transition: 'color 150ms', borderRadius: '6px',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgb(239,68,68)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = loggingOut ? 'rgb(239,68,68)' : 'rgb(70,82,100)'; }}
          >
            {loggingOut ? (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 019.6 7.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <Icon d={ICONS.logout} size={12} />
            )}
            {loggingOut ? 'A sair...' : 'Terminar sessão'}
          </button>
        </div>
      </aside>

      {/* ════ MOBILE TOP BAR ════ */}
      <div className="flex md:hidden" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '52px',
        background: 'rgba(8,15,28,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem',
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
          your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
        </span>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '0.4rem 0.75rem', cursor: 'pointer',
            color: 'rgb(140,155,175)', fontSize: '0.75rem',
          }}
        >
          <Icon d={ICONS.search} size={14} />
          <span>Pesquisar</span>
          <kbd style={{ fontSize: '0.58rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontFamily: 'monospace' }}>⌘K</kbd>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <NotificationCenter />
          <Link href="/quotes/new" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'rgba(77,163,255,0.15)', border: '1px solid rgba(77,163,255,0.3)',
            color: 'rgb(77,163,255)',
          }}>
            <Icon d={ICONS.plus} size={16} />
          </Link>
        </div>
      </div>

      {/* ════ MOBILE BOTTOM NAV ════ */}
      <nav className="flex md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        height: '64px',
        background: 'rgba(8,15,28,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'space-around', padding: '0 0.5rem',
      }}>
        {MOBILE_NAV.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const d = ICONS[item.icon as keyof typeof ICONS];
          const badge = item.icon === 'orders' ? badges.orders : item.icon === 'quotes' ? badges.quotes : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.2rem', padding: '0.5rem 0.75rem', borderRadius: '12px',
                color: isActive ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
                background: isActive ? 'rgba(77,163,255,0.1)' : 'transparent',
                transition: 'all 150ms', textDecoration: 'none', position: 'relative',
                minWidth: '52px', flexShrink: 0,
              }}
            >
              <Icon d={d} size={20} />
              <span style={{ fontSize: '0.55rem', fontWeight: isActive ? 700 : 400, letterSpacing: '0.02em' }}>
                {item.label}
              </span>
              {badge > 0 && (
                <div style={{
                  position: 'absolute', top: '4px', right: '8px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: 'rgb(77,163,255)', border: '2px solid rgb(8,15,28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.45rem', fontWeight: 800, color: 'rgb(7,17,31)',
                }}>{badge > 9 ? '9+' : badge}</div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ════ MAIN CONTENT ════ */}
      <main style={{ flex: 1, minWidth: 0 }} className="pt-[52px] md:pt-0 pb-[64px] md:pb-0">
        {children}
      </main>
    </div>
  );
}
