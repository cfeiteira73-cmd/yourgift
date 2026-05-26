'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.yourgift.pt';

interface EmployeeLoginFormProps {
  slug: string;
  accent: string;
}

export function EmployeeLoginForm({ slug, accent }: EmployeeLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(slug)}/auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        },
      );

      if (res.status === 401 || res.status === 403) {
        setError('Email não autorizado para esta loja.');
        return;
      }

      if (res.status === 404) {
        setError('Loja não encontrada.');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setError(body.message ?? 'Erro ao autenticar. Tente novamente.');
        return;
      }

      const data = await res.json() as { access_token: string };
      sessionStorage.setItem('storeToken', data.access_token);
      setSuccess(true);

      // Small visual delay before redirect
      setTimeout(() => {
        router.push(`/store/${slug}/portal`);
      }, 400);
    } catch {
      setError('Erro de ligação. Verifique a sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: `${accent}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            margin: '0 auto 12px',
          }}
        >
          ✓
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: '#07111f', fontWeight: 600 }}>
          Autenticado! A redirecionar...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="employee-email"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#64748b',
            marginBottom: '8px',
          }}
        >
          Email corporativo
        </label>
        <input
          id="employee-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="joao@empresa.pt"
          required
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: `2px solid ${error ? '#f87171' : '#e2e8f0'}`,
            fontSize: '15px',
            color: '#07111f',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = accent;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? '#f87171' : '#e2e8f0';
          }}
        />
      </div>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            fontSize: '13px',
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim()}
        style={{
          width: '100%',
          padding: '13px',
          borderRadius: '12px',
          border: 'none',
          background: loading || !email.trim() ? '#cbd5e1' : accent,
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 700,
          cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease, opacity 0.15s ease',
        }}
      >
        {loading ? 'A verificar...' : 'Entrar'}
      </button>

      <p
        style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        Introduza o seu email corporativo para aceder ao portal da sua empresa.
      </p>
    </form>
  );
}
