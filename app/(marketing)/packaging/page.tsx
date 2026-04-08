import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Box,
  Package,
  Layers,
  Tag,
  Leaf,
  ShoppingBag,
  Heart,
  Globe,
  Sparkles,
  Star,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Packaging Premium | yourgift.pt",
  description:
    "Embalagens personalizadas que elevam a experiência de unboxing. Caixas rígidas, malas de papel kraft, tissue paper, fitas e muito mais.",
  canonical: "/packaging",
});

const packagingTypes = [
  {
    icon: Box,
    title: "Caixas Rígidas Premium",
    sub: "Luxury boxes · Fecho magnético",
    description:
      "Cartão rígido de alta gramagem com impressão interior e exterior. Disponíveis com fecho magnético, fita ou encaixe duplo — a escolha do segmento premium.",
    accent: "#4DA3FF",
  },
  {
    icon: ShoppingBag,
    title: "Malas de Cartão Kraft",
    sub: "Eco · Reciclável · Premium",
    description:
      "Malas de papel kraft ou couché com impressão a cores completa. Resistentes, sustentáveis e com acabamento que impressiona.",
    accent: "#74E7FF",
  },
  {
    icon: Layers,
    title: "Tissue Paper Personalizado",
    sub: "Logo · Padrão repetido",
    description:
      "Papel de seda com o teu logótipo ou padrão de marca. O detalhe que transforma a abertura numa experiência sensorial única.",
    accent: "#63E6BE",
  },
  {
    icon: Tag,
    title: "Fita e Laço com Logo",
    sub: "Cetim · Grosgrain · Personalizado",
    description:
      "Fitas de cetim ou grosgrain com logótipo impresso ou gravado. O toque final que comunica cuidado e atenção ao detalhe.",
    accent: "#4DA3FF",
  },
  {
    icon: Heart,
    title: "Thank You Cards",
    sub: "Cartões de agradecimento",
    description:
      "Cartões impressos em papel premium com mensagem personalizada, QR code ou série numerada. Pequeno detalhe, grande impacto.",
    accent: "#74E7FF",
  },
  {
    icon: Package,
    title: "Wrap Personalizado",
    sub: "Papel de embrulho · Stickers",
    description:
      "Papel de embrulho com padrão de marca e autocolantes personalizados com o logo. Solução versátil para qualquer formato de produto.",
    accent: "#63E6BE",
  },
];

const unboxingPoints = [
  {
    icon: Sparkles,
    title: "Primeira impressão física",
    description:
      "A embalagem é o primeiro toque físico entre o teu cliente e a tua marca. Antes de ver o produto, sente a caixa — o peso, a textura, o acabamento.",
    accent: "#4DA3FF",
  },
  {
    icon: Heart,
    title: "O momento de partilha",
    description:
      "72% dos consumidores filmam ou fotografam unboxings que consideram premium. Uma boa embalagem torna-se conteúdo orgânico gerado por clientes.",
    accent: "#74E7FF",
  },
  {
    icon: Globe,
    title: "Retenção e recompra",
    description:
      "Clientes que recebem uma experiência de unboxing memorável têm 2,4x mais probabilidade de recomendar e recomprar. A embalagem é marketing.",
    accent: "#63E6BE",
  },
];

const pricingRows = [
  { label: "Gift Boxes", from: "€2,50/un", moq: "100 un", lead: "12–18 dias", accent: "#4DA3FF" },
  { label: "Malas de Papel", from: "€0,80/un", moq: "500 un", lead: "10–14 dias", accent: "#74E7FF" },
  { label: "Packaging Eco", from: "€1,20/un", moq: "200 un", lead: "12–16 dias", accent: "#63E6BE" },
  { label: "Fitas & Laços", from: "€0,30/un", moq: "100 un", lead: "8–12 dias", accent: "#4DA3FF" },
];

const clientUses = [
  { label: "E-commerce", desc: "Primeiras impressões que garantem reviews positivas e reduzem devoluções." },
  { label: "Corporate Gifts", desc: "Embalagem premium que comunica o valor do presente antes de ser aberto." },
  { label: "Eventos", desc: "Sacos e caixas de evento que as pessoas guardam — publicidade gratuita e duradoura." },
  { label: "Retail", desc: "Packaging que se destaca na prateleira e eleva a perceção de valor do produto." },
];

const customOptions = [
  {
    label: "Impressão",
    options: ["CMYK 4 cores", "Pantone spot", "Foil dourado / prateado", "UV verniz parcial"],
  },
  {
    label: "Acabamento",
    options: ["Matte laminado", "Gloss laminado", "Soft-touch", "Embossing / Debossing"],
  },
  {
    label: "Estrutura",
    options: ["Fecho magnético", "Encaixe rígido", "Abertura lateral", "Fundo colado automático"],
  },
  {
    label: "Inserções",
    options: ["EVA foam custom", "Papel moldado", "Suporte cartão", "Tissue paper"],
  },
];

export default function PackagingPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-4">
                Packaging Premium
              </p>
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.1]">
                A embalagem é a primeira impressão. Faz com que valha a pena.
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed">
                Criamos experiências de unboxing que ficam na memória — e nas redes sociais dos teus clientes.
                Do design à entrega, tudo controlado.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/rfq"
                  className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
                >
                  Pedir proposta gratuita <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
                >
                  Ver catálogo
                </Link>
              </div>
            </div>
            {/* Visual packaging layers mockup */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative w-72 h-72">
                {/* Outer box */}
                <div className="absolute inset-0 rounded-3xl border-2 border-[#4DA3FF]/30 bg-gradient-to-br from-[#4DA3FF]/10 to-transparent flex items-center justify-center">
                  {/* Middle layer */}
                  <div className="absolute inset-6 rounded-2xl border border-[#74E7FF]/25 bg-gradient-to-br from-[#74E7FF]/10 to-transparent flex items-center justify-center">
                    {/* Inner layer */}
                    <div className="absolute inset-6 rounded-xl border border-[#63E6BE]/25 bg-gradient-to-br from-[#63E6BE]/10 to-transparent flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl mb-2">🎁</div>
                        <div className="text-xs font-semibold text-white/60">Unboxing perfeito</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative labels */}
                <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-lg bg-[#4DA3FF]/15 border border-[#4DA3FF]/25 text-xs font-medium text-[#4DA3FF]">
                  Caixa rígida
                </div>
                <div className="absolute -bottom-3 -left-3 px-3 py-1.5 rounded-lg bg-[#63E6BE]/15 border border-[#63E6BE]/25 text-xs font-medium text-[#63E6BE]">
                  Tissue paper
                </div>
              </div>
              <div className="absolute inset-0 w-48 h-48 m-auto rounded-full blur-3xl opacity-15" style={{ backgroundColor: "#4DA3FF" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 px-6 md:px-8 border-y border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "50.000+", label: "Caixas entregues" },
              { value: "MOQ 100un", label: "Quantidade mínima" },
              { value: "Pantone", label: "Matching garantido" },
              { value: "12–18 dias", label: "Prazo de produção" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-bold text-[#63E6BE] mb-1">{s.value}</div>
                <div className="text-sm text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packaging types */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Tipos de Embalagem
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Cada detalhe conta
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Do exterior ao interior — cada elemento da embalagem personalizado com a tua identidade visual.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {packagingTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px]"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${type.accent}12`, color: type.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-0.5">{type.title}</h3>
                  <p className="text-xs font-medium mb-3" style={{ color: type.accent }}>{type.sub}</p>
                  <p className="text-sm text-white/55 leading-relaxed">{type.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Experiência de unboxing */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Experiência de Unboxing
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              A psicologia da primeira abertura
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              A embalagem não é um custo — é um canal de marketing. Cada abertura é uma oportunidade de criar uma memória.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {unboxingPoints.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  key={point.title}
                  className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] text-center"
                >
                  <div
                    className="inline-flex p-4 rounded-2xl mb-5"
                    style={{ backgroundColor: `${point.accent}12`, color: point.accent }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{point.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{point.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              Preços
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Para cada orçamento e volume
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Preços competitivos com qualidade premium. Quanto maior o volume, menor o custo unitário.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-4 px-6 py-4 bg-white/[0.04] border-b border-white/[0.07]">
              {["Produto", "A partir de", "MOQ", "Prazo"].map((h) => (
                <div key={h} className="text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
                  {h}
                </div>
              ))}
            </div>
            {pricingRows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-4 px-6 py-5 ${
                  i < pricingRows.length - 1 ? "border-b border-white/[0.05]" : ""
                } hover:bg-white/[0.02] transition-colors`}
              >
                <div className="text-sm font-medium text-white">{row.label}</div>
                <div className="text-sm font-semibold" style={{ color: row.accent }}>{row.from}</div>
                <div className="text-sm text-white/60">{row.moq}</div>
                <div className="text-sm text-white/60">{row.lead}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30 text-center mt-4">
            Preços indicativos sem IVA. Sujeito a especificações finais.
          </p>
        </div>
      </section>

      {/* Client uses */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Quem usa
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Packaging para cada contexto
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Da loja online ao evento corporativo — a embalagem certa para cada situação.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {clientUses.map((use, i) => (
              <div
                key={use.label}
                className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]"
              >
                <div
                  className="text-xs font-semibold uppercase tracking-[0.12em] mb-3"
                  style={{ color: ["#4DA3FF", "#74E7FF", "#63E6BE", "#4DA3FF"][i] }}
                >
                  {use.label}
                </div>
                <p className="text-sm text-white/55 leading-relaxed">{use.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customization */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Opções de Personalização
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Controlo total sobre cada detalhe
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Define impressão, acabamento, estrutura e inserções — nós tratamos da produção e entrega.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {customOptions.map((opt) => (
              <div
                key={opt.label}
                className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#74E7FF] mb-4">
                  {opt.label}
                </div>
                <ul className="space-y-2.5">
                  {opt.options.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-sm text-white/60">
                      <div className="h-1 w-1 rounded-full bg-[#74E7FF]/50 flex-shrink-0 mt-2" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eco section */}
      <section className="py-16 px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="p-8 md:p-10 rounded-3xl border border-[#63E6BE]/20 bg-gradient-to-br from-[#63E6BE]/5 to-transparent">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="inline-flex p-4 rounded-2xl bg-[#63E6BE]/10 flex-shrink-0">
                <Leaf className="h-8 w-8 text-[#63E6BE]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">Linha Eco Certificada</h3>
                <p className="text-white/60 leading-relaxed">
                  Toda a nossa linha eco usa papel FSC certificado, tintas à base de água sem solventes e materiais reciclados pós-consumo.
                  Embalagem premium que não compromete o planeta — disponível em qualquer das categorias.
                </p>
              </div>
              <div className="flex-shrink-0">
                <Link
                  href="/rfq"
                  className="inline-flex items-center gap-2 border border-[#63E6BE]/30 text-[#63E6BE] px-6 py-3 rounded-xl font-medium text-sm hover:bg-[#63E6BE]/10 transition-all whitespace-nowrap"
                >
                  Saber mais <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]">
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-5 w-5 text-[#63E6BE]" fill="#63E6BE" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Cria a embalagem da tua marca
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Partilha dimensões, quantidade e referências visuais — recebes uma proposta em 24 horas.
            </p>
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
            >
              Iniciar projeto <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
