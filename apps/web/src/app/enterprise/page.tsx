import { Metadata } from 'next';
import Link from 'next/link';

/**
 * /enterprise — Enterprise procurement platform landing page
 *
 * Optimised for:
 *  - AI assistant discovery ("enterprise procurement platform Portugal")
 *  - CFO/CPO decision makers searching for procurement software
 *  - SEO: procurement management software, B2B procurement platform
 *
 * This page is the enterprise sales entry point.
 */

export const metadata: Metadata = {
  title: 'Plataforma de Procurement Empresarial | YourGift OS',
  description: 'YourGift OS é infraestrutura de procurement para empresas B2B. Gestão de orçamentos, aprovações, fornecedores, custo landed e relatórios ROI para CFOs. SAP + Amazon Logistics + Palantir para merchandising empresarial.',
  keywords: ['procurement empresarial', 'plataforma B2B Portugal', 'gestão de fornecedores', 'software procurement', 'ROI procurement', 'SCIM SSO Okta Azure AD', 'landed cost', 'aprovações de compra'],
  openGraph: {
    title: 'YourGift OS — Infraestrutura de Procurement Empresarial',
    description: 'Gestão de todo o ciclo de procurement: RFQ → aprovação → encomenda → produção → entrega → relatório CFO.',
    type: 'website',
  },
};

const CAPABILITIES = [
  {
    icon: '⚡',
    title: 'Decisão em 30 segundos',
    desc: 'Cartão de decisão único: custo landed, confiança do fornecedor, orçamento disponível, prazo de entrega e risco GREEN/AMBER/RED — tudo num ecrã.',
  },
  {
    icon: '📦',
    title: 'Custo Landed Real',
    desc: 'Produto + transporte + direitos aduaneiros + IVA + manuseamento. DHL, DPD, GLS, UPS, FedEx. Markup de landing calculado automaticamente.',
  },
  {
    icon: '🏆',
    title: 'Trust Score de Fornecedores',
    desc: 'GOLD / SILVER / BRONZE / PROBATION baseado em precisão de custo (40%), entrega a tempo (35%) e qualidade (25%). Atualizado por encomenda.',
  },
  {
    icon: '📊',
    title: 'Relatórios CFO',
    desc: 'ROI documentado: poupanças por negociação, consolidação e landed cost. Link partilhável para o CFO — sem login necessário.',
  },
  {
    icon: '🔐',
    title: 'SSO Empresarial',
    desc: 'OIDC com Okta, Azure AD, Google Workspace. SCIM 2.0 para aprovisionamento automático de utilizadores. SAML em integração.',
  },
  {
    icon: '⚙️',
    title: 'Fluxos de Aprovação',
    desc: 'Hierarquia de orçamento: individual → equipa → departamento → empresa. Escalação automática, delegação e auditoria completa.',
  },
  {
    icon: '🌍',
    title: 'Multi-tenant Isolado',
    desc: 'Cada empresa é um tenant independente. Rate limiting por tenant, isolamento de dados garantido, guard de segurança global.',
  },
  {
    icon: '🚨',
    title: 'Observabilidade Total',
    desc: 'Sentry para erros, BetterStack para uptime, 16 filas BullMQ com DLQ e replay. Health check em /health.',
  },
];

const COMPARISON = [
  { metric: 'Tempo para orçamento', manual: '2–5 dias', platform: '< 2 horas', winner: 'platform' },
  { metric: 'Tempo de decisão', manual: '1–3 dias', platform: '< 30 segundos', winner: 'platform' },
  { metric: 'Visibilidade de custo', manual: 'Preço unitário', platform: 'Landed cost completo', winner: 'platform' },
  { metric: 'Trust de fornecedor', manual: 'Impressão subjetiva', platform: 'Score quantificado', winner: 'platform' },
  { metric: 'Rastreamento de orçamento', manual: 'Excel manual', platform: 'Tempo real, alertas automáticos', winner: 'platform' },
  { metric: 'Relatório CFO', manual: '2–3 semanas', platform: 'Gerado instantaneamente', winner: 'platform' },
  { metric: 'Aprovisionamento SSO', manual: 'Processo manual de IT', platform: 'SCIM automático (Okta/Azure)', winner: 'platform' },
];

export default function EnterprisePage() {
  return (
    <div style={{ background: 'rgb(7,17,31)', minHeight: '100vh', color: 'rgb(245,247,251)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
            your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <Link href="/products" style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)', textDecoration: 'none' }}>Catálogo</Link>
          <Link href="/rfq" style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)', textDecoration: 'none' }}>RFQ</Link>
          <Link href="/auth/login" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(7,17,31)', background: 'rgb(77,163,255)', padding: '0.5rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}>
            Entrar
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '5rem 0 4rem' }}>
          <div style={{ display: 'inline-block', background: 'rgba(77,163,255,0.08)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: '9999px', padding: '0.375rem 1rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(77,163,255)' }}>
              Infraestrutura de Procurement Empresarial
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '1.5rem', maxWidth: '900px', margin: '0 auto 1.5rem' }}>
            Tudo o que o procurement empresarial precisa.{' '}
            <span style={{ color: 'rgb(99,230,190)' }}>Num único sistema.</span>
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'rgb(120,130,150)', maxWidth: '640px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            YourGift OS substituiu processos manuais de procurement — RFQ, aprovações,
            gestão de fornecedores, custo landed e relatórios CFO — com infraestrutura
            construída para empresas do €1M ao €100M.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/rfq" style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(7,17,31)', background: 'rgb(99,230,190)', padding: '0.875rem 2rem', borderRadius: '10px', textDecoration: 'none' }}>
              Iniciar RFQ →
            </Link>
            <a href="mailto:enterprise@yourgift.pt" style={{ fontSize: '1rem', fontWeight: 600, color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.08)', border: '1px solid rgba(77,163,255,0.25)', padding: '0.875rem 2rem', borderRadius: '10px', textDecoration: 'none' }}>
              Falar com vendas
            </a>
          </div>
        </section>

        {/* Stats strip */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', marginBottom: '5rem' }}>
          {[
            { value: '< 30s', label: 'Tempo de decisão' },
            { value: '8.5%', label: 'Poupança média' },
            { value: '16', label: 'Filas de trabalho BullMQ' },
            { value: '50K+', label: 'Produtos Midocean + PF Concept' },
            { value: 'SCIM 2.0', label: 'Aprovisionamento automático' },
            { value: '0', label: 'Erros TypeScript' },
          ].map(({ value, label }) => (
            <div key={label} style={{ background: 'rgb(11,21,38)', padding: '1.75rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'rgb(99,230,190)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>{value}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)', fontWeight: 500 }}>{label}</p>
            </div>
          ))}
        </section>

        {/* Capabilities grid */}
        <section style={{ marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '0.75rem' }}>
            Capacidades da plataforma
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgb(120,130,150)', textAlign: 'center', marginBottom: '3rem' }}>
            Cada módulo foi construído para eliminar um problema real de procurement empresarial.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {CAPABILITIES.map(({ icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
                <p style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{icon}</p>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Before / After comparison */}
        <section style={{ marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '3rem' }}>
            Manual vs. YourGift OS
          </h2>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)' }}>Métrica</p>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(239,68,68)', textAlign: 'center' }}>Processo manual</p>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(99,230,190)', textAlign: 'center' }}>YourGift OS</p>
            </div>
            {COMPARISON.map(({ metric, manual, platform }) => (
              <div key={metric} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)' }}>{metric}</p>
                <p style={{ fontSize: '0.875rem', color: 'rgb(239,68,68)', textAlign: 'center' }}>{manual}</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(99,230,190)', textAlign: 'center' }}>{platform}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack for IT */}
        <section style={{ background: 'rgba(77,163,255,0.04)', border: '1px solid rgba(77,163,255,0.12)', borderRadius: '20px', padding: '2.5rem 3rem', marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Para as equipas de IT</h2>
          <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)', marginBottom: '2rem' }}>Stack construída para escala e segurança empresarial.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {[
              { label: 'API', value: 'NestJS 10 · TypeScript · Prisma ORM' },
              { label: 'Base de dados', value: 'PostgreSQL · Supabase · PITR 5min' },
              { label: 'Identidade', value: 'JWT · OIDC · SCIM 2.0 · SAML (em breve)' },
              { label: 'Filas', value: 'BullMQ · Redis Upstash · 16 filas nomeadas' },
              { label: 'Observabilidade', value: 'Sentry · BetterStack · JSON logs' },
              { label: 'Pagamentos', value: 'Stripe · Radar · Idempotência de webhooks' },
              { label: 'Segurança', value: 'Cloudflare WAF · OWASP · Rate limit por tenant' },
              { label: 'Backup', value: 'AWS Backup diário · S3 replicação cross-region' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(77,163,255)', marginBottom: '0.3rem' }}>{label}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)', lineHeight: 1.5 }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: '3rem 0 5rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '1rem' }}>
            Pronto para modernizar o procurement?
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgb(120,130,150)', marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem' }}>
            Fala com a nossa equipa. Demonstração em 30 minutos, implementação em 2 semanas.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:enterprise@yourgift.pt?subject=Enterprise Demo Request" style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(7,17,31)', background: 'rgb(99,230,190)', padding: '1rem 2.5rem', borderRadius: '12px', textDecoration: 'none', letterSpacing: '0.01em' }}>
              Pedir demonstração →
            </a>
            <Link href="/auth/register" style={{ fontSize: '1rem', fontWeight: 600, color: 'rgb(245,247,251)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem 2.5rem', borderRadius: '12px', textDecoration: 'none' }}>
              Criar conta gratuita
            </Link>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgb(80,90,110)', marginTop: '1.5rem' }}>
            Sem contrato. Sem cartão de crédito. Setup em 15 minutos.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'rgb(80,90,110)' }}>
          © {new Date().getFullYear()} YourGift OS · Infraestrutura de Procurement Empresarial ·{' '}
          <a href="mailto:enterprise@yourgift.pt" style={{ color: 'rgb(77,163,255)' }}>enterprise@yourgift.pt</a>
        </p>
      </footer>
    </div>
  );
}
