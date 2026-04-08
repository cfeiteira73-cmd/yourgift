import { notFound } from "next/navigation";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, User, ArrowRight, Share2, Linkedin, Twitter } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "Corporate Gifts": "text-[#4DA3FF] border-[#4DA3FF]/25 bg-[#4DA3FF]/10",
  "Branded Merch": "text-[#63E6BE] border-[#63E6BE]/25 bg-[#63E6BE]/10",
  "Packaging": "text-[#F59E0B] border-[#F59E0B]/25 bg-[#F59E0B]/10",
  "Company Stores": "text-[#A78BFA] border-[#A78BFA]/25 bg-[#A78BFA]/10",
  "Fulfillment": "text-[#F472B6] border-[#F472B6]/25 bg-[#F472B6]/10",
  "Guias": "text-[#34D399] border-[#34D399]/25 bg-[#34D399]/10",
  "Sustentabilidade": "text-[#6EE7B7] border-[#6EE7B7]/25 bg-[#6EE7B7]/10",
};

const POSTS: Record<
  string,
  {
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    date: string;
    author: string;
    readTime: string;
    image: string;
    content: string;
  }
> = {
  "guia-corporate-gifts-2025": {
    slug: "guia-corporate-gifts-2025",
    title: "Guia completo de Corporate Gifts para 2025",
    excerpt:
      "Tendências, estratégias e os produtos mais procurados por empresas para presentes corporativos este ano.",
    category: "Corporate Gifts",
    date: "2025-01-15",
    author: "Equipa yourgift.pt",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&h=600&fit=crop",
    content: `
<h2>O que mudou no corporate gifting em 2025</h2>
<p>O mercado de presentes corporativos em Portugal atravessa uma transformação profunda. As empresas deixaram de tratar o gifting como uma despesa de fim de ano e passam a encará-lo como uma alavanca estratégica de retenção de talento, fidelização de clientes e reforço da identidade de marca. Em 2025, três fatores moldam todas as decisões de compra: sustentabilidade credível, personalização com impacto e logística previsível.</p>
<p>Quem compra presentes corporativos já não aceita canetas com o logótipo da empresa numa caixa genérica. Os decision-makers de Recursos Humanos, Marketing e Procurement exigem produtos que reflitam os valores da organização e que o destinatário vai realmente usar — e apreciar.</p>

<h2>As 5 tendências que dominam o mercado</h2>

<h3>1. Sustentabilidade com substância</h3>
<p>A palavra "eco" perdeu impacto quando foi aplicada a quase tudo. Em 2025, as empresas exigem provas: certificações FSC para papel e madeira, algodão orgânico com rastreabilidade GOTS, e materiais reciclados com percentagens verificáveis. O greenwashing é detectado imediatamente — e prejudica a marca de quem oferece tanto quanto de quem fornece.</p>
<ul>
  <li>Cadernos em papel reciclado com certificação FSC são o produto sustentável mais procurado</li>
  <li>Garrafas de vidro borossilicato substituíram o plástico em praticamente todos os welcome kits premium</li>
  <li>Sacos tote em algodão orgânico têm taxas de uso real muito superiores aos equivalentes sintéticos</li>
  <li>Embalagem minimalista em cartão reciclado torna-se parte integrante da experiência</li>
</ul>

<h3>2. Personalização além do logótipo</h3>
<p>A gravação laser e o debossing continuam a ser os métodos mais elegantes para produtos premium — deixam uma marca subtil mas duradoura, sem o aspeto publicitário que alguns colaboradores rejeitam. O UV printing permite detalhes a cores impossíveis de alcançar com outros métodos, ideal para marcas com identidades visuais complexas.</p>

<h3>3. Tech accessories com valor percebido elevado</h3>
<p>Os acessórios de tecnologia ultrapassaram o vestuário como segunda categoria mais oferecida. Carregadores sem fios, hubs USB-C e stands para telemóvel têm preços de custo controlados mas valor percebido elevado — o destinatário usa-os todos os dias e associa essa experiência positiva à empresa que os ofereceu.</p>

<h3>4. Kits curados em vez de produtos isolados</h3>
<p>A tendência mais clara de 2025 é a transição do produto único para o kit curado. Uma empresa que oferece um diário de couro, uma garrafa térmica e um tote bag coordenados — todos com a mesma paleta de cores e o mesmo nível de acabamento — transmite uma mensagem de cuidado que nenhum produto isolado consegue.</p>

<h3>5. Programas contínuos em vez de campanhas pontuais</h3>
<p>As organizações mais avançadas abandonaram o modelo "natal e anos de empresa" e criaram programas de gifting contínuos: welcome kits no onboarding, reconhecimentos de aniversário, prémios de performance trimestral e kits de offboarding. Este modelo distribui o orçamento ao longo do ano e multiplica os pontos de contacto positivos.</p>

<blockquote>
  "O presente corporativo mais poderoso não é o mais caro — é o mais relevante. Um kit de onboarding bem pensado tem impacto nos primeiros 90 dias de um colaborador muito maior do que um voucher genérico no Natal."
</blockquote>

<h2>Como definir o budget certo</h2>
<p>A regra empírica mais usada no mercado B2B português é 1–2% do custo anual de aquisição de talento para welcome kits e 0,5–1% da receita anual por cliente para gifting de relação. Na prática, os valores mais comuns são:</p>
<ul>
  <li>Welcome kits para colaboradores: €25–€80 por pessoa</li>
  <li>Presentes de cliente mid-market: €40–€150 por destinatário</li>
  <li>Gifting premium para contas estratégicas: €150–€500+</li>
  <li>Kits para eventos e conferências: €15–€45 por participante</li>
</ul>

<h2>O que pedir ao seu fornecedor</h2>
<p>Antes de avançar com qualquer encomenda, há quatro perguntas que deve colocar ao seu fornecedor:</p>
<ul>
  <li>Qual é o prazo de entrega garantido, e o que acontece se não for cumprido?</li>
  <li>Posso ver uma amostra física antes de aprovar a produção em série?</li>
  <li>Quais as certificações disponíveis para os materiais sustentáveis?</li>
  <li>Como é gerida a personalização — existe aprovação de arte-final antes de produzir?</li>
</ul>
<p>Um fornecedor sério responde a todas estas questões sem hesitar. A transparência no processo é tão importante quanto a qualidade do produto final.</p>
    `,
  },

  "onboarding-kits-melhores-praticas": {
    slug: "onboarding-kits-melhores-praticas",
    title: "Onboarding Kits: as melhores práticas das empresas top",
    excerpt:
      "Como as melhores empresas do mundo recebem novos colaboradores com experiências memoráveis.",
    category: "Branded Merch",
    date: "2025-01-08",
    author: "Equipa yourgift.pt",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=600&fit=crop",
    content: `
<h2>Os primeiros 90 dias definem tudo</h2>
<p>A investigação em gestão de recursos humanos é inequívoca: os primeiros 90 dias determinam em grande medida se um novo colaborador vai ficar na empresa a médio prazo. O onboarding não é apenas uma questão administrativa — é a primeira experiência real da cultura da empresa. E o kit de boas-vindas é o momento físico, tangível, em que essa cultura se materializa.</p>
<p>As empresas com os programas de onboarding mais bem avaliados em Portugal partilham uma característica comum: tratam o kit de boas-vindas como o primeiro presente de uma relação longa, não como um custo operacional a minimizar.</p>

<h2>Anatomia de um welcome kit de classe mundial</h2>

<h3>A embalagem importa tanto quanto o conteúdo</h3>
<p>O novo colaborador vai fotografar e partilhar o seu kit de onboarding. Empresas como Stripe, Notion e Remote constroem os seus kits com este facto em mente — a embalagem é parte integrante da experiência. Uma caixa magnética com o logótipo da empresa em debossing, interior em papel tissue na cor da marca, e um cartão de boas-vindas manuscrito cria um momento de unboxing que o colaborador vai recordar.</p>
<ul>
  <li>Caixa rígida ou magnética com branding discreto</li>
  <li>Interior forrado em tecido ou papel tissue na cor da marca</li>
  <li>Cartão de boas-vindas personalizado com o nome do colaborador</li>
  <li>Organização cuidada dos produtos dentro da caixa</li>
</ul>

<h3>Os produtos essenciais de um kit de nível A</h3>
<p>Há uma diferença clara entre um kit de nível B — funcional mas esquecível — e um kit de nível A, que o colaborador usa todos os dias e que reforça o orgulho de fazer parte da empresa. O nível A tem:</p>
<ul>
  <li><strong>Diário de qualidade:</strong> couro ou cobertura suave, papel de gramagem adequada. O colaborador vai usá-lo em reuniões durante meses.</li>
  <li><strong>Garrafa ou tumbler premium:</strong> o item de daily-carry com maior retorno de visibilidade.</li>
  <li><strong>Vestuário de qualidade real:</strong> não a t-shirt que encolhe na primeira lavagem. Uma hoodie em algodão pesado que a pessoa vai querer vestir ao fim de semana.</li>
  <li><strong>Acessório tecnológico:</strong> um carregador sem fios, um hub USB, ou um stand para telemóvel.</li>
</ul>

<blockquote>
  "Quando o novo colaborador abre o kit e pensa 'estes gajes têm mesmo atenção ao detalhe', já ganhámos metade da batalha do employer branding."
</blockquote>

<h2>Kits para trabalho remoto vs. presencial</h2>
<p>A normalização do trabalho híbrido criou duas realidades distintas no onboarding físico. O colaborador que vem ao escritório tem uma experiência diferente do que trabalha remotamente e recebe o kit por correio.</p>

<h3>Kit para equipas remotas</h3>
<p>O kit enviado por correio tem desafios logísticos adicionais — tem de sobreviver ao transporte sem danos, e a experiência de unboxing tem de compensar a ausência de um colega. Algumas empresas resolvem este problema enviando o kit com instruções para uma chamada de vídeo de boas-vindas no dia da abertura.</p>

<h3>Kit para espaços físicos</h3>
<p>No onboarding presencial, o kit pode ser mais volumoso. A solução ideal é deixar o kit na secretária antes do primeiro dia, para que a chegada ao espaço de trabalho já inclua esse momento de descoberta.</p>

<h2>Quanto investir por colaborador</h2>
<p>O investimento típico situa-se entre €40 e €120 por colaborador. A regra de ouro é comparar o custo do kit com o custo de substituir um colaborador que sai nos primeiros 6 meses — que tipicamente equivale a 50–200% do salário anual. Um kit de €80 é trivial nesse contexto.</p>
    `,
  },

  "company-stores-vantagens": {
    slug: "company-stores-vantagens",
    title: "Company Stores: porque é que as empresas estão a adotar",
    excerpt:
      "A tendência que está a transformar como as empresas gerem o merchandising interno.",
    category: "Company Stores",
    date: "2025-01-02",
    author: "Equipa yourgift.pt",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop",
    content: `
<h2>O que é uma Company Store e porque é que importa</h2>
<p>Uma Company Store é uma plataforma online privada onde os colaboradores, parceiros ou clientes de uma empresa podem encomendar produtos com a marca da organização. Pode ser tão simples como um catálogo com formulário de encomenda, ou tão sofisticada como uma loja de e-commerce completa com gestão de créditos e integração com sistemas de RH.</p>
<p>A adoção de company stores em Portugal acelerou significativamente desde 2023, impulsionada pela expansão de equipas remotas e pela necessidade de padronizar o branding em geografias múltiplas.</p>

<h2>Os problemas que uma Company Store resolve</h2>

<h3>Fragmentação de branding</h3>
<p>Sem uma loja centralizada, cada departamento encomenda ao fornecedor mais conveniente, resultando em t-shirts de qualidades diferentes e canecas com versões desatualizadas do logótipo. Uma company store garante que todos os produtos foram aprovados pela equipa de Marketing e estão alinhados com a identidade visual atual.</p>

<h3>Desperdício de tempo operacional</h3>
<p>Sem uma plataforma de self-service, as equipas de Operações ou RH recebem pedidos individuais, consolidam encomendas e coordenam entregas — um processo que consome dezenas de horas mensais. A company store transfere essa gestão para uma plataforma automatizada.</p>

<blockquote>
  "Antes da nossa company store, o processo de encomendar merchandising para um evento demorava 2 semanas e envolvia pelo menos 5 pessoas em e-mails diferentes. Agora o responsável entra na plataforma e em 48h tem confirmação de produção."
</blockquote>

<h2>Modelos de company store — qual escolher</h2>

<h3>Loja com stock físico</h3>
<p>A empresa mantém stock de produtos branded num armazém e os colaboradores encomendam a partir desse catálogo. Entrega rápida — tipicamente 24–48 horas — mas requer gestão de inventário.</p>

<h3>Loja com produção on-demand</h3>
<p>Não há stock permanente. Cada encomenda dispara uma ordem de produção e o produto é enviado diretamente. Eliminação total de inventário, mas lead times mais longos — tipicamente 7–14 dias.</p>

<h3>Modelo híbrido</h3>
<p>Os produtos de maior rotação estão em stock; produtos premium são produzidos on-demand. É o modelo mais equilibrado para a maioria das organizações com mais de 100 colaboradores.</p>

<h2>ROI de uma Company Store</h2>
<ul>
  <li><strong>Poupança operacional:</strong> redução de 20–40 horas mensais de gestão interna em empresas com 200+ colaboradores.</li>
  <li><strong>Poupança em compras:</strong> volume consolidado permite negociar 15–25% de redução face ao modelo disperso.</li>
  <li><strong>Valor de branding:</strong> consistência visual em todos os pontos de contacto tem impacto mensurável em NPS de colaboradores e clientes.</li>
</ul>
<p>Para a maioria das empresas com mais de 50 colaboradores e gastos anuais em merchandising acima de €10.000, a implementação paga-se em menos de 12 meses.</p>
    `,
  },

  "branded-merch-tendencias-2025": {
    slug: "branded-merch-tendencias-2025",
    title: "Branded Merch: 7 tendências que vão dominar 2025",
    excerpt:
      "Das colaborações com artistas locais ao drop-model para colaboradores, estas são as tendências que definem o branded merch este ano.",
    category: "Branded Merch",
    date: "2025-01-20",
    author: "Equipa yourgift.pt",
    readTime: "7 min",
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=1200&h=600&fit=crop",
    content: `
<h2>O merch corporativo cresceu — e ficou mais exigente</h2>
<p>O branded merchandise deixou de ser um subproduto do departamento de marketing e passou a ser uma extensão estratégica da identidade da marca. Em 2025, as empresas mais avançadas tratam o merch com a mesma seriedade com que tratam o design do produto ou a experiência do cliente. O resultado é um mercado mais criativo, mais exigente e — para quem está atento — cheio de oportunidades.</p>

<h2>Tendência 1: Drop culture para equipas internas</h2>
<p>Inspirado pelo modelo streetwear de lançamentos limitados e exclusivos, várias empresas tech adotaram o drop-model para distribuição de merch interno: em vez de um catálogo permanente, fazem lançamentos trimestrais de coleções limitadas, criando um sentido de antecipação e exclusividade que eleva o valor percebido de cada peça.</p>

<h2>Tendência 2: Colaborações com artistas e criativos locais</h2>
<p>Empresas como startups de Lisboa e Porto estão a comissionar artistas locais para criar designs exclusivos para o seu merch. O resultado é duplo: um produto verdadeiramente único e uma narrativa autêntica sobre os valores da empresa. Esta tendência conecta a marca a uma comunidade criativa e diferencia radicalmente o merch de qualquer concorrente.</p>

<h2>Tendência 3: Peças de vestuário que as pessoas querem usar fora do trabalho</h2>
<p>A questão chave no vestuário de merch é simples: o colaborador usaria esta peça ao fim de semana, sem a marca da empresa? Se a resposta for não, a peça não é boa o suficiente. As empresas que entendem isto investem em cortes contemporâneos, tecidos premium e designs que funcionam além do contexto profissional.</p>

<blockquote>
  "O melhor merch é o que as pessoas pedem para ter, não o que lhes é imposto. Quando os colaboradores mostram orgulho em usar a marca fora do trabalho, o valor do employer branding é incalculável."
</blockquote>

<h2>Tendência 4: Embalagem como experiência</h2>
<p>A entrega de merch evoluiu de simples envio postal para um momento de brand experience. Caixas personalizadas, papel tissue em cores da marca, cartões manuscritos e pequenos extras surpresa transformam a abertura de uma encomenda num evento partilhável.</p>

<h2>Tendência 5: Merch funcional e tecnológico</h2>
<p>Produtos que o utilizador usa ativamente todos os dias têm um ROI de visibilidade muito superior a objetos decorativos. Carregadores sem fios, garrafas térmicas inteligentes e organizadores de secretária com branding discreto são os produtos com maior taxa de uso real.</p>

<h2>Tendência 6: Personalização individual em escala</h2>
<p>A tecnologia de impressão evoluiu ao ponto de ser economicamente viável personalizar cada unidade com o nome do destinatário, a sua equipa ou um campo específico — mesmo em volumes de 50 a 500 unidades. Esta personalização transforma um produto de marca numa peça pessoal com ligação emocional.</p>

<h2>Tendência 7: Merch como ferramenta de recrutamento</h2>
<p>Empresas em crescimento enviam kits de merch premium a candidatos finalistas mesmo antes de receberem uma oferta de emprego. A lógica é simples: transmite cultura, diferencia a empresa de outros empregadores e cria um ponto de contacto positivo antes da decisão. É employer branding no momento mais crítico do processo de recrutamento.</p>
    `,
  },

  "packaging-premium-impacto-marca": {
    slug: "packaging-premium-impacto-marca",
    title: "Porque o packaging premium aumenta o valor percebido da marca em 40%",
    excerpt:
      "Estudos de neuromarketing confirmam: a embalagem influencia a perceção do produto antes de qualquer interação.",
    category: "Packaging",
    date: "2025-01-25",
    author: "Equipa yourgift.pt",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&h=600&fit=crop",
    content: `
<h2>A embalagem é a primeira impressão — e a última memória</h2>
<p>Estudos de neuromarketing demonstram consistentemente que o packaging influencia a perceção de valor de um produto em 30 a 40% antes de qualquer interação com o produto em si. A textura, o peso, o som ao abrir, o cheiro do cartão — todos estes estímulos sensoriais comunicam qualidade ou a falta dela de forma imediata e visceral.</p>
<p>No contexto de corporate gifting e branded merchandise, este princípio é ainda mais crítico: a embalagem é muitas vezes o primeiro ponto de contacto físico que um colaborador ou cliente tem com a sua marca. O que comunica essa embalagem define o enquadramento de tudo o que vem depois.</p>

<h2>Os elementos de uma embalagem premium</h2>

<h3>Material e acabamento</h3>
<p>A diferença entre uma caixa de €0,80 e uma de €3,50 é imediatamente perceptível ao toque. Cartão de 2mm com revestimento soft-touch, magnetos para fecho sem velcro, cantos reforçados com perfil metálico — são detalhes de custo marginal baixo mas impacto de perceção alto.</p>
<ul>
  <li><strong>Soft-touch lamination:</strong> transforma qualquer caixa num objeto de desejo ao toque</li>
  <li><strong>Debossing e foil stamping:</strong> o logótipo em relevo ou metalizado comunica luxo sem excesso</li>
  <li><strong>Caixas magnéticas:</strong> o som do fecho magnético é um detalhe sensorial que eleva a experiência</li>
  <li><strong>Interior estruturado:</strong> suportes de EVA ou cartão moldam o espaço e evitam que os produtos se movam</li>
</ul>

<h3>Cor e tipografia</h3>
<p>O interior de uma embalagem é frequentemente negligenciado — mas é o que o destinatário vê primeiro ao abrir. Forrar o interior com papel tissue na cor secundária da marca, ou usar um padrão sutil no papel de fundo, cria uma consistência visual que reforça a identidade da empresa.</p>

<blockquote>
  "Numa experiência de gifting premium, o primeiro sentimento acontece antes do produto ser visto. A embalagem conta a história de quem somos e do quanto nos importamos com quem recebe."
</blockquote>

<h2>O erro mais comum no packaging corporativo</h2>
<p>O erro mais frequente é tratar a embalagem como um custo a minimizar e não como um investimento em perceção de marca. Empresas que gastam €80 por kit de onboarding e colocam tudo numa caixa de cartão genérica desperdiçam 30–40% do impacto potencial. O custo incremental de uma embalagem premium — tipicamente €3–8 por unidade — tem um retorno de perceção desproporcional.</p>

<h2>Packaging sustentável sem comprometer o premium</h2>
<p>A boa notícia é que sustentabilidade e premium não são mutuamente exclusivos. Cartão reciclado com certificação FSC tem um toque e aparência idênticos ao cartão virgem. Tintas à base de água produzem acabamentos de qualidade equivalente às tintas com solventes. E uma embalagem reutilizável — que o destinatário guarda para outros fins — tem um valor de perceção ainda maior do que uma caixa descartável.</p>
    `,
  },

  "fulfillment-b2b-guia": {
    slug: "fulfillment-b2b-guia",
    title: "Fulfillment B2B: tudo o que uma empresa precisa de saber",
    excerpt:
      "Pick & pack, last-mile, gestão de devoluções e integração com ERPs — o guia completo para quem quer escalar a operação de merchandising.",
    category: "Fulfillment",
    date: "2025-02-01",
    author: "Equipa yourgift.pt",
    readTime: "9 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=600&fit=crop",
    content: `
<h2>O que é fulfillment B2B e porque difere do B2C</h2>
<p>O fulfillment B2B — o conjunto de operações de armazenagem, embalagem e expedição de produtos para destinatários empresariais — tem características distintas do fulfillment de retalho. Os volumes são mais baixos mas mais complexos: cada encomenda pode ter personalização diferente, requisitos de embalagem específicos, e destinos que vão do escritório central ao domicílio de um colaborador remoto.</p>
<p>Para empresas que gerem programas de onboarding, corporate gifting ou company stores, o fulfillment é muitas vezes o ponto de falha mais crítico — e o menos visível até algo correr mal.</p>

<h2>Os componentes do fulfillment B2B</h2>

<h3>Receção e armazenagem</h3>
<p>O processo começa com a receção do stock de produtos personalizados ou em branco. Um bom parceiro de fulfillment faz a contagem de qualidade na receção, identifica produtos não conformes e reporta imediatamente. O armazenamento deve garantir condições adequadas para cada tipo de produto — temperatura, humidade e proteção contra danos.</p>

<h3>Pick & Pack</h3>
<p>O pick & pack é a operação de selecionar os produtos de cada encomenda e embalar de acordo com as especificações. No contexto de corporate gifting, isto inclui frequentemente: montar uma caixa específica, colocar produtos numa ordem pré-definida, incluir cartão personalizado com o nome do destinatário, e fechar a embalagem com os acabamentos correctos.</p>

<blockquote>
  "O nosso maior desafio era a variabilidade: cada onboarding kit levava o nome do colaborador, a cidade, e às vezes até uma mensagem do gestor. Até encontrarmos um parceiro com sistemas para lidar com isso, fazíamos tudo manualmente."
</blockquote>

<h3>Last-mile delivery</h3>
<p>A entrega final é o momento em que toda a operação é julgada pelo destinatário. Para envios para escritórios, a entrega standard com rastreio funciona bem. Para envios para domicílio — cada vez mais comuns com equipas remotas — é crítico trabalhar com transportadoras que garantam entregas em janelas horária e que tratem embalagens premium com o cuidado adequado.</p>

<h2>Integração com sistemas da empresa</h2>
<p>O fulfillment moderno não pode depender de e-mails e spreadsheets. As integrações que mais impacto têm são:</p>
<ul>
  <li><strong>HRIS (Workday, BambooHR, Factorial):</strong> trigger automático de onboarding kit quando um novo colaborador é criado no sistema</li>
  <li><strong>CRM (Salesforce, HubSpot):</strong> envio automático de gifting quando um deal atinge determinada fase ou um cliente celebra aniversário</li>
  <li><strong>Company store:</strong> cada encomenda na loja interna dispara automaticamente o processo de fulfillment</li>
  <li><strong>ERP:</strong> reconciliação automática de stock e custos por centro de custo</li>
</ul>

<h2>Métricas de fulfillment que importam</h2>
<ul>
  <li><strong>Order accuracy rate:</strong> percentagem de encomendas expedidas sem erros. Referência de excelência: &gt;99,5%</li>
  <li><strong>On-time delivery rate:</strong> percentagem de encomendas entregues no prazo prometido. Referência: &gt;97%</li>
  <li><strong>Damage rate:</strong> percentagem de produtos chegados danificados. Referência: &lt;0,5%</li>
  <li><strong>Return processing time:</strong> tempo médio para processar uma devolução. Referência: &lt;48h</li>
</ul>

<h2>Como escolher um parceiro de fulfillment</h2>
<p>Os critérios mais importantes na seleção de um parceiro são: capacidade de lidar com personalização individual (cartões por nome, inserções variáveis), integração com os seus sistemas, transparência no inventário em tempo real, e experiência com produtos premium (para garantir o manuseamento adequado). Solicite sempre uma visita ao armazém antes de assinar qualquer contrato — as condições físicas dizem muito sobre a qualidade da operação.</p>
    `,
  },

  "roi-corporate-gifting": {
    slug: "roi-corporate-gifting",
    title: "O ROI do Corporate Gifting: números reais de 200 empresas",
    excerpt:
      "Analisámos 200 programas de corporate gifting em Portugal e Espanha. Os resultados mostram um retorno médio de 3,4x sobre o investimento.",
    category: "Corporate Gifts",
    date: "2025-02-08",
    author: "Equipa yourgift.pt",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&h=600&fit=crop",
    content: `
<h2>O problema da justificação de budget em gifting</h2>
<p>Muitos responsáveis de Recursos Humanos e Marketing enfrentam o mesmo desafio: sabem intuitivamente que o corporate gifting tem valor, mas lutam para quantificá-lo perante um CFO que exige métricas concretas. Este artigo apresenta os dados reais de 200 programas analisados em Portugal e Espanha entre 2023 e 2024.</p>

<h2>Metodologia da análise</h2>
<p>Analisámos 200 empresas com programas ativos de corporate gifting, com investimentos anuais entre €5.000 e €250.000. Os dados foram recolhidos através de questionários diretos a decisores de RH e Marketing, complementados com métricas disponíveis em sistemas de RH e CRM.</p>

<h2>Resultados por categoria de gifting</h2>

<h3>Welcome kits para onboarding</h3>
<p>Este é o caso de ROI mais sólido do estudo. Empresas com programas de onboarding com kit físico premium reportam:</p>
<ul>
  <li>Redução de 23% na taxa de abandono nos primeiros 90 dias</li>
  <li>NPS de onboarding 34 pontos superior à média do setor</li>
  <li>Retorno médio calculado: 4,8x (considerando custo de substituição de colaboradores)</li>
</ul>

<h3>Corporate gifting para clientes</h3>
<p>O gifting de relação com clientes apresenta resultados mais variáveis, dependendo fortemente da qualidade e relevância do presente. Os melhores resultados foram alcançados por programas com personalização alta e frequência trimestral:</p>
<ul>
  <li>Aumento médio de 18% na taxa de renovação de contratos</li>
  <li>Redução de 12% no churn anual</li>
  <li>Retorno médio calculado: 3,1x sobre o investimento em gifting</li>
</ul>

<blockquote>
  "Antes de instituirmos o programa de gifting trimestral, a nossa taxa de renovação rondava os 72%. No ano seguinte, subiu para 85%. Não posso atribuir tudo ao gifting — mas é difícil ignorar a correlação."
</blockquote>

<h3>Gifting para reconhecimento de performance</h3>
<p>Os programas de reconhecimento com componente física têm impacto documentado em engagement. Empresas com reconhecimento físico trimestral reportam:</p>
<ul>
  <li>Aumento de 15–22% em scores de engagement interno</li>
  <li>Redução de 8% na intenção de abandono reportada em surveys</li>
</ul>

<h2>Os fatores que determinam o ROI</h2>
<p>A diferença entre um programa de gifting com ROI de 1,5x e um com 4,8x não está no valor gasto — está em três fatores:</p>
<ul>
  <li><strong>Relevância:</strong> o presente é adequado ao destinatário e ao momento? Um kit genérico para todos tem impacto muito inferior a um kit que demonstra conhecimento do destinatário.</li>
  <li><strong>Timing:</strong> o gifting no momento certo (onboarding, aniversário, renovação de contrato) tem impacto múltiplo face ao gifting sem contexto.</li>
  <li><strong>Qualidade e apresentação:</strong> programas com produtos premium e packaging cuidado têm ROI consistentemente superior. A diferença de custo entre um kit mediano e um premium é tipicamente €20–40; a diferença de impacto é muito maior.</li>
</ul>

<h2>Como medir o ROI do seu programa</h2>
<p>As métricas mais práticas para medir o retorno de um programa de corporate gifting são: taxa de retenção de colaboradores nos primeiros 12 meses, NPS de onboarding, taxa de renovação de clientes, e resultados de surveys de engagement interno. Estabeleça uma baseline antes de implementar o programa e meça aos 6 e 12 meses.</p>
    `,
  },

  "merch-sustentavel-b2b": {
    slug: "merch-sustentavel-b2b",
    title: "Merch sustentável: como escolher fornecedores com impacto real",
    excerpt:
      "Greenwashing ou impacto genuíno? Ensinamos a distinguir certificações reais de marketing vazio, e como auditar a cadeia de fornecimento.",
    category: "Sustentabilidade",
    date: "2025-02-15",
    author: "Equipa yourgift.pt",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1542601906897-ecd9073b3cf0?w=1200&h=600&fit=crop",
    content: `
<h2>O problema do greenwashing no merch corporativo</h2>
<p>O mercado de merch sustentável está cheio de promessas que não resistem a uma análise mais aprofundada. "Eco-friendly", "verde", "sustentável" — estas palavras aparecem em catálogos de fornecedores sem qualquer substância por detrás. Para as empresas que genuinamente querem reduzir o impacto ambiental do seu merchandising, a desinformação é um obstáculo real.</p>
<p>Este artigo é um guia prático para distinguir certificações reais de marketing vazio, e para fazer as perguntas certas antes de assinar com um fornecedor.</p>

<h2>Certificações que importam (e o que significam)</h2>

<h3>Para têxteis: GOTS e OEKO-TEX</h3>
<p>A certificação GOTS (Global Organic Textile Standard) é o padrão mais exigente para têxteis orgânicos — cobre toda a cadeia de produção, desde a agricultura do algodão até ao produto acabado. A certificação OEKO-TEX Standard 100 garante que o produto acabado não contém substâncias nocivas. Para vestuário de merch, exigir uma destas certificações é o mínimo para poder fazer afirmações de sustentabilidade credíveis.</p>

<h3>Para papel e embalagem: FSC e Cradle to Cradle</h3>
<p>A certificação FSC (Forest Stewardship Council) garante que o papel e madeira provêm de florestas geridas de forma responsável. A certificação Cradle to Cradle vai mais longe, avaliando reciclabilidade, conteúdo de materiais reciclados e práticas de produção. Para diários, embalagens e materiais impressos, FSC deve ser o padrão mínimo.</p>

<h3>Para produtos em geral: B Corp</h3>
<p>Fornecedores com certificação B Corp passaram por uma auditoria independente rigorosa dos seus impactos ambientais e sociais. Não é uma garantia de que cada produto é sustentável, mas é um indicador forte de que a empresa tem práticas sérias e transparentes.</p>

<blockquote>
  "A pergunta que fazemos a todos os fornecedores é simples: mostra-me a documentação. Certificações reais vêm com números de certificado verificáveis. Quando o fornecedor hesita, temos a resposta que precisamos."
</blockquote>

<h2>Perguntas que deve fazer ao fornecedor</h2>
<ul>
  <li>Qual é a percentagem real de material reciclado ou orgânico neste produto?</li>
  <li>Qual é o número de certificado e como posso verificar a sua validade?</li>
  <li>Qual é a pegada de carbono estimada deste produto, incluindo transporte?</li>
  <li>Qual é a política de compensação de carbono da empresa?</li>
  <li>As tintas e corantes utilizados são à base de água ou têm solventes?</li>
</ul>

<h2>Materiais sustentáveis com melhor desempenho em merch corporativo</h2>
<ul>
  <li><strong>Algodão orgânico GOTS:</strong> excelente para vestuário. Textura idêntica ao algodão convencional mas sem pesticidas.</li>
  <li><strong>RPET (poliéster reciclado de garrafas PET):</strong> ideal para sacos, mochilas e alguns acessórios. 1 garrafa PET = matéria-prima para ~1 t-shirt.</li>
  <li><strong>Bambú:</strong> renovável, biodegradável, excelente para canetas, artigos de secretária e alguns têxteis.</li>
  <li><strong>Cartão FSC com tintas vegetais:</strong> para embalagem e material impresso.</li>
  <li><strong>Cortiça portuguesa:</strong> material de excelência para acessórios premium — renovável, biodegradável e com uma narrativa de origem local poderosa.</li>
</ul>
    `,
  },

  "welcome-kit-perfeito": {
    slug: "welcome-kit-perfeito",
    title: "Como criar o welcome kit perfeito para novos colaboradores",
    excerpt:
      "Da escolha de produtos à embalagem e personalização — um guia passo a passo para criar uma primeira impressão inesquecível.",
    category: "Corporate Gifts",
    date: "2025-02-22",
    author: "Equipa yourgift.pt",
    readTime: "7 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&h=600&fit=crop",
    content: `
<h2>O welcome kit como declaração de intenções</h2>
<p>O welcome kit não é apenas um conjunto de produtos úteis para o primeiro dia — é a primeira declaração física de quem é a empresa, o que valoriza, e como trata as suas pessoas. Um kit bem concebido comunica tudo isto em segundos, antes de qualquer palavra ser dita.</p>
<p>Neste guia, percorremos cada etapa do processo de criação de um welcome kit de nível A — da estratégia inicial à entrega final.</p>

<h2>Etapa 1: Definir a estratégia e o budget</h2>
<p>Antes de escolher qualquer produto, é necessário responder a três perguntas: Quem recebe este kit? (todos os colaboradores, ou diferenciado por nível/departamento?) Qual é o orçamento por pessoa? Qual é o principal objetivo — transmitir cultura, fornecer ferramentas de trabalho, ou criar um momento de brand experience?</p>
<p>Os intervalos de budget mais comuns em Portugal são €40–€60 para empresas de crescimento, €60–€100 para tech e consultoria, e €100–€200+ para empresas que fazem do onboarding experience uma vantagem competitiva de recrutamento.</p>

<h2>Etapa 2: Selecionar os produtos certos</h2>
<p>A seleção de produtos deve equilibrar três critérios: utilidade diária (o colaborador vai usar?), qualidade percebida (reflete bem a empresa?), e coerência estética (os produtos funcionam bem juntos?). Os produtos com maior retorno de impacto são:</p>
<ul>
  <li><strong>Diário ou caderno premium:</strong> usado em reuniões, visível para toda a equipa</li>
  <li><strong>Garrafa ou tumbler com branding:</strong> o item de maior visibilidade fora do escritório</li>
  <li><strong>Hoodie ou t-shirt premium:</strong> a peça de vestuário que o colaborador vai querer usar</li>
  <li><strong>Acessório tech:</strong> carregador sem fios, hub ou stand para telemóvel</li>
  <li><strong>Extras personalizados:</strong> snack local, cartão manuscrito, ou item surpresa</li>
</ul>

<h2>Etapa 3: A embalagem como experiência</h2>
<p>A caixa é a primeira coisa que o colaborador vê e toca. Uma caixa magnética com o logótipo em debossing, interior forrado em papel tissue na cor da marca, e cartão de boas-vindas personalizado com o nome da pessoa transformam a abertura do kit num momento memorável e partilhável.</p>

<blockquote>
  "O nosso primeiro welcome kit era uma caixa de cartão marrom com produtos a granel. A primeira foto que apareceu no LinkedIn foi de um novo colaborador com a nossa nova caixa premium. Percebemos imediatamente o valor do investimento."
</blockquote>

<h2>Etapa 4: Personalização e mensagem</h2>
<p>O elemento que mais diferencia um kit premium é a personalização individual. No mínimo, isso significa um cartão com o nome do colaborador. No nível seguinte, inclui o nome gravado num dos produtos (diário ou garrafa). No nível de excelência, inclui uma mensagem personalizada do gestor direto e referências específicas ao contexto da pessoa.</p>

<h2>Etapa 5: Logística e escalabilidade</h2>
<p>Um welcome kit excelente que chega atrasado ou danificado perde todo o impacto. A logística é tão crítica quanto o conteúdo. Para empresas em crescimento, a solução mais eficiente é trabalhar com um parceiro de fulfillment que: mantém stock dos produtos, monta o kit com as personalizações necessárias, e expede diretamente para o endereço do colaborador (seja o escritório ou o domicílio) assim que recebe o trigger do HRIS.</p>
    `,
  },

  "estrategia-merch-eventos": {
    slug: "estrategia-merch-eventos",
    title: "Estratégia de merch para eventos: maximize o impacto da presença",
    excerpt:
      "Como transformar a sua participação num evento numa oportunidade de branding de longa duração — antes, durante e depois do evento.",
    category: "Branded Merch",
    date: "2025-03-01",
    author: "Equipa yourgift.pt",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=600&fit=crop",
    content: `
<h2>O erro mais comum no merch para eventos</h2>
<p>A maioria das empresas aborda o merch para eventos de forma reativa: encomenda os produtos com pouco tempo, escolhe o que está disponível no catálogo do fornecedor, e distribui tudo na entrada ou stand. O resultado é previsível: sacolas plásticas com pens e post-its que vão diretamente para o caixote do lixo no hotel.</p>
<p>As empresas que extraem valor real do merch em eventos pensam de forma diferente: o merch é uma ferramenta de branding contínuo, não um brinde descartável.</p>

<h2>Antes do evento: criar antecipação</h2>
<p>Algumas das estratégias mais eficazes de merch para eventos começam antes do evento em si. Enviar um "preview kit" para os participantes confirmados — com um item de qualidade e uma mensagem de "até já" — cria antecipação, aumenta a taxa de comparência e estabelece um ponto de contacto positivo antes do primeiro aperto de mão.</p>

<h2>Durante o evento: criar valor, não volume</h2>
<p>A tentação de distribuir o máximo de produtos para o máximo de pessoas é o caminho para o merch descartável. A abordagem contrária — menos produtos, mais qualidade, distribuição seletiva — gera mais valor de marca.</p>
<ul>
  <li><strong>Tier 1 (todos os visitantes):</strong> um item útil e compacto que não vai para o lixo — bloco de notas premium, stick de lábios com SPF, ou cartão de acesso a conteúdo digital</li>
  <li><strong>Tier 2 (conversas qualificadas):</strong> produto de qualidade média-alta — tumbler, tote bag ou acessório tech</li>
  <li><strong>Tier 3 (leads estratégicos):</strong> kit premium curado, embalado individualmente, entregue em mão com intenção</li>
</ul>

<blockquote>
  "Deixámos de tentar distribuir tudo a todos. Passámos a ter três níveis de merch e a entregar o kit premium apenas a quem tivemos uma conversa real. O impacto multiplicou — e o custo total reduziu."
</blockquote>

<h2>Produtos com maior ROI em eventos</h2>
<p>Com base nos dados de rastreamento de marca em eventos, os produtos com maior taxa de uso continuado após o evento são:</p>
<ul>
  <li>Garrafas e tumblers (usados diariamente, visíveis a terceiros)</li>
  <li>Cadernos e diários premium (usados profissionalmente, alta visibilidade)</li>
  <li>Carregadores portáteis e acessórios tech (utilitários de alta necessidade)</li>
  <li>Vestuário de qualidade (used on a daily basis se o design for bom)</li>
</ul>

<h2>Depois do evento: prolongar o impacto</h2>
<p>O follow-up pós-evento é onde a maioria das empresas deixa valor na mesa. Enviar um segundo ponto de contacto — um cartão de agradecimento com um item simbólico, ou uma oferta digital — dentro de 48 horas do evento mantém a marca presente no momento de maior receptividade. Combines este envio com uma mensagem personalizada e terá criado um sistema de nurturing que a maioria dos concorrentes não faz.</p>
    `,
  },

  "comparar-fornecedores-merch": {
    slug: "comparar-fornecedores-merch",
    title: "7 critérios para comparar fornecedores de merch e não se arrepender",
    excerpt:
      "Preço, qualidade, prazo, amostras, certificações, capacidade de escala e suporte — o checklist definitivo antes de assinar qualquer contrato.",
    category: "Guias",
    date: "2025-03-08",
    author: "Equipa yourgift.pt",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=1200&h=600&fit=crop",
    content: `
<h2>Porque é que escolher o fornecedor errado custa caro</h2>
<p>Escolher um fornecedor de merchandising com base apenas no preço é um dos erros mais comuns — e mais caros — que uma empresa pode cometer. O custo real de um fornecedor que atrasa entregas, entrega produtos de qualidade inferior ao aprovado, ou falha na personalização vai muito além do valor da encomenda: inclui o tempo perdido a resolver problemas, o impacto de marca de produtos que chegam com defeito, e muitas vezes a necessidade de refazer toda a produção com prazo urgente.</p>
<p>Este guia apresenta os 7 critérios que deve usar para comparar fornecedores — e as perguntas exatas que deve fazer antes de avançar.</p>

<h2>Critério 1: Qualidade e amostras físicas</h2>
<p>Nunca aprove uma produção em série sem ver e aprovar uma amostra física. Ponto final. Um fornecedor que resiste a enviar amostras está a esconder alguma coisa. A amostra deve ser produzida com os mesmos materiais, técnicas de personalização e acabamentos da produção final. Avalie: textura, peso, cor face ao ficheiro aprovado, durabilidade dos acabamentos, e qualidade da embalagem.</p>

<h2>Critério 2: Prazos e garantias de entrega</h2>
<p>O prazo mais importante não é o prazo médio — é o prazo garantido. Pergunte: "O que acontece se não cumprirem o prazo prometido?" Um fornecedor sério tem políticas claras de compensação ou re-produção urgente sem custo adicional. Verifique também a capacidade de produção em período de pico (outubro–dezembro é crítico para o mercado de gifting).</p>

<h2>Critério 3: Capacidade de personalização</h2>
<p>Nem todos os fornecedores têm as mesmas capacidades de personalização. Verifique se o fornecedor tem capacidade para: gravação laser, debossing, UV printing a cores, bordados para vestuário, e personalização individual (nome por unidade). Para programas de onboarding com centenas de colaboradores, a capacidade de personalizar individualmente a escala é crítica.</p>

<blockquote>
  "O critério que mais nos surpreendeu na importância foi o suporte durante o processo. Quando surgiu um problema com uma cor na produção, o nosso fornecedor avisou-nos imediatamente, apresentou opções e resolveu sem drama. Isso vale mais do que o preço mais baixo."
</blockquote>

<h2>Critério 4: Certificações e sustentabilidade</h2>
<p>Se a sustentabilidade é um valor real da sua empresa, exija documentação. Peça os números de certificado FSC, GOTS ou OEKO-TEX e verifique a validade online. Pergunte sobre a pegada de carbono dos produtos e sobre políticas de compensação. Um fornecedor que faz afirmações de sustentabilidade sem poder documentar deve ser tratado com ceticismo.</p>

<h2>Critério 5: Capacidade de escala</h2>
<p>O seu fornecedor atual consegue responder se o vosso volume triplicar? Pergunte qual é o volume máximo que conseguem processar por mês, quais são os mínimos de encomenda para os diferentes produtos, e como gerem picos de procura. Para programas de empresa em crescimento, a escalabilidade do fornecedor é um fator crítico a longo prazo.</p>

<h2>Critério 6: Transparência no processo de arte-final</h2>
<p>O processo de aprovação de arte-final é onde muitos problemas nascem. Um bom fornecedor tem um processo claro: submissão de ficheiro, revisão técnica, envio de mockup digital, aprovação formal, e só então produção. Desconfie de fornecedores que avançam para produção sem uma aprovação formal documentada.</p>

<h2>Critério 7: Suporte e comunicação</h2>
<p>A qualidade do suporte é só visível quando algo corre mal — que inevitavelmente vai acontecer. Teste o fornecedor com perguntas antes de contratar: tempo de resposta, clareza das respostas, disponibilidade de um interlocutor fixo para a vossa conta. Um fornecedor que demora 3 dias a responder a um email de prospeto vai demorar o mesmo quando há um problema urgente de produção.</p>
    `,
  },

  "drinkware-branding": {
    slug: "drinkware-branding",
    title: "Drinkware com branding: o produto que mais aparece no dia a dia",
    excerpt:
      "Garrafas, tumblers e canecas com a sua marca viajam para reuniões, ginásios e cafés. Saiba como escolher o produto certo para o seu público.",
    category: "Branded Merch",
    date: "2025-03-15",
    author: "Equipa yourgift.pt",
    readTime: "4 min",
    image:
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=1200&h=600&fit=crop",
    content: `
<h2>O produto de merch com maior retorno de visibilidade</h2>
<p>Se há um produto de branded merchandise que justifica o investimento de forma consistente, é o drinkware. Garrafas térmicas, tumblers e canecas premium acompanham o utilizador para reuniões, conferências, ginásios, cafés e transportes públicos — gerando impressões de marca repetidas, diárias e em contextos de alta visibilidade.</p>
<p>Estudos de eficácia de merch mostram que o drinkware de qualidade é usado uma média de 5,7 dias por semana durante 14 meses — um retorno de impressões por euro investido que nenhum outro produto de merch consegue igualar.</p>

<h2>Os três tipos de drinkware e quando usar cada um</h2>

<h3>Garrafa térmica (inox)</h3>
<p>A garrafa térmica em aço inoxidável é o produto de drinkware com maior valor percebido e maior longevidade. Marcas como Hydro Flask e S'well estabeleceram um padrão de expectativa que os produtos de marca B2B precisam de corresponder. Capacidade de 500–750ml, paredes duplas com vácuo, tampa de rosca ou flip — estes são os detalhes que fazem a diferença entre uma garrafa que o colaborador usa todos os dias e uma que fica no armário.</p>

<h3>Tumbler para bebidas quentes e frias</h3>
<p>O tumbler é o produto que mais cresceu no mercado de drinkware nos últimos dois anos, impulsionado pela tendência dos Stanley Cups e similares. Capacidade de 350–600ml, design para bebidas quentes e frias, pega confortável — é o produto mais versátil da categoria e o que mais frequentemente aparece em fotografias partilhadas nas redes sociais.</p>

<h3>Caneca premium para uso em escritório</h3>
<p>A caneca de porcelana ou cerâmica de alta gramagem é o clássico do drinkware corporativo — mas a diferença entre uma caneca genérica de €2 e uma caneca de design premium de €12 é imediatamente percetível. Gramagem mínima recomendada: 400g. Acabamento mate ou com textura tátil. Impressão sublimação para cores, ou silkscreen para designs a cor única.</p>

<blockquote>
  "Quando distribuímos garrafas térmicas de qualidade no onboarding, começámos a vê-las em reuniões de clientes, eventos da indústria e fotos de LinkedIn. O retorno de visibilidade de marca foi imediato e contínuo."
</blockquote>

<h2>Técnicas de personalização para drinkware</h2>
<ul>
  <li><strong>Gravação laser:</strong> para inox e vidro — cria uma marca permanente, subtil e premium. Ideal para logótipos simples e texto.</li>
  <li><strong>Powder coating com impressão:</strong> para garrafas inox — permite cores personalizadas na superfície exterior com impressão UV por cima.</li>
  <li><strong>Wrap printing:</strong> para tumblers e copos — impressão que envolve 360° o produto, permite designs complexos e a cores.</li>
  <li><strong>Silkscreen:</strong> para canecas e garrafas — económico para volumes médios-altos, ideal para designs a 1–3 cores.</li>
</ul>

<h2>Como escolher o produto certo para o seu público</h2>
<p>O critério mais importante na seleção de drinkware é o estilo de vida do destinatário. Para equipas jovens em empresas tech ou startups, o tumbler ou garrafa de design contemporâneo vai ao encontro dos seus hábitos. Para equipas mais sénior ou em contextos mais formais, uma garrafa térmica de design clean ou uma caneca premium de escritório tem maior adequação. O erro mais comum é escolher com base no preço sem considerar se o produto se encaixa no quotidiano do utilizador.</p>
    `,
  },
};

const ALL_POSTS = Object.values(POSTS);

export async function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) return {};
  return constructMetadata({
    title: post.title,
    description: post.excerpt,
    canonical: `/blog/${slug}`,
    keywords: [
      post.category.toLowerCase(),
      "corporate gifting",
      "branding B2B",
      "merchandising empresas",
    ],
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) notFound();

  const relatedPosts = ALL_POSTS.filter(
    (p) => p.slug !== slug && p.category === post.category
  ).slice(0, 3);

  const fallbackRelated = ALL_POSTS.filter((p) => p.slug !== slug).slice(0, 3);
  const displayRelated = relatedPosts.length > 0 ? relatedPosts : fallbackRelated;

  const categoryColor =
    CATEGORY_COLORS[post.category] ??
    "text-[#4DA3FF] border-[#4DA3FF]/25 bg-[#4DA3FF]/10";

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Hero image full width with gradient overlay */}
      <div className="relative w-full h-64 md:h-96 overflow-hidden mb-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/40 to-transparent" />
        {/* Breadcrumb overlay */}
        <div className="absolute top-6 left-0 right-0 max-w-7xl mx-auto px-6 md:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/50">
            <Link href="/" className="hover:text-white/80 transition-colors">
              Home
            </Link>
            <span className="text-white/24">/</span>
            <Link href="/blog" className="hover:text-white/80 transition-colors">
              Blog
            </Link>
            <span className="text-white/24">/</span>
            <span className="text-white/70 line-clamp-1">{post.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 items-start">
          {/* Main content */}
          <div className="min-w-0">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors mb-8 mt-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao blog
            </Link>

            {/* Category badge */}
            <div className="mb-4">
              <span
                className={`inline-block px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-[0.12em] ${categoryColor}`}
              >
                {post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-white mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Author row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/40 mb-8 pb-8 border-b border-white/[0.07]">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime} leitura
              </span>
              {/* Share buttons (visual only) */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                  aria-label="Partilhar no LinkedIn"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                  aria-label="Partilhar no Twitter"
                >
                  <Twitter className="h-3.5 w-3.5" />
                  Twitter
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                  aria-label="Copiar link"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Copiar
                </button>
              </div>
            </div>

            {/* Article body */}
            <div
              className="prose-yourgift"
              dangerouslySetInnerHTML={{ __html: post.content }}
              style={{
                color: "rgba(255,255,255,0.72)",
                lineHeight: "1.8",
                fontSize: "1.0625rem",
              }}
            />

            {/* Scoped prose styles */}
            <style>{`
              .prose-yourgift h2 {
                color: rgba(255,255,255,0.95);
                font-size: 1.5rem;
                font-weight: 600;
                letter-spacing: -0.02em;
                margin-top: 2.5rem;
                margin-bottom: 1rem;
                line-height: 1.3;
              }
              .prose-yourgift h3 {
                color: rgba(255,255,255,0.88);
                font-size: 1.125rem;
                font-weight: 600;
                margin-top: 1.75rem;
                margin-bottom: 0.625rem;
                line-height: 1.4;
              }
              .prose-yourgift p {
                margin-bottom: 1.25rem;
              }
              .prose-yourgift ul {
                list-style: none;
                padding-left: 0;
                margin-bottom: 1.25rem;
              }
              .prose-yourgift ul li {
                position: relative;
                padding-left: 1.5rem;
                margin-bottom: 0.5rem;
                color: rgba(255,255,255,0.65);
              }
              .prose-yourgift ul li::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0.55em;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #4DA3FF;
              }
              .prose-yourgift ul li strong {
                color: rgba(255,255,255,0.85);
                font-weight: 600;
              }
              .prose-yourgift blockquote {
                border-left: 3px solid #4DA3FF;
                background: rgba(77,163,255,0.06);
                border-radius: 0 12px 12px 0;
                padding: 1.25rem 1.5rem;
                margin: 2rem 0;
                color: rgba(255,255,255,0.80);
                font-style: italic;
                line-height: 1.7;
              }
              .prose-yourgift strong {
                color: rgba(255,255,255,0.88);
                font-weight: 600;
              }
            `}</style>

            {/* CTA block */}
            <div className="mt-14 p-8 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-transparent text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4DA3FF] mb-3">
                Pronto para começar?
              </p>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Pronto para o teu próximo projeto?
              </h2>
              <p className="text-white/52 text-sm mb-6 max-w-md mx-auto">
                Fala connosco e recebe uma proposta personalizada para a tua
                empresa em menos de 48 horas.
              </p>
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 bg-white text-[#07111F] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
              >
                Pedir proposta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Related posts */}
            {displayRelated.length > 0 && (
              <div className="mt-16">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/38 mb-6">
                  Artigos relacionados
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {displayRelated.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/blog/${related.slug}`}
                      className="group block rounded-2xl border border-white/[0.07] hover:border-white/[0.14] bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden transition-all duration-300 hover:translate-y-[-2px]"
                    >
                      <div className="aspect-video overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={related.image}
                          alt={related.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-[#4DA3FF] font-medium">
                            {related.category}
                          </span>
                          <span className="text-white/20">·</span>
                          <span className="text-xs text-white/38">
                            {related.readTime} leitura
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white/85 group-hover:text-white transition-colors leading-snug">
                          {related.title}
                        </h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-5">
              {/* CTA card */}
              <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-6">
                <div className="w-10 h-10 rounded-xl bg-[#4DA3FF]/15 flex items-center justify-center mb-4">
                  <svg
                    className="w-5 h-5 text-[#4DA3FF]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Precisa de ajuda?
                </h3>
                <p className="text-sm text-white/50 mb-5 leading-relaxed">
                  A nossa equipa responde em menos de 48h com uma proposta
                  personalizada para a sua empresa.
                </p>
                <Link
                  href="/rfq"
                  className="block text-center bg-white text-[#07111F] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all mb-3"
                >
                  Pedir proposta
                </Link>
                <a
                  href="https://wa.me/351000000000?text=Olá! Gostaria de saber mais sobre os vossos serviços."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-white/[0.1] text-white/60 hover:text-white hover:border-white/25 px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Fala connosco
                </a>
              </div>

              {/* Post meta card */}
              <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/30 mb-4">
                  Sobre este artigo
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 text-sm text-white/50">
                    <User className="h-4 w-4 text-white/30 flex-shrink-0" />
                    {post.author}
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-white/50">
                    <Calendar className="h-4 w-4 text-white/30 flex-shrink-0" />
                    {formatDate(post.date)}
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-white/50">
                    <Clock className="h-4 w-4 text-white/30 flex-shrink-0" />
                    {post.readTime} de leitura
                  </div>
                  <div className="pt-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                        CATEGORY_COLORS[post.category] ??
                        "text-[#4DA3FF] border-[#4DA3FF]/25 bg-[#4DA3FF]/10"
                      }`}
                    >
                      {post.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
