'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

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
  {
    href: '/companies',
    label: 'Empresas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5" width="14" height="10" rx="1" />
        <path d="M4 5V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M6 9h4M8 7v4" />
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
    href: '/financial',
    label: 'Financial Intel',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="9" width="3" height="5" rx="0.5" />
        <rect x="6" y="5" width="3" height="9" rx="0.5" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" />
      </svg>
    ),
  },
  {
    href: '/intelligence',
    label: 'Intelligence',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="6" r="3.5" />
        <path d="M5.5 9.5L4 14M10.5 9.5L12 14M6 14h4" />
        <path d="M6.5 4.5c0-.5.5-1.5 1.5-1.5s1.5 1 1.5 1.5" />
      </svg>
    ),
  },
  {
    href: '/inventory',
    label: 'Inventário',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="4" width="12" height="9" rx="1.5" />
        <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
        <path d="M5 8.5h6M5 11h4" />
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
  {
    href: '/webhooks',
    label: 'Webhooks',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 5.5V2M8 14v-2.5M5.5 8H2M14 8h-2.5" />
        <path d="M10.24 5.76l1.77-1.77M3.99 12.01l1.77-1.77M10.24 10.24l1.77 1.77M3.99 3.99l1.77 1.77" />
      </svg>
    ),
  },
  {
    href: '/suppliers',
    label: 'Fornecedores',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="10" height="8" rx="1" />
        <path d="M11 9h2.5a1 1 0 0 1 .9.55l1 2A1 1 0 0 1 15 12v2a1 1 0 0 1-1 1h-3" />
        <circle cx="4" cy="14" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="12" cy="14" r="1.25" fill="currentColor" stroke="none" />
        <path d="M1 9h10" />
      </svg>
    ),
  },
  {
    href: '/retention',
    label: 'Retention',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2a6 6 0 1 1-4.243 1.757" />
        <path d="M2 2h3v3" />
        <path d="M8 5v3.5l2 1.5" />
      </svg>
    ),
  },
  {
    href: '/pricing',
    label: 'Preços',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10l4-8 4 8" />
        <path d="M3.5 7.5h5" />
        <path d="M11 5.5c0 0 1.5-1.5 3 0s-1.5 3 0 4.5" />
      </svg>
    ),
  },
  {
    href: '/audit',
    label: 'Auditoria',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" />
        <path d="M8 5v3.5l2.5 1.5" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Definições',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
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
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('adminUser');
      if (raw) {
        setAdminUser(JSON.parse(raw) as AdminUser);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    // Clear cookie
    document.cookie =
      'adminToken=; path=/; max-age=0; samesite=strict';
    router.replace('/login');
  }

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
      <div className="px-3 py-4 border-t border-[#1a2f48] space-y-1">
        {/* API Docs link */}
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

        {/* User info + logout */}
        {adminUser && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-[#07111f] border border-[#1a2f48]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4da3ff] to-[#74e7ff] flex items-center justify-center text-[#07111f] font-bold text-xs flex-shrink-0">
                {adminUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate leading-none">
                  {adminUser.name}
                </p>
                <p className="text-[10px] text-[#4d6a87] truncate mt-0.5">
                  {adminUser.email}
                </p>
              </div>
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
                {ROLE_LABELS[adminUser.role] ?? adminUser.role}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#f87171] hover:bg-[#f87171]/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 6.5h6M9 4.5l2 2-2 2" />
                <path d="M8 2.5H2.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1H8" />
              </svg>
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
