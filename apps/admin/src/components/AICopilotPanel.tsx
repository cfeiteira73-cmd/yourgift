'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

type InsightType = 'warning' | 'opportunity' | 'critical' | 'info';

interface Insight {
  type: InsightType;
  title: string;
  body: string;
  action: string | null;
}

interface AICopilotContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AICopilotContext = createContext<AICopilotContextValue | null>(null);

export function useAICopilot(): AICopilotContextValue {
  const ctx = useContext(AICopilotContext);
  if (!ctx) {
    throw new Error('useAICopilot must be used within an AICopilotProvider');
  }
  return ctx;
}

export function AICopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AICopilotContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </AICopilotContext.Provider>
  );
}

// ── Fallback insights ─────────────────────────────────────────────────────────

const FALLBACK_INSIGHTS: Insight[] = [
  {
    type: 'warning',
    title: 'Supplier Reliability Drop',
    body: 'Midocean reliability dropped 8% this week in EU region. 3 orders at risk of delay.',
    action: 'Review Routing',
  },
  {
    type: 'opportunity',
    title: 'Reorder Signal Detected',
    body: '14 SKUs projected to deplete within 7 days. Auto-reorder would save ~€420 in rush fees.',
    action: 'Review Forecasts',
  },
  {
    type: 'critical',
    title: 'Budget Alert — Marketing',
    body: 'Marketing dept at 94% of Q2 budget with 18 days remaining.',
    action: 'View Budgets',
  },
  {
    type: 'info',
    title: 'Workflow Performance',
    body: 'Approval workflows completing 23% faster than last month. 0 stuck workflows.',
    action: null,
  },
  {
    type: 'opportunity',
    title: 'Expansion Signal',
    body: '3 clients showing expansion signals: increased order frequency + new categories.',
    action: 'View CS Intelligence',
  },
];

// ── Insight config ────────────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<InsightType, { border: string; badge: string; icon: string }> = {
  warning: {
    border: 'border-[#f59e0b]/30',
    badge: 'bg-[#f59e0b]/20 text-[#f59e0b]',
    icon: '⚠',
  },
  opportunity: {
    border: 'border-[#22c55e]/30',
    badge: 'bg-[#22c55e]/20 text-[#22c55e]',
    icon: '↗',
  },
  critical: {
    border: 'border-[#ef4444]/30',
    badge: 'bg-[#ef4444]/20 text-[#ef4444]',
    icon: '!',
  },
  info: {
    border: 'border-[#4da3ff]/30',
    badge: 'bg-[#4da3ff]/20 text-[#4da3ff]',
    icon: 'i',
  },
};

// ── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = INSIGHT_CONFIG[insight.type];

  return (
    <div className={`mx-3 my-2 p-3 rounded-xl border bg-[#102131] ${cfg.border} animate-fade-in`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#f0f6ff] leading-snug">{insight.title}</p>
        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
          {insight.type}
        </span>
      </div>
      <p className="text-[12px] text-[#8ba8c7] mt-1 leading-relaxed">{insight.body}</p>
      {insight.action && (
        <button className="mt-2 text-[11px] px-3 py-1 rounded-lg bg-[#1a2f48] text-[#4da3ff] hover:bg-[#1f3855] transition-colors duration-100">
          {insight.action}
        </button>
      )}
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Approve All Pending', href: '/employee-portal', icon: '✓' },
  { label: 'Detect Anomalies', href: '/consolidation', icon: '◉' },
  { label: 'Replay Events', href: '/event-platform', icon: '↺' },
  { label: 'View Production', href: '/production', icon: '⬡' },
];

function QuickActions() {
  return (
    <div className="px-3 pb-4">
      <div className="text-[10px] uppercase tracking-widest text-[#4d6a87] font-semibold mb-2 px-1">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#102131] border border-[#1a2f48] hover:border-[#1f3855] text-[11px] text-[#8ba8c7] transition-colors duration-100 text-center"
          >
            <span className="text-[16px]">{a.icon}</span>
            <span>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Sparkle Icon ─────────────────────────────────────────────────────────────

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1L9.5 6H14.5L10.5 9.5L12 14.5L8 11L4 14.5L5.5 9.5L1.5 6H6.5L8 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export default function AICopilotPanel() {
  const { isOpen, close } = useAICopilot();
  const [insights, setInsights] = useState<Insight[]>(FALLBACK_INSIGHTS);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/observability/ai-insights');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.insights)) {
          setInsights(data.insights as Insight[]);
        }
      }
    } catch {
      // Keep fallback insights
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 60_000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  return (
    <div
      className="fixed top-0 right-0 h-full w-[320px] bg-[#0b1526] border-l border-[#1a2f48] z-50 flex flex-col"
      style={{
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a2f48] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#4da3ff]">
            <SparkleIcon size={15} />
          </span>
          <span className="text-[13px] font-semibold text-[#4da3ff]">AI Copilot</span>
          <div
            className="w-2 h-2 rounded-full bg-[#22c55e] pulse-live ml-1"
            title="Monitoring"
          />
        </div>
        <button
          onClick={close}
          className="text-[#4d6a87] hover:text-[#8ba8c7] transition-colors text-[18px] leading-none"
          aria-label="Close AI Copilot"
        >
          ×
        </button>
      </div>

      {/* Insights feed */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Refresh row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-[#4d6a87] font-semibold">
            Insights
          </span>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="text-[11px] text-[#4da3ff] hover:text-[#74e7ff] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>

        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}

        <div className="h-px bg-[#1a2f48] mx-3 my-3" />

        <QuickActions />
      </div>
    </div>
  );
}
