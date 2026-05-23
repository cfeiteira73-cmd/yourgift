'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  label: string;
  href: string;
  group: 'navigate' | 'action';
}

interface RecentItem {
  href: string;
  label: string;
}

interface FlatItem {
  item: CommandItem | RecentItem;
  group: 'navigate' | 'action' | 'recent';
}

interface CommandBarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

export function useCommandBar(): CommandBarContextValue {
  const ctx = useContext(CommandBarContext);
  if (!ctx) {
    throw new Error('useCommandBar must be used within a CommandBarProvider');
  }
  return ctx;
}

export function CommandBarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CommandBarContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandBarContext.Provider>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const NAVIGATE_ITEMS: CommandItem[] = [
  { label: 'Dashboard', href: '/', group: 'navigate' },
  { label: 'Orders', href: '/orders', group: 'navigate' },
  { label: 'Production', href: '/production', group: 'navigate' },
  { label: 'Financial Intelligence', href: '/financial-intelligence', group: 'navigate' },
  { label: 'Workflows', href: '/workflows', group: 'navigate' },
  { label: 'Suppliers', href: '/suppliers', group: 'navigate' },
  { label: 'Employee Portal', href: '/employee-portal', group: 'navigate' },
  { label: 'Observability', href: '/observability', group: 'navigate' },
  { label: 'Globalization', href: '/globalization', group: 'navigate' },
  { label: 'Customer Success', href: '/customer-success', group: 'navigate' },
  { label: 'Design Studio', href: '/design-studio', group: 'navigate' },
  { label: 'Event Platform', href: '/event-platform', group: 'navigate' },
  { label: 'Supplier Intelligence', href: '/supplier-intelligence', group: 'navigate' },
];

const ACTION_ITEMS: CommandItem[] = [
  { label: 'Create New Order', href: '/orders/new', group: 'action' },
  { label: 'Approve Pending Requests', href: '/employee-portal', group: 'action' },
  { label: 'Run Budget Anomaly Detection', href: '/consolidation', group: 'action' },
  { label: 'Replay Event Stream', href: '/event-platform', group: 'action' },
  { label: 'Generate AI Mockup', href: '/design-studio', group: 'action' },
  { label: 'Take System Snapshot', href: '/observability', group: 'action' },
];

const RECENT_KEY = 'cmdbar_recent';
const MAX_RECENT = 3;

function getRecent(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

function saveRecent(item: RecentItem) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecent().filter((r) => r.href !== item.href);
    const updated = [item, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-[#4da3ff]">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#4d6a87]">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 opacity-50">
      <path d="M2.5 10.5L10.5 2.5M10.5 2.5H4.5M10.5 2.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 text-[#f59e0b]">
      <path d="M7.5 1L2 7.5H6.5L5.5 12L11 5.5H6.5L7.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 opacity-50">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 3.5V6.5L8.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-[#4d6a87] font-semibold select-none">
      {label}
    </div>
  );
}

// ── Command Row ──────────────────────────────────────────────────────────────

interface CommandRowProps {
  item: CommandItem | RecentItem;
  isSelected: boolean;
  query: string;
  group: 'navigate' | 'action' | 'recent';
  onHover: () => void;
  onClick: () => void;
}

function CommandRow({ item, isSelected, query, group, onHover, onClick }: CommandRowProps) {
  const label = item.label;

  return (
    <div
      className={`h-10 px-4 flex items-center gap-3 rounded-lg mx-1 cursor-pointer transition-colors duration-75 ${
        isSelected ? 'bg-[#102131] text-[#f0f6ff]' : 'text-[#8ba8c7]'
      }`}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      {group === 'navigate' && <ArrowUpRightIcon />}
      {group === 'action' && <BoltIcon />}
      {group === 'recent' && <ClockIcon />}
      <span className="text-[13px] flex-1 truncate">
        {query ? highlightMatch(label, query) : label}
      </span>
    </div>
  );
}

// ── Main CommandBar ───────────────────────────────────────────────────────────

export default function CommandBar() {
  const { open, setOpen } = useCommandBar();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  // Load recent on mount
  useEffect(() => {
    setRecent(getRecent());
  }, [open]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build visible items list
  const filteredItems = (() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const navMatches = NAVIGATE_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
    const actMatches = ACTION_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
    return [
      ...navMatches.map((i) => ({ ...i, group: 'navigate' as const })),
      ...actMatches.map((i) => ({ ...i, group: 'action' as const })),
    ];
  })();

  // Flat list for keyboard navigation
  const flatList: FlatItem[] = query.trim()
    ? filteredItems.map((i) => ({ item: i, group: i.group }))
    : [
        ...NAVIGATE_ITEMS.map((i) => ({ item: i, group: 'navigate' as const })),
        ...ACTION_ITEMS.map((i) => ({ item: i, group: 'action' as const })),
        ...recent.map((i) => ({ item: i, group: 'recent' as const })),
      ];

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, flatList.length - 1)),
    [flatList.length],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => clampIndex(i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => clampIndex(i - 1));
    } else if (e.key === 'Enter') {
      const selected = flatList[selectedIndex];
      if (selected) handleNavigate(selected.item);
    }
  }

  function handleNavigate(item: CommandItem | RecentItem) {
    saveRecent({ href: item.href, label: item.label });
    handleClose();
    router.push(item.href);
  }

  function handleClose() {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelectedIndex(0);
  }

  if (!open) return null;

  const showSearch = query.trim().length > 0;
  const hasResults = filteredItems.length > 0;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] cmd-overlay"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[580px] rounded-2xl bg-[#0b1526] border border-[#1a2f48] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-5 py-4">
          <SearchIcon />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[#f0f6ff] text-[15px] outline-none placeholder:text-[#4d6a87]"
            placeholder="Search pages, actions…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[11px] text-[#4d6a87] bg-[#102131] border border-[#1a2f48] rounded px-1.5 py-0.5 font-mono">
            esc
          </kbd>
        </div>

        <div className="border-b border-[#1a2f48]" />

        {/* Results area */}
        <div className="max-h-[400px] overflow-y-auto py-2 scrollbar-thin">
          {showSearch ? (
            hasResults ? (
              <>
                {/* Navigate group */}
                {filteredItems.filter((i) => i.group === 'navigate').length > 0 && (
                  <>
                    <SectionHeader label="Navigate" />
                    {filteredItems
                      .filter((i) => i.group === 'navigate')
                      .map((item) => {
                        const idx = flatList.findIndex((f) => f.item.href === item.href && f.group === 'navigate');
                        return (
                          <CommandRow
                            key={item.href + '-nav'}
                            item={item}
                            group="navigate"
                            isSelected={selectedIndex === idx}
                            query={query}
                            onHover={() => setSelectedIndex(idx)}
                            onClick={() => handleNavigate(item)}
                          />
                        );
                      })}
                  </>
                )}
                {/* Actions group */}
                {filteredItems.filter((i) => i.group === 'action').length > 0 && (
                  <>
                    <SectionHeader label="Actions" />
                    {filteredItems
                      .filter((i) => i.group === 'action')
                      .map((item) => {
                        const idx = flatList.findIndex((f) => f.item.href === item.href && f.group === 'action');
                        return (
                          <CommandRow
                            key={item.href + '-act'}
                            item={item}
                            group="action"
                            isSelected={selectedIndex === idx}
                            query={query}
                            onHover={() => setSelectedIndex(idx)}
                            onClick={() => handleNavigate(item)}
                          />
                        );
                      })}
                  </>
                )}
              </>
            ) : (
              <div className="px-5 py-10 text-center text-[#4d6a87] text-[13px]">
                No results for &quot;{query}&quot;
              </div>
            )
          ) : (
            <>
              {/* Navigate section */}
              <SectionHeader label="Navigate" />
              {NAVIGATE_ITEMS.map((item) => {
                const idx = flatList.findIndex((f) => f.item.href === item.href && f.group === 'navigate');
                return (
                  <CommandRow
                    key={item.href + '-nav'}
                    item={item}
                    group="navigate"
                    isSelected={selectedIndex === idx}
                    query=""
                    onHover={() => setSelectedIndex(idx)}
                    onClick={() => handleNavigate(item)}
                  />
                );
              })}

              {/* Actions section */}
              <SectionHeader label="Actions" />
              {ACTION_ITEMS.map((item) => {
                const idx = flatList.findIndex((f) => f.item.href === item.href && f.group === 'action');
                return (
                  <CommandRow
                    key={item.href + '-act'}
                    item={item}
                    group="action"
                    isSelected={selectedIndex === idx}
                    query=""
                    onHover={() => setSelectedIndex(idx)}
                    onClick={() => handleNavigate(item)}
                  />
                );
              })}

              {/* Recent section */}
              {recent.length > 0 && (
                <>
                  <SectionHeader label="Recent" />
                  {recent.map((item) => {
                    const idx = flatList.findIndex((f) => f.item.href === item.href && f.group === 'recent');
                    return (
                      <CommandRow
                        key={item.href + '-recent'}
                        item={item}
                        group="recent"
                        isSelected={selectedIndex === idx}
                        query=""
                        onHover={() => setSelectedIndex(idx)}
                        onClick={() => handleNavigate(item)}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#1a2f48] flex items-center gap-4 text-[11px] text-[#4d6a87]">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
