import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fulfillment — Produção, Armazenagem e Envio',
  description: 'Serviço completo de fulfillment para merchandising B2B. Produção, armazenagem, picking, packing e entrega em toda a Europa.',
};

const steps = [
  { num: '01', title: 'Produção', desc: 'Fabricamos os teus produtos com fornecedores certificados internacionalmente. Controlo de qualidade em cada etapa.' },
  { num: '02', title: 'Armazenagem', desc: 'O teu stock fica guardado nos nossos armazéns. Gerido digitalmente, acessível no portal em tempo real.' },
  { num: '03', title: 'Picking & Packing', desc: 'Quando recebes um pedido, preparamos o envio com o packaging da tua marca. Sem intervenção da tua parte.' },
  { num: '04', title: 'Entrega Europa', desc: 'Envio para qualquer país da UE em 2–5 dias úteis. Tracking incluído, sem surpresas.' },
];

const benefits = [
  { icon: '⚡', text: 'Sem investimento em armazém próprio' },
  { icon: '📈', text: 'Escala sem custos fixos adicionais' },
  { icon: '🔍', text: 'Rastreio em tempo real no portal' },
  { icon: '📦', text: 'Packaging personalizado em cada envio' },
  { icon: '🌍', text: 'Cobertura em toda a União Europeia' },
  { icon: '🧾', text: 'Faturação consolidada mensal' },
];

export default function FulfillmentPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', paddingTop: '5rem' }}>
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(154,124,74,0.08)', border: '1px solid rgba(154,124,74,0.18)', borderRadius: '100px', padding: '0.375rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#d4b47a', fontWeight: 600 }}>
          Fulfillment
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Libre Baskerville', serif", fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Produção ao destino<br /><span style={{ color: '#d4b47a' }}>sem fricção</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'rgb(170,180,198)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Tratamos de todo o processo — desde a produção até ao destinatário final.
          Tu defines o produto, nós fazemos o resto.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/enterprise" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#d4b47a', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Falar com a equipa →
          </Link>
          <Link href="/how-it-works" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(240,236,228,0.06)', color: '#f0ece4', border: '1px solid rgba(240,236,228,0.10)', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none' }}>
            Como Funciona
          </Link>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 4rem', maxWidth: '880px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>O processo completo</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '1.5rem', alignItems: 'flex-start', background: 'linear-gradient(180deg, rgba(240,236,228,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '18px', padding: '1.75rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(154,124,74,0.10)', border: '1px solid rgba(154,124,74,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#d4b47a', flexShrink: 0 }}>
                {step.num}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.375rem' }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '2rem', textAlign: 'center' }}>Porquê externalizar?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '3rem' }}>
          {benefits.map((b) => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'rgba(154,124,74,0.04)', border: '1px solid rgba(154,124,74,0.10)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{b.icon}</span>
              <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>{b.text}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link href="/enterprise" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#d4b47a', color: '#090907', padding: '0.875rem 1.75rem', borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
            Falar connosco →
          </Link>
        </div>
      </section>
    </div>
  );
}
