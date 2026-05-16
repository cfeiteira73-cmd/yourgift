"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Shield, Zap, Award, ChevronRight, Star } from "lucide-react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const SOCIAL_PROOF_EVENTS = [
  "Ana Silva (Galp) pediu proposta há 23 min",
  "Pedro Costa (EDP) confirmou encomenda de 500 kits",
  "Mariana Ferreira (Sonae) aprovou mockup hoje",
  "João Nunes (NOS) pediu 1.200 t-shirts brandizadas",
  "Catarina Lima (Deloitte) confirmou encomenda de onboarding kits",
  "Rui Alves (Millennium BCP) pediu proposta há 12 min",
  "Sofia Pereira (TAP) aprovou 800 gifts de Natal",
  "Miguel Santos (KPMG) confirmou kit de boas-vindas",
];

const PRODUCT_GRID = [
  {
    img: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop",
    label: "T-Shirts",
  },
  {
    img: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&h=400&fit=crop",
    label: "Notebooks",
  },
  {
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
    label: "Canecas",
  },
  {
    img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop",
    label: "Tote Bags",
  },
  {
    img: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&h=400&fit=crop",
    label: "Gift Boxes",
  },
  {
    img: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&h=400&fit=crop",
    label: "Bonés",
  },
  {
    img: "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=400&h=400&fit=crop",
    label: "Tech",
  },
  {
    img: "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=400&h=400&fit=crop",
    label: "Tumblers",
  },
  {
    img: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop",
    label: "Powerbanks",
  },
];

const TRUST_BADGES = [
  { icon: <Shield className="h-4 w-4" />, label: "Equipa certificada ISO 9001" },
  { icon: <Award className="h-4 w-4" />, label: "Parceiros internacionais verificados" },
  { icon: <Zap className="h-4 w-4" />, label: "Mockup gratuito em 24h" },
];

const STATS = [
  { value: "20.000+", label: "produtos disponíveis" },
  { value: "312", label: "clientes activos" },
  { value: "48h", label: "resposta garantida" },
  { value: "98%", label: "satisfação" },
];

export function HeroSection() {
  const [proofIdx, setProofIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setProofIdx((i) => (i + 1) % SOCIAL_PROOF_EVENTS.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[100svh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#07111F]" />

      {/* Gradient orbs */}
      <div
        className="absolute top-0 left-0 w-[700px] h-[600px] rounded-full opacity-25 blur-[130px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(77,163,255,0.4) 0%, rgba(116,231,255,0.15) 50%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[600px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(99,230,190,0.35) 0%, transparent 70%)",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.022] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8 pt-28 pb-16 md:pt-32 md:pb-20 w-full">
        {/* FOMO badge */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            6 propostas disponíveis esta semana — restam 2
          </div>
        </motion.div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT — Copy */}
          <div>
            {/* Eyebrow */}
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 mb-6"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#4DA3FF]/22 bg-[#4DA3FF]/8 text-[#74E7FF] text-xs font-semibold uppercase tracking-[0.14em]">
                <Star className="h-3.5 w-3.5 fill-current" />
                Plataforma B2B premium · Portugal
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.6, delay: 0.18 }}
              className="text-[2.5rem] leading-[1.08] sm:text-5xl md:text-[3.4rem] font-semibold tracking-tight text-white mb-5"
            >
              Merch que a tua equipa{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #4DA3FF 0%, #74E7FF 50%, #63E6BE 100%)",
                }}
              >
                vai querer usar.
              </span>{" "}
              Branding que os clientes vão lembrar.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.6, delay: 0.26 }}
              className="text-lg text-white/62 mb-7 leading-relaxed max-w-xl"
            >
              Transformamos pedidos complexos em produtos que as empresas se orgulham de oferecer.
              Da proposta ao fulfillment — com mockup gratuito em 24h e gestor dedicado.
            </motion.p>

            {/* Loss aversion */}
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.5, delay: 0.32 }}
              className="flex items-start gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/8 mb-7"
            >
              <span className="text-orange-400 text-lg mt-0.5">⚠️</span>
              <p className="text-sm text-orange-300/90 leading-relaxed">
                Empresas com merch genérico perdem em média{" "}
                <strong className="text-orange-300">23% de brand recall</strong>{" "}
                vs. concorrentes com merch premium. Não seja mais um.
              </p>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.5, delay: 0.38 }}
              className="flex flex-col sm:flex-row gap-3 mb-8"
            >
              {TRUST_BADGES.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 text-xs text-white/60 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2"
                >
                  <span className="text-[#63E6BE]">{badge.icon}</span>
                  {badge.label}
                </div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.5, delay: 0.44 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6"
            >
              <Link
                href="/rfq"
                onClick={() =>
                  trackEvent(ANALYTICS_EVENTS.CLICK_HERO_CTA, { cta: "pedir_proposta" })
                }
                className="flex items-center gap-2.5 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/92 transition-all hover:scale-[1.02] shadow-[0_4px_20px_rgba(255,255,255,0.15)] w-full sm:w-auto justify-center"
              >
                Pedir proposta gratuita
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/catalog"
                onClick={() =>
                  trackEvent(ANALYTICS_EVENTS.CLICK_HERO_CTA, { cta: "ver_catalogo" })
                }
                className="flex items-center gap-2 border border-white/[0.14] text-white/80 px-7 py-3.5 rounded-xl font-medium text-sm hover:bg-white/[0.07] hover:text-white transition-all w-full sm:w-auto justify-center"
              >
                Ver catálogo
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Reciprocity micro-copy */}
            <motion.p
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.4, delay: 0.5 }}
              className="text-xs text-white/36"
            >
              🎁 Mockup gratuito incluído · Sem compromisso · Resposta em 48h garantida
            </motion.p>

            {/* Progress indicator */}
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.5, delay: 0.56 }}
              className="mt-6 flex items-center gap-3"
            >
              <span className="text-xs text-white/40 font-medium">Proposta em 3 passos:</span>
              <div className="flex items-center gap-2">
                {["Briefing", "Mockup", "Produção"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: "linear-gradient(135deg, #4DA3FF, #63E6BE)",
                          color: "#07111F",
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-xs text-white/50">{step}</span>
                    </div>
                    {i < 2 && <ChevronRight className="h-3 w-3 text-white/20" />}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT — Product showcase grid */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <div className="grid grid-cols-3 gap-2.5">
              {PRODUCT_GRID.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.06 }}
                  className="relative group overflow-hidden rounded-xl aspect-square cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={item.label}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07111F]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <span className="text-[10px] font-semibold text-white/90 bg-[#07111F]/70 backdrop-blur-sm px-2 py-1 rounded-md">
                      {item.label}
                    </span>
                  </div>
                  {/* Glow border on hover */}
                  <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-[#4DA3FF]/40 transition-all duration-300" />
                </motion.div>
              ))}
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="absolute -bottom-4 -left-4 bg-[#0B1526] border border-white/[0.1] rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#4DA3FF] to-[#63E6BE] flex items-center justify-center text-[#07111F] font-bold text-xs">
                  20K
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">20.000+ produtos</div>
                  <div className="text-[10px] text-white/40">10 categorias</div>
                </div>
              </div>
            </motion.div>

            {/* Top right badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="absolute -top-4 -right-4 bg-[#0B1526] border border-[#63E6BE]/20 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <div className="text-[#63E6BE] text-lg">✓</div>
                <div>
                  <div className="text-xs font-semibold text-white">312 clientes activos</div>
                  <div className="text-[10px] text-white/40">em Portugal</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-0 divide-x divide-white/[0.08] bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center px-8 py-5">
              <span
                className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #4DA3FF, #74E7FF)",
                }}
              >
                {stat.value}
              </span>
              <span className="text-xs text-white/40 mt-1">{stat.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Live social proof ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-5 flex items-center justify-center gap-3"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.07]">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#63E6BE] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#63E6BE]" />
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={proofIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -6 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-xs text-white/55"
              >
                {SOCIAL_PROOF_EVENTS[proofIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
