import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { ChevronRight, Shield, Truck, Star, Leaf } from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Catálogo — 20.000+ Produtos Personalizáveis",
  description:
    "Explora mais de 20.000 produtos corporativos prontos a personalizar: corporate gifts, branded merchandise, packaging, apparel e muito mais.",
  canonical: "/catalog",
  keywords: [
    "catálogo corporate gifts",
    "branded merchandise catálogo",
    "produtos personalizados empresas",
    "merchandising B2B Portugal",
  ],
});

const TRUST_SIGNALS = [
  {
    icon: Shield,
    label: "Qualidade garantida",
    sub: "Aprovação prévia de amostra",
    color: "#4DA3FF",
  },
  {
    icon: Truck,
    label: "Entrega Europa",
    sub: "Entregas em 72h – 21 dias",
    color: "#74E7FF",
  },
  {
    icon: Star,
    label: "500+ fornecedores",
    sub: "Rede global certificada",
    color: "#4DA3FF",
  },
  {
    icon: Leaf,
    label: "Opções Eco",
    sub: "Materiais sustentáveis certificados",
    color: "#63E6BE",
  },
];

export default function CatalogPage() {
  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <div
        className="relative pt-32 pb-16 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(77,163,255,0.06) 0%, rgba(7,17,31,0) 100%)",
        }}
      >
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(77,163,255,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-white/35 mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">
              Início
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/60">Catálogo</span>
          </nav>

          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4DA3FF]/10 border border-[#4DA3FF]/20 text-[#4DA3FF] text-xs font-bold tracking-widest uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4DA3FF] animate-pulse" />
                Catálogo Completo
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
              <span className="block">20.000+ produtos</span>
              <span
                className="block"
                style={{
                  background:
                    "linear-gradient(135deg, #4DA3FF 0%, #74E7FF 50%, #63E6BE 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                prontos a personalizar
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/50 leading-relaxed max-w-2xl">
              Corporate gifts, branded merchandise, packaging sustentável,
              apparel e tecnologia — tudo com o teu logótipo, entregue em
              Portugal e toda a Europa.
            </p>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12">
            {TRUST_SIGNALS.map((signal) => {
              const Icon = signal.icon;
              return (
                <div
                  key={signal.label}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${signal.color}18` }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: signal.color }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white/80 leading-tight">
                      {signal.label}
                    </div>
                    <div className="text-[10px] text-white/35 mt-0.5 leading-tight">
                      {signal.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Catalog Grid ── */}
      <CatalogGrid />
    </div>
  );
}
