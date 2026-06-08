'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, Upload } from 'lucide-react';
import type { Metadata } from 'next';
import { type Lang, t } from '@/lib/i18n';

// Note: metadata export is not supported in Client Components.
// Define it in a parent server component or move to a separate layout if needed.
// For this public-facing page we keep it as a client component for form interactivity.

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type FormData = {
  // Contacto
  name: string;
  email: string;
  company: string;
  phone: string;
  // Pedido
  occasion: string;
  quantity: string;
  eventDate: string;
  budget: string;
  // Produtos
  products: string;
  // Personalização
  customization: string;
  // Extra
  notes: string;
};

const initialForm: FormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  occasion: '',
  quantity: '',
  eventDate: '',
  budget: '',
  products: '',
  customization: '',
  notes: '',
};

const OCCASIONS = [
  { value: '', label: 'Selecionar ocasião...' },
  { value: 'onboarding_kit', label: 'Onboarding Kit' },
  { value: 'event_kit', label: 'Kit de Evento' },
  { value: 'marketing', label: 'Marketing / Promoção' },
  { value: 'custom', label: 'Personalizado' },
];

// ── Field helpers ────────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'rgb(170,180,198)',
        marginBottom: '0.375rem',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '10px',
  border: '1px solid rgba(240,236,228,0.10)',
  background: 'rgba(240,236,228,0.04)',
  color: '#f0ece4',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '96px',
};

const sectionHeading: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#d4b47a',
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid rgba(154,124,74,0.14)',
};

// ── Main page ────────────────────────────────────────────────────────────────

export default function QuotePage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('pt');

  useEffect(() => {
    const match = document.cookie.match(/lang=(pt|en)/);
    if (match) setLang(match[1] as Lang);
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        phone: form.phone.trim() || undefined,
        occasion: form.occasion || undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        eventDate: form.eventDate || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        products: form.products.trim() || undefined,
        customization: form.customization.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      const res = await fetch(`${API_BASE}/quotes/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const msg =
          (data['message'] as string | undefined) ??
          `Erro ${res.status}. Tente novamente.`;
        throw new Error(msg);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, 'common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#090907',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            background: 'rgba(240,236,228,0.04)',
            border: '1px solid rgba(184,151,94,0.22)',
            borderRadius: '20px',
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <CheckCircle
            style={{ width: 48, height: 48, color: '#b8975e', margin: '0 auto 1.25rem' }}
          />
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#f0ece4',
              marginBottom: '0.75rem',
            }}
          >
            {lang === 'en' ? 'Request received!' : 'Pedido recebido!'}
          </h1>
          <p style={{ color: 'rgba(240,236,228,0.42)', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {t(lang, 'quote.success')}
          </p>
          <p style={{ color: 'rgb(100,110,130)', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            Confirmaremos por e-mail para <strong style={{ color: 'rgb(170,180,198)' }}>{form.email}</strong>.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '2rem',
              padding: '0.625rem 1.375rem',
              borderRadius: '10px',
              background: 'rgba(154,124,74,0.12)',
              border: '1px solid rgba(77,163,255,0.22)',
              color: '#d4b47a',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#090907',
        paddingTop: '6rem',
        paddingBottom: '4rem',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Page header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.3rem 0.85rem',
              borderRadius: '99px',
              background: 'rgba(154,124,74,0.10)',
              border: '1px solid rgba(77,163,255,0.22)',
              color: '#d4b47a',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            Proposta gratuita · Sem compromisso
          </span>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800,
              color: '#f0ece4',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginBottom: '0.75rem',
            }}
          >
            {t(lang, 'quote.title')}
          </h1>
          <p
            style={{
              color: 'rgba(240,236,228,0.42)',
              fontSize: '1rem',
              lineHeight: 1.6,
              maxWidth: '520px',
              margin: '0 auto',
            }}
          >
            Preencha o formulário e a nossa equipa enviará uma proposta detalhada
            em até 48 horas, sem compromisso.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(240,236,228,0.04)',
            border: '1px solid rgba(240,236,228,0.06)',
            borderRadius: '20px',
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}
        >

          {/* ── Section 1: Dados de Contacto ── */}
          <section>
            <p style={sectionHeading}>1. Dados de Contacto</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ana Silva"
                  value={form.name}
                  onChange={handleChange}
                  style={inputStyle}
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="ana@empresa.pt"
                  value={form.email}
                  onChange={handleChange}
                  style={inputStyle}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="company">Empresa</Label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  placeholder="Empresa Lda."
                  value={form.company}
                  onChange={handleChange}
                  style={inputStyle}
                  autoComplete="organization"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+351 910 000 000"
                  value={form.phone}
                  onChange={handleChange}
                  style={inputStyle}
                  autoComplete="tel"
                />
              </div>
            </div>
          </section>

          {/* ── Section 2: Detalhes do Pedido ── */}
          <section>
            <p style={sectionHeading}>2. Detalhes do Pedido</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <Label htmlFor="occasion">Ocasião</Label>
                <select
                  id="occasion"
                  name="occasion"
                  value={form.occasion}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o.value} value={o.value} style={{ background: 'rgb(11,21,38)' }}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="quantity">Número de destinatários</Label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  placeholder="ex: 100"
                  value={form.quantity}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="eventDate">Data do evento</Label>
                <input
                  id="eventDate"
                  name="eventDate"
                  type="date"
                  value={form.eventDate}
                  onChange={handleChange}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>
              <div>
                <Label htmlFor="budget">Orçamento aproximado (€)</Label>
                <input
                  id="budget"
                  name="budget"
                  type="number"
                  min="0"
                  placeholder="ex: 2000"
                  value={form.budget}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* ── Section 3: Produtos ── */}
          <section>
            <p style={sectionHeading}>3. Produtos Desejados</p>
            <Label htmlFor="products">Descreva os produtos que procura</Label>
            <textarea
              id="products"
              name="products"
              placeholder="Ex: 200 t-shirts algodão orgânico, 100 canetas metal, 50 sacos tote canvas..."
              value={form.products}
              onChange={handleChange}
              style={textareaStyle}
            />
          </section>

          {/* ── Section 4: Personalização ── */}
          <section>
            <p style={sectionHeading}>4. Personalização</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <Label htmlFor="customization">Informações sobre personalização</Label>
                <textarea
                  id="customization"
                  name="customization"
                  placeholder="Ex: logotipo a bordado no peito esquerdo, cores pantone 286C e branco, técnica serigráfica..."
                  value={form.customization}
                  onChange={handleChange}
                  style={textareaStyle}
                />
              </div>

              {/* Artwork upload — stub */}
              <div>
                <Label htmlFor="artwork-stub">Upload de arte / logotipo</Label>
                <div
                  style={{
                    border: '1px dashed rgba(240,236,228,0.14)',
                    borderRadius: '10px',
                    padding: '1.25rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'not-allowed',
                    opacity: 0.65,
                  }}
                  title="Em breve"
                >
                  <Upload style={{ width: 18, height: 18, color: 'rgba(240,236,228,0.42)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(240,236,228,0.42)' }}>
                    Upload de ficheiros (imagem / PDF) —{' '}
                    <span style={{ color: '#d4b47a' }}>Em breve</span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 5: Notas ── */}
          <section>
            <p style={sectionHeading}>5. Notas Adicionais</p>
            <Label htmlFor="notes">Outras informações relevantes</Label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Prazos urgentes, referências de estilo, restrições, etc."
              value={form.notes}
              onChange={handleChange}
              style={textareaStyle}
            />
          </section>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: 'rgb(252,165,165)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.875rem 2rem',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              background: loading
                ? 'rgba(240,236,228,0.06)'
                : 'linear-gradient(135deg, #d4b47a, #b8975e)',
              color: loading ? 'rgba(240,236,228,0.42)' : '#090907',
              border: 'none',
              transition: 'all 0.2s',
              width: '100%',
              letterSpacing: '-0.01em',
            }}
          >
            {loading ? (
              t(lang, 'common.loading')
            ) : (
              <>
                {t(lang, 'quote.submit')}
                <ArrowRight style={{ width: 18, height: 18 }} />
              </>
            )}
          </button>

          <p
            style={{
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'rgb(100,110,130)',
              marginTop: '-0.75rem',
            }}
          >
            Sem spam. Resposta garantida em 48h. Proposta gratuita sem compromisso.
          </p>
        </form>
      </div>
    </div>
  );
}
