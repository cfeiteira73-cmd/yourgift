import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Insights sobre merchandising B2B, branding corporativo e tendências de personalização.',
};

const articles = [
  {
    category: 'Merchandising',
    title: 'Como escolher a técnica de personalização certa para cada produto',
    excerpt: 'Bordado, DTF, serigrafia, laser — cada técnica tem o seu caso de uso ideal. Descobre qual funciona melhor para o teu projeto.',
    readTime: '5 min',
    date: 'Mai 2026',
  },
  {
    category: 'Branding',
    title: 'Merchandising sustentável: o que realmente importa em 2026',
    excerpt: 'Certificações GOTS, FSC e B Corp estão a mudar a forma como as empresas escolhem os seus fornecedores de merchandising.',
    readTime: '6 min',
    date: 'Abr 2026',
  },
  {
    category: 'Tendências',
    title: 'Company Stores: a revolução no merchandising corporativo',
    excerpt: 'Como as lojas privadas para equipas estão a transformar a gestão de stock e a reduzir custos operacionais.',
    readTime: '4 min',
    date: 'Abr 2026',
  },
  {
    category: 'Guia',
    title: 'Kit de boas-vindas para novos colaboradores: o guia completo',
    excerpt: 'Do primeiro dia ao onboarding perfeito — como criar um kit que faz a diferença na experiência do novo colaborador.',
    readTime: '7 min',
    date: 'Mar 2026',
  },
  {
    category: 'Merchandising',
    title: 'ROI do merchandising corporativo: como medir o impacto real',
    excerpt: 'Métricas práticas para justificar o investimento em merchandising junto da gestão — com dados reais.',
    readTime: '8 min',
    date: 'Mar 2026',
  },
  {
    category: 'Tendências',
    title: 'Produtos tech personalizados: o presente corporativo de 2026',
    excerpt: 'USB, power banks, auriculares — descobrimos quais os gadgets com maior impacto nos clientes B2B.',
    readTime: '5 min',
    date: 'Fev 2026',
  },
];

const categoryColors: Record<string, string> = {
  Merchandising: '#d4b47a',
  Branding: '#b8975e',
  Tendências: '#b8975e',
  Guia: 'rgb(167,243,208)',
};

export default function BlogPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Insights sobre<br />
          <span style={{ color: '#d4b47a' }}>merchandising B2B</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'rgb(170,180,198)', lineHeight: 1.7 }}>
          Tudo o que precisas de saber sobre personalização, branding corporativo e tendências do setor.
        </p>
      </section>

      {/* Articles */}
      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {articles.map((article) => (
            <div key={article.title} style={{
              background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(240,236,228,0.06)',
              borderRadius: '20px', padding: '2rem',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: categoryColors[article.category] ?? '#d4b47a',
                  background: `${categoryColors[article.category] ?? '#d4b47a'}14`,
                  padding: '0.25rem 0.625rem', borderRadius: '100px',
                }}>
                  {article.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.42)', marginLeft: 'auto' }}>
                  {article.date} · {article.readTime}
                </span>
              </div>

              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0ece4', lineHeight: 1.4 }}>
                {article.title}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.6, flex: 1 }}>
                {article.excerpt}
              </p>

              <div style={{
                fontSize: '0.8rem', color: '#d4b47a', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem',
              }}>
                Ler artigo →
              </div>
            </div>
          ))}
        </div>

        {/* Coming soon note */}
        <div style={{
          marginTop: '3rem', textAlign: 'center',
          background: 'rgba(154,124,74,0.06)', border: '1px solid rgba(154,124,74,0.12)',
          borderRadius: '16px', padding: '2rem',
        }}>
          <p style={{ color: 'rgba(240,236,228,0.42)', fontSize: '0.9rem' }}>
            📝 Novos artigos todos os meses.{' '}
            <Link href="/quote" style={{ color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>
              Fala connosco
            </Link>{' '}
            para sugerir um tema.
          </p>
        </div>
      </section>
    </div>
  );
}
