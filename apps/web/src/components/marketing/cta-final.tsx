"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Clock, Star } from "lucide-react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

const PRODUCT_STRIP = [
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=200&h=200&fit=crop",
];

const GUARANTEES = [
  {
    icon: <Shield className="h-4 w-4" />,
    label: "30 dias de satisfação garantida",
    desc: "ou devolvemos",
    color: "#63E6BE",
  },
  {
    icon: <Clock className="h-4 w-4" />,
    label: "Resposta em 48h",
    desc: "garantida por contrato",
    color: "#4DA3FF",
  },
  {
    icon: <Star className="h-4 w-4" />,
    label: "Mockup gratuito",
    desc: "sem compromisso",
    color: "#74E7FF",
  },
];

export function CTAFinal() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-gradient-to-br from-[#0B1526] via-[#07111F] to-[#0B1526]">
      {/* Animated gradient orb */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(77,163,255,0.14) 0%, rgba(99,230,190,0.08) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.022] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Top border accent */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(77,163,255,0.5), rgba(116,231,255,0.5), rgba(99,230,190,0.5), transparent)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 md:px-8 text-center">
        {/* Urgency badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          Últimas 4 propostas desta semana disponíveis
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63E6BE] mb-5">
            Prontos para começar?
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-5 leading-[1.12]">
            A tua marca merece mais{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #4DA3FF, #74E7FF, #63E6BE)",
              }}
            >
              do que merch genérico.
            </span>
          </h2>
          <p className="text-white/52 text-lg mb-10 leading-relaxed max-w-2xl mx-auto">
            Junte-se a 312+ empresas que transformaram o seu branding com a yourgift.pt.
            Proposta gratuita, mockup incluído, sem compromisso.
          </p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Link
              href="/rfq"
              onClick={() =>
                trackEvent(ANALYTICS_EVENTS.CTA_CLICK, { location: "footer_cta_primary" })
              }
              className="flex items-center gap-2 bg-white text-[#07111F] px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/92 transition-all hover:scale-[1.02] shadow-[0_4px_28px_rgba(255,255,255,0.18)] w-full sm:w-auto justify-center"
            >
              Pedir proposta gratuita
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/catalog"
              onClick={() =>
                trackEvent(ANALYTICS_EVENTS.CTA_CLICK, { location: "footer_cta_secondary" })
              }
              className="flex items-center gap-2 text-white/78 px-8 py-4 rounded-xl font-medium text-base border border-white/[0.14] hover:bg-white/[0.07] hover:text-white hover:border-white/[0.26] transition-all w-full sm:w-auto justify-center"
            >
              Explorar 20.000+ produtos
            </Link>
          </motion.div>

          {/* Guarantees */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-14"
          >
            {GUARANTEES.map((g) => (
              <div
                key={g.label}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03]"
              >
                <span style={{ color: g.color }}>{g.icon}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white/80">{g.label}</div>
                  <div className="text-[10px] text-white/40">{g.desc}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Product strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-2 overflow-hidden"
          >
            <span className="text-xs text-white/30 mr-2 whitespace-nowrap">Alguns dos nossos produtos:</span>
            <div className="flex gap-2 overflow-hidden">
              {PRODUCT_STRIP.map((src, i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-white/10 flex-shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt="produto"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <span className="text-xs text-white/30 ml-2 whitespace-nowrap">+19.992</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
