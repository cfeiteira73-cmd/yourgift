import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Shirt,
  Coffee,
  Cpu,
  ShoppingBag,
  BookOpen,
  Leaf,
  Star,
} from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Branded Merchandise | yourgift.pt",
  description:
    "Merch de marca com qualidade internacional. Apparel, tech, drinkware e muito mais — com branding de precisão e produção controlada.",
  canonical: "/branded-merch",
});

const categories = [
  {
    icon: Shirt,
    title: "Apparel",
    sub: "T-shirts · Hoodies · Polos",
    description:
      "Cortes premium, tecidos duradouros e branding de alta resolução. Tamanhos XS–3XL, dezenas de cores base.",
    img: "photo-1576566588028-4147f3842f27",
    accent: "#4DA3FF",
  },
  {
    icon: Coffee,
    title: "Drinkware",
    sub: "Canecas · Tumblers · Garrafas",
    description:
      "Aço inoxidável, cerâmica e vidro com gravação a laser ou impressão full-colour. Resistentes à máquina de lavar.",
    img: "photo-1616345840969-851d7e671c74",
    accent: "#74E7FF",
  },
  {
    icon: Cpu,
    title: "Tech & Gadgets",
    sub: "Power banks · Carregadores · USB",
    description:
      "Gadgets premium — certificados CE/RoHS — com branding discreto e embalagem própria da marca.",
    img: "photo-1591543620767-582b2e76369e",
    accent: "#63E6BE",
  },
  {
    icon: ShoppingBag,
    title: "Acessórios",
    sub: "Malas · Bonés · Lanyards",
    description:
      "Totebags de lona, mochilas técnicas, bonés estruturados e fitas personalizadas para eventos e equipas.",
    img: "photo-1553062407-98eeb64c6a62",
    accent: "#4DA3FF",
  },
  {
    icon: BookOpen,
    title: "Desk & Office",
    sub: "Cadernos · Canetas · Organizers",
    description:
      "Blocos de notas encadernados, esferográficas premium, mat de secretária e organizadores com a tua marca.",
    img: "photo-1544816155-12df9643f363",
    accent: "#74E7FF",
  },
  {
    icon: Leaf,
    title: "Eco & Sustentável",
    sub: "Bambu · Reciclado · Orgânico",
    description:
      "Linha certificada com materiais FSC, algodão orgânico e plástico reciclado pós-consumo. Bom para a marca e para o planeta.",
    img: "photo-1542601906897-ecd9073b3cf0",
    accent: "#63E6BE",
  },
];

const techniques = [
  {
    name: "Serigrafia",
    detail: "Impressão direta com tintas à base de água. Cores vibrantes e resistência máxima. Ideal para grandes quantidades.",
    best: "Apparel, bags",
    accent: "#4DA3FF",
  },
  {
    name: "Bordado",
    detail: "Acabamento tátil e premium. Aspeto profissional imbatível em tecidos de qualidade.",
    best: "Polos, hoodies, bonés",
    accent: "#74E7FF",
  },
  {
    name: "Impressão Digital",
    detail: "Full-colour sem custo de fotolito. Perfeito para tiragens curtas e designs complexos.",
    best: "Camisolas, tote bags",
    accent: "#63E6BE",
  },
  {
    name: "Gravação Laser",
    detail: "Permanente, elegante e sem tinta. Para metal, madeira e couro — dura para sempre.",
    best: "Metal, madeira, couro",
    accent: "#4DA3FF",
  },
  {
    name: "Transferência",
    detail: "Reprodução fotográfica perfeita. Alta definição em qualquer superfície têxtil.",
    best: "Polyester, dry-fit",
    accent: "#74E7FF",
  },
];

const process = [
  { step: "01", title: "Briefing", desc: "Partilha a ideia, o logótipo e o contexto. Briefing de 5 minutos chega." },
  { step: "02", title: "Seleção", desc: "O nosso equipa propõe os produtos certos para o teu objetivo e orçamento." },
  { step: "03", title: "Mockup", desc: "Recebes mockups digitais fotorrealistas em 48 horas para aprovação." },
  { step: "04", title: "Aprovação", desc: "Dás o ok. Avançamos só com a tua confirmação — sem surpresas." },
  { step: "05", title: "Produção", desc: "Produção controlada com QC antes do envio. Prazos cumpridos." },
  { step: "06", title: "Entrega", desc: "Entrega na tua morada ou diretamente aos colaboradores via fulfillment." },
];

const pricing = [
  {
    tier: "Basic",
    range: "€3 – €9/un",
    examples: "Canetas, lanyards, autocolantes, magnetos",
    moq: "50 un",
    accent: "#4DA3FF",
  },
  {
    tier: "Premium",
    range: "€9 – €25/un",
    examples: "T-shirts, canecas, tote bags, cadernos",
    moq: "25 un",
    accent: "#74E7FF",
    featured: true,
  },
  {
    tier: "Luxury",
    range: "€25+/un",
    examples: "Power banks, hoodies, malas, tech gadgets",
    moq: "10 un",
    accent: "#63E6BE",
  },
];

export default function BrandedMerchPage() {
  return (
    <div className="min-h-screen bg-[rgb(7,17,31)]">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-4">
                Branded Merchandise
              </p>
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.1]">
                O teu branding em cada produto que a equipa usa.
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed">
                5.200+ produtos disponíveis. Mockup em 48 horas. MOQ desde 25 unidades.
                Produção controlada do início ao fim — sem intermediários.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/rfq"
                  className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
                >
                  Pedir proposta gratuita <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
                >
                  Ver catálogo completo
                </Link>
              </div>
            </div>
            {/* CSS-only product grid mockup */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { bg: "#4DA3FF", label: "Hoodie", icon: "👕" },
                  { bg: "#74E7FF", label: "Tumbler", icon: "🥤" },
                  { bg: "#63E6BE", label: "Tote bag", icon: "👜" },
                  { bg: "#63E6BE", label: "Power bank", icon: "🔋" },
                  { bg: "#4DA3FF", label: "Cap", icon: "🧢" },
                  { bg: "#74E7FF", label: "Notebook", icon: "📓" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border border-white/[0.07] bg-gradient-to-b from-white/[0.07] to-white/[0.02]"
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-xs font-medium text-white/50">{item.label}</span>
                    <div className="h-1 w-8 rounded-full" style={{ backgroundColor: item.bg }} />
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ backgroundColor: "#4DA3FF" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10 px-6 md:px-8 border-y border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "5.200+", label: "Produtos disponíveis" },
              { value: "48h", label: "Mockup digital" },
              { value: "MOQ 25un", label: "Quantidade mínima" },
              { value: "100%", label: "Personalizado" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-bold text-[#4DA3FF] mb-1">{s.value}</div>
                <div className="text-sm text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Categories with images */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Categorias de Produto
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              O que produzimos
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Seis categorias principais, centenas de referências — todas com branding exclusivo da tua marca.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.title}
                  className="rounded-2xl overflow-hidden border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px] bg-[#0B1526] group"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={`https://images.unsplash.com/${cat.img}?auto=format&fit=crop&w=600&q=80`}
                      alt={cat.title}
                      loading="lazy"
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1526] via-[#0B1526]/30 to-transparent" />
                    <div
                      className="absolute top-4 left-4 inline-flex p-2.5 rounded-xl"
                      style={{ backgroundColor: `${cat.accent}20`, color: cat.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-0.5">{cat.title}</h3>
                    <p className="text-xs font-medium mb-3" style={{ color: cat.accent }}>{cat.sub}</p>
                    <p className="text-sm text-white/55 leading-relaxed">{cat.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Técnicas de personalização */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
              Técnicas de Personalização
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Precisão em cada detalhe
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Escolhemos a técnica certa para cada produto — nunca comprometemos na qualidade do resultado final.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {techniques.map((t) => (
              <div
                key={t.name}
                className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300"
              >
                <div className="h-1.5 w-10 rounded-full mb-5" style={{ backgroundColor: t.accent }} />
                <h3 className="text-base font-semibold text-white mb-2">{t.name}</h3>
                <p className="text-sm text-white/50 leading-relaxed mb-4">{t.detail}</p>
                <div className="text-xs text-white/35">
                  Ideal:{" "}
                  <span className="font-medium" style={{ color: t.accent }}>
                    {t.best}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing guide */}
      <section className="py-20 md:py-28 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Guia de Preços
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Transparência total
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Três gamas de produto para cada orçamento. Preços indicativos — o valor final depende de quantidade e técnica.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricing.map((p) => (
              <div
                key={p.tier}
                className={`p-7 rounded-2xl border transition-all duration-300 ${
                  p.featured
                    ? "bg-gradient-to-b from-white/[0.09] to-white/[0.04] border-white/[0.18]"
                    : "bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-white/[0.07]"
                }`}
              >
                {p.featured && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Star className="h-3.5 w-3.5 text-[#74E7FF]" fill="#74E7FF" />
                    <span className="text-xs font-semibold text-[#74E7FF] uppercase tracking-[0.1em]">
                      Mais pedido
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-semibold text-white mb-1">{p.tier}</h3>
                <div className="text-2xl font-bold mb-3" style={{ color: p.accent }}>
                  {p.range}
                </div>
                <p className="text-sm text-white/50 mb-4 leading-relaxed">{p.examples}</p>
                <div className="flex items-center gap-2 text-xs text-white/35">
                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: p.accent }} />
                  MOQ {p.moq}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30 text-center mt-5">
            Preços indicativos sem IVA. Volumes maiores reduzem o custo unitário significativamente.
          </p>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-3">
              Processo
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Do briefing à entrega
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Seis passos simples — nós tratamos de tudo, tu só tens de aprovar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {process.map((p, i) => (
              <div key={p.step} className="relative">
                <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] h-full">
                  <div className="text-2xl font-bold text-[#74E7FF]/25 mb-3">{p.step}</div>
                  <h3 className="text-sm font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{p.desc}</p>
                </div>
                {i < process.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-white/[0.12] z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-6 md:px-8 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 text-[#4DA3FF]" fill="#4DA3FF" />
            ))}
          </div>
          <blockquote className="text-xl md:text-2xl font-medium text-white/85 leading-relaxed mb-8 italic">
            "Entregámos 200 kits de onboarding premium — hoodie, garrafa e caderno com o nosso branding. O feedback da equipa foi extraordinário. O processo foi incrivelmente simples."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#4DA3FF]/30 to-[#74E7FF]/10 border border-white/[0.1] flex items-center justify-center text-sm font-bold text-[#4DA3FF]">
              JS
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">João Silva</div>
              <div className="text-xs text-white/45">Head de People · Startup Lisboa · 200 kits de onboarding</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07]">
            <div className="inline-flex p-3 rounded-xl mb-6 bg-[#74E7FF]/10">
              <CheckCircle2 className="h-6 w-6 text-[#74E7FF]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Vamos criar o teu merch?
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Partilha o teu briefing e recebe mockups + preços em menos de 48 horas. Sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
              >
                Iniciar projeto <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 border border-white/[0.15] text-white/70 px-7 py-3.5 rounded-xl font-medium text-sm hover:border-white/30 hover:text-white transition-all"
              >
                Ver catálogo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
