import { notFound } from "next/navigation";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Star,
  Leaf,
  Clock,
  Package,
  CheckCircle2,
  Zap,
  ChevronRight,
  Shield,
  Truck,
  RotateCcw,
  Sparkles,
} from "lucide-react";

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  priceFrom: number;
  moq: number;
  leadTimeDays: number;
  sustainable: boolean;
  popular: boolean;
  image: string;
  images: string[];
  shortDescription: string;
  description: string;
  features: string[];
  specifications: Record<string, string>;
  brandingMethods: string[];
  brandingAreas: string;
  faqs: Array<{ q: string; a: string }>;
  relatedSlugs: string[];
};

const PRODUCTS: Record<string, Product> = {
  "premium-leather-journal": {
    id: "1",
    slug: "premium-leather-journal",
    name: "Premium Leather Journal",
    category: "corporate-gifts",
    categoryLabel: "Corporate Gifts",
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Diário em couro genuíno para gifting premium e welcome kits executivos.",
    description:
      "Um diário de couro premium que impressiona à primeira vista. Ideal para presentes corporativos de alto valor, welcome kits executivos e reconhecimentos especiais. A cobertura em couro genuíno desenvolve um patine único com o tempo, tornando cada exemplar verdadeiramente único. Disponível em quatro cores clássicas, com personalização por debossing ou gravura laser na capa frontal.",
    features: [
      "Couro genuíno curtido vegetalmente",
      "200 páginas de papel sem ácido 90g/m²",
      "Elástico de fecho e marcador de página em seda",
      "Bolso interno para documentos e cartões",
      "Personalização por debossing ou gravura laser",
      "Embalagem individual premium disponível",
      "Disponível com página de dedicatória personalizada",
    ],
    specifications: {
      Material: "Couro genuíno",
      Dimensões: "21 × 14.5 × 1.5 cm",
      Páginas: "200 páginas pautadas",
      Peso: "380g",
      "Cores disponíveis": "Castanho, Preto, Verde escuro, Bordô",
      "Área de branding": "Capa frontal 8×6cm",
    },
    brandingMethods: ["Debossing", "Gravura Laser", "Hot Stamping"],
    brandingAreas: "Capa frontal (8×6cm), centrada ou offset",
    faqs: [
      {
        q: "Posso escolher a cor da capa?",
        a: "Sim, disponível em Castanho, Preto, Verde escuro e Bordô. Outras cores mediante consulta para volumes acima de 200 unidades.",
      },
      {
        q: "O debossing inclui tinta ou é apenas relevo?",
        a: "O debossing standard é a seco (apenas relevo). Hot stamping adiciona folha metálica dourada ou prateada ao relevo, com custo adicional.",
      },
      {
        q: "É possível personalizar página a página?",
        a: "Sim, oferecemos inserção de página de rosto personalizada com nome do destinatário e mensagem, ideal para welcome kits nominais.",
      },
    ],
    relatedSlugs: ["premium-gift-box-set", "bamboo-tech-organizer"],
  },

  "insulated-tumbler-500ml": {
    id: "2",
    slug: "insulated-tumbler-500ml",
    name: "Insulated Tumbler 500ml",
    category: "drinkware",
    categoryLabel: "Drinkware",
    priceFrom: 18,
    moq: 100,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1575474491497-e3baa3a2a400?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Tumbler de aço inoxidável com dupla parede e isolamento a vácuo.",
    description:
      "O item de daily-carry com maior retorno de visibilidade no mercado de merchandising B2B. Mantém bebidas quentes até 12 horas e frias até 24 horas graças ao isolamento a vácuo de dupla parede em aço inoxidável 18/8. Tampa com fecho de segurança e abertura de 360º para beber. Compatível com apoios de copos de automóvel. Disponível em 8 cores premium com acabamento fosco ou brilhante.",
    features: [
      "Aço inoxidável 18/8 de grau alimentar",
      "Isolamento a vácuo de dupla parede",
      "Mantém quente 12h, frio 24h",
      "Tampa com fecho de segurança integrado",
      "Abertura de 360º para beber",
      "Compatível com apoios de copo de automóvel",
      "Livre de BPA",
      "Base antiderrapante em borracha",
    ],
    specifications: {
      Material: "Aço inoxidável 18/8",
      Capacidade: "500ml",
      Altura: "19.5cm",
      Diâmetro: "7.5cm",
      Peso: "290g",
      "Cores disponíveis": "8 cores: Preto, Branco, Cinza, Azul, Verde, Coral, Nude, Dourado",
      "Área de branding": "Lateral 8×5cm",
    },
    brandingMethods: ["Gravura Laser", "UV Print"],
    brandingAreas: "Lateral frontal (8×5cm) ou circunferencial (360°)",
    faqs: [
      {
        q: "A gravura laser remove o revestimento colorido?",
        a: "Sim, a gravura laser remove o revestimento e revela o aço polido por baixo, criando um contraste elegante. Para manter a cor, recomendamos UV print.",
      },
      {
        q: "É lavável na máquina de loiça?",
        a: "O copo é lavável na máquina, mas recomendamos lavagem à mão para preservar o acabamento e a durabilidade do branding.",
      },
    ],
    relatedSlugs: ["glass-water-bottle", "premium-leather-journal"],
  },

  "bamboo-tech-organizer": {
    id: "3",
    slug: "bamboo-tech-organizer",
    name: "Bamboo Tech Organizer",
    category: "desk-accessories",
    categoryLabel: "Desk & Office",
    priceFrom: 22,
    moq: 25,
    leadTimeDays: 14,
    sustainable: true,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Organizador de secretária em bambu sustentável com suporte para dispositivos.",
    description:
      "Um organizador de secretária que combina funcionalidade máxima com estética premium. Fabricado em bambu de crescimento rápido certificado FSC, uma alternativa sustentável à madeira convencional. Inclui compartimentos para canetas, cartões e documentos, suporte ajustável para telemóvel e tablet, e passa-cabos integrado na base. A superfície natural do bambu responde excepcionalmente bem à gravura laser, criando um contraste profundo e duradouro.",
    features: [
      "Bambu de crescimento rápido certificado FSC",
      "Suporte ajustável para telemóvel e tablet",
      "3 compartimentos para canetas e acessórios",
      "Porta-cartões de visita com capacidade para 20 cartões",
      "Passa-cabos integrado na base",
      "Base com feltro anti-risco",
      "Gravura laser de alta definição",
      "Montagem sem ferramentas",
    ],
    specifications: {
      Material: "Bambu FSC certificado",
      Dimensões: "28 × 18 × 12 cm",
      Peso: "620g",
      Certificação: "FSC, RoHS",
      Acabamento: "Natural envernizado",
      "Área de branding": "Painel frontal 10×4cm",
    },
    brandingMethods: ["Gravura Laser"],
    brandingAreas: "Painel frontal (10×4cm)",
    faqs: [
      {
        q: "O bambu é tratado para resistir à humidade?",
        a: "Sim, todos os organizadores recebem um tratamento de verniz aquoso de baixo VOC que protege contra humidade e manchas sem alterar a aparência natural.",
      },
      {
        q: "A gravura pode incluir o logótipo e um texto?",
        a: "Sim, a área de 10×4cm permite logótipo + tagline ou logótipo + URL com boa definição.",
      },
    ],
    relatedSlugs: ["wireless-charging-pad", "premium-leather-journal"],
  },

  "organic-cotton-tee": {
    id: "4",
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    category: "apparel",
    categoryLabel: "Apparel",
    priceFrom: 9,
    moq: 50,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "T-shirt em algodão orgânico certificado GOTS, corte premium unissexo.",
    description:
      "A base de qualquer programa de merchandising sólido. Esta t-shirt em algodão orgânico 100% com certificação GOTS oferece um corte unissexo com caimento justo sem ser restritivo — o tipo que as pessoas escolhem vestir ao fim de semana, não apenas no escritório. O peso de 180g/m² dá uma sensação de qualidade imediata. Disponível em 12 cores e tamanhos XS a 3XL.",
    features: [
      "Algodão orgânico 100% certificado GOTS",
      "Gramagem 180g/m² — peso de qualidade",
      "Corte unissexo com caimento premium",
      "Costura dupla nas bainhas e punhos",
      "Etiqueta interna substituível com marca do cliente",
      "Disponível em 12 cores sólidas",
      "Tamanhos XS a 3XL",
      "Pré-lavada para evitar encolhimento",
    ],
    specifications: {
      Material: "Algodão orgânico 100%",
      Gramagem: "180g/m²",
      Certificação: "GOTS, Oeko-Tex Standard 100",
      Corte: "Unissexo, fit regular",
      Tamanhos: "XS / S / M / L / XL / XXL / 3XL",
      "Cores disponíveis": "12 cores — consultar carta",
      "Área de branding": "Peito esquerdo até 10×10cm, costas até 30×40cm",
    },
    brandingMethods: ["Serigrafia", "Bordado"],
    brandingAreas: "Peito esquerdo (10×10cm), costas (30×40cm), mangas (5×5cm)",
    faqs: [
      {
        q: "A serigrafia mantém-se após múltiplas lavagens?",
        a: "Sim, usamos tintas plastisol de alta durabilidade com cura a quente. Com cuidados normais de lavagem, a serigrafia mantém-se vibrante por mais de 50 lavagens.",
      },
      {
        q: "Posso misturar tamanhos na mesma encomenda?",
        a: "Sim, desde que o total seja igual ou superior ao MOQ de 50 unidades. Pode distribuir livremente pelos tamanhos disponíveis.",
      },
    ],
    relatedSlugs: ["embroidered-cap", "canvas-tote-bag"],
  },

  "premium-gift-box-set": {
    id: "5",
    slug: "premium-gift-box-set",
    name: "Premium Gift Box Set",
    category: "packaging",
    categoryLabel: "Packaging",
    priceFrom: 35,
    moq: 20,
    leadTimeDays: 15,
    sustainable: true,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Caixa magnética de apresentação em cartão reciclado para gifting premium.",
    description:
      "A embalagem que transforma qualquer presente num momento. Esta caixa rígida de fecho magnético é fabricada em cartão reciclado 1200g com revestimento interno em papel tissue. O exterior aceita personalização por UV printing de alta resolução, debossing ou hot stamping — cada acabamento transmite uma mensagem diferente sobre a marca. Inclui enchimento em papel kraft reciclado para proteção e apresentação. O MOQ baixo de 20 unidades torna-a acessível mesmo para eventos pequenos.",
    features: [
      "Cartão reciclado 1200g de alta resistência",
      "Fecho magnético silencioso de alta durabilidade",
      "Interior em papel tissue personalizável",
      "Enchimento em papel kraft reciclado incluído",
      "Suporte para produtos até 3kg",
      "Handles de fita de cetim opcional",
      "Certificação FSC disponível sob pedido",
      "Dimensões personalizáveis a partir de 50 unidades",
    ],
    specifications: {
      Material: "Cartão reciclado 1200g",
      "Dimensão standard": "30 × 22 × 10 cm",
      "Capacidade peso": "Até 3kg",
      Fecho: "Magnético integrado",
      Interior: "Papel tissue branco ou colorido",
      "Área de branding": "Tampa superior 28×20cm",
    },
    brandingMethods: ["UV Print", "Debossing", "Hot Stamping"],
    brandingAreas: "Tampa superior completa (28×20cm), laterais (8×10cm)",
    faqs: [
      {
        q: "Posso encomendar dimensões personalizadas?",
        a: "Sim, a partir de 50 unidades produzimos dimensões à medida. O prazo aumenta para 18–21 dias para peças customizadas.",
      },
      {
        q: "O kit inclui apenas a caixa ou também os produtos?",
        a: "O produto base é a caixa com enchimento. Podemos sourcing e montagem completa do kit com outros produtos do nosso catálogo.",
      },
    ],
    relatedSlugs: ["premium-leather-journal", "insulated-tumbler-500ml"],
  },

  "wireless-charging-pad": {
    id: "6",
    slug: "wireless-charging-pad",
    name: "Wireless Charging Pad",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    priceFrom: 28,
    moq: 30,
    leadTimeDays: 12,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Carregador sem fios 15W Qi2 com superfície em alumínio anodizado.",
    description:
      "O acessório de secretária que todos os colaboradores vão usar todos os dias. Este carregador sem fios suporta o protocolo Qi2 com potência máxima de 15W, compatível com todos os iPhones desde o 12, Samsung Galaxy S21+ e qualquer dispositivo Qi. A superfície superior em alumínio anodizado aceita gravura laser de alta definição — o logótipo fica visível em cada carregamento.",
    features: [
      "Protocolo Qi2 — até 15W de carregamento rápido",
      "Compatível com iPhone 12+ e Samsung Galaxy S21+",
      "Compatível com qualquer dispositivo Qi",
      "Superfície em alumínio anodizado",
      "Base em borracha antiderrapante",
      "LED de estado discreto",
      "Proteção contra sobrecarga e sobretemperatura",
      "Cabo USB-C 1.5m incluído",
    ],
    specifications: {
      Potência: "5W / 10W / 15W (adaptativo)",
      Protocolo: "Qi2 / Qi",
      "Material superfície": "Alumínio anodizado",
      Dimensões: "10 × 10 × 0.8 cm",
      Cabo: "USB-C 1.5m",
      Certificação: "CE, FCC, RoHS",
      "Área de branding": "Superfície 6×6cm",
    },
    brandingMethods: ["Gravura Laser", "UV Print"],
    brandingAreas: "Superfície superior central (6×6cm)",
    faqs: [
      {
        q: "O carregador funciona com capas protetoras?",
        a: "Sim, com capas até 3mm de espessura. Capas de carteira ou com componentes metálicos podem interferir com o carregamento.",
      },
      {
        q: "O adaptador de tomada está incluído?",
        a: "O produto inclui apenas o cabo USB-C. Recomendamos adaptadores de 20W para velocidade máxima.",
      },
    ],
    relatedSlugs: ["bamboo-tech-organizer", "insulated-tumbler-500ml"],
  },

  "canvas-tote-bag": {
    id: "7",
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag Premium",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    priceFrom: 6,
    moq: 100,
    leadTimeDays: 8,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Tote bag em canvas de algodão 340g/m² com costuras reforçadas.",
    description:
      "O clássico do merchandising reinventado com qualidade real. Este tote bag é fabricado em canvas de algodão 340g/m² — significativamente mais pesado e duradouro do que os modelos promocionais standard de 180–200g. As asas em canvas duplo suportam até 15kg de carga. Disponível em 6 cores neutras. Lead time de apenas 8 dias.",
    features: [
      "Canvas de algodão 100% — 340g/m²",
      "Asas em canvas duplo reforçado",
      "Base com reforço estrutural",
      "Capacidade até 15kg",
      "Bolso interior com fecho de velcro",
      "Disponível em 6 cores: Natural, Preto, Navy, Verde, Bordeaux, Cinza",
      "Lead time de 8 dias",
      "100% algodão não-tratado, reciclável",
    ],
    specifications: {
      Material: "Canvas de algodão 100%",
      Gramagem: "340g/m²",
      Dimensões: "38 × 42 × 10 cm",
      Asas: "Canvas duplo, comprimento 65cm",
      "Carga máxima": "15kg",
      "Cores disponíveis": "Natural, Preto, Navy, Verde, Bordeaux, Cinza",
      "Área de branding": "Frente 30×30cm, verso 30×30cm",
    },
    brandingMethods: ["Serigrafia"],
    brandingAreas: "Frente central (30×30cm), verso (30×30cm), asa (5×25cm)",
    faqs: [
      {
        q: "Posso imprimir frente e verso com designs diferentes?",
        a: "Sim, frente e verso podem ter designs distintos. Conta como 2 posições de impressão com custo adicional por posição.",
      },
      {
        q: "A cor Natural é exatamente branca?",
        a: "Não — Natural é o tom cru do algodão não-branqueado, ligeiramente amarelado. É o tom mais ecológico e fotogénico.",
      },
    ],
    relatedSlugs: ["organic-cotton-tee", "embroidered-cap"],
  },

  "embroidered-cap": {
    id: "8",
    slug: "embroidered-cap",
    name: "Embroidered Cap — 6 Panel",
    category: "apparel",
    categoryLabel: "Apparel",
    priceFrom: 11,
    moq: 50,
    leadTimeDays: 14,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Boné de 6 painéis em twill de algodão com bordado 3D na frente.",
    description:
      "O boné que representa a marca fora do escritório. Este modelo de 6 painéis em twill de algodão de alta qualidade tem uma estrutura firme que mantém a forma ao longo do tempo. O fecho traseiro em velcro com etiqueta de couro personalizada é um detalhe premium que poucos fornecedores oferecem.",
    features: [
      "Twill de algodão 100% — 6 painéis",
      "Painel frontal estruturado com tafetá",
      "Bordado 3D de alta definição no painel frontal",
      "Fecho traseiro em velcro com etiqueta de couro",
      "Pala pré-curvada com bordo reforçado",
      "Banda de suor interior em algodão",
      "Ajustável: tamanho único 56–60cm",
      "Disponível em 8 cores",
    ],
    specifications: {
      Material: "Twill de algodão 100%",
      Estrutura: "6 painéis, painel frontal rígido",
      Fecho: "Velcro com etiqueta de couro",
      Tamanho: "Ajustável 56–60cm",
      "Cores disponíveis":
        "Preto, Branco, Navy, Cinza, Bordeaux, Camel, Verde, Creme",
      "Área de branding frente": "Painel frontal 8×6cm",
      "Área de branding lateral": "Painel lateral 5×4cm (opcional)",
    },
    brandingMethods: ["Bordado"],
    brandingAreas: "Painel frontal (8×6cm), painel lateral (5×4cm)",
    faqs: [
      {
        q: "O bordado 3D funciona com logótipos detalhados?",
        a: "Bordado 3D é ideal para logótipos com formas geométricas e texto legível acima de 6pt. Logótipos com gradientes ou detalhes muito finos adaptam-se melhor a bordado plano.",
      },
      {
        q: "Posso personalizar a etiqueta de couro traseira?",
        a: "Sim, a etiqueta de couro pode ter o nome da empresa, website ou um ícone simples em debossing.",
      },
    ],
    relatedSlugs: ["organic-cotton-tee", "canvas-tote-bag"],
  },

  "glass-water-bottle": {
    id: "9",
    slug: "glass-water-bottle",
    name: "Borosilicate Glass Bottle",
    category: "drinkware",
    categoryLabel: "Drinkware",
    priceFrom: 16,
    moq: 50,
    leadTimeDays: 12,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1575474491497-e3baa3a2a400?w=800&h=800&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1575474491497-e3baa3a2a400?w=800&h=800&fit=crop",
    ],
    shortDescription:
      "Garrafa de vidro borossilicato 600ml com manga protetora em silicone.",
    description:
      "A escolha sustentável por excelência para welcome kits e gifting de cliente consciente. O vidro borossilicato é o mesmo material dos copos de laboratório — resistente a choques térmicos, livre de BPA, e que não transfere sabores. A manga protetora em silicone alimentar dá grip confortável, proteção contra impactos e uma área de branding premium com toque suave.",
    features: [
      "Vidro borossilicato de grau alimentar",
      "Resistente a variações de temperatura (-20°C a 120°C)",
      "Livre de BPA, ftalatos e metais pesados",
      "Manga protetora em silicone alimentar",
      "Tampa em bambu com vedante de silicone",
      "Gargalo largo para fácil limpeza",
      "Lavável na máquina de loiça (exceto tampa de bambu)",
      "Capacidade 600ml",
    ],
    specifications: {
      Material: "Vidro borossilicato + Silicone + Bambu",
      Capacidade: "600ml",
      Altura: "23cm",
      Diâmetro: "7cm",
      Peso: "340g",
      "Resistência térmica": "-20°C a +120°C",
      Certificação: "FDA, LFGB",
      "Área de branding": "Manga lateral 8×6cm",
    },
    brandingMethods: ["Gravura Laser", "UV Print"],
    brandingAreas: "Manga de silicone lateral (8×6cm)",
    faqs: [
      {
        q: "A garrafa resiste a quedas?",
        a: "O vidro borossilicato tem boa resistência a choques térmicos mas não é inquebrável. A manga de silicone protege contra impactos menores. Para uso intensivo em campo, recomendamos o Insulated Tumbler.",
      },
      {
        q: "Posso encomendar sem a manga de silicone?",
        a: "Sim, versão apenas em vidro com gravura laser direta está disponível. Requer MOQ mínimo de 100 unidades.",
      },
    ],
    relatedSlugs: ["insulated-tumbler-500ml", "bamboo-tech-organizer"],
  },
};

const ALL_PRODUCTS = Object.values(PRODUCTS);

const BRANDING_METHOD_COLORS: Record<string, string> = {
  Debossing: "border-[#4DA3FF]/25 bg-[#4DA3FF]/08 text-[#4DA3FF]",
  "Gravura Laser": "border-[#74E7FF]/25 bg-[#74E7FF]/08 text-[#74E7FF]",
  "UV Print": "border-[#63E6BE]/25 bg-[#63E6BE]/08 text-[#63E6BE]",
  "Hot Stamping": "border-yellow-400/25 bg-yellow-400/08 text-yellow-300",
  Serigrafia: "border-[#4DA3FF]/25 bg-[#4DA3FF]/08 text-[#4DA3FF]",
  Bordado: "border-[#74E7FF]/25 bg-[#74E7FF]/08 text-[#74E7FF]",
};

export async function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) return {};
  return constructMetadata({
    title: `${product.name} — ${product.categoryLabel}`,
    description: product.shortDescription,
    canonical: `/catalog/${slug}`,
    keywords: [
      product.categoryLabel.toLowerCase(),
      "merchandising personalizado",
      "branding B2B Portugal",
      product.brandingMethods.map((m) => m.toLowerCase()).join(", "),
    ],
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) notFound();

  const relatedProducts = product.relatedSlugs
    .map((s) => PRODUCTS[s])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="min-h-screen" style={{ background: "rgb(7,17,31)" }}>

      {/* ── Full-width Hero Image ── */}
      <div className="relative w-full h-[55vh] min-h-[420px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {/* Deep gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,17,31,0.2) 0%, rgba(7,17,31,0.55) 60%, rgb(7,17,31) 100%)",
          }}
        />

        {/* Breadcrumb floated over image */}
        <div className="absolute top-28 left-0 right-0 max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex items-center gap-2 text-xs text-white/50">
            <Link href="/" className="hover:text-white/80 transition-colors">
              Início
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href="/catalog"
              className="hover:text-white/80 transition-colors"
            >
              Catálogo
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href={`/catalog?category=${product.category}`}
              className="hover:text-white/80 transition-colors"
            >
              {product.categoryLabel}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/80">{product.name}</span>
          </nav>
        </div>

        {/* Badges over hero */}
        <div className="absolute bottom-8 left-0 right-0 max-w-7xl mx-auto px-4 md:px-8 flex gap-2">
          {product.popular && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#07111F]/70 backdrop-blur-md text-[#74E7FF] text-xs font-bold border border-[#74E7FF]/25">
              <Star className="h-3 w-3 fill-current" />
              Popular
            </span>
          )}
          {product.sustainable && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#07111F]/70 backdrop-blur-md text-[#63E6BE] text-xs font-bold border border-[#63E6BE]/25">
              <Leaf className="h-3 w-3" />
              Eco & Sustentável
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#07111F]/70 backdrop-blur-md text-[#4DA3FF] text-xs font-bold border border-[#4DA3FF]/20">
            <Sparkles className="h-3 w-3" />
            {product.categoryLabel}
          </span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24 -mt-2">

        {/* Product title + info grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 mb-16">

          {/* Left: details */}
          <div>
            {/* Name */}
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
              {product.name}
            </h1>

            {/* Short description */}
            <p className="text-lg text-white/55 leading-relaxed mb-6 max-w-2xl">
              {product.description}
            </p>

            {/* Key metrics row */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                {
                  icon: Zap,
                  label: "Desde",
                  value: `€${product.priceFrom}/un`,
                  color: "#74E7FF",
                  bg: "rgba(116,231,255,0.08)",
                  border: "rgba(116,231,255,0.2)",
                },
                {
                  icon: Package,
                  label: "MOQ",
                  value: `${product.moq} un`,
                  color: "#4DA3FF",
                  bg: "rgba(77,163,255,0.08)",
                  border: "rgba(77,163,255,0.2)",
                },
                {
                  icon: Clock,
                  label: "Lead time",
                  value: `${product.leadTimeDays} dias`,
                  color: "#63E6BE",
                  bg: "rgba(99,230,190,0.08)",
                  border: "rgba(99,230,190,0.2)",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="p-4 rounded-2xl text-center"
                    style={{
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                    }}
                  >
                    <Icon
                      className="h-5 w-5 mx-auto mb-2"
                      style={{ color: item.color }}
                    />
                    <div className="text-[10px] uppercase tracking-widest text-white/38 mb-1">
                      {item.label}
                    </div>
                    <div
                      className="text-sm font-black"
                      style={{ color: item.color }}
                    >
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Branding methods */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white/38 mb-3">
                Métodos de personalização
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {product.brandingMethods.map((m) => (
                  <span
                    key={m}
                    className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
                      BRANDING_METHOD_COLORS[m] ||
                      "border-white/10 bg-white/05 text-white/60"
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-xs text-white/35">
                Área de branding: {product.brandingAreas}
              </p>
            </div>

            {/* Image gallery (thumbnails) */}
            {product.images.length > 1 && (
              <div className="flex gap-3 mb-8">
                {product.images.map((img, i) => (
                  <div
                    key={i}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      i === 0
                        ? "border-[#4DA3FF]/60"
                        : "border-white/[0.1] hover:border-white/[0.25]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Vista ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Trust micro-badges */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-white/[0.06]">
              {[
                { icon: Shield, text: "Amostra digital grátis" },
                { icon: Truck, text: "Entrega Portugal & EU" },
                { icon: RotateCcw, text: "Revisão sem compromisso" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.text}
                    className="flex items-center gap-2 text-xs text-white/45"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#4DA3FF]" />
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: sticky CTA card */}
          <div className="lg:sticky lg:top-28 self-start">
            <div
              className="rounded-2xl p-7 border"
              style={{
                background:
                  "linear-gradient(135deg, rgba(77,163,255,0.07) 0%, rgba(11,21,38,0.95) 100%)",
                border: "1px solid rgba(77,163,255,0.2)",
              }}
            >
              {/* Price */}
              <div className="mb-6">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-1">
                  Preço por unidade
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    €{product.priceFrom}
                  </span>
                  <span className="text-white/40 text-sm">/un</span>
                </div>
                <div className="text-xs text-white/35 mt-1">
                  Preços por volume disponíveis na proposta
                </div>
              </div>

              {/* Quick specs */}
              <div className="space-y-2.5 mb-7">
                {[
                  { label: "MOQ", value: `${product.moq} unidades` },
                  {
                    label: "Lead time",
                    value: `${product.leadTimeDays} dias úteis`,
                  },
                  {
                    label: "Personalização",
                    value: product.brandingMethods.slice(0, 2).join(", "),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-white/[0.05]"
                  >
                    <span className="text-xs text-white/40">{row.label}</span>
                    <span className="text-xs font-semibold text-white/80">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Primary CTA */}
              <Link
                href={`/rfq?product=${slug}`}
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-xl font-black text-sm tracking-wide transition-all"
                style={{
                  background: "linear-gradient(135deg, #4DA3FF, #74E7FF)",
                  color: "#07111F",
                  boxShadow: "0 0 30px rgba(77,163,255,0.3)",
                }}
              >
                <Zap className="h-4 w-4" />
                Pedir proposta agora
              </Link>

              <Link
                href="/catalog"
                className="flex items-center justify-center gap-2 w-full py-3 mt-3 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:text-white hover:border-white/[0.2] transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Ver catálogo
              </Link>

              {/* Social proof */}
              <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className="h-3 w-3 fill-[#74E7FF] text-[#74E7FF]"
                    />
                  ))}
                </div>
                <p className="text-xs text-white/45 leading-relaxed">
                  &ldquo;Produto excelente, entrega dentro do prazo e o branding
                  ficou perfeito.&rdquo;
                </p>
                <p className="text-[10px] text-white/30 mt-1.5 font-medium">
                  — Diretora de Marketing, empresa tech Lisboa
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features + Specs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
          {/* Features */}
          <div
            className="p-7 rounded-2xl border"
            style={{
              background: "rgba(11,21,38,0.8)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#63E6BE]" />
              Características
            </h2>
            <ul className="space-y-3">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#63E6BE] flex-shrink-0" />
                  <span className="text-sm text-white/60 leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Specifications */}
          <div
            className="p-7 rounded-2xl border"
            style={{
              background: "rgba(11,21,38,0.8)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#4DA3FF]" />
              Especificações técnicas
            </h2>
            <div>
              {Object.entries(product.specifications).map(([k, v], idx, arr) => (
                <div
                  key={k}
                  className={`flex justify-between items-start py-3 gap-4 ${
                    idx < arr.length - 1 ? "border-b border-white/[0.05]" : ""
                  }`}
                >
                  <span className="text-sm text-white/38 flex-shrink-0">
                    {k}
                  </span>
                  <span className="text-sm text-white/75 font-semibold text-right">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQs ── */}
        {product.faqs.length > 0 && (
          <div className="mb-16 max-w-3xl">
            <h2 className="text-2xl font-black text-white mb-7">
              Perguntas frequentes
            </h2>
            <div className="space-y-3">
              {product.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl border transition-colors"
                  style={{
                    background: "rgba(11,21,38,0.7)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h3 className="text-sm font-bold text-white mb-2.5 flex items-start gap-2">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
                      style={{
                        background: "rgba(77,163,255,0.15)",
                        color: "#4DA3FF",
                      }}
                    >
                      Q
                    </span>
                    {faq.q}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed pl-7">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Related Products ── */}
        {relatedProducts.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-7">
              <h2 className="text-2xl font-black text-white">
                Produtos relacionados
              </h2>
              <Link
                href="/catalog"
                className="flex items-center gap-1.5 text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors"
              >
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedProducts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/catalog/${related.slug}`}
                  className="group block rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#4DA3FF]/30 bg-[#0B1526] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(77,163,255,0.1)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#0D1A2D]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={related.image}
                      alt={related.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {related.popular && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#74E7FF] text-[9px] font-bold border border-[#74E7FF]/20">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Popular
                        </span>
                      )}
                      {related.sustainable && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#63E6BE] text-[9px] font-bold border border-[#63E6BE]/20">
                          <Leaf className="h-2.5 w-2.5" />
                          Eco
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold text-[#4DA3FF] uppercase tracking-wider mb-1.5">
                      {related.categoryLabel}
                    </p>
                    <h3 className="text-sm font-bold text-white/90 group-hover:text-white transition-colors mb-3 line-clamp-1">
                      {related.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-white/38">De </span>
                        <span className="text-base font-black text-white">
                          €{related.priceFrom}
                        </span>
                        <span className="text-[10px] text-white/38">/un</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-white/38">
                          <Package className="h-2.5 w-2.5" />
                          MOQ {related.moq}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-white/38">
                          <Clock className="h-2.5 w-2.5" />
                          {related.leadTimeDays}d
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom CTA Banner ── */}
        <div
          className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(77,163,255,0.1) 0%, rgba(116,231,255,0.06) 50%, rgba(99,230,190,0.08) 100%)",
            border: "1px solid rgba(77,163,255,0.2)",
          }}
        >
          {/* Decorative glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-[80px] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(77,163,255,0.15) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4DA3FF]/10 border border-[#4DA3FF]/20 text-[#4DA3FF] text-xs font-bold tracking-widest uppercase mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4DA3FF] animate-pulse" />
              Próximo passo
            </span>

            <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
              Pronto para personalizar?
            </h2>
            <p className="text-white/50 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              Envia o teu briefing e recebe uma proposta com mockups digitais,
              preços por volume e prazo confirmado em menos de 48 horas.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/rfq?product=${slug}`}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-black text-sm transition-all"
                style={{
                  background: "linear-gradient(135deg, #4DA3FF, #74E7FF)",
                  color: "#07111F",
                  boxShadow: "0 0 40px rgba(77,163,255,0.3)",
                }}
              >
                Pedir proposta para este produto
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/[0.1] text-white/60 text-sm hover:bg-white/[0.06] hover:text-white transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Ver catálogo completo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
