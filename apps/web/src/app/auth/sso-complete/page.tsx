'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * /auth/sso-complete
 *
 * Landing page after a successful OIDC SSO flow.
 * The API redirects here with:
 *   ?accessToken=...&refreshToken=...&expiresIn=900&tenantId=...&redirect=/dashboard
 *
 * This page:
 *  1. Reads tokens from query params
 *  2. Stores them in sessionStorage (access) + localStorage (refresh)
 *  3. Cleans the URL (removes tokens from address bar)
 *  4. Redirects to the intended destination
 *
 * Security notes:
 *  - Tokens are in query params only transiently — this page replaces history immediately.
 *  - sessionStorage access token is lost when the tab closes (correct behaviour).
 *  - localStorage refresh token persists for the 7d validity window.
 *  - The API also sets an HttpOnly cookie as belt-and-suspenders where supported.
 */

function SSOCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const expiresIn = params.get('expiresIn');
    const redirect = params.get('redirect') ?? '/dashboard';

    if (!accessToken || !refreshToken) {
      setErrorMsg('SSO concluído mas sem token. Tente novamente.');
      setStatus('error');
      return;
    }

    // Store tokens
    try {
      sessionStorage.setItem('yg_access_token', accessToken);
      localStorage.setItem('yg_refresh_token', refreshToken);
      if (expiresIn) {
        const expiresAt = Date.now() + Number(expiresIn) * 1000;
        sessionStorage.setItem('yg_token_expires_at', String(expiresAt));
      }
    } catch {
      // Storage might be blocked in private mode — continue anyway, token in memory
    }

    // Replace history so the token doesn't stay in address bar
    window.history.replaceState({}, '', '/auth/sso-complete');

    // Small delay so the "Autenticado" state renders briefly
    const t = setTimeout(() => {
      // Navigate to intended destination
      const dest = redirect.startsWith('/') ? redirect : '/dashboard';
      router.replace(dest);
    }, 1200);

    return () => clearTimeout(t);
  }, [params, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center p-6">
        <div className="bg-[#0b1526] border border-[#ef4444]/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <h2 className="text-[#f0f6ff] font-semibold text-lg mb-2">Erro de Autenticação</h2>
          <p className="text-[#4d6a87] text-sm mb-6">{errorMsg}</p>
          <a
            href="/auth/login"
            className="inline-block px-6 py-2.5 bg-[#4da3ff] text-white text-sm font-medium rounded-xl hover:bg-[#3a92ee] transition-colors"
          >
            Voltar ao Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center p-6">
      <div className="text-center">
        {/* Logo */}
        <div className="text-2xl font-black tracking-tight text-white mb-8">
          your<span className="text-[#4da3ff]">gift</span>
        </div>

        {/* Spinner → Checkmark animation */}
        <div className="w-16 h-16 rounded-full bg-[#4da3ff]/10 border border-[#4da3ff]/30 flex items-center justify-center mx-auto mb-6">
          <svg
            className="animate-spin text-[#4da3ff]"
            width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-[#f0f6ff] text-xl font-semibold mb-2">Autenticado com sucesso</h1>
        <p className="text-[#4d6a87] text-sm">A redirecionar para o dashboard…</p>
      </div>
    </div>
  );
}

export default function SSOCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SSOCompleteInner />
    </Suspense>
  );
}
