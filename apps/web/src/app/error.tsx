'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the web app.
 * Catches unhandled errors in React Server Components and client components.
 * Sentry capture happens automatically via the SentryInterceptor on the API side;
 * frontend errors are captured by the Sentry Browser SDK if configured.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Report to Sentry if client SDK is loaded
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Sentry?.captureException(error);
    }
    // Always log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalError]', error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Algo correu mal</h1>
      <p className="text-gray-500 max-w-sm mb-2">
        Ocorreu um erro inesperado. A nossa equipa foi notificada.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 font-mono mb-6">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
        <a
          href="/"
          className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          Página inicial
        </a>
      </div>
    </div>
  );
}
