import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sobre Nós',
  description: 'YourGift — plataforma B2B de merchandising premium. Conheça a nossa missão, equipa e valores.',
};

const values = [
  { icon: '🎯', title: 'Foco no cliente', description: 'Cada projeto é único. Tratamos cada encomenda como se fosse a nossa própria marca.' },
  { icon: '⚡', title: 'Rapidez sem compromissos', description: 'Proposta em 24h, produção em 5–10 dias. Sem burocracia desnecessária.' },
  { icon: '🌱', title: 'Sustentabilidade', description: 'Priorizamos fornecedores com certificações GOTS, FSC e práticas de produção responsável.' },
  { icon: '🔒', title: 'Transparência total', description: 'Preços claros, sem surpresas. Mockups antes da produção. Rastreio em tempo real.' },
];

const stats = [
  { value: '2.400+', label: 'Produtos disponíveis' },
  { value: '5–10', label: 'Dias de entrega (úteis)' },
  { value: '100+', label: 'Clientes B2B satisfeitos' },
  { value: '24h', label: 'Resposta garantida' },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Libre Baskerville', serif", fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Merchandising B2B<br />
          <span style={{ color: '#d4b47a' }}>feito com propósito</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '0' }}>
          A YourGift nasceu da frustração de marcas que precisavam de merchandising premium
          sem ter de lidar com fornecedores lentos, preços opacos e qualidade inconsistente.
          Criámos uma plataforma que resolve isso de ponta a ponta.
        </p>
      </section>

      {/* Stats */}
      <section style={{ padding: '2rem 1.5rem 5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(240,236,228,0.06)',
              borderRadius: '18px', padding: '1.75rem', textAlign: 'center',
            }}>
              <p style={{ fontSize: '2.25rem', fontWeight: 700, color: '#d4b47a', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.5rem', fontWeight: 500 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{
          background: 'rgba(154,124,74,0.08)', border: '1px solid rgba(154,124,74,0.14)',
          borderRadius: '24px', padding: '3rem',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            A nossa missão
          </h2>
          <p style={{ color: 'rgb(170,180,198)', lineHeight: 1.8, fontSize: '1rem' }}>
            Democratizar o acesso a merchandising de qualidade internacional para empresas de todos os tamanhos.
            Do startup à multinacional, qualquer marca merece ter produtos que reflitam os seus valores —
            com preços justos, qualidade garantida e entrega rápida.
          </p>
          <p style={{ color: 'rgb(170,180,198)', lineHeight: 1.8, fontSize: '1rem', marginTop: '1rem' }}>
            Trabalhamos exclusivamente com fornecedores certificados como a Midocean e PF Concept,
            líderes europeus em merchandising sustentável e de qualidade.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '4rem 1.5rem 6rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.5rem', textAlign: 'center' }}>
          Os nossos valores
        </h2>
        <p style={{ color: 'rgba(240,236,228,0.42)', textAlign: 'center', marginBottom: '2.5rem' }}>
          O que nos guia em cada decisão.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {values.map((v) => (
            <div key={v.title} style={{
              background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(240,236,228,0.06)',
              borderRadius: '18px', padding: '1.75rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{v.icon}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.5rem' }}>{v.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.6 }}>{v.description}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
          <Link href="/quote" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: '#d4b47a', color: '#090907',
            padding: '0.875rem 1.75rem', borderRadius: '14px',
            fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
          }}>
            Trabalha connosco →
          </Link>
        </div>
      </section>
    </div>
  );
}
