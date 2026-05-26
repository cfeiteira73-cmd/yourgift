'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, createImplicitClient } from '@/lib/supabase/client';
import { detectBrowserEnv, BrowserEnv } from '@/lib/auth/in-app-browser';

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9087-2.2582c-.8064.54-1.8382.8591-3.0477.8591-2.3441 0-4.3282-1.5836-5.036-3.7109H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.173 0 7.5482 0 9s.3477 2.827.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="white">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.7-150.4-109.3C34.2 770.3 0 665.9 0 562.2c0-202.4 131.4-309.7 261.1-309.7 66.7 0 122.2 43.8 164.3 43.8 40.4 0 103.6-46.2 177.8-46.2zm-170.1-45.5c-3.2 16.3-8.3 34.7-18.3 52.7-16.4 28.7-45.2 58.3-91.5 58.3-43.8 0-78.4-27.9-107.4-27.9-30 0-64.6 29.1-107.5 29.1-27.2 0-56.4-11.7-79.4-30.6C188.7 344.3 160 291 160 238.2c0-77.5 49.5-119.7 97.5-119.7 54.5 0 97.1 36.7 128.2 36.7 29.8 0 76.9-38.9 132.8-38.9 19.3 0 91.4 2.3 142.6 66.1z"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Error message map — URL error codes → Portuguese messages ─────────────────

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Não conseguimos verificar o teu acesso. O link pode ter expirado ou já foi utilizado.',
  link_expired: 'O link de acesso expirou. Pede um novo link abaixo.',
  invalid_link: 'Link inválido. Usa o formulário abaixo para entrar.',
  missing_code: 'Link incompleto. Usa o formulário abaixo para entrar.',
  no_code: 'Link incompleto. Usa o formulário abaixo para entrar.',
  no_user: 'Conta não encontrada. Verifica o teu email ou cria uma conta.',
  callback_failed: 'Falha ao verificar o link. Tenta novamente ou usa um método alternativo.',
  access_denied: 'Acesso negado. Tenta com outro método de login.',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadingProvider = 'google' | 'apple' | 'magic' | 'password' | null;
type AuthView = 'oauth' | 'password' | 'magic';
type FailedProvider = 'google' | 'apple' | null;

// ── Main form ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const urlErrorCode = searchParams.get('error');
  const urlErrorDesc = searchParams.get('error_description');

  // Translate URL error code to Portuguese message
  const initialError = urlErrorCode
    ? (ERROR_MESSAGES[urlErrorCode] ?? urlErrorDesc ?? 'Erro de autenticação. Tenta novamente.')
    : '';

  const [view, setView] = useState<AuthView>('oauth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>(initialError);
  const [magicSent, setMagicSent] = useState(false);
  const [loading, setLoading] = useState<LoadingProvider>(null);
  const [failedProvider, setFailedProvider] = useState<FailedProvider>(null);
  const [browserEnv, setBrowserEnv] = useState<BrowserEnv | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setBrowserEnv(detectBrowserEnv(navigator.userAgent));
    // If arriving from a failed link, auto-switch to magic link view
    if (urlErrorCode && ['auth_failed', 'link_expired', 'callback_failed'].includes(urlErrorCode)) {
      setView('magic');
    }
  }, [urlErrorCode]);

  const isLoading = loading !== null;
  const safeNext = next.startsWith('/') ? next : '/dashboard';

  // ── OAuth handlers ──────────────────────────────────────────────────────

  async function handleGoogle() {
    setLoading('google');
    setError('');
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (oauthError) {
      setError('Google não está disponível. Tenta outro método abaixo.');
      setFailedProvider('google');
      setLoading(null);
    }
  }

  async function handleApple() {
    setLoading('apple');
    setError('');
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    });
    if (oauthError) {
      setError('Apple não está disponível. Usa o link por email para entrar.');
      setFailedProvider('apple');
      setLoading(null);
    }
  }

  // ── Magic link handler ──────────────────────────────────────────────────

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading('magic');
    setError('');
    // Use implicit flow: magic links are opened in email clients (different browser
    // session) so PKCE code-verifier would be missing. Implicit flow sends a
    // token_hash that /auth/confirm handles without needing a verifier.
    const supabase = createImplicitClient();
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(safeNext)}`,
      },
    });
    if (magicError) {
      setError('Erro ao enviar link. Verifica o email e tenta novamente.');
    } else {
      setMagicSent(true);
    }
    setLoading(null);
  }

  // ── Password handler ────────────────────────────────────────────────────

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading('password');
    setError('');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Email ou password inválidos.');
      setLoading(null);
      return;
    }
    router.push(safeNext);
    router.refresh();
  }

  // ── Magic link sent state ───────────────────────────────────────────────

  if (magicSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verifica o teu email</h2>
          <p className="text-sm text-gray-500 mb-1">
            Enviámos um link de acesso para
          </p>
          <p className="text-sm font-semibold text-gray-900 mb-5">{email}</p>
          <p className="text-xs text-gray-400 mb-6">
            Clica no link no email para entrar. O link expira em 60 minutos. Verifica também a pasta de spam.
          </p>
          <button
            type="button"
            onClick={() => { setMagicSent(false); setEmail(''); }}
            className="text-sm text-brand-600 hover:underline"
          >
            Usar outro email
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">

        {/* In-app browser warning */}
        {browserEnv?.shouldForceExternal && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm">
            <p className="text-amber-800 font-medium mb-1">Abre no Safari ou Chrome</p>
            <p className="text-amber-700 text-xs mb-2">
              O browser actual pode bloquear o login. Clica em ⋯ e escolhe &ldquo;Abrir no Safari&rdquo; ou &ldquo;Abrir no Chrome&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }).catch(() => {});
              }}
              className="text-xs text-amber-800 underline font-medium"
            >
              {linkCopied ? '✓ Link copiado!' : 'Copiar link'}
            </button>
          </div>
        )}

        {/* Logo */}
        <div className="mb-8">
          <Link href="/" className="text-xl font-black text-gray-900">
            your<span className="text-brand-600">gift</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Bem-vindo de volta</h1>
          <p className="text-sm text-gray-500">Acede à tua conta B2B</p>
        </div>

        {/* Error banner + failsafe chain */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            <p className="font-medium mb-1">{error}</p>
            {failedProvider === 'google' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setError(''); setFailedProvider(null); handleApple(); }} className="text-xs text-red-700 underline font-medium">
                  Tentar com Apple →
                </button>
                <span className="text-red-400">·</span>
                <button type="button" onClick={() => { setError(''); setFailedProvider(null); setView('magic'); }} className="text-xs text-red-700 underline font-medium">
                  Entrar por email →
                </button>
              </div>
            )}
            {failedProvider === 'apple' && (
              <div className="mt-2">
                <button type="button" onClick={() => { setError(''); setFailedProvider(null); setView('magic'); }} className="text-xs text-red-700 underline font-medium">
                  Entrar por link de email →
                </button>
              </div>
            )}
            {!failedProvider && (urlErrorCode === 'auth_failed' || urlErrorCode === 'link_expired' || urlErrorCode === 'callback_failed') && (
              <div className="mt-2">
                <button type="button" onClick={() => { setError(''); setView('magic'); }} className="text-xs text-red-700 underline font-medium">
                  Receber novo link →
                </button>
              </div>
            )}
          </div>
        )}

        {/* OAuth view */}
        {view === 'oauth' && (
          <>
            <button type="button" onClick={handleGoogle} disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed mb-3">
              {loading === 'google' ? <Spinner /> : <GoogleIcon />}
              Continue with Google
            </button>
            <button type="button" onClick={handleApple} disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-black rounded-xl px-4 py-3 text-sm font-medium text-white hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3">
              {loading === 'apple' ? <Spinner /> : <AppleIcon />}
              Continue with Apple
            </button>
            <button type="button" onClick={() => setView('magic')} disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 border border-blue-300 text-blue-600 rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign in with email link
            </button>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button type="button" onClick={() => setView('password')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Sign in with password instead
            </button>
          </>
        )}

        {/* Magic link form */}
        {view === 'magic' && (
          <>
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="nome@empresa.pt"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"/>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loading === 'magic' ? <Spinner /> : null}
                {loading === 'magic' ? 'A enviar...' : 'Enviar link de acesso'}
              </button>
            </form>
            <button type="button" onClick={() => setView('oauth')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4 transition-colors">
              ← Voltar
            </button>
          </>
        )}

        {/* Password form */}
        {view === 'password' && (
          <>
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="nome@empresa.pt"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"/>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loading === 'password' ? <Spinner /> : null}
                {loading === 'password' ? 'A entrar...' : 'Entrar →'}
              </button>
            </form>
            <button type="button" onClick={() => setView('oauth')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4 transition-colors">
              ← Voltar
            </button>
          </>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Sem conta?{' '}
          <Link href="/auth/register" className="text-brand-600 hover:underline font-medium">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
