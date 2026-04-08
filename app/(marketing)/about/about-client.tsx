"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

/* ─── Data ──────────────────────────────────────────────────── */

const STATS = [
  { value: "2020", label: "Fundada em" },
  { value: "312", label: "Clientes activos" },
  { value: "20.000+", label: "Produtos disponíveis" },
  { value: "15+", label: "Países de entrega" },
];

const VALUES = [
  {
    icon: "🎯",
    title: "Qualidade",
    description:
      "Cada produto passa por controlo de qualidade rigoroso antes de sair de produção. Sem compromissos na experiência final.",
    accent: "#4DA3FF",
  },
  {
    icon: "🔍",
    title: "Transparência",
    description:
      "Preços claros, prazos realistas e comunicação directa. Nunca ficás sem saber o estado do teu projeto.",
    accent: "#74E7FF",
  },
  {
    icon: "🤝",
    title: "Parceria",
    description:
      "Não somos um fornecedor genérico. Aprendemos a tua marca, os teus padrões e tornamo-nos parte da tua equipa.",
    accent: "#63E6BE",
  },
  {
    icon: "🌱",
    title: "Sustentabilidade",
    description:
      "Parceiros certificados FSC, SEDEX e OEKO-TEX. Reduzimos o impacto ambiental sem sacrificar a qualidade.",
    accent: "#4DA3FF",
  },
];

const DIFFERENCES = [
  {
    us: "Gestor dedicado que conhece a tua marca",
    them: "Conta-corrente num fornecedor anónimo",
  },
  {
    us: "Mockup digital antes de qualquer produção",
    them: "Surpresas só quando o produto chega",
  },
  {
    us: "Proposta em 48h, resposta sempre em 24h",
    them: "Meses de vai-e-vem sem resposta clara",
  },
  {
    us: "Dashboard com tracking em tempo real",
    them: "Nenhum portal, tudo por WhatsApp",
  },
  {
    us: "Reorder em 1 clique com histórico guardado",
    them: "Cada encomenda começa do zero",
  },
  {
    us: "Fabricantes auditados em 5 países",
    them: "Origem desconhecida, qualidade imprevisível",
  },
];

const CLIENTS = [
  { name: "Galp", icon: "⛽" },
  { name: "EDP", icon: "⚡" },
  { name: "Sonae", icon: "🛒" },
  { name: "Jerónimo Martins", icon: "🏪" },
  { name: "NOS", icon: "📡" },
  { name: "MEO", icon: "📱" },
  { name: "Millennium BCP", icon: "🏦" },
  { name: "Santander", icon: "🔴" },
  { name: "BPI", icon: "💳" },
  { name: "KPMG", icon: "📊" },
  { name: "Deloitte", icon: "🔷" },
  { name: "PwC", icon: "📈" },
  { name: "Vodafone", icon: "📶" },
  { name: "Altice", icon: "🌐" },
  { name: "CTT", icon: "✉️" },
  { name: "TAP", icon: "✈️" },
];

/* ─── Animation helpers ──────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay },
  }),
};

/* ─── Component ──────────────────────────────────────────────── */

export function AboutPageClient() {
  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-[0.08] blur-[120px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(77,163,255,0.7) 0%, rgba(116,231,255,0.4) 50%, transparent 80%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 md:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="max-w-4xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-4">
              Sobre nós
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.12]">
              Somos o parceiro de branding que as{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #4DA3FF, #74E7FF, #63E6BE)",
                }}
              >
                melhores empresas portuguesas
              </span>{" "}
              escolhem.
            </h1>
            <p className="text-white/55 text-lg md:text-xl leading-relaxed max-w-2xl">
              Desde 2020 que transformamos a forma como as empresas gerem o seu
              universo de branding — dos presentes aos colaboradores, dos eventos
              às company stores privadas.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0.2}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16"
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="p-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-[#4DA3FF] mb-1">
                  {s.value}
                </div>
                <div className="text-sm text-white/45">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STORY ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            {/* Left — text */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-4">
                A nossa história
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-6">
                Nascemos da frustração de um problema que toda a empresa conhece.
              </h2>
              <div className="space-y-4 text-white/58 leading-relaxed">
                <p>
                  Em 2020, os nossos fundadores viviam na pele o mesmo problema que
                  milhares de empresas enfrentam: gerir branding e merchandising era
                  caótico. Fornecedores desconhecidos, qualidade inconsistente,
                  prazos que nunca se cumpriam e zero visibilidade sobre o que estava
                  a acontecer.
                </p>
                <p>
                  A yourgift.pt nasceu com uma missão simples: ser o parceiro que
                  toda a empresa merece ter — alguém que conhece a tua marca, antecipa
                  os teus problemas e entrega resultados consistentemente premium.
                </p>
                <p>
                  Hoje somos 12 pessoas apaixonadas por design, logística e
                  experiência B2B. Gerimos centenas de projetos por ano, em Portugal
                  e além-fronteiras, para algumas das maiores empresas do país.
                </p>
              </div>
            </motion.div>

            {/* Right — team culture card */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 relative overflow-hidden">
                {/* Glow */}
                <div
                  className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[60px] opacity-15 pointer-events-none"
                  style={{ background: "#4DA3FF" }}
                />

                <div className="relative">
                  <div className="text-4xl mb-4">👥</div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    Somos 12 pessoas.
                  </h3>
                  <p className="text-white/55 leading-relaxed mb-6">
                    Apaixonadas por design, logística e experiência B2B. Cada
                    membro da equipa tem um papel directo nos projectos dos clientes
                    — sem camadas, sem burocracia.
                  </p>

                  <div className="space-y-3">
                    {[
                      { role: "Account Managers", count: "4", color: "#4DA3FF" },
                      { role: "Design & Mockups", count: "3", color: "#74E7FF" },
                      { role: "Operações & Logística", count: "3", color: "#63E6BE" },
                      { role: "Tecnologia & Produto", count: "2", color: "#4DA3FF" },
                    ].map((team) => (
                      <div
                        key={team.role}
                        className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0"
                      >
                        <span className="text-sm text-white/60">{team.role}</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: team.color }}
                        >
                          {team.count} pessoas
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── VALUES ─────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1526]/60 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-4">
              Os nossos valores
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              O que nos guia todos os dias
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.5, delay: i * 0.09 }}
                className="group p-7 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.13] hover:bg-white/[0.05] transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="text-2xl w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{
                      backgroundColor: `${v.accent}10`,
                      border: `1px solid ${v.accent}20`,
                    }}
                  >
                    {v.icon}
                  </div>
                  <div>
                    <h3
                      className="text-lg font-semibold mb-2"
                      style={{ color: v.accent }}
                    >
                      {v.title}
                    </h3>
                    <p className="text-sm text-white/55 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORQUE SOMOS DIFERENTES ────────────────────────── */}
      <section className="py-20 md:py-28 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63E6BE] mb-4">
              A nossa diferença
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Porque somos diferentes
            </h2>
            <p className="text-white/48 text-base max-w-lg mx-auto">
              Não somos mais um fornecedor. Somos o parceiro que a tua marca merece.
            </p>
          </motion.div>

          {/* Comparison table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.55 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
          >
            {/* Header row */}
            <div className="grid grid-cols-2 border-b border-white/[0.07]">
              <div className="px-6 py-4 bg-[#63E6BE]/[0.06] border-r border-white/[0.07]">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#63E6BE]">
                  yourgift.pt
                </span>
              </div>
              <div className="px-6 py-4 bg-white/[0.02]">
                <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                  Fornecedor genérico
                </span>
              </div>
            </div>

            {DIFFERENCES.map((d, i) => (
              <motion.div
                key={d.us}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                className={`grid grid-cols-2 border-b border-white/[0.05] last:border-0 ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                }`}
              >
                <div className="px-6 py-4 flex items-center gap-3 border-r border-white/[0.05]">
                  <Check className="h-4 w-4 text-[#63E6BE] flex-shrink-0" />
                  <span className="text-sm text-white/80">{d.us}</span>
                </div>
                <div className="px-6 py-4 flex items-center gap-3">
                  <span className="text-xs text-red-400/60 flex-shrink-0 font-bold">✕</span>
                  <span className="text-sm text-white/35">{d.them}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CLIENT LOGOS ───────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#0B1526]/50 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55 }}
            className="text-center mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30 mb-2">
              Confiam em nós
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-white">
              Empresas que escolheram a yourgift.pt
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {CLIENTS.map((client, i) => (
              <motion.div
                key={client.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200 cursor-default group"
              >
                <span className="text-2xl grayscale group-hover:grayscale-0 transition-all duration-300">
                  {client.icon}
                </span>
                <span className="text-[11px] text-white/35 group-hover:text-white/65 transition-colors font-medium text-center leading-tight">
                  {client.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 border-t border-white/[0.05] relative overflow-hidden">
        {/* Glow */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.12] blur-[100px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(77,163,255,0.7) 0%, rgba(99,230,190,0.4) 60%, transparent 80%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-4">
              Vamos trabalhar juntos
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-5 max-w-2xl mx-auto">
              Pronto para ter um parceiro de branding de confiança?
            </h2>
            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
              Fala connosco hoje. Proposta personalizada em 24h, sem compromisso.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/contact"
                className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-semibold text-[#07111F] text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(77,163,255,0.35)]"
                style={{
                  background: "linear-gradient(135deg, #4DA3FF 0%, #74E7FF 100%)",
                }}
              >
                Pedir proposta gratuita
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl font-semibold text-white/70 text-sm border border-white/[0.12] bg-white/[0.05] hover:border-white/[0.22] hover:bg-white/[0.09] hover:text-white transition-all duration-200"
              >
                Ver catálogo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
