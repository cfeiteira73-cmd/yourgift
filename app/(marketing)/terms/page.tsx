import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Termos de Serviço",
  description: "Termos e condições de utilização dos serviços da yourgift.pt.",
  noIndex: true,
});

const sections = [
  {
    id: "aceitacao",
    title: "1. Aceitação dos Termos",
    content: `Ao aceder e utilizar a plataforma yourgift.pt, confirmas que leste, compreendeste e aceitas os presentes Termos de Serviço na sua totalidade. Se estás a agir em nome de uma empresa ou entidade, declara ainda que tens autoridade para vinculá-la a estes termos.

A yourgift.pt reserva-se o direito de atualizar estes Termos. A continuação da utilização após publicação de alterações constitui aceitação das mesmas. A versão mais recente está sempre disponível nesta página.

Estes Termos aplicam-se a todos os utilizadores da plataforma, incluindo clientes, visitantes e quaisquer outras pessoas que acedam ou utilizem os serviços.`,
  },
  {
    id: "servicos",
    title: "2. Descrição dos Serviços",
    content: `A yourgift.pt é uma plataforma B2B de merchandising corporativo que oferece:

— Brindes corporativos personalizados (corporate gifts)
— Merchandising de marca (branded merch) com logótipo e identidade visual
— Embalagem personalizada (packaging)
— Lojas empresa (company stores) — plataforma white-label para distribuição interna
— Fulfillment e logística — armazenamento, picking, packing e expedição

Os serviços são prestados exclusivamente a empresas e profissionais (B2B). A yourgift.pt não presta serviços a consumidores particulares no âmbito do presente website.`,
  },
  {
    id: "conta",
    title: "3. Conta de Utilizador",
    content: `Para aceder ao dashboard e funcionalidades avançadas, é necessário criar uma conta. Ao criar a tua conta, comprometes-te a:

— Fornecer informações verdadeiras, precisas, atuais e completas
— Manter a confidencialidade das tuas credenciais de acesso
— Notificar-nos imediatamente em caso de utilização não autorizada da tua conta
— Ser responsável por todas as atividades realizadas com as tuas credenciais

A yourgift.pt reserva-se o direito de suspender ou encerrar contas que violem estes Termos, sem aviso prévio.`,
  },
  {
    id: "encomendas",
    title: "4. Pedidos de Proposta e Encomendas",
    content: `Processo de Encomenda:
1. O cliente submete um Pedido de Proposta (RFQ) com as especificações do produto
2. A yourgift.pt apresenta uma proposta com preço, prazo e condições
3. O cliente aceita a proposta e procede ao pagamento de 50% (adiantamento)
4. Produção e aprovação de mockup digital pelo cliente
5. Expedição após pagamento da segunda tranche (50%)

Confirmação: uma encomenda só é considerada firme após o pagamento do adiantamento. Propostas têm validade de 15 dias úteis.

Quantidade Mínima de Encomenda (MOQ): varia por produto. A MOQ indicada em cada produto é a quantidade mínima para produção com personalização.

Alterações: após aprovação do mockup e início de produção, não são aceites alterações à encomenda.`,
  },
  {
    id: "precos-pagamentos",
    title: "5. Preços e Pagamentos",
    content: `Preços: todos os preços apresentados são indicativos e excluem IVA à taxa legal em vigor (23% em Portugal continental), salvo indicação contrária. O preço final é o constante da proposta aceite pelo cliente.

Condições de Pagamento:
— 50% no momento da confirmação da encomenda (adiantamento)
— 50% antes da expedição da encomenda
— Encomendas de valor superior a €50.000 podem ter condições negociadas

Métodos de Pagamento: transferência bancária, cartão de crédito/débito (via Stripe), e, para clientes com conta ativa, nota de débito a 30 dias mediante aprovação de crédito.

Mora: pagamentos em atraso incorrem em juros de mora à taxa legal comercial, acrescidos de custos de cobrança.`,
  },
  {
    id: "prazos-entrega",
    title: "6. Prazos de Entrega",
    content: `Os prazos de produção são os seguintes (dias úteis após aprovação do mockup):

— Produtos standard personalizados: 7–15 dias úteis
— Produtos premium ou complexos: 20–35 dias úteis
— Embalagem personalizada: 15–25 dias úteis
— Company stores (setup): 3–5 dias úteis

Os prazos são indicativos e podem variar em função de picos de produção, complexidade do pedido, disponibilidade de stock de base e sazonalidade. Prazos urgentes estão sujeitos a suplemento de urgência.

A yourgift.pt não se responsabiliza por atrasos causados por transportadoras terceiras, após expedição.`,
  },
  {
    id: "qualidade-reclamacoes",
    title: "7. Qualidade e Reclamações",
    content: `Garantia de Qualidade: todos os produtos passam por controlo de qualidade antes da expedição. A yourgift.pt garante que os produtos estão em conformidade com as especificações acordadas e com o mockup aprovado.

Reclamações: devem ser comunicadas por escrito em até 5 dias úteis após receção. Após esse prazo, considera-se que o cliente aceitou a encomenda.

Tolerâncias: em produtos personalizados são aceites as seguintes tolerâncias industriais:
— Quantidade: ±5% da quantidade encomendada
— Cor: variações de cor dentro dos padrões industriais (CMYK/Pantone)
— Dimensões: ±2mm

Devoluções por defeito: produtos com defeito de produção serão substituídos ou reembolsados, a critério da yourgift.pt.`,
  },
  {
    id: "propriedade-intelectual",
    title: "8. Propriedade Intelectual",
    content: `Materiais do Cliente: ao submeter logótipos, imagens, designs ou outros materiais para personalização, o cliente declara e garante que:
— É o titular dos direitos ou tem licença para utilizar os materiais
— Os materiais não violam direitos de terceiros (marcas registadas, direitos de autor, etc.)
— Os materiais não contêm conteúdo ilegal, obsceno ou ofensivo

Responsabilidade: a yourgift.pt não verifica a originalidade dos materiais fornecidos e não assume qualquer responsabilidade por infrações de propriedade intelectual originadas nos materiais do cliente. O cliente indemnizará a yourgift.pt por quaisquer reclamações de terceiros neste âmbito.

Conteúdo da Plataforma: todo o conteúdo da plataforma yourgift.pt (texto, imagens, design, código) é propriedade da yourgift.pt ou dos seus licenciantes.`,
  },
  {
    id: "responsabilidade",
    title: "9. Limitação de Responsabilidade",
    content: `Na máxima extensão permitida pela lei aplicável:

— A responsabilidade total da yourgift.pt, por qualquer causa, está limitada ao valor pago pelo cliente na encomenda em causa
— A yourgift.pt não se responsabiliza por danos indiretos, lucros cessantes, perda de dados ou danos reputacionais
— A yourgift.pt não garante a disponibilidade ininterrupta da plataforma e não se responsabiliza por perdas resultantes de interrupções técnicas

Nada nestes Termos exclui ou limita a responsabilidade da yourgift.pt por morte ou danos pessoais causados por negligência, ou por qualquer outra responsabilidade que não possa ser excluída por lei.`,
  },
  {
    id: "suspensao",
    title: "10. Suspensão e Rescisão",
    content: `A yourgift.pt pode suspender ou terminar o acesso à plataforma, a qualquer momento, por:
— Violação destes Termos de Serviço
— Falta de pagamento
— Atividade fraudulenta ou suspeita
— Incumprimento de obrigações legais

Em caso de rescisão, as obrigações de pagamento por encomendas já em produção mantêm-se.`,
  },
  {
    id: "lei-jurisdicao",
    title: "11. Lei Aplicável e Jurisdição",
    content: `Estes Termos são regidos pelo direito português. Em caso de litígio, as partes comprometem-se a tentar uma resolução amigável num prazo de 30 dias. Na impossibilidade de resolução amigável, o litígio será submetido aos tribunais de Lisboa, com expressa renúncia a qualquer outro foro.

Para efeitos de resolução alternativa de litígios de consumo, pode ser utilizado o Centro de Arbitragem de Conflitos de Consumo de Lisboa (www.centroarbitragemlisboa.pt), quando aplicável.`,
  },
  {
    id: "contacto",
    title: "12. Contactos",
    content: `Para questões sobre estes Termos de Serviço:

Email geral: gera@yourgift.pt
Questões jurídicas: legal@yourgift.pt
Telefone: +351 210 000 000 (dias úteis, 9h–18h)

yourgift.pt — Lisboa, Portugal`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-28 pb-24">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className="text-sm text-[#4DA3FF] font-medium mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-white mb-4">
            Termos de Serviço
          </h1>
          <p className="text-white/50 text-sm">
            Última atualização: 8 de abril de 2026 · yourgift.pt, Lisboa, Portugal
          </p>
        </div>

        {/* Intro banner */}
        <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] mb-10">
          <p className="text-sm text-white/70 leading-relaxed">
            Estes Termos de Serviço regulam a utilização da plataforma yourgift.pt e a prestação de serviços de merchandising corporativo. Por favor, lê-os com atenção antes de criar uma conta ou submeter um pedido.
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
          <p className="text-white/70 text-sm mb-2">Questões sobre estes termos?</p>
          <a
            href="mailto:legal@yourgift.pt"
            className="text-[#4DA3FF] font-medium hover:underline"
          >
            legal@yourgift.pt
          </a>
        </div>
      </div>
    </div>
  );
}
