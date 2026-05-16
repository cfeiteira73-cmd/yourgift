"use client";

import { motion } from "framer-motion";
import { Globe, Boxes, Clock, FileCheck, Repeat } from "lucide-react";

const ops = [
  {
    icon: <FileCheck className="h-5 w-5" />,
    title: "Aprovação de mockup",
    desc: "Revê e aprova digitalmente antes de qualquer produção.",
    accent: "#4DA3FF",
  },
  {
    icon: <Boxes className="h-5 w-5" />,
    title: "Produção controlada",
    desc: "Parceiros certificados. Qualidade auditada em cada etapa.",
    accent: "#74E7FF",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Envio global",
    desc: "Entregas unitárias ou em lote, Portugal e internacional.",
    accent: "#63E6BE",
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: "Tracking em tempo real",
    desc: "Acompanha o estado da produção e entrega no dashboard.",
    accent: "#4DA3FF",
  },
  {
    icon: <Repeat className="h-5 w-5" />,
    title: "Reorder em 1 clique",
    desc: "Configurações guardadas. Repetir é instantâneo.",
    accent: "#74E7FF",
  },
];

export function OperationsSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Left — visual */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6 }}
            className="relative order-last lg:order-first"
          >
            <div className="relative space-y-3">
              {[
                {
                  label: "Proposta aprovada",
                  time: "Hoje, 09:14",
                  status: "done",
                  accent: "#63E6BE",
                },
                {
                  label: "Mockup enviado para aprovação",
                  time: "Amanhã",
                  status: "active",
                  accent: "#4DA3FF",
                },
                {
                  label: "Produção iniciada",
                  time: "Semana 2",
                  status: "pending",
                  accent: "#74E7FF",
                },
                {
                  label: "QC e expedição",
                  time: "Semana 3",
                  status: "pending",
                  accent: "#74E7FF",
                },
                {
                  label: "Entrega confirmada",
                  time: "Semana 4",
                  status: "pending",
                  accent: "#74E7FF",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    item.status === "active"
                      ? "border-[#4DA3FF]/30 bg-[#4DA3FF]/06"
                      : item.status === "done"
                      ? "border-[#63E6BE]/20 bg-[#63E6BE]/04"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        item.status === "pending"
                          ? "rgba(255,255,255,0.2)"
                          : item.accent,
                    }}
                  />
                  <div className="flex-1">
                    <span
                      className={`text-sm font-medium ${
                        item.status === "pending"
                          ? "text-white/40"
                          : "text-white/80"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span className="text-xs text-white/32">{item.time}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Operações
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-5">
              Produção e logística sem stress.
            </h2>
            <p className="text-white/56 text-lg leading-relaxed mb-8">
              Gerimos toda a complexidade operacional — mockups, produção,
              controlo de qualidade, armazenagem e envio — para que a tua
              equipa se foque no que importa.
            </p>

            <div className="space-y-4">
              {ops.map((op, i) => (
                <motion.div
                  key={op.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className="p-2 rounded-lg flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: `${op.accent}12`,
                      color: op.accent,
                    }}
                  >
                    {op.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/88">
                      {op.title}
                    </div>
                    <div className="text-sm text-white/48">{op.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
