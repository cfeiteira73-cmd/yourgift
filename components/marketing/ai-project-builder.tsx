"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, ChevronRight } from "lucide-react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

type Step = "objective" | "sector" | "quantity" | "budget" | "result";

const objectives = [
  { id: "onboarding", label: "Onboarding kits", emoji: "🎁" },
  { id: "client-gifts", label: "Presentes para clientes", emoji: "🤝" },
  { id: "event", label: "Evento / conferência", emoji: "🎪" },
  { id: "team-merch", label: "Merch de equipa", emoji: "👕" },
  { id: "holiday", label: "Ofertas de fim de ano", emoji: "🎄" },
  { id: "brand-launch", label: "Lançamento de marca", emoji: "🚀" },
];

const sectors = [
  { id: "tech", label: "Tecnologia" },
  { id: "finance", label: "Finanças" },
  { id: "healthcare", label: "Saúde" },
  { id: "retail", label: "Retalho" },
  { id: "real-estate", label: "Imobiliário" },
  { id: "consulting", label: "Consultoria" },
  { id: "other", label: "Outro" },
];

const quantities = [
  { id: "25-50", label: "25–50 un" },
  { id: "50-250", label: "50–250 un" },
  { id: "250-1000", label: "250–1.000 un" },
  { id: "1000+", label: "1.000+ un" },
];

const budgets = [
  { id: "under_1k", label: "< €1.000" },
  { id: "1k_5k", label: "€1K–€5K" },
  { id: "5k_15k", label: "€5K–€15K" },
  { id: "15k_50k", label: "€15K–€50K" },
  { id: "over_50k", label: "€50K+" },
];

type Selections = {
  objective: string;
  sector: string;
  quantity: string;
  budget: string;
};

const recommendations: Record<string, { products: string[]; message: string }> = {
  "onboarding-tech": {
    products: ["Bamboo Tech Organizer", "Insulated Tumbler", "Premium Journal"],
    message:
      "Para onboarding em empresas tech recomendamos kits com tech accessories premium e itens de desk sustainability.",
  },
  "client-gifts-finance": {
    products: ["Premium Leather Journal", "Gift Box Set", "Wireless Charger"],
    message:
      "Presentes para o sector financeiro pedem elegância e qualidade premium — leather goods e caixas curadas são a escolha certa.",
  },
  default: {
    products: ["Premium Gift Box Set", "Insulated Tumbler", "Organic Cotton Tee"],
    message:
      "Com base no teu perfil, selecionámos produtos versáteis de alta qualidade que funcionam para qualquer contexto.",
  },
};

function getRecommendation(selections: Partial<Selections>) {
  const key = `${selections.objective}-${selections.sector}`;
  return recommendations[key] || recommendations.default;
}

export function AIProjectBuilder() {
  const [step, setStep] = useState<Step>("objective");
  const [selections, setSelections] = useState<Partial<Selections>>({});

  const handleSelect = (field: keyof Selections, value: string) => {
    const next = { ...selections, [field]: value };
    setSelections(next);

    if (field === "objective") setStep("sector");
    else if (field === "sector") setStep("quantity");
    else if (field === "quantity") setStep("budget");
    else if (field === "budget") {
      setStep("result");
      trackEvent(ANALYTICS_EVENTS.COMPLETE_AI_BUILDER, {
        objective: next.objective || "",
        sector: next.sector || "",
        budget: next.budget || "",
      });
    }
  };

  const reset = () => {
    setStep("objective");
    setSelections({});
  };

  const rec = getRecommendation(selections);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(77,163,255,0.12), transparent)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4DA3FF]/10 border border-[#4DA3FF]/20 text-[#4DA3FF] text-xs font-semibold uppercase tracking-[0.12em] mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Project Builder
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">
              Que projeto tens em mente?
            </h2>
            <p className="text-white/54">
              Responde a 4 perguntas e recebe uma recomendação personalizada.
            </p>
          </motion.div>

          {/* Builder card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-white/[0.1] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 md:p-10"
          >
            {/* Progress */}
            {step !== "result" && (
              <div className="flex gap-2 mb-8">
                {(["objective", "sector", "quantity", "budget"] as Step[]).map((s, i) => (
                  <div
                    key={s}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor:
                        ["objective", "sector", "quantity", "budget"].indexOf(step) >= i
                          ? "#4DA3FF"
                          : "rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === "objective" && (
                <motion.div
                  key="objective"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-6">
                    Qual é o objetivo do projeto?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {objectives.map((obj) => (
                      <button
                        key={obj.id}
                        onClick={() => handleSelect("objective", obj.id)}
                        className="flex flex-col items-start gap-2 p-4 rounded-xl border border-white/[0.08] hover:border-[#4DA3FF]/40 bg-white/[0.03] hover:bg-[#4DA3FF]/08 transition-all text-left group"
                      >
                        <span className="text-xl">{obj.emoji}</span>
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors leading-snug">
                          {obj.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "sector" && (
                <motion.div
                  key="sector"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-6">
                    Em que setor operas?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sectors.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSelect("sector", s.id)}
                        className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] hover:border-[#4DA3FF]/40 bg-white/[0.03] hover:bg-[#4DA3FF]/08 transition-all text-sm font-medium text-white/80 hover:text-white"
                      >
                        {s.label}
                        <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "quantity" && (
                <motion.div
                  key="quantity"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-6">
                    Qual a quantidade aproximada?
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {quantities.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => handleSelect("quantity", q.id)}
                        className="p-5 rounded-xl border border-white/[0.08] hover:border-[#4DA3FF]/40 bg-white/[0.03] hover:bg-[#4DA3FF]/08 transition-all text-base font-semibold text-white/80 hover:text-white text-center"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "budget" && (
                <motion.div
                  key="budget"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-6">
                    Qual o budget estimado?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {budgets.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelect("budget", b.id)}
                        className="p-4 rounded-xl border border-white/[0.08] hover:border-[#4DA3FF]/40 bg-white/[0.03] hover:bg-[#4DA3FF]/08 transition-all text-sm font-semibold text-white/80 hover:text-white text-center"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "result" && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#63E6BE]/12 text-[#63E6BE] text-xs font-semibold mb-4">
                      <Sparkles className="h-3 w-3" />
                      Recomendação gerada
                    </div>
                    <p className="text-white/62 text-sm leading-relaxed max-w-md mx-auto">
                      {rec.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {rec.products.map((p) => (
                      <div
                        key={p}
                        className="p-3 rounded-xl border border-[#4DA3FF]/18 bg-[#4DA3FF]/05 text-center"
                      >
                        <span className="text-xs font-medium text-white/70 leading-snug">
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/rfq"
                      onClick={() => trackEvent(ANALYTICS_EVENTS.AI_BUILDER_TO_RFQ)}
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-[#07111F] py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
                    >
                      Transformar em proposta
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={reset}
                      className="flex items-center justify-center px-5 py-3.5 rounded-xl border border-white/[0.1] text-white/60 text-sm hover:bg-white/[0.05] transition-all"
                    >
                      Recomeçar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
