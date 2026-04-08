import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Política de Privacidade",
  description: "Política de privacidade e proteção de dados da yourgift.pt, em conformidade com o RGPD.",
  noIndex: true,
});

const sections = [
  {
    id: "responsavel",
    title: "1. Responsável pelo Tratamento",
    content: `A yourgift.pt, doravante designada "yourgift", é responsável pelo tratamento dos dados pessoais recolhidos através deste website e dos seus serviços.

Para qualquer questão relacionada com a proteção de dados, podes contactar-nos através de:
• Email: privacy@yourgift.pt
• Morada: Lisboa, Portugal
• NIPC: em processo de registo`,
  },
  {
    id: "dados-recolhidos",
    title: "2. Dados Pessoais Recolhidos",
    content: `Recolhemos as seguintes categorias de dados pessoais:

Dados de Identificação: nome completo, cargo, empresa/organização
Dados de Contacto: endereço de email, número de telefone, morada de entrega e faturação
Dados de Utilização: páginas visitadas, tempo de navegação, cliques e interações com o website (via cookies analíticos)
Dados Comerciais: histórico de encomendas, pedidos de proposta (RFQ), preferências de produtos
Dados Técnicos: endereço IP, tipo de browser, sistema operativo, idioma do browser`,
  },
  {
    id: "finalidade",
    title: "3. Finalidade e Base Legal do Tratamento",
    content: `Os dados pessoais são tratados para as seguintes finalidades:

Execução Contratual (Art. 6.º, n.º 1, al. b) RGPD):
— Processar e gerir encomendas e pedidos de proposta
— Faturação e pagamentos
— Gestão da conta de cliente no dashboard

Interesse Legítimo (Art. 6.º, n.º 1, al. f) RGPD):
— Análise e melhoria dos nossos serviços e website
— Prevenção de fraude
— Comunicação sobre pedidos existentes

Consentimento (Art. 6.º, n.º 1, al. a) RGPD):
— Envio de newsletters e comunicações de marketing
— Cookies não essenciais de analítica e publicidade

Obrigação Legal (Art. 6.º, n.º 1, al. c) RGPD):
— Cumprimento de obrigações fiscais e contabilísticas`,
  },
  {
    id: "conservacao",
    title: "4. Conservação dos Dados",
    content: `Os dados são conservados pelo período estritamente necessário:

• Dados de clientes e encomendas: 10 anos (obrigação legal fiscal)
• Dados de pedidos de proposta sem contrato: 2 anos
• Dados de marketing (com consentimento): até à revogação do consentimento ou 3 anos sem interação
• Cookies analíticos: máximo 13 meses
• Logs técnicos: 90 dias

Após o período de conservação, os dados são eliminados de forma segura ou anonimizados.`,
  },
  {
    id: "partilha",
    title: "5. Partilha de Dados com Terceiros",
    content: `A yourgift não vende dados pessoais a terceiros. Os dados podem ser partilhados com:

Subcontratantes (processadores de dados):
— Clerk (autenticação de utilizadores) — EUA, com cláusulas contratuais standard
— Supabase (base de dados) — UE
— Stripe (processamento de pagamentos) — EUA, com certificação Privacy Shield
— Resend (envio de emails transacionais) — EUA, com cláusulas contratuais standard
— Vercel (hosting) — EUA, com cláusulas contratuais standard

Autoridades: quando legalmente obrigado (ex. Autoridade Tributária, CNPD).

Todos os subcontratantes foram avaliados quanto às suas garantias de proteção de dados.`,
  },
  {
    id: "direitos",
    title: "6. Os Teus Direitos RGPD",
    content: `Enquanto titular dos dados, tens os seguintes direitos:

Direito de Acesso — solicitar uma cópia dos dados pessoais que tratamos
Direito de Retificação — corrigir dados inexatos ou incompletos
Direito ao Apagamento — solicitar a eliminação dos teus dados ("direito a ser esquecido")
Direito à Limitação — restringir o tratamento em determinadas circunstâncias
Direito à Portabilidade — receber os teus dados num formato estruturado e legível por máquina
Direito de Oposição — opor-te ao tratamento baseado em interesse legítimo ou para marketing
Direito de Retirar o Consentimento — a qualquer momento, sem afetar o tratamento anterior

Para exercer qualquer destes direitos, contacta-nos em privacy@yourgift.pt. Responderemos no prazo de 30 dias. Tens também o direito de apresentar reclamação junto da CNPD (www.cnpd.pt).`,
  },
  {
    id: "cookies",
    title: "7. Cookies e Tecnologias Similares",
    content: `Utilizamos os seguintes tipos de cookies:

Cookies Essenciais (sem consentimento): necessários para o funcionamento do website, autenticação e segurança. Não podem ser desativados.

Cookies Analíticos (com consentimento): utilizamos o Google Analytics 4 para análise de tráfego anónima e agregada.

Cookies de Marketing (com consentimento): utilizados para personalizar publicidade e medir eficácia de campanhas.

Podes gerir as tuas preferências de cookies através do banner de cookies ou nas definições do teu browser. A rejeição de cookies não essenciais não afeta a utilização dos nossos serviços principais.`,
  },
  {
    id: "seguranca",
    title: "8. Segurança dos Dados",
    content: `Implementamos medidas técnicas e organizativas adequadas para proteger os teus dados:

— Encriptação TLS/HTTPS em todas as comunicações
— Encriptação de dados sensíveis em repouso
— Autenticação multifator disponível para contas de utilizador
— Controlo de acesso baseado em funções (RBAC)
— Auditorias de segurança regulares
— Política de retenção e eliminação segura de dados
— Formação regular da equipa em proteção de dados`,
  },
  {
    id: "transferencias",
    title: "9. Transferências Internacionais",
    content: `Alguns dos nossos subcontratantes estão sediados fora do Espaço Económico Europeu (EEE). Nestas situações, asseguramos que as transferências são feitas com as devidas garantias, nomeadamente através de Cláusulas Contratuais Tipo aprovadas pela Comissão Europeia, ou mediante adequação reconhecida pelo Regulador.`,
  },
  {
    id: "alteracoes",
    title: "10. Alterações a esta Política",
    content: `Esta Política de Privacidade pode ser atualizada periodicamente para refletir alterações nas nossas práticas ou requisitos legais. A data da última atualização é indicada no início do documento. Em caso de alterações significativas, notificamos os utilizadores registados por email.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-28 pb-24">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className="text-sm text-[#4DA3FF] font-medium mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-white mb-4">
            Política de Privacidade
          </h1>
          <p className="text-white/50 text-sm">
            Última atualização: 8 de abril de 2026 · Em conformidade com o RGPD (Regulamento Geral sobre a Proteção de Dados)
          </p>
        </div>

        {/* Intro banner */}
        <div className="p-4 rounded-xl border border-[#4DA3FF]/20 bg-[#4DA3FF]/05 mb-10">
          <p className="text-sm text-white/70 leading-relaxed">
            A yourgift.pt está comprometida com a proteção dos teus dados pessoais. Esta política explica de forma transparente como recolhemos, utilizamos e protegemos os teus dados, em conformidade com o Regulamento (UE) 2016/679 (RGPD).
          </p>
        </div>

        {/* TOC */}
        <nav className="mb-12 p-5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Índice</p>
          <ol className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-white/60 hover:text-[#4DA3FF] transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-lg font-semibold text-white mb-3">{s.title}</h2>
              <div className="space-y-2">
                {s.content.split("\n").map((line, i) =>
                  line.trim() === "" ? null : (
                    <p key={i} className="text-sm text-white/60 leading-relaxed">
                      {line}
                    </p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 p-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] text-center">
          <p className="text-white/70 text-sm mb-2">Questões sobre privacidade?</p>
          <a
            href="mailto:privacy@yourgift.pt"
            className="text-[#4DA3FF] font-medium hover:underline"
          >
            privacy@yourgift.pt
          </a>
        </div>
      </div>
    </div>
  );
}
