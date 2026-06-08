import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Serviço — YourGift',
  description: 'Termos e condições de serviço da YourGift para clientes B2B.',
};

const sections = [
  { title: '1. Partes', content: 'Os presentes Termos de Serviço ("Termos") regulam a relação entre YourGift Lda. ("YourGift") e o Cliente, pessoa singular ou colectiva, que utiliza a plataforma yourgift.pt.' },
  { title: '2. Objecto', content: 'YourGift presta serviços de fornecimento de produtos personalizados (branded merchandise, corporate gifts, company stores) para empresas, através de fornecedores certificados.' },
  { title: '3. Encomendas', content: 'Uma encomenda é confirmada após: (i) aprovação escrita do mockup pelo Cliente; (ii) pagamento do sinal acordado (mínimo 50%). A produção só inicia após ambas as condições estarem cumpridas.' },
  { title: '4. Preços e Pagamento', content: 'Os preços são indicados em euros (€) e incluem IVA quando aplicável. Condições padrão: 50% no início, 50% antes do envio. Pagamentos via transferência bancária ou cartão (Stripe).' },
  { title: '5. Prazos de Entrega', content: 'Os prazos indicados são estimativas após aprovação de arte-final. YourGift não se responsabiliza por atrasos causados por força maior, greves ou problemas aduaneiros.' },
  { title: '6. Aprovação de Arte', content: 'O Cliente é responsável pela aprovação final do mockup. YourGift não se responsabiliza por erros de conteúdo aprovados pelo Cliente (ortografia, imagens, cores).' },
  { title: '7. Propriedade Intelectual', content: 'O Cliente garante ter os direitos sobre todos os materiais fornecidos (logos, imagens, textos). YourGift não valida os direitos de propriedade intelectual dos materiais entregues.' },
  { title: '8. Devoluções e Garantias', content: 'Produtos com defeito de produção são substituídos gratuitamente. Não são aceites devoluções por motivos de gosto ou alteração de necessidade após início de produção.' },
  { title: '9. Limitação de Responsabilidade', content: 'A responsabilidade máxima de YourGift é limitada ao valor da encomenda em causa. Não nos responsabilizamos por lucros cessantes ou danos indirectos.' },
  { title: '10. Lei Aplicável', content: 'Estes Termos são regidos pela lei portuguesa. Qualquer litígio será sujeito à jurisdição dos Tribunais de Lisboa.' },
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', color: '#f0ece4', paddingTop: '5rem' }}>
      <section style={{ padding: '4rem 1.5rem 2rem', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 28, height: 1, background: '#9a7c4a' }} />
          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#9a7c4a' }}>Legal</span>
        </div>
        <h1 style={{ fontFamily: "'Libre Baskerville',serif", fontSize: 'clamp(1.75rem,3.5vw,2.5rem)', fontWeight: 400, color: '#f0ece4', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '1rem' }}>
          Termos de <em style={{ fontStyle: 'italic', color: '#d4b47a' }}>Serviço</em>
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

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem' }}>
          <Link href="/privacy-policy" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: 'rgba(240,236,228,0.38)', textDecoration: 'none' }}>Política de Privacidade →</Link>
          <Link href="/" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: 'rgba(240,236,228,0.38)', textDecoration: 'none' }}>← Voltar ao início</Link>
        </div>
      </section>
    </div>
  );
}
