import Link from 'next/link';

// ── Portal 404 ────────────────────────────────────────────────────────────────
// Server component — shown when a portal route is not found.

export default function PortalNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md space-y-6 text-center">

        {/* Visual */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-white/20 text-xs font-mono">404</p>
          <h2 className="text-white text-sm font-semibold">Página não encontrada</h2>
          <p className="text-white/40 text-xs">
            Esta secção do portal não existe ou foi movida.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/command"
            className="w-full py-2.5 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium text-center transition-colors">
            ⚡ Command Center
          </Link>
          <Link href="/dashboard"
            className="w-full py-2.5 rounded-xl border border-white/8 text-white/40 hover:text-white/70 text-xs text-center transition-colors">
            ← Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
