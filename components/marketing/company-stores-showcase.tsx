"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Store,
  Layers,
  Users,
  RefreshCw,
  Shield,
  BarChart3,
  Headphones,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Layers className="h-4 w-4" />,
    title: "Catálogo personalizado",
    desc: "Apenas os produtos aprovados pela tua empresa, com preços negociados.",
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: "Controlo por departamento",
    desc: "Permissões, centros de custo e limites de orçamento por equipa.",
  },
  {
    icon: <RefreshCw className="h-4 w-4" />,
    title: "Reorder automático",
    desc: "Histórico completo. Repetir uma encomenda é um único clique.",
  },
  {
    icon: <Shield className="h-4 w-4" />,
    title: "Integração SSO",
    desc: "Login com Google Workspace, Microsoft 365 ou qualquer IdP SAML.",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Dashboard analítico",
    desc: "Visibilidade total de gastos, encomendas e desempenho por item.",
  },
  {
    icon: <Headphones className="h-4 w-4" />,
    title: "Suporte prioritário",
    desc: "Gestor de conta dedicado e resposta garantida em 4 horas úteis.",
  },
];

const MOCK_PRODUCTS = [
  {
    name: "Welcome Kit",
    price: "€45",
    color: "from-[#4DA3FF]/20 to-[#4DA3FF]/5",
  },
  {
    name: "Branded Tee",
    price: "Incluído",
    color: "from-[#63E6BE]/20 to-[#63E6BE]/5",
  },
  {
    name: "ACME Tumbler",
    price: "€18",
    color: "from-[#74E7FF]/20 to-[#74E7FF]/5",
  },
  {
    name: "Backpack Pro",
    price: "€65",
    color: "from-white/10 to-white/3",
  },
];

export function CompanyStoresShowcase() {
  return (
    <section className="py-20 md:py-28 bg-[#0B1526]/50 relative overflow-hidden">
      {/* Background orb */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.12] blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(99,230,190,0.6), rgba(77,163,255,0.3), transparent)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-20 items-center">
          {/* LEFT — features */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#63E6BE]/10 border border-[#63E6BE]/20 text-[#63E6BE] text-xs font-semibold uppercase tracking-[0.12em] mb-6">
              <Store className="h-3.5 w-3.5" />
              Company Stores
            </div>

            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-5 leading-[1.2]">
              A loja privada{" "}
              <span className="text-white/50">da tua empresa.</span>
            </h2>
            <p className="text-white/52 text-lg leading-relaxed mb-10">
              Um portal exclusivo para as tuas equipas encomendarem merch,
              gifts e kits — com o branding da empresa, preços acordados e
              aprovações automáticas.
            </p>

            <ul className="space-y-5 mb-10">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 + i * 0.07 }}
                  className="flex items-start gap-3.5"
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-[#63E6BE]/[0.1] text-[#63E6BE] flex-shrink-0 border border-[#63E6BE]/[0.15]">
                    {f.icon}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white/90">
                      {f.title}
                    </span>
                    <span className="text-sm text-white/46 ml-2">{f.desc}</span>
                  </div>
                </motion.li>
              ))}
            </ul>

            <Link
              href="/company-stores"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#63E6BE]/[0.1] border border-[#63E6BE]/25 text-[#63E6BE] text-sm font-semibold hover:bg-[#63E6BE]/[0.18] hover:border-[#63E6BE]/40 transition-all"
            >
              Criar a minha loja
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* RIGHT — mock store UI */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            {/* Browser chrome card */}
            <div className="rounded-2xl border border-white/[0.1] bg-[#0B1526] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.025]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
                  <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
                  <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-lg bg-white/[0.05] border border-white/[0.06] px-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#63E6BE]/60" />
                    <span className="text-[11px] text-white/28 font-mono">
                      store.yourgift.pt/acme-corp
                    </span>
                  </div>
                </div>
              </div>

              {/* Store content */}
              <div className="p-5">
                {/* Store header */}
                <div className="flex items-center justify-between mb-5 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #4DA3FF 0%, #63E6BE 100%)",
                      }}
                    >
                      AC
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        ACME Corp Store
                      </div>
                      <div className="text-xs text-white/36">
                        Bem-vindo, João Silva
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#63E6BE]/10 border border-[#63E6BE]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#63E6BE]" />
                    <span className="text-[10px] text-[#63E6BE] font-semibold">
                      Ativo
                    </span>
                  </div>
                </div>

                {/* Category pills */}
                <div className="flex gap-2 mb-4">
                  {["Todos", "Merch", "Onboarding"].map((c, i) => (
                    <span
                      key={c}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
                        i === 0
                          ? "bg-white text-[#07111F] border-white"
                          : "bg-white/[0.04] border-white/[0.1] text-white/50"
                      }`}
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* Products mini grid */}
                <div className="grid grid-cols-2 gap-3">
                  {MOCK_PRODUCTS.map((p) => (
                    <div
                      key={p.name}
                      className={`p-3 rounded-xl border border-white/[0.07] bg-gradient-to-br ${p.color}`}
                    >
                      <div className="aspect-square rounded-lg bg-white/[0.08] mb-2.5" />
                      <div className="text-xs font-semibold text-white/78">
                        {p.name}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="text-xs text-[#63E6BE] font-medium">
                          {p.price}
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] text-white/44">
                          Pedir
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer row */}
                <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-[11px] text-white/30">
                    4 produtos disponíveis
                  </span>
                  <span className="text-[11px] text-[#4DA3FF]">
                    Ver encomendas →
                  </span>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="absolute -bottom-4 -right-4 flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#63E6BE]/22 bg-[#07111F] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-sm font-semibold text-[#63E6BE]"
            >
              <span className="w-2 h-2 rounded-full bg-[#63E6BE] animate-pulse" />
              Ativo em 2 dias úteis
            </motion.div>

            {/* Second floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="absolute -top-4 -left-4 flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#4DA3FF]/22 bg-[#07111F] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-sm font-semibold text-[#4DA3FF]"
            >
              SSO incluído
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
