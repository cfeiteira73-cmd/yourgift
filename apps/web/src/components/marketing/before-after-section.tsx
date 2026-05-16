"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const BEFORE = [
  "Meses de emails para encontrar um fornecedor de confiança",
  "Mockups que não representam o produto real",
  "Preços opacos com taxas escondidas no final",
  "Prazos que se prolongam sem explicação",
  "Cada reorder começa do zero, sem histórico",
  "Sem visibilidade sobre o estado da produção",
  "Qualidade inconsistente lote a lote",
];

const AFTER = [
  "Proposta em 48h, gestor dedicado que conhece a tua marca",
  "Mockup fotorrealista em 24h antes de qualquer produção",
  "Preços transparentes, sem surpresas — confirmados por escrito",
  "Prazos cumpridos com tracking em tempo real",
  "Reorder em 1 clique com todos os ficheiros guardados",
  "Dashboard com estado da produção em tempo real",
  "QC rigoroso em cada lote — consistência garantida",
];

export function BeforeAfterSection() {
  return (
    <section className="py-20 md:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            A mudança
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Deixa de perder tempo com fornecedores genéricos.
          </h2>
          <p className="text-white/54 text-lg max-w-xl mx-auto">
            312 empresas já fizeram a transição. A diferença é sentida no primeiro projeto.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {/* BEFORE */}
          <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-sm font-bold">✕</span>
              </div>
              <h3 className="text-base font-semibold text-white/60">Fornecedor genérico</h3>
            </div>
            <ul className="space-y-3.5">
              {BEFORE.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-red-400/60 text-xs font-bold flex-shrink-0 mt-1">✕</span>
                  <span className="text-sm text-white/40 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AFTER */}
          <div className="rounded-2xl border border-[#63E6BE]/22 bg-[#63E6BE]/[0.05] p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-8 w-8 rounded-full bg-[#63E6BE]/12 border border-[#63E6BE]/22 flex items-center justify-center">
                <span className="text-[#63E6BE] text-sm font-bold">✓</span>
              </div>
              <h3 className="text-base font-semibold text-white">yourgift.pt</h3>
            </div>
            <ul className="space-y-3.5">
              {AFTER.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-[#63E6BE] text-xs font-bold flex-shrink-0 mt-1">✓</span>
                  <span className="text-sm text-white/78 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
        >
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all hover:scale-[1.02]"
          >
            Fazer a mudança — proposta gratuita
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-sm text-white/38">
            Mockup gratuito · Sem compromisso · Resposta em 48h
          </p>
        </motion.div>
      </div>
    </section>
  );
}
