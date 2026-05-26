import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Company Stores — Lojas Privadas para Equipas',
  description: 'Cria uma loja privada com a tua marca para equipas e departamentos. Gestão de stock, encomendas e relatórios numa plataforma dedicada.',
};

const features = [
  { emoji: '🏪', title: 'Loja com a tua marca', description: 'URL e design personalizado com o branding da empresa. Parece a tua plataforma, não a nossa.' },
  { emoji: '👥', title: 'Acesso por equipas', description: 'Convida colaboradores, departamentos ou regiões. Controla quem acede ao quê.' },
  { emoji: '💳', title: 'Budget por colaborador', description: 'Define limites de gasto por pessoa, departamento ou período. Controlo total sem burocracia.' },
  { emoji: '📊', title: 'Relatórios em tempo real', description: 'Vê o que está a ser encomendado, por quem, e quando. Exportação para Excel incluída.' },
  { emoji: '🚚', title: 'Entrega onde quiserem', description: 'Cada colaborador recebe na morada que preferir. Dentro da UE sem custo adicional.' },
  { emoji: '🔄', title: 'Reposição automática', description: 'Stock mínimo configurável. Reposição automática quando os níveis baixam do threshold.' },
];

const plans = [
  {
    name: 'Starter',
    desc: 'Para equipas até 50 pessoas',
    items: ['1 loja privada', 'Até 50 SKUs', 'Relatórios básicos', 'Suporte por email'],
  },
  {
    name: 'Business',
    desc: 'Para empresas em crescimento',
    items: ['Múltiplos departamentos', 'SKUs ilimitados', 'Budget por colaborador', 'Relatórios avançados', 'Gestor de conta dedicado'],
    highlight: true,
  },
  {
    name: 'Enterprise',
    desc: 'Para multinacionais',
    items: ['Multi-país e multi-idioma', 'Integração ERP/HRIS', 'SLA personalizado', 'Onboarding dedicado', 'Contrato framework'],
  },
];

export default function CompanyStoresPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', paddingTop: '5rem' }}>
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,230,190,0.08)', border: '1px solid rgba(99,230,190,0.2)', borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'rgb(99,230,190)', fontWeight: 600 }}>
          Company Stores
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          A loja da tua empresa.<br /><span style={{ color: 'rgb(99,230,190)' }}>Para a tua equipa.</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Uma plataforma privada com o teu branding onde colaboradores encomendatm os seus próprios produtos.
          Stock gerido por ti, entrega directa para eles.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/enterprise" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgb(99,230,190)', color: 'rgb(7,17,31)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Falar com a equipa →
          </Link>
          <Link href="/quote" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', color: 'rgb(245,247,251)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none' }}>
            Pedir Demo
          </Link>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Tudo o que precisas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '1.75rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{f.emoji}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.375rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.83rem', color: 'rgb(120,130,150)', lineHeight: 1.6 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Planos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? 'rgba(99,230,190,0.06)' : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
              border: plan.highlight ? '1px solid rgba(99,230,190,0.3)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px', padding: '2rem',
            }}>
              {plan.highlight && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(99,230,190)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Mais popular</div>}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgb(245,247,251)', marginBottom: '0.25rem' }}>{plan.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgb(120,130,150)', marginBottom: '1.5rem' }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {plan.items.map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>
                    <span style={{ color: 'rgb(99,230,190)', flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/enterprise" style={{ display: 'block', textAlign: 'center', marginTop: '1.75rem', background: plan.highlight ? 'rgb(99,230,190)' : 'rgba(255,255,255,0.06)', color: plan.highlight ? 'rgb(7,17,31)' : 'rgb(245,247,251)', border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
                Falar connosco
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
