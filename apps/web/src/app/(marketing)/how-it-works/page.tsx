import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Como Funciona',
  description: 'Descobre como a YourGift entrega merchandising B2B premium em 4 passos simples.',
};

const steps = [
  {
    number: '01',
    title: 'Pedes um orçamento',
    description: 'Descreves o teu projeto — produto, quantidade, técnica de personalização e prazo. O formulário leva menos de 2 minutos.',
    color: 'rgb(77,163,255)',
  },
  {
    number: '02',
    title: 'Receves proposta em 24h',
    description: 'A nossa equipa analisa o teu pedido e envia uma proposta detalhada com preços, mockups e opções de personalização.',
    color: 'rgb(116,231,255)',
  },
  {
    number: '03',
    title: 'Aprovação e produção',
    description: 'Aprovas a proposta, enviamos a arte-final, e a produção arranca. Podes acompanhar tudo em tempo real no portal.',
    color: 'rgb(99,230,190)',
  },
  {
    number: '04',
    title: 'Entrega em toda a Europa',
    description: 'Produção e entrega em 5–10 dias úteis. Embalagem premium, controlo de qualidade, e suporte pós-entrega incluídos.',
    color: 'rgb(167,243,208)',
  },
];

const faqs = [
  { q: 'Qual o mínimo de encomenda?', a: 'Depende do produto e técnica. Para a maioria do catálogo, o mínimo é 25 unidades. Contacta-nos para detalhes específicos.' },
  { q: 'Quanto tempo demora a produção?', a: 'Standard: 7–10 dias úteis após aprovação de arte-final. Express (5 dias) disponível para produtos selecionados.' },
  { q: 'Posso ver um mockup antes de confirmar?', a: 'Sim, sempre. Enviamos mockups digitais para aprovação antes de qualquer produção.' },
  { q: 'Trabalham com empresas de toda a Europa?', a: 'Sim. Entregamos em toda a UE. Faturação em euros, documentação fiscal incluída.' },
];

export default function HowItWorksPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', paddingTop: '5rem' }}>
      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Do briefing à entrega<br />
          <span style={{ color: 'rgb(77,163,255)' }}>em 4 passos simples</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'rgb(170,180,198)', lineHeight: 1.7 }}>
          Merchandising B2B sem complicações. Tu fogas no teu negócio, nós tratamos do resto.
        </p>
      </section>

      {/* Steps */}
      <section style={{ padding: '2rem 1.5rem 5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {steps.map((step, i) => (
            <div key={step.number} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr',
              gap: '1.5rem', alignItems: 'flex-start',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px', padding: '2rem',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '16px',
                background: `${step.color}18`, border: `1px solid ${step.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 900, color: step.color,
                flexShrink: 0,
              }}>
                {step.number}
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'rgb(170,180,198)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/quote" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgb(77,163,255)', color: 'rgb(7,17,31)',
            padding: '0.875rem 1.75rem', borderRadius: '14px',
            fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
          }}>
            Começar agora →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '4rem 1.5rem 6rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>
          Perguntas frequentes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq) => (
            <div key={faq.q} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '1.25rem 1.5rem',
            }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.5rem' }}>{faq.q}</p>
              <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.6 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
