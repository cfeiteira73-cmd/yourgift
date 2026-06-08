'use client';

import type { Metadata } from 'next';
import Link from 'next/link';
import { useState } from 'react';

// export const metadata: Metadata = { ... }  — can't export in 'use client'
// SEO handled at route level; page title set in <title> via layout

const categories = [
  {
    label: 'Encomendas',
    faqs: [
      {
        q: 'Qual é o prazo médio de produção?',
        a: 'Depende do produto e da quantidade. A maioria dos projetos fica entre 10 e 20 dias úteis após aprovação do mockup. Projetos urgentes podem ser acelerados — fala connosco para verificar disponibilidade.',
      },
      {
        q: 'Qual é o pedido mínimo (MOQ)?',
        a: 'Varia por produto, mas trabalhamos a partir de 25 unidades em muitas categorias. Para produtos personalizados premium, algumas referências têm MOQ de 50 ou 100 unidades. Consulta a ficha de cada produto para o MOQ exacto.',
      },
      {
        q: 'Posso fazer reorders de produtos anteriores?',
        a: 'Sim. Guardamos todos os ficheiros de produção, configurações e preferências. Um reorder é simples — confirmas a quantidade e avançamos sem burocracia.',
      },
      {
        q: 'Como acompanho o estado da minha encomenda?',
        a: 'Através do Portal YourGift. Tens acesso em tempo real a todas as etapas — mockup, aprovação, produção, controlo de qualidade e envio. Podes também configurar alertas por email ou WhatsApp.',
      },
    ],
  },
  {
    label: 'Personalização',
    faqs: [
      {
        q: 'Como funciona o processo de personalização?',
        a: 'Partilhas o teu logo e briefing. A nossa equipa prepara um mockup digital para aprovação — geralmente em 24h. Após aprovação escrita, avançamos para produção. Zero surpresas no produto final.',
      },
      {
        q: 'Que técnicas de personalização oferecem?',
        a: 'Bordado, DTF Transfer, Serigrafia, Laser, Pad Printing, Sublimação e Impressão UV. A nossa equipa recomenda a técnica ideal para cada produto e tipo de arte. Todos os detalhes são confirmados antes de avançar.',
      },
      {
        q: 'Em que formato devo enviar o logótipo?',
        a: 'Idealmente em formato vectorial (AI, EPS, SVG ou PDF com fontes incorporadas). Aceitamos também PNG de alta resolução (mínimo 300 dpi). Se não tiveres o vectorial, podemos vectorizar o teu logo — consulta os nossos serviços de arte.',
      },
      {
        q: 'Posso ver o mockup antes de confirmar?',
        a: 'Sempre. Nenhuma encomenda avança para produção sem aprovação escrita do mockup. O mockup digital é gratuito e incluído em todas as propostas.',
      },
    ],
  },
  {
    label: 'Entregas & Logística',
    faqs: [
      {
        q: 'Fazem envio internacional?',
        a: 'Sim. Entregamos em Portugal continental, ilhas, Espanha e na maioria dos países europeus. Para outros destinos, fala connosco para uma quotação específica de frete.',
      },
      {
        q: 'Quais os prazos de entrega depois de sair da produção?',
        a: 'Em Portugal continental: 1–3 dias úteis. Ilhas: 3–5 dias úteis. Europa: 3–7 dias úteis, dependendo do destino. Enviamos tracking number em todos os envios.',
      },
      {
        q: 'Oferecem fulfillment e armazenagem?',
        a: 'Sim. Podemos armazenar os teus produtos e fazer envios unitários ou em lote conforme necessário — ideal para Company Stores e campanhas de gifting recorrentes.',
      },
    ],
  },
  {
    label: 'Conta & Portal',
    faqs: [
      {
        q: 'O que é uma Company Store privada?',
        a: 'É uma loja online exclusiva para os colaboradores da tua empresa — com o teu branding, catálogo definido, preços negociados e sistema de aprovações. Ideal para merchandising interno, onboarding e gifting recorrente.',
      },
      {
        q: 'Como acedo ao Portal YourGift?',
        a: 'Após criares conta ou receberes convite, acedes em yourgift.pt/auth/login. O portal está disponível em qualquer dispositivo e inclui gestão de encomendas, artes, faturas e relatórios.',
      },
      {
        q: 'Posso ter múltiplos utilizadores na minha conta empresarial?',
        a: 'Sim. Planos empresariais suportam múltiplos utilizadores com diferentes permissões — gestor de aprovação, visualizador, comprador. Configura a tua equipa em Definições > Utilizadores.',
      },
    ],
  },
  {
    label: 'Pagamentos',
    faqs: [
      {
        q: 'Que métodos de pagamento aceitam?',
        a: 'Transferência bancária (IBAN PT), Stripe (cartão de crédito/débito) e fatura com prazo de pagamento para clientes recorrentes (mediante aprovação de crédito).',
      },
      {
        q: 'Quando é que pago?',
        a: 'Para novas encomendas: 50% na confirmação da proposta, 50% antes do envio. Para clientes com histórico e aprovação de crédito, oferecemos condições de pagamento a 30 dias.',
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(154,124,74,0.12)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: '2rem', padding: '1.5rem 0', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: "'Libre Baskerville', serif",
          fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
          fontWeight: 400, color: '#f0ece4', lineHeight: 1.4,
        }}>
          {q}
        </span>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: '1.25rem', color: '#9a7c4a', flexShrink: 0,
          transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          lineHeight: 1,
        }}>
          +
        </span>
      </button>
      {open && (
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: '14px', color: 'rgba(240,236,228,0.62)',
          fontWeight: 300, lineHeight: 1.8,
          paddingBottom: '1.5rem',
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div style={{ minHeight: '100vh', background: '#090907', color: '#f0ece4', paddingTop: '5rem' }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.5rem 3rem', maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '28px', height: '1px', background: '#9a7c4a' }} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#9a7c4a' }}>
            Dúvidas
          </span>
          <div style={{ width: '28px', height: '1px', background: '#9a7c4a' }} />
        </div>

        <h1 style={{
          fontFamily: "'Libre Baskerville', serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 400, color: '#f0ece4',
          letterSpacing: '-0.02em', lineHeight: 1.1,
          marginBottom: '1.25rem',
        }}>
          Perguntas<br />
          <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>Frequentes</em>
        </h1>

        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '1rem', color: 'rgba(240,236,228,0.62)', fontWeight: 300, lineHeight: 1.75, maxWidth: '500px', margin: '0 auto' }}>
          Não encontras resposta? A nossa equipa responde em menos de 2 horas.
        </p>
      </section>

      {/* ── Category tabs ─────────────────────────────────────────────── */}
      <section style={{ padding: '0 1.5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(154,124,74,0.14)', overflowX: 'auto', marginBottom: 0 }}>
          {categories.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(i)}
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '12px 24px', background: 'none', border: 'none',
                borderBottom: activeCategory === i ? '2px solid #b8975e' : '2px solid transparent',
                marginBottom: '-1px',
                color: activeCategory === i ? '#f0ece4' : 'rgba(240,236,228,0.38)',
                cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── FAQ list ───────────────────────────────────────────────────── */}
      <section style={{ padding: '0 1.5rem 5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: '680px' }}>
          {categories[activeCategory].faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Still need help? ──────────────────────────────────────────── */}
      <section style={{ background: '#0f0f0c', borderTop: '1px solid rgba(154,124,74,0.14)', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#9a7c4a', marginBottom: '0.75rem' }}>
              Ainda tens dúvidas?
            </div>
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.015em', lineHeight: 1.2, marginBottom: '0.75rem' }}>
              Fala directamente <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>connosco</em>
            </h2>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(240,236,228,0.52)', fontWeight: 300, lineHeight: 1.7 }}>
              Equipa disponível Segunda–Sexta, 9h–18h. WhatsApp com resposta imediata.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              href="/contact"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: '#090907', background: '#b8975e',
                padding: '14px 28px', textDecoration: 'none',
              }}
            >
              Contactar Equipa &nbsp;→
            </Link>
            <a
              href="https://wa.me/351919948986?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '10px', fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(240,236,228,0.72)', background: 'transparent',
                border: '1px solid rgba(154,124,74,0.28)',
                padding: '13px 28px', textDecoration: 'none',
              }}
            >
              💬 &nbsp;WhatsApp
            </a>
            <Link
              href="/rfq"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '10px', fontWeight: 400, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: '#d4b47a', textDecoration: 'none', paddingTop: '4px',
              }}
            >
              Ou pede uma proposta gratuita →
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
