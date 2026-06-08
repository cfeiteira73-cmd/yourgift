import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Branded Merchandise — Merch de Marca Premium',
  description: 'Branded merchandise com qualidade internacional. Vestuário, acessórios e gadgets com a tua marca. Midocean + PF Concept.',
};

const items = [
  { emoji: '👕', label: 'T-shirts & Polos', desc: 'Algodão orgânico, slim fit, oversized' },
  { emoji: '🧥', label: 'Hoodies & Fleeces', desc: 'Bordado premium, interior taftado' },
  { emoji: '🎒', label: 'Mochilas & Bags', desc: 'Totes, backpacks, crossbody bags' },
  { emoji: '🧢', label: 'Headwear', desc: 'Caps, beanies, bucket hats' },
  { emoji: '💼', label: 'Business Bags', desc: 'Briefcases, laptop bags, tote executivo' },
  { emoji: '🌂', label: 'Guarda-chuvas', desc: 'Manual, automático, travel size' },
];

const techniques = [
  { name: 'Bordado', detail: 'Durabilidade máxima, look premium. Ideal para vestuário de qualidade.' },
  { name: 'DTF Transfer', detail: 'Full colour sem limitação. Perfeito para designs complexos e gradientes.' },
  { name: 'Serigrafia', detail: 'Custo-benefício imbatível em grandes quantidades. Cores sólidas e vivas.' },
];

export default function BrandedMerchPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(154,124,74,0.08)', border: '1px solid rgba(154,124,74,0.18)', borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#d4b47a', fontWeight: 600 }}>
          Branded Merchandise
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Libre Baskerville', serif", fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          A tua marca em<br /><span style={{ color: '#d4b47a' }}>cada produto</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Vestuário, acessórios e gadgets com qualidade internacional. Midocean + PF Concept — os maiores fornecedores europeus de branded merch.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#d4b47a', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Pedir Orçamento →
          </Link>
          <Link href="/catalog" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(240,236,228,0.06)', color: '#f0ece4', border: '1px solid rgba(240,236,228,0.10)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none' }}>
            Ver Catálogo
          </Link>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Categorias de produto</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {items.map((item) => (
            <div key={item.label} style={{ background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '18px', padding: '1.5rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.625rem' }}>{item.emoji}</div>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.25rem' }}>{item.label}</p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.42)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Técnicas de personalização</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {techniques.map((t) => (
            <div key={t.name} style={{ background: 'rgba(154,124,74,0.04)', border: '1px solid rgba(154,124,74,0.10)', borderRadius: '14px', padding: '1.25rem 1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4b47a', marginTop: '5px', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.25rem' }}>{t.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.5 }}>{t.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#d4b47a', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Criar o meu merch →
          </Link>
        </div>
      </section>
    </div>
  );
}
