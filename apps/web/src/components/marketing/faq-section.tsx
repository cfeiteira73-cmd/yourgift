"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";

const faqs = [
  {
    q: "Qual é o prazo médio de produção?",
    a: "Depende do produto e da quantidade. A maioria dos projetos fica entre 10 e 20 dias úteis após aprovação do mockup. Projetos urgentes podem ser acelerados — fala connosco.",
  },
  {
    q: "Qual é o pedido mínimo (MOQ)?",
    a: "Varia por produto, mas trabalhamos a partir de 25 unidades em muitas categorias. Para projetos personalizados premium, algumas referências têm MOQ de 50 ou 100 unidades.",
  },
  {
    q: "Como funciona a personalização?",
    a: "Partilhas o teu logo e briefing. A nossa equipa prepara um mockup digital para aprovação. Após aprovação escrita, avançamos para produção. Zero surpresas.",
  },
  {
    q: "Fazem envio internacional?",
    a: "Sim. Entregamos em Portugal continental, ilhas, Espanha e na maioria dos países europeus. Para outros destinos, fala connosco para quotação específica.",
  },
  {
    q: "O que é uma Company Store privada?",
    a: "É uma loja online exclusiva para os colaboradores da tua empresa — com o teu branding, catálogo definido, preços negociados e sistema de aprovações. Ideal para merchandising interno, onboarding e gifting recorrente.",
  },
  {
    q: "Posso fazer reorders de produtos anteriores?",
    a: "Sim. Guardamos todos os ficheiros de produção, configs e preferências. Um reorder é simples — confirmas a quantidade e avançamos sem burocracia.",
  },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 md:py-28 bg-[#0B1526]/40">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Perguntas frequentes
            </h2>
            <p className="text-white/54">
              Tudo o que precisas de saber antes de começar.
            </p>
          </motion.div>

          {/* Accordion */}
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`rounded-xl border transition-all duration-200 ${
                  open === i
                    ? "border-[#4DA3FF]/22 bg-[#4DA3FF]/05"
                    : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]"
                }`}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex items-center justify-between w-full px-6 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-white/88 pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#4DA3FF] flex-shrink-0 transition-transform duration-200 ${
                      open === i ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm text-white/54 leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* More questions CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center mt-10"
          >
            <p className="text-sm text-white/42 mb-3">
              Tens mais perguntas?
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors font-medium"
            >
              Fala connosco
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
