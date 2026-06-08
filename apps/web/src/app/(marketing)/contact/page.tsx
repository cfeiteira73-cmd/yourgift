import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contacto — YourGift',
  description: 'Fala connosco. Resposta em menos de 2 horas. Orçamento gratuito para merchandising B2B premium.',
};

const contacts = [
  {
    icon: '✉',
    label: 'Email',
    value: 'geral@yourgift.pt',
    href: 'mailto:geral@yourgift.pt',
    note: 'Resposta em menos de 2h',
  },
  {
    icon: '📞',
    label: 'Telefone',
    value: '+351 210 000 000',
    href: 'tel:+351210000000',
    note: 'Segunda a Sexta, 9h–18h',
  },
  {
    icon: '💬',
    label: 'WhatsApp',
    value: 'Fala connosco',
    href: 'https://wa.me/351919948986?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20vossos%20servi%C3%A7os.',
    note: 'Resposta imediata',
  },
  {
    icon: '📍',
    label: 'Localização',
    value: 'Lisboa, Portugal',
    href: null,
    note: 'Atendimento presencial disponível',
  },
];

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', color: '#f0ece4', paddingTop: '5rem' }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.5rem 4rem', maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '28px', height: '1px', background: '#9a7c4a' }} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#9a7c4a' }}>
            Fala Connosco
          </span>
          <div style={{ width: '28px', height: '1px', background: '#9a7c4a' }} />
        </div>

        <h1 style={{
          fontFamily: "'Libre Baskerville', serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 400,
          color: '#f0ece4',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: '1.25rem',
        }}>
          Estamos aqui para<br />
          <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>ajudar</em>
        </h1>

        <p style={{ fontSize: '1rem', color: 'rgba(240,236,228,0.62)', fontWeight: 300, lineHeight: 1.75, maxWidth: '520px', margin: '0 auto 2.5rem', fontFamily: "'Montserrat', sans-serif" }}>
          Seja um projecto de merchandising, uma dúvida sobre produtos ou simplesmente curiosidade — responda-nos em menos de 2 horas.
        </p>

        <Link
          href="/rfq"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#090907', background: '#b8975e',
            padding: '14px 36px', textDecoration: 'none',
            transition: 'background 0.25s',
          }}
        >
          Pedir Proposta Gratuita &nbsp;→
        </Link>
      </section>

      {/* ── Contacts ──────────────────────────────────────────────────── */}
      <section style={{ padding: '0 1.5rem 5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'rgba(154,124,74,0.12)' }}>
          {contacts.map((c) => (
            <div key={c.label} style={{ background: '#141411', padding: '2.5rem 2rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{c.icon}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.32)', marginBottom: '0.5rem' }}>
                {c.label}
              </div>
              {c.href ? (
                <a
                  href={c.href}
                  target={c.href.startsWith('http') ? '_blank' : undefined}
                  rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ fontFamily: "'Libre Baskerville', serif", fontSize: '1.1rem', fontWeight: 400, color: '#d4b47a', textDecoration: 'none', display: 'block', marginBottom: '0.4rem', transition: 'color 0.2s' }}
                >
                  {c.value}
                </a>
              ) : (
                <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: '1.1rem', fontWeight: 400, color: '#f0ece4', marginBottom: '0.4rem' }}>
                  {c.value}
                </div>
              )}
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(240,236,228,0.38)', fontWeight: 300 }}>
                {c.note}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Message form ──────────────────────────────────────────────── */}
      <section style={{ padding: '0 1.5rem 6rem', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ borderTop: '1px solid rgba(154,124,74,0.18)', paddingTop: '3rem', marginBottom: '2rem' }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#9a7c4a', marginBottom: '1rem' }}>
            Mensagem directa
          </div>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.015em', lineHeight: 1.15, marginBottom: '0.5rem' }}>
            Preferes escrever?
          </h2>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(240,236,228,0.52)', fontWeight: 300, lineHeight: 1.7 }}>
            Descreve o teu projecto e respondemos em menos de 2h.
          </p>
        </div>

        <form
          action="mailto:geral@yourgift.pt"
          method="post"
          encType="text/plain"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { id: 'name',    label: 'Nome',    placeholder: 'O teu nome',    type: 'text'  },
              { id: 'company', label: 'Empresa', placeholder: 'Nome da empresa', type: 'text'},
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} style={{ display: 'block', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '6px' }}>
                  {field.label}
                </label>
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: '#1a1a16', border: '1px solid rgba(154,124,74,0.18)',
                    color: '#f0ece4', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 300,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="email" style={{ display: 'block', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '6px' }}>
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="o-teu-email@empresa.pt"
              style={{
                width: '100%', padding: '12px 14px',
                background: '#1a1a16', border: '1px solid rgba(154,124,74,0.18)',
                color: '#f0ece4', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 300,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label htmlFor="message" style={{ display: 'block', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '6px' }}>
              Mensagem *
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              placeholder="Descreve o teu projecto — produto, quantidade, prazo desejado..."
              style={{
                width: '100%', padding: '12px 14px', resize: 'vertical',
                background: '#1a1a16', border: '1px solid rgba(154,124,74,0.18)',
                color: '#f0ece4', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 300,
                outline: 'none', lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: '#090907', background: '#b8975e',
                padding: '14px 32px', border: 'none', cursor: 'pointer',
                transition: 'background 0.25s',
              }}
            >
              Enviar Mensagem &nbsp;→
            </button>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(240,236,228,0.28)' }}>
              Respondemos em menos de 2 horas
            </span>
          </div>
        </form>
      </section>

      {/* ── CTA / RFQ ─────────────────────────────────────────────────── */}
      <section style={{ background: '#0f0f0c', borderTop: '1px solid rgba(154,124,74,0.14)', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#9a7c4a', marginBottom: '1rem' }}>
            Começa aqui
          </div>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.015em', marginBottom: '1rem' }}>
            Preferes um orçamento <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>formal</em>?
          </h2>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(240,236,228,0.52)', fontWeight: 300, lineHeight: 1.7, marginBottom: '2rem' }}>
            Preenche o formulário de proposta com os detalhes do teu projecto e recebe um orçamento detalhado em 24h.
          </p>
          <Link
            href="/rfq"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#090907', background: '#b8975e',
              padding: '14px 36px', textDecoration: 'none',
            }}
          >
            Pedir Proposta &nbsp;→
          </Link>
        </div>
      </section>

    </div>
  );
}
