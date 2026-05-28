'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

// ── OMEGA X — S18: Command Palette (Cmd+K) ────────────────────────────────────
//
// Universal command palette for instant navigation, actions and search.
// Persists recent + frequent commands per user via /api/preferences.
// Keyboard-first: Cmd/Ctrl+K to open, ↑↓ to navigate, Enter to execute, Esc to close.
//
// ─────────────────────────────────────────────────────────────────────────────

type Command = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  href?: string;
  action?: () => void;
  category: string;
  keywords?: string[];
};

// All portal commands
const ALL_COMMANDS: Command[] = [
  // Navigation
  { id: 'nav_dashboard',     label: 'Dashboard',              icon: '⬛', href: '/dashboard',    category: 'Navegação' },
  { id: 'nav_orders',        label: 'Encomendas',             icon: '📦', href: '/orders',       category: 'Navegação' },
  { id: 'nav_quotes',        label: 'Orçamentos',             icon: '📄', href: '/quotes',       category: 'Navegação' },
  { id: 'nav_clients',       label: 'Clientes',               icon: '👥', href: '/clients',      category: 'Navegação' },
  { id: 'nav_procurement',   label: 'Procurement AI',         icon: '🤝', href: '/procurement',  category: 'Navegação' },
  { id: 'nav_inventory',     label: 'Inventário',             icon: '🏭', href: '/inventory',    category: 'Navegação' },
  { id: 'nav_qc',            label: 'Controlo Qualidade',     icon: '🔬', href: '/qc',           category: 'Navegação' },
  { id: 'nav_sales',         label: 'AI Sales Intelligence',  icon: '📈', href: '/sales',        category: 'Navegação' },
  { id: 'nav_executive',     label: 'Executive Intel',        icon: '⚙️', href: '/executive',    category: 'Navegação' },
  { id: 'nav_supply_chain',  label: 'Supply Chain',           icon: '🚢', href: '/supply-chain', category: 'Navegação' },
  { id: 'nav_flags',         label: 'Feature Flags',          icon: '🚩', href: '/flags',        category: 'Navegação' },
  { id: 'nav_org',           label: 'Org & RBAC',             icon: '🛡', href: '/org',          category: 'Navegação' },
  { id: 'nav_billing',       label: 'Faturação',              icon: '💳', href: '/billing',      category: 'Navegação' },
  { id: 'nav_suppliers',     label: 'Fornecedores',           icon: '🏪', href: '/suppliers',    category: 'Navegação' },
  { id: 'nav_settings',      label: 'Definições',             icon: '⚙', href: '/settings',     category: 'Navegação' },
  // Quick actions
  { id: 'action_new_order',  label: 'Nova Encomenda',         icon: '➕', href: '/orders/new',   category: 'Ações', keywords: ['criar', 'new', 'order'] },
  { id: 'action_new_quote',  label: 'Novo Orçamento',         icon: '➕', href: '/quotes/new',   category: 'Ações', keywords: ['criar', 'quote', 'orçamento'] },
  { id: 'action_new_client', label: 'Novo Cliente',           icon: '➕', href: '/clients/new',  category: 'Ações', keywords: ['criar', 'client'] },
  { id: 'action_exec_brief', label: 'Gerar Briefing CEO',     icon: '✨', href: '/executive',   category: 'Ações', keywords: ['ai', 'brief', 'executive'] },
  { id: 'action_new_rfq',    label: 'Novo RFQ Procurement',   icon: '📋', href: '/procurement',  category: 'Ações', keywords: ['rfq', 'procurement', 'fornecedor'] },
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-violet-500/30 text-violet-200 rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recentCommands, setRecentCommands] = useState<Array<{ command: string; label: string; href: string }>>([]);

  // Load recent commands
  useEffect(() => {
    if (open) {
      fetch('/api/preferences?mode=commands')
        .then(r => r.json())
        .then(d => setRecentCommands(d.commands ?? []))
        .catch(() => { /* ignore */ });
    }
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  // Filter commands
  const filtered = query.trim()
    ? ALL_COMMANDS.filter(cmd => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q)
          || cmd.description?.toLowerCase().includes(q)
          || cmd.keywords?.some(k => k.includes(q))
          || cmd.category.toLowerCase().includes(q);
      })
    : ALL_COMMANDS.slice(0, 8); // show top 8 when no query

  // Group by category
  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Flat list for keyboard nav
  const flat = Object.values(grouped).flat();

  const execute = useCallback((cmd: Command) => {
    // Track usage
    if (cmd.href || cmd.action) {
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'track_command', command: cmd.id,
          label: cmd.label, href: cmd.href, action_type: cmd.href ? 'navigate' : 'action' }),
      }).catch(() => { /* ignore */ });
    }

    if (cmd.action) { cmd.action(); }
    else if (cmd.href) { router.push(cmd.href); }
    onClose();
  }, [router, onClose]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && flat[selected]) execute(flat[selected]);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flat, selected, execute, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // Recent items to show when no query
  const showRecent = !query.trim() && recentCommands.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh] px-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: -10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }} transition={springSnappy}
            className="w-full max-w-xl bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" className="text-white/30 shrink-0">
                <path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Pesquisar comando ou página..."
                className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none" />
              <kbd className="px-1.5 py-0.5 rounded border border-white/10 text-xs text-white/25 font-mono">esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
              {/* Recent items */}
              {showRecent && (
                <div className="mb-2">
                  <p className="px-4 py-1.5 text-xs font-medium text-white/25 uppercase tracking-wider">Recentes</p>
                  {recentCommands.slice(0, 4).map(cmd => (
                    <button key={cmd.command}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                      onClick={() => { router.push(cmd.href); onClose(); }}>
                      <span className="text-white/20 text-xs">🕐</span>
                      <span className="text-sm text-white/70">{cmd.label}</span>
                      <span className="ml-auto text-xs text-white/20 font-mono">{cmd.href}</span>
                    </button>
                  ))}
                  <div className="h-px bg-white/5 mx-4 my-1" />
                </div>
              )}

              {/* Filtered results grouped by category */}
              {flat.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  Nenhum resultado para "{query}"
                </div>
              ) : (
                Object.entries(grouped).map(([category, cmds]) => (
                  <div key={category}>
                    <p className="px-4 py-1.5 text-xs font-medium text-white/25 uppercase tracking-wider">{category}</p>
                    {cmds.map(cmd => {
                      const globalIdx = flat.indexOf(cmd);
                      const isSelected = globalIdx === selected;
                      return (
                        <button key={cmd.id} data-idx={globalIdx}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-violet-500/15' : 'hover:bg-white/3'}`}
                          onClick={() => execute(cmd)}
                          onMouseEnter={() => setSelected(globalIdx)}>
                          <span className="text-base shrink-0 w-6 text-center">{cmd.icon ?? '○'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80">{highlight(cmd.label, query)}</p>
                            {cmd.description && (
                              <p className="text-xs text-white/30 truncate">{cmd.description}</p>
                            )}
                          </div>
                          {cmd.href && (
                            <span className="text-xs text-white/20 font-mono shrink-0">{cmd.href}</span>
                          )}
                          {isSelected && (
                            <kbd className="px-1 py-0.5 rounded border border-white/10 text-xs text-white/30 font-mono shrink-0">↵</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 px-4 py-2 flex items-center gap-4 text-xs text-white/20">
              <span>↑↓ navegar</span>
              <span>↵ executar</span>
              <span>esc fechar</span>
              <span className="ml-auto">{flat.length} resultado{flat.length !== 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Hook to manage Cmd+K global shortcut ──────────────────────────────────────

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen, onClose: () => setOpen(false) };
}
