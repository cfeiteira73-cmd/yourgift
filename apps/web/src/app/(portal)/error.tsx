'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// ── Portal-level error boundary ───────────────────────────────────────────────
//
// Catches all unhandled errors from any portal page (46 pages).
// Next.js App Router requires 'use client' + { error, reset } props.
//
// ─────────────────────────────────────────────────────────────────────────────

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const payload = {
      message: error.message?.slice(0, 200) ?? 'Unknown error',
      digest: error.digest,
    };

    // Log to notification system (real-time alert)
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'broadcast',         // broadcast to all admins via null user_email
        type: 'portal_error',
        title: 'Portal Error',
        message: payload.message,
        priority: 3,
        metadata: payload,
      }),
    }).catch(() => { /* silent */ });

    // Log to immutable audit trail
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'portal_error',
        entity_type: 'ui',
        metadata: payload,
      }),
    }).catch(() => { /* silent */ });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-white text-sm font-semibold">Algo correu mal</h2>
          <p className="text-white/40 text-xs">
            Ocorreu um erro inesperado nesta página do portal.
          </p>
          {error.digest && (
            <p className="text-white/20 text-[10px] font-mono">#{error.digest}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button type="button"
            type="button"
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white text-xs font-medium transition-colors"
          >
            ↺ Tentar novamente
          </button>
          <Link
            href="/command"
            className="w-full py-2.5 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium text-center transition-colors"
          >
            ⚡ Ir para Command Center
          </Link>
          <Link
            href="/dashboard"
            className="w-full py-2.5 rounded-xl border border-white/8 text-white/40 hover:text-white/70 text-xs text-center transition-colors"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Dev details */}
        {isDev && error.message && (
          <details className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
            <summary className="text-red-400/70 text-[10px] cursor-pointer font-mono">
              {error.name ?? 'Error'}: {error.message.slice(0, 80)}
            </summary>
            <pre className="mt-2 text-red-300/50 text-[9px] overflow-auto max-h-40 leading-relaxed whitespace-pre-wrap">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
