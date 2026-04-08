import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  Store,
  BookOpen,
  Shield,
  CheckCircle2,
  RefreshCw,
  BarChart2,
  HeadphonesIcon,
  Zap,
  Users,
  Globe,
  Briefcase,
  Rocket,
  Star,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Company Stores | yourgift.pt",
  description:
    "Lojas privadas para equipas e departamentos. Catálogo próprio, preços personalizados por equipa, reorder em 1 clique — no ar em 72 horas.",
  canonical: "/company-stores",
});

const storeFlow = [
  {
    step: "01",
    icon: Store,
    title: "Criamos a tua loja",
    description:
      "Setup completo com o branding da empresa: cores, logótipo, domínio personalizado (loja.tuaempresa.pt). Em 72 horas, sem linha de código.",
    accent: "#4DA3FF",
  },
  {
    step: "02",
    icon: BookOpen,
    title: "Carregamos o catálogo",
    description:
      "Produtos aprovados com fotos profissionais, descrições e preços internos. Podes adicionar, remover ou atualizar a qualquer momento.",
    accent: "#74E7FF",
  },
  {
    step: "03",
    icon: Shield,
    title: "Defines as permissões",
    description:
      "Cada equipa, departamento ou região vê apenas o que deve ver. Subsídios automáticos, limites de gastos e aprovações configuráveis.",
    accent: "#63E6BE",
  },
  {
    step: "04",
    icon: Zap,
    title: "Colaboradores fazem pedidos",
    description:
      "Interface simples e mobile-first. Pedidos com ou sem aprovação de gestor — tu defines o fluxo que faz sentido para a tua empresa.",
    accent: "#4DA3FF",
  },
  {
    step: "05",
    icon: RefreshCw,
    title: "Nós tratamos do fulfillment",
    description:
      "Produção, embalagem personalizada e envio direto para o colaborador ou armazém da empresa. Tracking em tempo real incluído.",
    accent: "#74E7FF",
  },
];

const features = [
  {
    icon: BookOpen,
    title: "Catálogo Personalizado",
    description: "Apenas os produtos aprovados pela empresa, com fotos profissionais e descrições editáveis a qualquer momento.",
    accent: "#4DA3FF",
  },
  {
    icon: Shield,
    title: "Preços por Equipa",
    description: "Define preços diferentes por grupo ou departamento. Subsídios automáticos e limites de gastos configuráveis.",
    accent: "#74E7FF",
  },
  {
    icon: CheckCircle2,
    title: "Aprovação Configurável",
    description: "Fluxo de aprovação opcional com notificações automáticas para gestores. Pedidos simples ou com validação.",
    accent: "#63E6BE",
  },
  {
    icon: RefreshCw,
    title: "Reorder 1-Click",
    description: "Repete pedidos anteriores com um clique. Histórico completo por utilizador, equipa e período.",
    accent: "#4DA3FF",
  },
  {
    icon: BarChart2,
    title: "Dashboard Analytics",
    description: "Relatórios em tempo real: gastos por departamento, produtos mais pedidos, tendências e exportação para Excel.",
    accent: "#74E7FF",
  },
  {
    icon: HeadphonesIcon,
    title: "Suporte Dedicado",
    description: "Um gestor de conta exclusivo para a tua empresa. Resposta em menos de 4 horas úteis, sempre.",
    accent: "#63E6BE",
  },
];

const whoUses = [
  {
    icon: Rocket,
    title: "Startups em crescimento",
    description:
      "Equipas que crescem rápido precisam de onboarding kits escaláveis. A loja elimina a gestão manual de pedidos para cada nova contratação.",
    accent: "#4DA3FF",
  },
  {
    icon: Users,
    title: "Empresas 200+ colaboradores",
    description:
      "Com múltiplos departamentos e orçamentos distintos, a loja centraliza pedidos e dá visibilidade total ao departamento de compras.",
    accent: "#74E7FF",
  },
  {
    icon: Globe,
    title: "Equipas remotas e distribuídas",
    description:
      "Colaboradores em múltiplas cidades ou países fazem os seus pedidos e recebem em casa — a empresa não gere logística.",
    accent: "#63E6BE",
  },
  {
    icon: Briefcase,
    title: "Agências de comunicação",
    description:
      "Gerem lojas privadas para vários clientes numa plataforma única, com branding independente e faturação separada.",
    accent: "#4DA3FF",
  },
];

const pricingTiers = [
  {
    name: "Essencial",
    price: "Gratuito",
    description: "Para empresas que estão a começar",
    features: [
      "Até 50 produtos no catálogo",
      "1 grupo de utilizadores",
      "Pedidos com aprovação manual",
      "Relatórios básicos",
      "Suporte por email",
    ],
    cta: "Começar grátis",
    accent: "#4DA3FF",
    featured: false,
  },
  {
    name: "Pro",
    price: "€99/mês",
    description: "Para equipas em crescimento",
    features: [
      "Produtos ilimitados",
      "Até 10 grupos / departamentos",
      "Fluxo de aprovação configurável",
      "Dashboard analytics avançado",
      "Integrações SSO (Google, Microsoft)",
      "Suporte prioritário 4h",
    ],
    cta: "Iniciar trial 14 dias",
    accent: "#74E7FF",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "€299/mês",
    description: "Para grandes organizações",
    features: [
      "Multisite e multilíngua",
      "Grupos e permissões ilimitados",
      "API REST completa + webhooks",
      "SLA garantido 99.9%",
      "Gestor de conta dedicado",
      "Onboarding personalizado",
    ],
    cta: "Falar com a equipa",
    accent: "#63E6BE",
    featured: false,
  },
];

const integrations = [
  { name: "Slack", color: "#74E7FF" },
  { name: "Google Workspace", color: "#4DA3FF" },
  { name: "Microsoft 365", color: "#74E7FF" },
  { name: "Workday", color: "#63E6BE" },
  { name: "BambooHR", color: "#4DA3FF" },
  { name: "SSO / SAML", color: "#63E6BE" },
];

export default function CompanyStoresPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-4">
            Company Stores
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-[1.1]">
            A loja privada da tua empresa. No ar em 72 horas.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
            Catálogo próprio, preços personalizados por equipa e reorder em 1 clique —
            tudo numa loja privada com o branding da tua empresa. Nós tratamos do fulfillment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
            >
              Criar a minha loja <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
            >
              Ver como funciona
            </Link>
          </div>
          {/* Store preview mockup */}
          <div className="max-w-3xl mx-auto rounded-2xl border border-white/[0.08] bg-[#0B1526] overflow-hidden">
            <div className="px-5 py-3 bg-white/[0.04] border-b border-white/[0.06] flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </div>
              <div className="flex-1 h-6 rounded-md bg-white/[0.06] flex items-center px-3">
                <span className="text-xs text-white/30">loja.tuaempresa.pt</span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4DA3FF] mb-0.5">Olá, Ana</div>
                  <div className="text-sm text-white/60">O que queres hoje?</div>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#63E6BE]/10 text-xs font-medium text-[#63E6BE]">
                  Saldo: €150
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Kit Onboarding", "Hoodie Team", "Caneca"].map((item, i) => (
                  <div key={item} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                    <div className="text-xl mb-1">{["🎁", "👕", "☕"][i]}</div>
                    <div className="text-xs font-medium text-white/70">{item}</div>
                    <div className="text-xs text-[#4DA3FF] mt-1">{["€45", "€32", "€12"][i]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 px-6 md:px-8 border-y border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "72h", label: "Setup completo" },
              { value: "100+", label: "Empresas ativas" },
              { value: "1-click", label: "Reorder simplificado" },
              { value: "99.9%", label: "Uptime garantido" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-bold text-[#4DA3FF] mb-1">{s.value}</div>
                <div className="text-sm text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — 5 steps */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Como Funciona
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Como funciona a tua loja
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Cinco passos do setup ao primeiro pedido. Tratamos de tudo o que é técnico.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {storeFlow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative">
                  <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] h-full">
                    <div
                      className="inline-flex p-2.5 rounded-xl mb-4"
                      style={{ backgroundColor: `${step.accent}15`, color: step.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold mb-2" style={{ color: `${step.accent}35` }}>
                      {step.step}
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-xs text-white/50 leading-relaxed">{step.description}</p>
                  </div>
                  {i < storeFlow.length - 1 && (
                    <div className="hidden md:block absolute top-8 -right-2 w-4 h-px bg-white/[0.10] z-10" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who uses */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              Quem usa Company Stores
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Feito para empresas que crescem
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Qualquer empresa que distribua merch, onboarding kits ou presentes internamente beneficia de ter uma loja.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {whoUses.map((segment) => {
              const Icon = segment.icon;
              return (
                <div
                  key={segment.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${segment.accent}12`, color: segment.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{segment.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{segment.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Funcionalidades
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Tudo o que a tua empresa precisa
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Uma plataforma completa para gerir merch e branding interno de forma eficiente.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-5"
                    style={{ backgroundColor: `${feat.accent}12`, color: feat.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 px-6 md:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-4">
            Integrações
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
            Conecta com as ferramentas que já usas
          </h2>
          <p className="text-white/55 mb-10">
            SSO nativo, sincronização de colaboradores e notificações onde a tua equipa já trabalha.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {integrations.map((int) => (
              <div
                key={int.name}
                className="px-4 py-2 rounded-full border border-white/[0.1] bg-white/[0.04] text-sm font-medium text-white/65 hover:border-white/20 hover:text-white/90 transition-all"
                style={{ borderColor: `${int.color}25` }}
              >
                <span style={{ color: int.color }}>●</span>{" "}
                {int.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Planos
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Começa grátis, escala conforme cresces
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Sem contratos de longo prazo. Cancela quando quiseres.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`p-7 rounded-2xl border transition-all duration-300 ${
                  tier.featured
                    ? "bg-gradient-to-b from-white/[0.09] to-white/[0.04] border-white/[0.18]"
                    : "bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-white/[0.07]"
                }`}
              >
                {tier.featured && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <Zap className="h-3.5 w-3.5 text-[#74E7FF]" />
                    <span className="text-xs font-semibold text-[#74E7FF] uppercase tracking-[0.1em]">
                      Mais popular
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-semibold text-white mb-1">{tier.name}</h3>
                <p className="text-sm text-white/45 mb-4">{tier.description}</p>
                <div className="text-3xl font-bold mb-6" style={{ color: tier.accent }}>
                  {tier.price}
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                      <CheckCircle2
                        className="h-4 w-4 flex-shrink-0 mt-0.5"
                        style={{ color: tier.accent }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/rfq"
                  className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
                    tier.featured
                      ? "bg-white text-[#07111F] hover:bg-white/90"
                      : "border border-white/[0.15] text-white hover:border-white/30"
                  }`}
                >
                  {tier.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-6 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 text-[#4DA3FF]" fill="#4DA3FF" />
            ))}
          </div>
          <blockquote className="text-xl md:text-2xl font-medium text-white/85 leading-relaxed mb-8 italic">
            "Tínhamos 3 pessoas a gerir pedidos de merch manualmente. Com a company store, esse tempo foi para zero. Cada novo colaborador faz o próprio pedido de onboarding kit — e nós nem sabemos que aconteceu."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#74E7FF]/30 to-[#4DA3FF]/10 border border-white/[0.1] flex items-center justify-center text-sm font-bold text-[#74E7FF]">
              MF
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Marta Ferreira</div>
              <div className="text-xs text-white/45">HR Director · Scale-up Porto · 280 colaboradores</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]">
            <div className="inline-flex p-3 rounded-xl mb-6 bg-[#4DA3FF]/10">
              <Store className="h-6 w-6 text-[#4DA3FF]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Cria a tua loja em 72 horas
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Fala connosco hoje e a tua loja privada está operacional antes do fim da semana.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
              >
                Criar a minha loja <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
              >
                Ver demonstração
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
