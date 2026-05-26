'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError('Email ou password incorretos');
        return;
      }

      const data = (await res.json()) as {
        token: string;
        admin: { id: string; email: string; name: string; role: string };
      };

      // Persist in localStorage
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.admin));

      // Also set a cookie so middleware can read it (8h = 28800s)
      document.cookie = `adminToken=${data.token}; path=/; max-age=28800; samesite=strict`;

      router.replace('/dashboard');
    } catch {
      setError('Erro ao ligar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4da3ff] to-[#74e7ff] flex items-center justify-center text-[#07111f] font-black text-lg mb-4 shadow-lg shadow-[#4da3ff]/20">
            YG
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            YourGift
          </h1>
          <p className="text-xs text-[#4d6a87] mt-1 uppercase tracking-widest font-medium">
            Admin
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-6 text-center">
            Entrar no painel
          </h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#8ba8c7] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourgift.pt"
                className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#2d4a66] focus:outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]/30 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#8ba8c7] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#2d4a66] focus:outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]/30 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-[#f87171]/10 border border-[#f87171]/20 rounded-lg px-3.5 py-2.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="flex-shrink-0"
                >
                  <circle cx="7" cy="7" r="6" />
                  <path d="M7 4.5v3M7 9.5h.01" />
                </svg>
                <p className="text-xs text-[#f87171]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#4da3ff] hover:bg-[#3d8fe6] disabled:opacity-50 disabled:cursor-not-allowed text-[#07111f] font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="28"
                      strokeDashoffset="10"
                    />
                  </svg>
                  A entrar...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#2d4a66] mt-6">
          YourGift OS · Acesso restrito
        </p>
      </div>
    </div>
  );
}
