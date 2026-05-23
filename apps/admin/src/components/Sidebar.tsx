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
    href: '/procurement-ops',
    label: 'Procurement Ops',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 10h3l1.5 2h3L11 10h3" />
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M5 6.5h6M5 8.5h4" />
      </svg>
    ),
  },
  {
    href: '/production',
    label: 'Production',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 6.75 2.9m-.893 8.653-.587-1.428m10.05 1.014-.587-1.428M5.443 12.37l-1.41-.512m14.095 5.13-1.41-.513" />
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
    href: '/financial-intelligence',
    label: 'Fin. Intel',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    href: '/consolidation',
    label: 'Consolidation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
      </svg>
    ),
  },
  {
    href: '/ledger',
    label: 'Ledger',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M8 2v12M2 8h12" />
      </svg>
    ),
  },
  {
    href: '/automation',
    label: 'Automation',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2L5 9h6l-4 5" />
      </svg>
    ),
  },
  {
    href: '/workflows',
    label: 'Workflows',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: '/tenants',
    label: 'Tenants',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
  {
    href: '/design-studio',
    label: 'Design Studio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
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
    href: '/projections',
    label: 'Projections',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="8" cy="4" rx="6" ry="2" />
        <path d="M2 4v3c0 1.1 2.686 2 6 2s6-.9 6-2V4" />
        <path d="M2 7v3c0 1.1 2.686 2 6 2s6-.9 6-2V7" />
      </svg>
    ),
  },
  {
    href: '/event-platform',
    label: 'Event Platform',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
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
    href: '/supplier-intelligence',
    label: 'Supplier Intel',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="4" r="2" />
        <circle cx="4" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <line x1="8" y1="6" x2="4" y2="10" />
        <line x1="8" y1="6" x2="12" y2="10" />
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
    href: '/customer-success',
    label: 'Customer Success',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
  },
  {
    href: '/employee-portal',
    label: 'Employee Portal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
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
    href: '/observability',
    label: 'Observability',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: '/globalization',
    label: 'Globalization',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <ellipse cx="8" cy="8" rx="3" ry="6.5" />
        <path d="M1.5 6h13M1.5 10h13" />
      </svg>
    ),
  },
  {
    href: '/logistics',
    label: 'Logistics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5" width="10" height="8" rx="1" />
        <path d="M11 7h2.5l1.5 2v3h-4V7z" />
        <circle cx="4" cy="13.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/margin-protection',
    label: 'Margin Guard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1L2 4v4c0 3.5 2.5 5.8 6 7 3.5-1.2 6-3.5 6-7V4L8 1z" />
        <path d="M5 8l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/ai-agent',
    label: 'AI Agent',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.5 6.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 1.5-1.5 2-2.5 2.5" />
        <circle cx="8" cy="12" r=".75" fill="currentColor" stroke="none" />
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
