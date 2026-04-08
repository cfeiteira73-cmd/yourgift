import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import { RFQForm } from "@/components/rfq/rfq-form";

export const metadata: Metadata = constructMetadata({
  title: "Pedir Proposta",
  description:
    "Submete o teu pedido de proposta para corporate gifts, branded merchandise, packaging ou company stores. Resposta garantida em 48 horas.",
  canonical: "/rfq",
});

export default function RFQPage() {
  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Pedir proposta
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Vamos construir o teu projeto.
          </h1>
          <p className="text-white/56 text-lg leading-relaxed">
            Preenche o formulário e recebe uma proposta detalhada em até 48
            horas úteis. Sem compromisso, sem surpresas.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Form */}
          <div className="lg:col-span-2">
            <RFQForm />
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* What to expect */}
            <div className="p-6 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent">
              <h3 className="text-sm font-semibold text-white mb-4">
                O que podes esperar
              </h3>
              <ul className="space-y-3">
                {[
                  { step: "1", text: "Recebemos o teu pedido" },
                  { step: "2", text: "Analisamos e contactamos se necessário" },
                  { step: "3", text: "Proposta detalhada em até 48h" },
                  { step: "4", text: "Mockup digital para aprovação" },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4DA3FF]/16 text-[#4DA3FF] text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                    <span className="text-sm text-white/58">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="p-6 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent">
              <h3 className="text-sm font-semibold text-white mb-3">
                Preferes falar diretamente?
              </h3>
              <p className="text-sm text-white/50 mb-4">
                A nossa equipa está disponível de segunda a sexta, 9h–18h.
              </p>
              <a
                href="mailto:gera@yourgift.pt"
                className="text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors font-medium"
              >
                gera@yourgift.pt →
              </a>
            </div>

            {/* Trust */}
            <div className="p-6 rounded-2xl border border-[#63E6BE]/14 bg-[#63E6BE]/04">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔒</div>
                <div>
                  <div className="text-sm font-semibold text-white/88 mb-1">
                    Dados protegidos
                  </div>
                  <div className="text-xs text-white/48 leading-relaxed">
                    As tuas informações são tratadas com total confidencialidade
                    e nunca partilhadas com terceiros.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
