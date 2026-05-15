'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', name: '', company: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('As passwords não coincidem.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.name, company: form.company, password: form.password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Erro ao criar conta. Tenta novamente.');
        return;
      }

      const { access_token } = await res.json();
      localStorage.setItem('token', access_token);
      router.push('/dashboard');
    } catch {
      setError('Erro de ligação. Verifica a tua internet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="mb-8">
          <Link href="/" className="text-xl font-black text-gray-900">
            your<span className="text-brand-600">gift</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Criar conta B2B</h1>
          <p className="text-sm text-gray-500">Grátis. Sem compromisso.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Empresa</label>
              <input type="text" value={form.company} onChange={(e) => set('company', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar password *</label>
            <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 mt-2">
            {loading ? 'A criar conta...' : 'Criar conta grátis'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Ao registares, aceitas os{' '}
          <Link href="/terms" className="text-brand-600 hover:underline">Termos de Serviço</Link>.
          <br />Já tens conta?{' '}
          <Link href="/auth/login" className="text-brand-600 hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
