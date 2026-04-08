import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquare,
  FileText,
  Eye,
  Factory,
  Truck,
  CheckCircle2,
  X,
  Minus,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Como Funciona | yourgift.pt",
  description:
    "Um processo simples e transparente: briefing, proposta, mockup, produção e entrega. Resultados extraordinários.",
  canonical: "/how-it-works",
});

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Briefing",
    duration: "Dia 1",
    description:
      "Tudo começa com uma conversa. Partilhas connosco o contexto do projeto: o que precisas, para quando, para quem e com que orçamento indicativo.",
    detail:
      "Não há formulários complexos. Um email, uma chamada ou o nosso formulário de RFQ chegam. Em menos de 24 horas tens resposta de um gestor de conta dedicado.",
    accent: "#4DA3FF",
  },
  {
    number: "02",
    icon: FileText,
    title: "Proposta",
    duration: "Dias 1–3",
    description:
      "Com base no teu briefing, preparamos uma proposta detalhada com opções de produto, técnicas de branding, MOQ, preços e prazos.",
    detail:
      "Apresentamos sempre 2–3 alternativas para que possas escolher o equilíbrio certo entre qualidade, custo e prazo. Sem letras pequenas.",
    accent: "#74E7FF",
  },
  {
    number: "03",
    icon: Eye,
    title: "Mockup",
    duration: "Dias 3–7",
    description:
      "Depois da aprovação da proposta, criamos mockups digitais detalhados com o teu branding aplicado em cada produto selecionado.",
    detail:
      "Podes pedir revisões ilimitadas ao mockup até ficares 100% satisfeito. Só avançamos para produção quando deres luz verde.",
    accent: "#63E6BE",
  },
  {
    number: "04",
    icon: Factory,
    title: "Produção",
    duration: "Dias 7–21",
    description:
      "Com o mockup aprovado, iniciamos a produção. Acompanhamos cada etapa com o fornecedor e fazemos controlo de qualidade antes do envio.",
    detail:
      "Recebes atualizações proativas sobre o estado da produção. Nenhuma surpresa, nenhum atraso não comunicado.",
    accent: "#4DA3FF",
  },
  {
    number: "05",
    icon: Truck,
    title: "Entrega",
    duration: "Dias 14–28",
    description:
      "Os teus produtos chegam embalados e prontos a usar, diretamente nos destinos que indicaste — um ou muitos.",
    detail:
      "Rastreamento em tempo real, seguro incluído e notificação automática para cada destinatário. Pós-entrega, receves relatório completo.",
    accent: "#74E7FF",
  },
];

const timelineItems = [
  { day: "Dia 1", event: "Briefing recebido + resposta inicial" },
  { day: "Dia 2–3", event: "Proposta com opções e preços" },
  { day: "Dia 4–7", event: "Mockups digitais e revisões" },
  { day: "Dia 8", event: "Aprovação final e arranque de produção" },
  { day: "Dia 8–21", event: "Produção + controlo de qualidade QC" },
  { day: "Dia 22–28", event: "Envio e entrega nos destinos" },
];

const comparisonRows = [
  {
    feature: "Tempo de resposta inicial",
    yourgift: "< 24 horas",
    agencia: "3–5 dias úteis",
    importacao: "1–2 semanas",
  },
  {
    feature: "Mockup digital",
    yourgift: "Incluído, ilimitado",
    agencia: "Cobrado à parte",
    importacao: "Raramente disponível",
  },
  {
    feature: "Controlo de qualidade",
    yourgift: "100% dos lotes",
    agencia: "Variável",
    importacao: "Inexistente",
  },
  {
    feature: "Prazo médio",
    yourgift: "2–4 semanas",
    agencia: "4–8 semanas",
    importacao: "6–14 semanas",
  },
  {
    feature: "Gestor dedicado",
    yourgift: true,
    agencia: false,
    importacao: false,
  },
  {
    feature: "Fulfillment & entrega",
    yourgift: true,
    agencia: false,
    importacao: false,
  },
];

function ComparisonCell({
  value,
  highlight = false,
}: {
  value: string | boolean;
  highlight?: boolean;
}) {
  if (typeof value === "boolean") {
    return (
      <div className={`flex justify-center ${highlight ? "" : ""}`}>
        {value ? (
          <CheckCircle2 className={`h-5 w-5 ${highlight ? "text-[#63E6BE]" : "text-[#63E6BE]/40"}`} />
        ) : (
          <X className="h-5 w-5 text-white/20" />
        )}
      </div>
    );
  }
  return (
    <span className={`text-sm ${highlight ? "text-white font-medium" : "text-white/45"}`}>
      {value}
    </span>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Como Funciona
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-white mb-6 max-w-4xl mx-auto">
            Um processo simples. Resultados extraordinários.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
            5 etapas claras, prazos realistas e comunicação proativa — para que o teu projeto corra
            sempre como planeado.
          </p>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
          >
            Começar agora <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 5-Step Process */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              O Processo
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              5 etapas. Zero dúvidas.
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Cada etapa tem um responsável, um prazo e um entregável claro.
            </p>
          </div>
          <div className="space-y-5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="p-7 md:p-8 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 md:w-20 flex-shrink-0">
                      <div
                        className="inline-flex p-3 rounded-xl"
                        style={{ backgroundColor: `${step.accent}12`, color: step.accent }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-xs text-white/35 font-medium">{step.duration}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-white/20">{step.number}</span>
                        <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                      </div>
                      <p className="text-white/70 leading-relaxed mb-3">{step.description}</p>
                      <p className="text-sm text-white/45 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Timeline Típica
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Projeto de 2 a 4 semanas
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Um projeto standard, do primeiro contacto à entrega, demora entre 14 e 28 dias.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-white/[0.07]" />
            <div className="space-y-4">
              {timelineItems.map((item, i) => (
                <div key={i} className="flex items-start gap-5 relative">
                  <div className="flex-shrink-0 w-20 text-right">
                    <span className="text-xs font-medium text-[#74E7FF]">{item.day}</span>
                  </div>
                  <div
                    className="flex-shrink-0 w-3 h-3 rounded-full mt-0.5 border-2 border-[#74E7FF] bg-[rgb(7,17,31)] relative z-10"
                    style={{ marginLeft: "-6px" }}
                  />
                  <div className="flex-1 pb-4">
                    <p className="text-sm text-white/65 leading-relaxed">{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Comparação
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              yourgift.pt vs alternativas
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Compara a experiência de trabalhar connosco face a uma agência tradicional ou importação direta.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-white/[0.07]">
              <div className="px-6 py-4 bg-white/[0.03]" />
              <div className="px-4 py-4 bg-[#4DA3FF]/10 border-l border-[#4DA3FF]/20 text-center">
                <span className="text-sm font-semibold text-[#4DA3FF]">yourgift.pt</span>
              </div>
              <div className="px-4 py-4 bg-white/[0.02] border-l border-white/[0.07] text-center">
                <span className="text-sm font-medium text-white/40">Agência Tradicional</span>
              </div>
              <div className="px-4 py-4 bg-white/[0.02] border-l border-white/[0.07] text-center">
                <span className="text-sm font-medium text-white/40">Importação Direta</span>
              </div>
            </div>
            {/* Rows */}
            {comparisonRows.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 ${i < comparisonRows.length - 1 ? "border-b border-white/[0.05]" : ""}`}
              >
                <div className="px-6 py-4 bg-white/[0.01]">
                  <span className="text-sm text-white/55">{row.feature}</span>
                </div>
                <div className="px-4 py-4 bg-[#4DA3FF]/[0.04] border-l border-[#4DA3FF]/20 flex justify-center items-center">
                  <ComparisonCell value={row.yourgift} highlight />
                </div>
                <div className="px-4 py-4 border-l border-white/[0.05] flex justify-center items-center">
                  <ComparisonCell value={row.agencia} />
                </div>
                <div className="px-4 py-4 border-l border-white/[0.05] flex justify-center items-center">
                  <ComparisonCell value={row.importacao} />
                </div>
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
              Pronto para começar?
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Envia o teu briefing hoje e recebe uma proposta detalhada em menos de 24 horas — sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
              >
                Pedir proposta gratuita <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
              >
                Falar com a equipa
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
