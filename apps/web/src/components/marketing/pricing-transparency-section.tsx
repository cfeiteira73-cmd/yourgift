"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

interface PricingTier {
  name: string;
  range: string;
  subtitle: string;
  idealFor: string;
  useCases: string[];
  benefits: string[];
  accent: string;
  featured?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: "Starter",
    range: "€500 – €2.500",
    subtitle: "Para arrancar com impacto",
    idealFor: "Startups, PMEs, primeiros projetos de branding",
    useCases: [
      "Onboarding kits para novas equipas",
      "Welcome pack para eventos pontuais",
      "Brinde de final de ano até 50 unidades",
    ],
    benefits: [
      "Até 50 unidades por projeto",
      "1 produto por encomenda",
      "Mockup digital incluído",
      "Resposta em 48h garantida",
      "Envio nacional rastreado",
    ],
    accent: "#74E7FF",
  },
  {
    name: "Growth",
    range: "€2.500 – €10.000",
    subtitle: "O tier mais escolhido",
    idealFor: "Empresas de 50–500 colaboradores com projetos recorrentes",
    useCases: [
      "Campanhas de merch sazonal",
      "Kits de evento com múltiplos produtos",
      "Company store privada para a equipa",
    ],
    benefits: [
      "Múltiplos produtos por projeto",
      "Gestor dedicado incluído",
      "Store privada opcional",
      "Produção em Portugal ou Ásia",
      "Reorder em 1 clique",
      "Tracking em tempo real",
    ],
    accent: "#4DA3FF",
    featured: true,
  },
  {
    name: "Enterprise",
    range: "€10.000+",
    subtitle: "Condições à medida da empresa",
    idealFor: "Grandes empresas, grupos e multinacionais em Portugal",
    useCases: [
      "Campanhas globais de branded merch",
      "Fulfillment e gestão de stock",
      "Integrações com sistemas internos",
    ],
    benefits: [
      "Condições comerciais negociadas",
      "Fulfillment dedicado",
      "Integrações API/ERP disponíveis",
      "SLA garantido por contrato",
      "Relatórios de impacto e sustentabilidade",
      "Account manager sénior",
    ],
    accent: "#63E6BE",
  },
];

function TierCard({ tier, index }: { tier: PricingTier; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.55, delay: index * 0.1 }}
      className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-300 ${
        tier.featured
          ? "border-[#4DA3FF]/40 bg-[#4DA3FF]/[0.06]"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.13] hover:bg-white/[0.05]"
      }`}
      style={
        tier.featured
          ? {
              boxShadow: "0 0 40px rgba(77,163,255,0.12), 0 0 80px rgba(77,163,255,0.06)",
            }
          : undefined
      }
    >
      {tier.featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <div
            className="px-4 py-1 rounded-full text-xs font-semibold text-[#07111F] tracking-wide"
            style={{ background: "linear-gradient(90deg, #4DA3FF, #74E7FF)" }}
          >
            Mais escolhido
          </div>
        </div>
      )}

      {/* Tier name + range */}
      <div className="mb-5">
        <p
          className="text-xs font-semibold uppercase tracking-[0.16em] mb-2"
          style={{ color: tier.accent }}
        >
          {tier.name}
        </p>
        <div
          className="text-2xl font-bold tracking-tight mb-1"
          style={{ color: tier.featured ? "#fff" : "rgba(255,255,255,0.90)" }}
        >
          {tier.range}
        </div>
        <p className="text-sm text-white/50">{tier.subtitle}</p>
      </div>

      {/* Ideal for */}
      <div className="mb-5 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03]">
        <p className="text-xs text-white/38 uppercase tracking-widest mb-1 font-semibold">Ideal para</p>
        <p className="text-sm text-white/65 leading-snug">{tier.idealFor}</p>
      </div>

      {/* Use cases */}
      <div className="mb-5">
        <p className="text-xs text-white/38 uppercase tracking-widest mb-2.5 font-semibold">Casos típicos</p>
        <ul className="space-y-2">
          {tier.useCases.map((uc) => (
            <li key={uc} className="flex items-start gap-2.5 text-sm text-white/55">
              <span
                className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: tier.accent, opacity: 0.7 }}
              />
              {uc}
            </li>
          ))}
        </ul>
      </div>

      {/* Benefits */}
      <div className="flex-1 mb-7">
        <p className="text-xs text-white/38 uppercase tracking-widest mb-2.5 font-semibold">Inclui</p>
        <ul className="space-y-2.5">
          {tier.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2.5">
              <Check
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: tier.accent }}
              />
              <span className="text-sm text-white/70">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <Link
        href="/contact"
        className={`group flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
          tier.featured
            ? "bg-[#4DA3FF] text-[#07111F] hover:bg-[#74E7FF]"
            : "border border-white/[0.12] bg-white/[0.05] text-white/80 hover:border-white/[0.22] hover:bg-white/[0.09] hover:text-white"
        }`}
      >
        Pedir estimativa gratuita
        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </motion.div>
  );
}

export function PricingTransparencySection() {
  return (
    <section className="py-24 md:py-32 bg-[#0B1526]/60 relative overflow-hidden">
      {/* Background orb */}
      <div
        className="absolute top-0 right-1/4 w-[500px] h-[400px] rounded-full opacity-[0.06] blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #4DA3FF 0%, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-4">
            Investimento
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Preços que fazem sentido{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #4DA3FF, #74E7FF, #63E6BE)",
              }}
            >
              para empresas
            </span>
          </h2>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            Não trabalhamos com tabelas rígidas. Cada projecto é único — aqui está
            uma referência de investimento para te orientares.
          </p>
        </motion.div>

        {/* Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <TierCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/[0.08] bg-white/[0.03]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#63E6BE] animate-pulse" />
            <span className="text-sm text-white/55">
              Proposta personalizada em{" "}
              <strong className="text-white/80">24h</strong> — sem compromisso
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
