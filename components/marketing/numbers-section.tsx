"use client";

import { motion } from "framer-motion";

const NUMBERS = [
  {
    value: "312",
    suffix: "+",
    label: "Clientes activos em Portugal",
    description: "Desde startups a multinacionais",
    accent: "#4DA3FF",
  },
  {
    value: "20.000",
    suffix: "+",
    label: "Produtos personalizáveis",
    description: "Em 10 categorias principais",
    accent: "#74E7FF",
  },
  {
    value: "98",
    suffix: "%",
    label: "Taxa de satisfação",
    description: "Medida após entrega de cada projeto",
    accent: "#63E6BE",
  },
  {
    value: "48",
    suffix: "h",
    label: "Resposta garantida",
    description: "A todos os briefings submetidos",
    accent: "#4DA3FF",
  },
  {
    value: "50.000",
    suffix: "+",
    label: "Artigos entregues por ano",
    description: "Nacional e internacional",
    accent: "#74E7FF",
  },
  {
    value: "15",
    suffix: "+",
    label: "Países de entrega",
    description: "Europa e mercados globais",
    accent: "#63E6BE",
  },
];

const INDUSTRIES = [
  "Tecnologia", "Finanças", "Consultoria", "Saúde", "Retalho",
  "Imobiliário", "Seguros", "Telecomunicações", "Energia", "Educação",
];

export function NumbersSection() {
  return (
    <section className="py-20 md:py-28 bg-[#0B1526]/50 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
            Em números
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Resultados reais. Todos os meses.
          </h2>
          <p className="text-white/54 text-lg max-w-xl mx-auto">
            Números baseados em dados reais de clientes activos — não projeções.
          </p>
        </motion.div>

        {/* Numbers grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 mb-14">
          {NUMBERS.map((num, i) => (
            <motion.div
              key={num.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="relative p-7 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.01] overflow-hidden group hover:border-white/[0.13] transition-all duration-300"
            >
              {/* Accent glow */}
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
                style={{ backgroundColor: num.accent }}
              />
              <div className="relative">
                <div
                  className="text-4xl md:text-5xl font-bold tracking-tight mb-1"
                  style={{ color: num.accent }}
                >
                  {num.value}
                  <span className="text-3xl md:text-4xl">{num.suffix}</span>
                </div>
                <div className="text-sm font-semibold text-white mb-1">{num.label}</div>
                <div className="text-xs text-white/38">{num.description}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Industries */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-xs text-white/36 uppercase tracking-[0.14em] mb-4 font-medium">
            Presentes em todos os sectores
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {INDUSTRIES.map((industry) => (
              <span
                key={industry}
                className="px-3.5 py-1.5 text-xs font-medium text-white/50 border border-white/[0.08] rounded-full bg-white/[0.03] hover:text-white/70 hover:border-white/[0.15] transition-all"
              >
                {industry}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
