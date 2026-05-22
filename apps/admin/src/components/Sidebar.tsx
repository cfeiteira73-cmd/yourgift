'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Encomendas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="3" width="12" height="11" rx="1.5" />
        <path d="M5 3V2.5a3 3 0 0 1 6 0V3" />
        <path d="M5 8h6M5 11h4" />
      </svg>
    ),
  },
  {
    href: '/products',
    label: 'Produtos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 2h2l1.5 7h7l1.5-5H5" />
        <circle cx="7" cy="13.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="11" cy="13.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/approvals',
    label: 'Aprovações',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M13 4.5L6 11.5l-3-3" />
        <circle cx="8" cy="8" r="6.5" />
      </svg>
    ),
  },
  {
    href: '/clients',
    label: 'Clientes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="5" r="3" />
        <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      </svg>
    ),
  },
];

const SECONDARY_ITEMS: NavItem[] = [
  {
    href: '/quotes',
    label: 'Orçamentos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M5 5h6M5 8h6M5 11h4" />
      </svg>
    ),
  },
  {
    href: '/budgets',
    label: 'Budgets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v7M6 6h3a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3" />
      </svg>
    ),
  },
  {
    href: '/campaigns',
    label: 'Campanhas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 8h10M11 5l3 3-3 3" />
        <path d="M3 4v8" />
      </svg>
    ),
  },
  {
    href: '/stores',
    label: 'Lojas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="7" width="12" height="7" rx="1" />
        <path d="M2 7l2-4h8l2 4" />
        <path d="M8 7v7" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 13l3-5 3 2 3-6 3 3" />
      </svg>
    ),
  },
  {
    href: '/ai',
    label: 'AI Center',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 1l1.6 4H14l-3.2 2.3L12 12 8 9.5 4 12l1.2-4.7L2 5h4.4z" />
      </svg>
    ),
  },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
        isActive
          ? 'bg-[#0d1f3a] text-[#4da3ff] border border-[#1a3a5c]'
          : 'text-[#8ba8c7] hover:bg-[#102131] hover:text-white border border-transparent'
      }`}
    >
      <span
        className={`flex-shrink-0 transition-colors ${
          isActive ? 'text-[#4da3ff]' : 'text-[#4d6a87] group-hover:text-[#8ba8c7]'
        }`}
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f87171]/10 text-[#f87171]">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-[#0b1526] border-r border-[#1a2f48] flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1a2f48]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4da3ff] to-[#74e7ff] flex items-center justify-center text-[#07111f] font-black text-sm">
            YG
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">YourGift</p>
            <p className="text-[10px] text-[#4d6a87] mt-0.5 font-medium uppercase tracking-widest">
              Admin
            </p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="my-4 border-t border-[#1a2f48]" />

        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">
          Operações
        </p>

        {SECONDARY_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#1a2f48]">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#4d6a87] hover:text-[#8ba8c7] hover:bg-[#102131] transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7v4M8 5h.01" />
          </svg>
          <span>API Docs</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-auto opacity-50">
            <path d="M2 8l6-6M8 8V2H2" />
          </svg>
        </a>
      </div>
    </aside>
  );
}
