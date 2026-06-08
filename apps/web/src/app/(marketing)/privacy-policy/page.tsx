import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — YourGift',
  description: 'Política de privacidade e protecção de dados pessoais da YourGift.',
};

const sections = [
  {
    title: '1. Responsável pelo Tratamento',
    content: 'YourGift Lda., com sede em Lisboa, Portugal, é o responsável pelo tratamento dos dados pessoais recolhidos através desta plataforma. Contacto: geral@yourgift.pt',
  },
  {
    title: '2. Dados Recolhidos',
    content: 'Recolhemos: nome, email, empresa, NIF/NIPC, morada de entrega, histórico de encomendas e orçamentos. Estes dados são necessários para a prestação dos nossos serviços B2B.',
  },
  {
    title: '3. Finalidade e Base Legal',
    content: 'Os seus dados são tratados para: execução de contratos de compra e venda (Art. 6.º/1/b RGPD), cumprimento de obrigações legais (Art. 6.º/1/c), e interesses legítimos na gestão da relação comercial (Art. 6.º/1/f).',
  },
  {
    title: '4. Conservação dos Dados',
    content: 'Os dados são conservados durante o período de vigência da relação comercial e pelo prazo legalmente exigido (10 anos para documentos fiscais, conforme legislação portuguesa).',
  },
  {
    title: '5. Partilha de Dados',
    content: 'Os seus dados não são vendidos a terceiros. São partilhados apenas com: fornecedores de produção (para execução de encomendas), processadores de pagamento (Stripe, certificado PCI DSS), e serviços de email (Resend).',
  },
  {
    title: '6. Os Seus Direitos (RGPD)',
    content: 'Tem direito a: acesso, rectificação, apagamento ("direito ao esquecimento"), portabilidade, oposição ao tratamento, e reclamação à CNPD (Comissão Nacional de Protecção de Dados). Para exercer qualquer direito: geral@yourgift.pt',
  },
  {
    title: '7. Cookies',
    content: 'Utilizamos cookies essenciais para autenticação e sessão. Cookies analíticos ou de marketing apenas com o seu consentimento explícito.',
  },
  {
    title: '8. Segurança',
    content: 'Aplicamos medidas técnicas e organizacionais adequadas: HTTPS/TLS, encriptação de dados em repouso (Supabase), autenticação de dois factores disponível, e controlo de acessos por função.',
  },
  {
    title: '9. Alterações',
    content: 'Esta política pode ser actualizada. Notificaremos por email para alterações materiais. Última actualização: Junho 2026.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', color: '#f0ece4', paddingTop: '5rem' }}>
      <section style={{ padding: '4rem 1.5rem 2rem', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 28, height: 1, background: '#9a7c4a' }} />
          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#9a7c4a' }}>Legal</span>
        </div>
        <h1 style={{ fontFamily: "'Libre Baskerville',serif", fontSize: 'clamp(1.75rem,3.5vw,2.5rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '1rem' }}>
          Política de <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>Privacidade</em>
        </h1>
        <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, color: 'rgba(240,236,228,0.52)', fontWeight: 300, marginBottom: '3rem' }}>
          Última actualização: Junho 2026 · Versão 1.0
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {sections.map((s) => (
            <div key={s.title} style={{ borderTop: '1px solid rgba(154,124,74,0.12)', paddingTop: '1.5rem' }}>
              <h2 style={{ fontFamily: "'Libre Baskerville',serif", fontSize: '1rem', fontWeight: 400, color: '#f0ece4', marginBottom: '0.75rem' }}>{s.title}</h2>
              <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, color: 'rgba(240,236,228,0.62)', fontWeight: 300, lineHeight: 1.8 }}>{s.content}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '3rem', padding: '1.5rem', background: '#141411', border: '1px solid rgba(154,124,74,0.18)' }}>
          <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 12, color: 'rgba(240,236,228,0.52)', marginBottom: '0.5rem' }}>
            Dúvidas sobre privacidade?
          </p>
          <a href="mailto:geral@yourgift.pt" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 12, color: '#d4b47a', textDecoration: 'none' }}>
            geral@yourgift.pt →
          </a>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem' }}>
          <Link href="/terms" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: 'rgba(240,236,228,0.38)', textDecoration: 'none' }}>Termos de Serviço →</Link>
          <Link href="/" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: 'rgba(240,236,228,0.38)', textDecoration: 'none' }}>← Voltar ao início</Link>
        </div>
      </section>
    </div>
  );
}
