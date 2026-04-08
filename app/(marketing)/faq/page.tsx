import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTAFinal } from "@/components/marketing/cta-final";

export const metadata: Metadata = constructMetadata({
  title: "FAQ — Perguntas Frequentes",
  description: "Respostas às perguntas mais frequentes sobre corporate gifts, branded merchandise, prazos, personalização e company stores.",
  canonical: "/faq",
});

export default function FAQPage() {
  return (
    <div className="min-h-screen pt-28">
      <div className="max-w-7xl mx-auto px-6 md:px-8 pb-6">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">FAQ</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Perguntas frequentes
          </h1>
          <p className="text-white/56 text-lg">
            Tudo o que precisas de saber antes de começar.
          </p>
        </div>
      </div>
      <FAQSection />
      <CTAFinal />
    </div>
  );
}
