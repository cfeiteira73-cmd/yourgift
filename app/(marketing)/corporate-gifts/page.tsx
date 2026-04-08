import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  Gift,
  Star,
  Users,
  CalendarDays,
  Mic2,
  UserPlus,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Corporate Gifts Premium | yourgift.pt",
  description:
    "Presentes corporativos premium para clientes, parceiros e equipas. Curadoria, personalização e entrega — tudo gerido para ti.",
  canonical: "/corporate-gifts",
});

const useCases = [
  {
    icon: UserPlus,
    title: "Welcome Kits",
    description: "Primeira impressão inesquecível para novos colaboradores ou clientes estratégicos.",
    accent: "#4DA3FF",
  },
  {
    icon: Star,
    title: "Presentes de Natal",
    description: "Seleções premium para o fim de ano com embalagem exclusiva e entrega garantida a tempo.",
    accent: "#74E7FF",
  },
  {
    icon: Gift,
    title: "Client Appreciation",
    description: "Presentes personalizados para reconhecer e fidelizar os clientes mais importantes.",
    accent: "#63E6BE",
  },
  {
    icon: Users,
    title: "Team Milestones",
    description: "Celebra aniversários, promoções e conquistas da equipa com algo verdadeiramente memorável.",
    accent: "#4DA3FF",
  },
  {
    icon: Mic2,
    title: "Eventos & Conferências",
    description: "Brindes e kits de evento que reforçam a presença da marca em cada detalhe.",
    accent: "#74E7FF",
  },
  {
    icon: CalendarDays,
    title: "Onboarding Kits",
    description: "Caixas de onboarding estruturadas para integrar novos membros desde o primeiro dia.",
    accent: "#63E6BE",
  },
];

const products = [
  {
    name: "Premium Leather Journal",
    description:
      "Caderno de couro genuíno com gravação a laser do logótipo. Acabamento premium, papel 100g acid-free.",
    price: "€12/un",
    moq: "MOQ 50 unidades",
    accent: "#4DA3FF",
  },
  {
    name: "Insulated Tumbler",
    description:
      "Garrafa térmica de aço inoxidável 500ml. Mantém bebidas frias 24h ou quentes 12h. Gravação laser.",
    price: "€18/un",
    moq: "MOQ 100 unidades",
    accent: "#74E7FF",
  },
  {
    name: "Bamboo Organizer",
    description:
      "Organizador de secretária em bambu sustentável com impressão serigráfica a 2 cores. FSC certificado.",
    price: "€22/un",
    moq: "MOQ 25 unidades",
    accent: "#63E6BE",
  },
];

const steps = [
  {
    number: "01",
    title: "Briefing",
    description:
      "Partilha os objetivos, quantidade, orçamento e prazo. Em 24 horas tens uma resposta com sugestões.",
  },
  {
    number: "02",
    title: "Curadoria",
    description:
      "A nossa equipa seleciona os produtos ideais para o teu contexto e brand identity. Sem ruído.",
  },
  {
    number: "03",
    title: "Mockup",
    description:
      "Visualizas a proposta final com branding aplicado antes de confirmar a produção. Zero surpresas.",
  },
  {
    number: "04",
    title: "Entrega",
    description:
      "Produção, embalagem e entrega diretamente nos destinos indicados. Nacional e internacional, rastreável.",
  },
];

export default function CorporateGiftsPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
            Corporate Gifts
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-white mb-6 max-w-4xl mx-auto">
            Corporate Gifts que impressionam — e fidelizam.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
            Curadoria, personalização e entrega de presentes corporativos premium. Do briefing à porta
            do teu cliente — gerimos tudo para ti.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
      </section>

      {/* Stats Bar */}
      <section className="py-10 px-6 md:px-8 border-y border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "500+", label: "Produtos disponíveis" },
              { value: "48h", label: "Resposta a briefings" },
              { value: "MOQ 25", label: "Quantidade mínima" },
              { value: "100%", label: "Branding personalizado" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-bold text-[#4DA3FF] mb-1">{s.value}</div>
                <div className="text-sm text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Casos de Uso
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Para cada momento, o presente certo
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Desde o onboarding ao fim de ano — a solução ideal para cada ocasião corporativa.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px]"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${item.accent}12`, color: item.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Produtos em Destaque
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Qualidade que se sente na mão
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Seleção de produtos premium com branding de precisão e produção controlada.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.name}
                className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px]"
              >
                <div className="h-1.5 w-12 rounded-full mb-6" style={{ backgroundColor: product.accent }} />
                <h3 className="text-xl font-semibold text-white mb-3">{product.name}</h3>
                <p className="text-sm text-white/55 leading-relaxed mb-6">{product.description}</p>
                <div className="flex items-end justify-between pt-4 border-t border-white/[0.07]">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: product.accent }}>
                      {product.price}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{product.moq}</div>
                  </div>
                  <Link
                    href="/rfq"
                    className="text-xs font-medium text-white/55 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    Pedir <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              Processo
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              4 passos. Zero complicações.
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Um fluxo simples e transparente desde o primeiro contacto até à entrega final.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {steps.map((step) => (
              <div
                key={step.number}
                className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]"
              >
                <div className="text-3xl font-bold text-[#4DA3FF]/30 mb-4">{step.number}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]">
            <div className="inline-flex p-3 rounded-xl mb-6 bg-[#4DA3FF]/10">
              <CheckCircle2 className="h-6 w-6 text-[#4DA3FF]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Pronto para impressionar?
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Partilha o teu briefing e recebe uma proposta personalizada em 24 horas — sem compromisso.
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
