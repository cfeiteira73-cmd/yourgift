'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Maps URL error codes to human-readable Portuguese messages
const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Não conseguimos verificar o teu acesso. O link pode ter expirado ou já foi utilizado.',
  link_expired: 'O link de acesso expirou. Pede um novo link abaixo.',
  invalid_link: 'Link inválido. Usa o formulário abaixo para entrar.',
  no_code: 'Link incompleto. Usa o formulário abaixo para entrar.',
  no_user: 'Conta não encontrada. Verifica o teu email ou cria uma conta.',
  access_denied: 'Acesso negado pelo fornecedor de autenticação.',
};

type AuthMode = 'password' | 'magic_link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uiState, setUiState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Error from URL params (e.g. callback failure)
  const urlError = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? errorDescription ?? 'Erro de autenticação. Tenta novamente.')
    : null;

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setUiState('loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg('Email ou password inválidos. Verifica e tenta novamente.');
      setUiState('error');
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Introduz o teu email.');
      setUiState('error');
      return;
    }

    setUiState('loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false, // only existing users
      },
    });

    if (error) {
      setErrorMsg(
        error.message.includes('not found') || error.message.includes('Invalid')
          ? 'Não encontrámos uma conta com este email. Cria uma conta primeiro.'
          : `Erro ao enviar link: ${error.message}`,
      );
      setUiState('error');
      return;
    }

    setUiState('sent');
  }

  async function handleResend() {
    setResending(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false,
      },
    });
    setResending(false);
    setUiState('sent');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">

        {/* Logo */}
        <div className="mb-8">
          <Link href="/" className="text-xl font-black text-gray-900">
            your<span className="text-brand-600">gift</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Bem-vindo de volta</h1>
          <p className="text-sm text-gray-500">Acede à tua conta B2B</p>
        </div>

        {/* URL error banner (from callback redirect) */}
        {urlError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-5 text-sm">
            <span className="font-semibold">Atenção: </span>{urlError}
          </div>
        )}

        {/* "Sent" state — magic link dispatched */}
        {uiState === 'sent' ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📬</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Verifica o teu email</h2>
            <p className="text-sm text-gray-600 mb-1">
              Enviámos um link de acesso para
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-5">{email}</p>
            <p className="text-xs text-gray-500 mb-6">
              Clica no link no email para entrar. O link expira em 60 minutos.
            </p>
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Reenviar link
            </button>
            <button
              onClick={() => setUiState('idle')}
              className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              Usar email diferente
            </button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => { setMode('password'); setErrorMsg(''); setUiState('idle'); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'password'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setMode('magic_link'); setErrorMsg(''); setUiState('idle'); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'magic_link'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Link mágico ✨
              </button>
            </div>

            {/* Error banner */}
            {(uiState === 'error' && errorMsg) && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {errorMsg}
              </div>
            )}

            {mode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nome@empresa.pt"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uiState === 'loading'}
                  className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uiState === 'loading' ? 'A entrar...' : 'Entrar →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nome@empresa.pt"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Enviamos um link seguro para o teu email. Não precisas de password.
                </p>
                <button
                  type="submit"
                  disabled={uiState === 'loading'}
                  className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uiState === 'loading' ? 'A enviar...' : 'Enviar link de acesso ✉️'}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              Sem conta?{' '}
              <Link href="/auth/register" className="text-brand-600 hover:underline font-medium">
                Criar conta grátis
              </Link>
            </p>
          </>
        )}
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
