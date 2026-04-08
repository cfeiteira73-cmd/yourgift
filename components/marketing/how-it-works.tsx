"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Target, Lightbulb, CheckCircle, PackageCheck } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Target,
    accent: "#4DA3FF",
    title: "Define o objetivo",
    description:
      "Partilha o contexto do projeto — evento, onboarding, cliente VIP ou campanha interna. Quanto mais soubermos, mais precisa é a nossa proposta. O formulário demora menos de 5 minutos.",
    timeBadge: "5 min",
  },
  {
    number: "02",
    icon: Lightbulb,
    accent: "#74E7FF",
    title: "Recebe proposta personalizada",
    description:
      "A nossa equipa analisa o teu briefing e apresenta uma seleção de produtos com mockups digitais, preços e prazos. Sem compromisso, sem surpresas. Podes também usar o AI Project Builder.",
    timeBadge: "24–48h",
  },
  {
    number: "03",
    icon: CheckCircle,
    accent: "#63E6BE",
    title: "Aprovas branding e detalhes",
    description:
      "Partilhas logo, brandbook e preferências de personalização. Aprovação escrita antes de qualquer produção. Zero suposições — cada detalhe é confirmado contigo antes de avançar.",
    timeBadge: "1–2 dias",
  },
  {
    number: "04",
    icon: PackageCheck,
    accent: "#4DA3FF",
    title: "Produção, entrega e reorder",
    description:
      "Gerimos toda a produção, controlo de qualidade e logística. Tracking em tempo real. Histórico e ficheiros guardados para reorders instantâneos — sem repetir o processo de raiz.",
    timeBadge: "7–15 dias",
  },
];

const stats = [
  { value: "5 min", label: "para pedir proposta" },
  { value: "48h", label: "resposta garantida" },
  { value: "7–15 dias", label: "prazo médio produção" },
  { value: "100%", label: "acompanhamento" },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Processo
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Como funciona
          </h2>
          <p className="text-white/56 text-lg max-w-xl mx-auto">
            Um processo simples e estruturado, desenhado para equipas B2B que
            valorizam tempo e consistência.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14"
        >
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="relative group"
              >
                {/* Connector line between steps (desktop) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-[2.75rem] left-full w-5 h-px z-10">
                    <div
                      className="w-full h-full"
                      style={{
                        background: `linear-gradient(to right, ${step.accent}40, transparent)`,
                      }}
                    />
                  </div>
                )}

                <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.13] transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
                  {/* Step number + icon */}
                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="text-xs font-bold tracking-[0.1em] tabular-nums"
                      style={{ color: step.accent }}
                    >
                      {step.number}
                    </span>
                    <div
                      className="p-2 rounded-xl flex-shrink-0"
                      style={{
                        backgroundColor: `${step.accent}14`,
                        color: step.accent,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Time badge */}
                    <span
                      className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
                      style={{
                        color: step.accent,
                        borderColor: `${step.accent}28`,
                        backgroundColor: `${step.accent}0d`,
                      }}
                    >
                      {step.timeBadge}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/52 leading-relaxed flex-1">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-5 px-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] text-center"
            >
              <span className="text-2xl font-bold tracking-tight text-white mb-1">
                {stat.value}
              </span>
              <span className="text-xs text-white/40">{stat.label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-center"
        >
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors font-medium"
          >
            Ver processo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
