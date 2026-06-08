import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Catálogo',
  description: '2.400+ produtos Midocean para personalização — bordado, DTF, laser, pad printing. Pede o teu orçamento B2B.',
};

const categories = [
  { emoji: '👕', label: 'Vestuário', description: 'T-shirts, polos, hoodies, fleeces' },
  { emoji: '🎒', label: 'Mochilas & Bags', description: 'Mochilas, totes, bolsas, malas' },
  { emoji: '☕', label: 'Drinkware', description: 'Canecas, garrafas, termos, copos' },
  { emoji: '🖊️', label: 'Escrita', description: 'Canetas, marcadores, cadernos' },
  { emoji: '💡', label: 'Tech & Gadgets', description: 'USB, power banks, auriculares, hubs' },
  { emoji: '🏠', label: 'Home & Office', description: 'Acessórios de mesa, organização' },
  { emoji: '🌱', label: 'Eco & Sustentável', description: 'Produtos reciclados e orgânicos' },
  { emoji: '🎁', label: 'Kits & Gift Sets', description: 'Conjuntos prontos para oferta' },
];

const techniques = [
  { label: 'Bordado', description: 'Alta durabilidade, ideal para vestuário' },
  { label: 'DTF Transfer', description: 'Full colour, sem mínimos de cor' },
  { label: 'Serigrafia', description: 'Econômico para grandes quantidades' },
  { label: 'Laser', description: 'Gravação permanente em metal e madeira' },
  { label: 'Pad Printing', description: 'Ideal para superfícies curvas' },
  { label: 'Sublimação', description: 'Cores vivas em poliéster e cerâmica' },
];

export default function CatalogPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '860px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(154,124,74,0.08)', border: '1px solid rgba(154,124,74,0.18)',
          borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem',
          fontSize: '0.8rem', color: '#d4b47a', fontWeight: 600,
        }}>
          2.400+ produtos disponíveis
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Libre Baskerville', serif", fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Catálogo Midocean<br />
          <span style={{ color: '#d4b47a' }}>para o teu negócio</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Acesso a todo o catálogo Midocean + PF Concept com personalização completa.
          Pede um orçamento e recebe proposta em 24h.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/quote" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: '#d4b47a', color: '#090907',
            padding: '0.875rem 1.75rem', borderRadius: '14px',
            fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
          }}>
            Pedir Orçamento Grátis →
          </Link>
          <Link href="/auth/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(240,236,228,0.06)', color: '#f0ece4',
            border: '1px solid rgba(240,236,228,0.10)',
            padding: '0.875rem 1.75rem', borderRadius: '14px',
            fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
          }}>
            Aceder ao Portal B2B
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.5rem', textAlign: 'center' }}>
          Categorias de Produto
        </h2>
        <p style={{ color: 'rgba(240,236,228,0.42)', textAlign: 'center', marginBottom: '2.5rem' }}>
          Do vestuário ao tech, encontras tudo aqui.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {categories.map((cat) => (
            <Link key={cat.label} href="/quote" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(240,236,228,0.06)',
                borderRadius: '18px', padding: '1.5rem',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{cat.emoji}</div>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.25rem' }}>{cat.label}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.42)' }}>{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Techniques */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.5rem', textAlign: 'center' }}>
          Técnicas de Personalização
        </h2>
        <p style={{ color: 'rgba(240,236,228,0.42)', textAlign: 'center', marginBottom: '2.5rem' }}>
          A técnica certa para cada produto e orçamento.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {techniques.map((t) => (
            <div key={t.label} style={{
              background: 'rgba(154,124,74,0.04)', border: '1px solid rgba(154,124,74,0.10)',
              borderRadius: '14px', padding: '1.25rem 1.5rem',
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4b47a', marginTop: '6px', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.2rem' }}>{t.label}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.42)' }}>{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          Pronto para começar?
        </h2>
        <p style={{ color: 'rgb(170,180,198)', marginBottom: '2rem' }}>
          Pede um orçamento gratuito e recebe proposta personalizada em 24h.
        </p>
        <Link href="/quote" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: '#d4b47a', color: '#090907',
          padding: '1rem 2rem', borderRadius: '14px',
          fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
        }}>
          Pedir Orçamento Grátis →
        </Link>
      </section>
    </div>
  );
}
