'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'order' | 'quote' | 'page' | 'action';
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  statusColor?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── Static quick actions ───────────────────────────────────────────────────────

const QUICK_ACTIONS: SearchResult[] = [
  { id:'q1', type:'action', title:'Nova Encomenda', subtitle:'Criar pedido de orçamento', href:'/quotes/new', icon:'📦' },
  { id:'q2', type:'action', title:'Ver Dashboard',  subtitle:'Visão geral do negócio',    href:'/dashboard',  icon:'📊' },
  { id:'q3', type:'action', title:'Upload de Assets',subtitle:'Enviar logótipos e artes', href:'/assets',     icon:'🖼️' },
  { id:'q4', type:'action', title:'Relatórios',     subtitle:'Analytics e faturação',     href:'/reports',    icon:'📈' },
];

const PAGES: SearchResult[] = [
  { id:'p1', type:'page', title:'Dashboard',               subtitle:'Página principal',           href:'/dashboard',    icon:'🏠' },
  { id:'p2', type:'page', title:'Encomendas',              subtitle:'Lista de encomendas',        href:'/orders',       icon:'📦' },
  { id:'p3', type:'page', title:'Orçamentos',              subtitle:'Pedidos de orçamento',       href:'/quotes',       icon:'📋' },
  { id:'p4', type:'page', title:'Catálogo de Produtos',    subtitle:'Pesquisar produtos',         href:'/products',     icon:'🛍️' },
  { id:'p5', type:'page', title:'Produção',                subtitle:'Pipeline de produção',       href:'/production',   icon:'🏭' },
  { id:'p6', type:'page', title:'Relatórios & Analytics',  subtitle:'Métricas e finanças',        href:'/reports',      icon:'📈' },
  { id:'p7', type:'page', title:'Fornecedores',            subtitle:'Parceiros e catálogos',      href:'/suppliers',    icon:'🌊' },
  { id:'p8', type:'page', title:'Marketing & Promoções',   subtitle:'Campanhas e ideias',         href:'/marketing',    icon:'📣' },
  { id:'p9', type:'page', title:'Integrações',             subtitle:'Stripe, Pagamentos, APIs',     href:'/integrations', icon:'⚡' },
  { id:'p10',type:'page', title:'Definições',              subtitle:'Conta e notificações',       href:'/settings',     icon:'⚙️' },
  { id:'p11',type:'page', title:'Faturação',               subtitle:'Faturas e pagamentos',       href:'/billing',      icon:'🧾' },
  { id:'p12',type:'page', title:'Assets & Ficheiros',      subtitle:'Logótipos e maquetes',       href:'/assets',       icon:'🎨' },
];

const STATUS_COLORS: Record<string, string> = {
  producing: '#b8975e', in_production: '#b8975e',
  shipped: '#d4b47a', delivered: '#b8975e',
  pending: 'rgb(245,158,11)', approved: '#b8975e',
  submitted: 'rgb(245,158,11)', pricing: '#b8975e',
  cancelled: 'rgb(239,68,68)', draft: 'rgba(240,236,228,0.42)',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function GlobalSearch({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Get client id once
  useEffect(() => {
    async function getClient() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: c } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      if (c) setClientId(c.id);
    }
    getClient();
  }, []);

  // Search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const supabase = createClient();
    const qLower = q.toLowerCase();

    // Filter pages
    const pageResults = PAGES.filter(p =>
      p.title.toLowerCase().includes(qLower) || p.subtitle.toLowerCase().includes(qLower)
    ).slice(0, 4);

    let orderResults: SearchResult[] = [];
    let quoteResults: SearchResult[] = [];

    if (clientId) {
      const [ordersRes, quotesRes] = await Promise.all([
        supabase.from('orders')
          .select('id,ref,status,total_amount,created_at')
          .eq('client_id', clientId)
          .ilike('ref', `%${q}%`)
          .limit(5),
        supabase.from('quotes')
          .select('id,ref,status,total_amount,notes')
          .eq('client_id', clientId)
          .or(`ref.ilike.%${q}%,notes.ilike.%${q}%`)
          .limit(5),
      ]);

      orderResults = (ordersRes.data ?? []).map((o: any) => ({
        id: o.id, type: 'order' as const,
        title: o.ref,
        subtitle: `Encomenda · ${o.total_amount ? `€${o.total_amount.toLocaleString('pt-PT')}` : 'Sob consulta'}`,
        href: `/orders/${o.id}`,
        icon: '📦',
        statusColor: STATUS_COLORS[o.status] ?? 'rgba(240,236,228,0.42)',
      }));

      quoteResults = (quotesRes.data ?? []).map((q: any) => ({
        id: q.id, type: 'quote' as const,
        title: q.ref,
        subtitle: `Orçamento · ${q.total_amount ? `€${q.total_amount.toLocaleString('pt-PT')}` : 'Sem valor'}`,
        href: `/quotes/${q.id}`,
        icon: '📋',
        statusColor: STATUS_COLORS[q.status] ?? 'rgba(240,236,228,0.42)',
      }));
    }

    setResults([...pageResults, ...orderResults, ...quoteResults]);
    setSelectedIndex(0);
    setLoading(false);
  }, [clientId]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  // Display items (quick actions when no query, results when querying)
  const displayItems = query.trim() ? results : QUICK_ACTIONS;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, displayItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && displayItems[selectedIndex]) {
        router.push(displayItems[selectedIndex].href);
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, displayItems, selectedIndex, router, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  const typeLabel = (type: string) => {
    if (type === 'order') return 'Encomenda';
    if (type === 'quote') return 'Orçamento';
    if (type === 'page') return 'Página';
    return 'Ação';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 9998 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: '560px',
              background: 'rgb(10,18,32)',
              border: '1px solid rgba(240,236,228,0.10)',
              borderRadius: '18px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(154,124,74,0.10)',
              zIndex: 9999, overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.125rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(240,236,228,0.24)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar encomendas, orçamentos, páginas..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: '0.95rem', color: 'rgb(230,240,255)',
                }}
              />
              {loading && (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#d4b47a" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 019.6 7.3" stroke="#d4b47a" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              <kbd style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', background: 'rgba(240,236,228,0.06)', borderRadius: '6px', padding: '0.15rem 0.5rem', fontFamily: 'monospace' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
              {displayItems.length === 0 && query.trim() && !loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.85rem' }}>
                  Sem resultados para "{query}"
                </div>
              ) : (
                <>
                  {!query.trim() && (
                    <div style={{ padding: '0.375rem 0.75rem 0.25rem', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(240,236,228,0.24)' }}>
                      Ações rápidas
                    </div>
                  )}
                  {query.trim() && results.length > 0 && (
                    <div style={{ padding: '0.375rem 0.75rem 0.25rem', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(240,236,228,0.24)' }}>
                      Resultados
                    </div>
                  )}
                  {displayItems.map((item, i) => (
                    <motion.div
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      whileHover={{ background: 'rgba(154,124,74,0.08)' }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                        background: selectedIndex === i ? 'rgba(154,124,74,0.10)' : 'transparent',
                        border: selectedIndex === i ? '1px solid rgba(154,124,74,0.18)' : '1px solid transparent',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                        background: selectedIndex === i ? 'rgba(154,124,74,0.14)' : 'rgba(240,236,228,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(240,236,228,0.75)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {item.title}
                          {item.statusColor && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.statusColor, flexShrink: 0 }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.05rem' }}>{item.subtitle}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', background: 'rgba(240,236,228,0.06)', borderRadius: '5px', padding: '0.1rem 0.35rem' }}>{typeLabel(item.type)}</span>
                        {selectedIndex === i && (
                          <kbd style={{ fontSize: '0.62rem', color: '#d4b47a', background: 'rgba(154,124,74,0.12)', borderRadius: '5px', padding: '0.1rem 0.4rem', fontFamily: 'monospace' }}>↵</kbd>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0.625rem 1.125rem', borderTop: '1px solid rgba(240,236,228,0.06)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {[['↑↓', 'navegar'], ['↵', 'abrir'], ['esc', 'fechar']].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <kbd style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', background: 'rgba(240,236,228,0.06)', borderRadius: '5px', padding: '0.1rem 0.4rem', fontFamily: 'monospace' }}>{key}</kbd>
                  <span style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)' }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
