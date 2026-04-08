import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Warehouse,
  PackageCheck,
  Truck,
  Globe,
  ScanLine,
  RotateCcw,
  Activity,
  Factory,
  Store,
  MapPin,
  Star,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Fulfillment | yourgift.pt",
  description:
    "Produção, stock e entrega. Gestão completa da cadeia logística do teu branding — armazenagem, pick & pack, envio nacional e internacional.",
  canonical: "/fulfillment",
});

const services = [
  {
    icon: Warehouse,
    title: "Armazenagem",
    description:
      "Stock gerido no nosso armazém com inventário em tempo real. Sabes sempre o que tens disponível — por referência, tamanho e cor.",
    accent: "#4DA3FF",
  },
  {
    icon: PackageCheck,
    title: "Pick & Pack Individual",
    description:
      "Cada pedido separado, embalado com os teus materiais e etiquetado com o branding da empresa. Perfeito para company stores.",
    accent: "#74E7FF",
  },
  {
    icon: Factory,
    title: "Envio em Lote",
    description:
      "Centenas ou milhares de pacotes despachados simultaneamente para múltiplos destinos. Ideal para eventos, kits de equipa e campanhas.",
    accent: "#63E6BE",
  },
  {
    icon: Truck,
    title: "Envio Unitário",
    description:
      "Um pacote para um colaborador ou cliente. Com embalagem personalizada, mensagem incluída e tracking individual.",
    accent: "#4DA3FF",
  },
  {
    icon: Activity,
    title: "Tracking em Tempo Real",
    description:
      "O destinatário recebe notificação automática por email ou SMS. Tu tens visibilidade completa do estado de cada envio no dashboard.",
    accent: "#74E7FF",
  },
  {
    icon: RotateCcw,
    title: "Gestão de Devoluções",
    description:
      "Processo de devolução simplificado com etiquetas pré-pagas e reposição automática de stock. Sem dores de cabeça.",
    accent: "#63E6BE",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Receção de Stock",
    description:
      "O teu produto chega ao armazém. Inspecionamos, catalogamos por SKU e atualizamos o inventário em tempo real.",
    accent: "#4DA3FF",
  },
  {
    number: "02",
    title: "Processamento",
    description:
      "Cada pedido processado automaticamente ou com aprovação. Picking, embalagem personalizada e etiquetagem com rigor.",
    accent: "#74E7FF",
  },
  {
    number: "03",
    title: "Envio & Tracking",
    description:
      "O pacote sai com rastreamento e seguro incluído. Notificação automática ao destinatário por email ou SMS.",
    accent: "#63E6BE",
  },
  {
    number: "04",
    title: "Reporting",
    description:
      "Dashboard com histórico de envios, stock atual, taxa de retorno e métricas de satisfação por período e campanha.",
    accent: "#4DA3FF",
  },
];

const coverageZones = [
  {
    region: "Portugal",
    time: "1–3 dias",
    detail: "Continental, Madeira e Açores. Entrega ao domicílio ou ponto de recolha.",
    icon: MapPin,
    accent: "#4DA3FF",
    flag: "🇵🇹",
  },
  {
    region: "Europa",
    time: "3–7 dias",
    detail: "27 países UE + UK, Suíça, Noruega. Rastreamento DHL/UPS incluído.",
    icon: Globe,
    accent: "#74E7FF",
    flag: "🌍",
  },
  {
    region: "Mundo",
    time: "7–14 dias",
    detail: "50+ países. Alfândega e documentação tratados por nós. Sem surpresas.",
    icon: Globe,
    accent: "#63E6BE",
    flag: "🌐",
  },
];

const capabilities = [
  { label: "On-time delivery", value: "99.2%", accent: "#4DA3FF" },
  { label: "Envios totais", value: "50K+", accent: "#74E7FF" },
  { label: "Países cobertos", value: "50+", accent: "#63E6BE" },
  { label: "Envio nacional", value: "24–48h", accent: "#4DA3FF" },
];

const qualitySteps = [
  {
    icon: ScanLine,
    title: "Controlo QC na receção",
    description:
      "Inspecionamos cada lote recebido: verificação dimensional, cromática e de acabamentos antes de armazenar.",
    accent: "#4DA3FF",
  },
  {
    icon: PackageCheck,
    title: "Verificação no pick & pack",
    description:
      "Dupla verificação no momento da embalagem. Produto certo, quantidade certa, embalagem correta.",
    accent: "#74E7FF",
  },
  {
    icon: Activity,
    title: "Confirmação pós-entrega",
    description:
      "Recolhemos feedback de entrega e gerimos reclamações em menos de 4 horas úteis.",
    accent: "#63E6BE",
  },
];

export default function FulfillmentPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-4">
                Fulfillment & Logística
              </p>
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.1]">
                Produção, stock e entrega. Nós tratamos de tudo.
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed">
                Da fábrica à porta do cliente — gerimos cada etapa da cadeia logística do teu branding.
                Produção controlada, armazenagem inteligente, envio para 50+ países.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/rfq"
                  className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
                >
                  Pedir proposta gratuita <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/company-stores"
                  className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
                >
                  Ver Company Stores
                </Link>
              </div>
            </div>
            {/* Logistics flow visual */}
            <div className="relative hidden lg:block">
              <div className="space-y-3">
                {[
                  { icon: "🏭", label: "Produção", status: "Concluído", color: "#63E6BE", progress: 100 },
                  { icon: "📦", label: "Armazenagem", status: "Em stock", color: "#4DA3FF", progress: 100 },
                  { icon: "🔍", label: "Pick & Pack", status: "A processar", color: "#74E7FF", progress: 65 },
                  { icon: "🚚", label: "Envio", status: "Pendente", color: "#4DA3FF", progress: 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[#0B1526] border border-white/[0.06]"
                  >
                    <div className="text-xl w-8 text-center">{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-white">{item.label}</span>
                        <span className="text-xs font-medium" style={{ color: item.color }}>
                          {item.status}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.progress}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full blur-3xl opacity-15" style={{ backgroundColor: "#74E7FF" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 px-6 md:px-8 border-y border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {capabilities.map((c) => (
              <div key={c.label}>
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: c.accent }}>
                  {c.value}
                </div>
                <div className="text-sm text-white/45">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Serviços
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              End-to-end sem lacunas
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Seis serviços integrados para que não precises de gerir nenhum fornecedor de logística.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px]"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${service.accent}12`, color: service.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{service.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{service.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Coverage map */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Cobertura
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Entregamos onde a tua equipa está
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Portugal, Europa ou o mundo inteiro — a mesma qualidade de serviço em qualquer destino.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {coverageZones.map((zone) => {
              const Icon = zone.icon;
              return (
                <div
                  key={zone.region}
                  className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 text-center"
                >
                  <div className="text-4xl mb-4">{zone.flag}</div>
                  <h3 className="text-xl font-semibold text-white mb-1">{zone.region}</h3>
                  <div className="text-2xl font-bold mb-4" style={{ color: zone.accent }}>
                    {zone.time}
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed">{zone.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              Fluxo Operacional
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              O que acontece em cada etapa
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Transparência total em cada passo — sabes sempre o que está a acontecer.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {processSteps.map((step, i) => (
              <div key={step.number} className="relative">
                <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] h-full">
                  <div className="text-3xl font-bold mb-4" style={{ color: `${step.accent}30` }}>
                    {step.number}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{step.description}</p>
                </div>
                {i < processSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-2.5 w-5 h-px bg-white/[0.10] z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Controlo de Qualidade
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              99.2% on-time. Zero surpresas.
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Três pontos de verificação em cada envio para garantir que o produto certo chega no tempo certo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {qualitySteps.map((q) => {
              const Icon = q.icon;
              return (
                <div
                  key={q.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${q.accent}12`, color: q.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{q.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{q.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Company stores integration */}
      <section className="py-16 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="p-8 md:p-10 rounded-3xl border border-[#4DA3FF]/20 bg-gradient-to-br from-[#4DA3FF]/5 to-transparent">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="inline-flex p-4 rounded-2xl bg-[#4DA3FF]/10 flex-shrink-0">
                <Store className="h-8 w-8 text-[#4DA3FF]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Integrado com Company Stores
                </h3>
                <p className="text-white/60 leading-relaxed">
                  O fulfillment conecta nativamente com a tua company store. Cada pedido feito pelos
                  colaboradores dispara automaticamente o processo de pick, pack e envio — sem intervenção manual.
                </p>
              </div>
              <div className="flex-shrink-0">
                <Link
                  href="/company-stores"
                  className="inline-flex items-center gap-2 border border-[#4DA3FF]/30 text-[#4DA3FF] px-6 py-3 rounded-xl font-medium text-sm hover:bg-[#4DA3FF]/10 transition-all whitespace-nowrap"
                >
                  Ver Company Stores <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-6 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 text-[#74E7FF]" fill="#74E7FF" />
            ))}
          </div>
          <blockquote className="text-xl md:text-2xl font-medium text-white/85 leading-relaxed mb-8 italic">
            "Enviámos 800 presentes de fim de ano para colaboradores em 12 países europeus. Cada um com embalagem personalizada, cartão manuscrito e tracking individual. Tudo no prazo. Taxa de problemas: 0%."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#74E7FF]/30 to-[#4DA3FF]/10 border border-white/[0.1] flex items-center justify-center text-sm font-bold text-[#74E7FF]">
              RC
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Ricardo Carvalho</div>
              <div className="text-xs text-white/45">Operations Manager · Empresa Multinacional · 800 envios internacionais</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]">
            <div className="inline-flex p-3 rounded-xl mb-6 bg-[#74E7FF]/10">
              <CheckCircle2 className="h-6 w-6 text-[#74E7FF]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Pronto para simplificar a logística?
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Fala connosco e recebe uma proposta de fulfillment adaptada ao volume e necessidades da tua empresa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
              >
                Iniciar projeto <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/company-stores"
                className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
              >
                Ver Company Stores
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
