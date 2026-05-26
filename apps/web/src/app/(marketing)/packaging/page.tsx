import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Packaging Premium — Embalagens Personalizadas',
  description: 'Embalagens premium personalizadas com a tua marca. Caixas, malas, sacos e packaging sustentável para a tua empresa.',
};

const types = [
  { emoji: '📦', label: 'Caixas Rígidas', desc: 'Tampas deslizantes, magnéticas ou com fita. Impressão a cores completa.' },
  { emoji: '🛍️', label: 'Sacos de Papel', desc: 'Kraft, couché ou reciclado. Handles de fita, corda ou corte a laser.' },
  { emoji: '🎀', label: 'Gift Boxes', desc: 'Com papel de seda, fita e cartão personalizado. Pronto para oferta.' },
  { emoji: '📫', label: 'Mailers & Caixas E-commerce', desc: 'Packaging funcional para envio. Exterior com branding, interior com surpresa.' },
  { emoji: '🌱', label: 'Eco Packaging', desc: 'Cartão reciclado, tinta de base aquosa, certificações FSC disponíveis.' },
  { emoji: '✨', label: 'Luxury Packaging', desc: 'Relevo, verniz localizado, hot stamping a ouro ou prata.' },
];

export default function PackagingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', paddingTop: '5rem' }}>
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(116,231,255,0.08)', border: '1px solid rgba(116,231,255,0.2)', borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'rgb(116,231,255)', fontWeight: 600 }}>
          Packaging Premium
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Embalagens que<br /><span style={{ color: 'rgb(116,231,255)' }}>comunicam a tua marca</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          A primeira impressão começa na embalagem. Packaging personalizado que eleva a percepção de valor da tua marca.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgb(116,231,255)', color: 'rgb(7,17,31)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Pedir Orçamento →
          </Link>
          <Link href="/how-it-works" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', color: 'rgb(245,247,251)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none' }}>
            Como Funciona
          </Link>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Tipos de packaging</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {types.map((t) => (
            <div key={t.label} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '1.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{t.emoji}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.375rem' }}>{t.label}</h3>
              <p style={{ fontSize: '0.83rem', color: 'rgb(120,130,150)', lineHeight: 1.6 }}>{t.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgb(116,231,255)', color: 'rgb(7,17,31)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Criar o meu packaging →
          </Link>
        </div>
      </section>
    </div>
  );
}
