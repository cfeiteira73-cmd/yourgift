'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import CommandBar, { useCommandBar } from './CommandBar';
import AICopilotPanel, { useAICopilot } from './AICopilotPanel';

// ── Breadcrumb helper ─────────────────────────────────────────────────────────

function pathToBreadcrumb(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  const segment = pathname.split('/').filter(Boolean)[0] ?? '';
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Sparkle icon ──────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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

// ── Top Header ────────────────────────────────────────────────────────────────

function TopHeader() {
  const pathname = usePathname();
  const { setOpen: openCommandBar } = useCommandBar();
  const { toggle: toggleCopilot, isOpen: copilotOpen } = useAICopilot();

  return (
    <header className="h-12 bg-[#07111f] border-b border-[#1a2f48] flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="text-[#4d6a87]">YourGift OS</span>
        <span className="text-[#1a2f48]">/</span>
        <span className="text-[#f0f6ff] font-medium">{pathToBreadcrumb(pathname)}</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* CMD+K trigger */}
        <button
          type="button"
          onClick={() => openCommandBar(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] hover:border-[#1f3855] text-[12px] font-mono transition-colors duration-100"
          aria-label="Open command bar"
        >
          <span>⌘K</span>
        </button>

        {/* AI Copilot toggle */}
        <button
          type="button"
          onClick={toggleCopilot}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] transition-colors duration-100 ${
            copilotOpen
              ? 'bg-[#4da3ff]/10 border-[#4da3ff]/40 text-[#4da3ff]'
              : 'bg-[#0b1526] border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] hover:border-[#1f3855]'
          }`}
          aria-label="Toggle AI Copilot"
        >
          <SparkleIcon />
          <span>Copilot</span>
        </button>

        {/* Notification placeholder */}
        <button
          type="button"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] hover:border-[#1f3855] transition-colors duration-100"
          aria-label="Notifications"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M7.5 1.5C5 1.5 3 3.5 3 6v3l-1 1.5h11L12 9V6c0-2.5-2-4.5-4.5-4.5zM6 11.5a1.5 1.5 0 003 0"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* Static red notification dot */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
        </button>
      </div>
    </header>
  );
}

// ── Inner layout (needs hooks, so separate from the outer guard) ──────────────

function AppShell({ children }: { children: ReactNode }) {
  const { isOpen: copilotOpen } = useAICopilot();

  return (
    <>
      <Sidebar />
      <CommandBar />
      <AICopilotPanel />

      <div
        className="flex flex-col min-h-screen"
        style={{
          marginLeft: '14rem', // ml-56 = 224px = 14rem
          marginRight: copilotOpen ? '320px' : '0px',
          transition: 'margin-right 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <TopHeader />
        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </>
  );
}

// ── Shell Layout (default export) ─────────────────────────────────────────────

export default function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
