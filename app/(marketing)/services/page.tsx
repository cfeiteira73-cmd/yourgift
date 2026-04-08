import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import { Gift, Package, Box, Store, Truck, ArrowRight, Check } from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Serviços",
  description:
    "Corporate Gifts, Branded Merchandise, Packaging Premium, Company Stores e Fulfillment. Tudo o que a tua marca precisa para um branding de classe mundial.",
  canonical: "/services",
  keywords: [
    "corporate gifts empresas Portugal",
    "branded merchandise serviços",
    "packaging premium personalizado",
    "company stores privadas",
    "fulfillment merchandising",
  ],
});

const services = [
  {
    href: "/corporate-gifts",
    icon: Gift,
    accent: "#4DA3FF",
    label: "Corporate Gifts",
    title: "Corporate Gifts",
    description:
      "Presentes corporativos premium para clientes, parceiros e colaboradores. Cada peça é pensada para reforçar relações e comunicar os teus valores de marca.",
    features: [
      "Curadoria de produtos para cada ocasião",
      "Personalização com logo e mensagem",
      "Embalagem premium incluída",
      "Entrega direta ao destinatário",
    ],
  },
  {
    href: "/branded-merch",
    icon: Package,
    accent: "#74E7FF",
    label: "Branded Merch",
    title: "Branded Merchandise",
    description:
      "Merchandising de marca para colaboradores, eventos e campanhas. Desde t-shirts a mochilas — com o teu branding aplicado com precision.",
    features: [
      "Catálogo +500 produtos personalizáveis",
      "Mockup digital antes da produção",
      "Controlo de qualidade rigoroso",
      "Gestão de stock e reorders",
    ],
  },
  {
    href: "/packaging",
    icon: Box,
    accent: "#63E6BE",
    label: "Packaging",
    title: "Packaging Premium",
    description:
      "Embalagens personalizadas que amplificam a experiência de unboxing. Caixas, sacolas e materiais de preenchimento com o teu ADN de marca.",
    features: [
      "Design de embalagem personalizado",
      "Opções sustentáveis e recicladas",
      "Aplicação de logo por gravação, UV ou foiling",
      "Kits de onboarding completos",
    ],
  },
  {
    href: "/company-stores",
    icon: Store,
    accent: "#4DA3FF",
    label: "Company Stores",
    title: "Company Stores",
    description:
      "Loja online privada com o teu branding — exclusiva para colaboradores. Catálogo definido, preços negociados e sistema de aprovações integrado.",
    features: [
      "Plataforma white-label com o teu branding",
      "Gestão de encomendas e orçamentos",
      "Dashboard de relatórios em tempo real",
      "Suporte dedicado à conta",
    ],
  },
  {
    href: "/fulfillment",
    icon: Truck,
    accent: "#74E7FF",
    label: "Fulfillment",
    title: "Fulfillment & Logística",
    description:
      "Armazenagem, pick & pack e distribuição nacional e internacional. Gerimos toda a operação logística para que te focuses no teu negócio.",
    features: [
      "Armazém dedicado em Portugal",
      "Envio nacional em 24–48h",
      "Envio internacional para +40 países",
      "Tracking em tempo real",
    ],
  },
];

// Feature comparison: rows = features, cols = services (same order)
const comparisonFeatures = [
  { label: "Personalização", values: [true, true, true, true, false] },
  { label: "Mockup Digital", values: [true, true, true, true, false] },
  { label: "Controlo QC", values: [true, true, true, true, true] },
  { label: "Armazenagem", values: [false, false, false, false, true] },
  { label: "Envio Nacional", values: [true, true, true, true, true] },
  { label: "Envio Internacional", values: [true, false, false, false, true] },
  { label: "Dashboard", values: [false, false, false, true, true] },
  { label: "Suporte Dedicado", values: [true, true, true, true, true] },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* ─── Hero ─── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 mb-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Serviços
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-5 leading-[1.1]">
            Tudo o que precisas para um branding de classe mundial.
          </h1>
          <p className="text-white/56 text-lg mb-8 max-w-2xl">
            Da ideia à entrega — corporate gifts, branded merchandise, packaging premium,
            company stores e fulfillment. Uma plataforma, uma equipa, resultado consistente.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 bg-white text-[#07111F] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
            >
              Pedir proposta <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 border border-white/[0.14] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/[0.05] transition-all"
            >
              Ver catálogo
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Services Grid ─── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.href}
                className="group flex flex-col p-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-300"
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 flex-shrink-0"
                  style={{ backgroundColor: `${service.accent}14`, color: service.accent }}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Label */}
                <p
                  className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
                  style={{ color: service.accent }}
                >
                  {service.label}
                </p>

                {/* Title */}
                <h2 className="text-xl font-semibold text-white mb-3">
                  {service.title}
                </h2>

                {/* Description */}
                <p className="text-sm text-white/52 leading-relaxed mb-6">
                  {service.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-8 flex-1">
                  {service.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-white/68">
                      <Check
                        className="h-4 w-4 flex-shrink-0 mt-0.5"
                        style={{ color: service.accent }}
                      />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* Link */}
                <Link
                  href={service.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{ color: service.accent }}
                >
                  Saber mais
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Comparison Table ─── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 mb-24">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Comparação
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
            O que inclui cada serviço
          </h2>
          <p className="text-white/48 text-sm max-w-xl mx-auto">
            Alguns serviços podem ser combinados — fala connosco para uma solução à medida.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/42 uppercase tracking-[0.1em] w-48">
                    Funcionalidade
                  </th>
                  {services.map((s) => (
                    <th
                      key={s.href}
                      className="px-4 py-4 text-center text-xs font-semibold text-white/72 tracking-tight"
                    >
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row, i) => (
                  <tr
                    key={row.label}
                    className={`border-b border-white/[0.05] ${
                      i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-white/64 font-medium">
                      {row.label}
                    </td>
                    {row.values.map((val, j) => (
                      <td key={j} className="px-4 py-4 text-center">
                        {val ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#63E6BE]/12">
                            <Check className="h-3.5 w-3.5 text-[#63E6BE]" />
                          </span>
                        ) : (
                          <span className="inline-block w-4 h-px bg-white/16 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── CTA ─── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-10 md:p-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Pronto para começar?
          </p>
          <h2 className="text-2xl md:text-4xl font-semibold tracking-tight text-white mb-4 max-w-2xl mx-auto">
            Diz-nos o que precisas. Tratamos do resto.
          </h2>
          <p className="text-white/48 text-sm mb-8 max-w-lg mx-auto">
            Preenche o formulário de proposta e recebe uma resposta personalizada em 24h úteis.
          </p>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
          >
            Pedir proposta gratuita <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
