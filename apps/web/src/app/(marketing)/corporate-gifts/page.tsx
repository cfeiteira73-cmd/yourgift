import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Corporate Gifts — Presentes Premium B2B',
  description: 'Presentes corporativos premium personalizados para clientes, parceiros e colaboradores. Qualidade internacional, entrega em toda a Europa.',
};

const useCases = [
  { emoji: '🤝', title: 'Clientes & Parceiros', description: 'Reforça relações com presentes que comunicam sofisticação e atenção ao detalhe.' },
  { emoji: '🎉', title: 'Eventos Corporativos', description: 'Congressos, lançamentos, gala dinners — merchandising que fica na memória.' },
  { emoji: '🏆', title: 'Reconhecimento Interno', description: 'Prémios, marcos de carreira, top performers — celebra com produtos únicos.' },
  { emoji: '🌍', title: 'Mercados Internacionais', description: 'Presentes adaptados a diferentes culturas e mercados. Entrega EU incluída.' },
];

const products = [
  'Caixas de presente premium com logo',
  'Conjuntos de escritório personalizados',
  'Kits de bem-estar (wellness kits)',
  'Vinhos & gastronomia com branding',
  'Tecnologia premium (auriculares, smartwatches)',
  'Artigos de couro (carteiras, capas)',
  'Canetas de luxo gravadas',
  'Porta-cartões e acessórios executivos',
];

export default function CorporateGiftsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(184,151,94,0.08)', border: '1px solid rgba(184,151,94,0.18)', borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#b8975e', fontWeight: 600 }}>
          Corporate Gifts
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Libre Baskerville', serif", fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Presentes que criam<br /><span style={{ color: '#b8975e' }}>relações duradouras</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Presentes corporativos personalizados com a tua marca. Do briefing à entrega, tratamos de tudo — com qualidade que impressiona.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#b8975e', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Pedir Proposta →
          </Link>
          <Link href="/catalog" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(240,236,228,0.06)', color: '#f0ece4', border: '1px solid rgba(240,236,228,0.10)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none' }}>
            Ver Catálogo
          </Link>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Casos de uso</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {useCases.map((u) => (
            <div key={u.title} style={{ background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '18px', padding: '1.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{u.emoji}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.5rem' }}>{u.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.6 }}>{u.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Produtos populares</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {products.map((p) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(184,151,94,0.04)', border: '1px solid rgba(184,151,94,0.10)', borderRadius: '12px', padding: '0.875rem 1.25rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b8975e', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>{p}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#b8975e', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Começar o meu projeto →
          </Link>
        </div>
      </section>
    </div>
  );
}
