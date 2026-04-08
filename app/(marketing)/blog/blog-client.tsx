"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  "Todos",
  "Corporate Gifts",
  "Branded Merch",
  "Packaging",
  "Company Stores",
  "Fulfillment",
  "Guias",
  "Sustentabilidade",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Corporate Gifts": "text-[#4DA3FF] border-[#4DA3FF]/25 bg-[#4DA3FF]/10",
  "Branded Merch": "text-[#63E6BE] border-[#63E6BE]/25 bg-[#63E6BE]/10",
  Packaging: "text-[#F59E0B] border-[#F59E0B]/25 bg-[#F59E0B]/10",
  "Company Stores": "text-[#A78BFA] border-[#A78BFA]/25 bg-[#A78BFA]/10",
  Fulfillment: "text-[#F472B6] border-[#F472B6]/25 bg-[#F472B6]/10",
  Guias: "text-[#34D399] border-[#34D399]/25 bg-[#34D399]/10",
  Sustentabilidade: "text-[#6EE7B7] border-[#6EE7B7]/25 bg-[#6EE7B7]/10",
};

const posts = [
  {
    slug: "guia-corporate-gifts-2025",
    title: "Guia completo de Corporate Gifts para 2025",
    excerpt:
      "Tendências, estratégias e os produtos mais procurados por empresas para presentes corporativos este ano.",
    category: "Corporate Gifts",
    date: "2025-01-15",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=450&fit=crop",
  },
  {
    slug: "onboarding-kits-melhores-praticas",
    title: "Onboarding Kits: as melhores práticas das empresas top",
    excerpt:
      "Como as melhores empresas do mundo recebem novos colaboradores com experiências memoráveis.",
    category: "Branded Merch",
    date: "2025-01-08",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=450&fit=crop",
  },
  {
    slug: "company-stores-vantagens",
    title: "Company Stores: porque é que as empresas estão a adotar",
    excerpt:
      "A tendência que está a transformar como as empresas gerem o merchandising interno.",
    category: "Company Stores",
    date: "2025-01-02",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=450&fit=crop",
  },
  {
    slug: "branded-merch-tendencias-2025",
    title: "Branded Merch: 7 tendências que vão dominar 2025",
    excerpt:
      "Das colaborações com artistas locais ao drop-model para colaboradores, estas são as tendências que definem o branded merch este ano.",
    category: "Branded Merch",
    date: "2025-01-20",
    readTime: "7 min",
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=450&fit=crop",
  },
  {
    slug: "packaging-premium-impacto-marca",
    title: "Porque o packaging premium aumenta o valor percebido da marca em 40%",
    excerpt:
      "Estudos de neuromarketing confirmam: a embalagem influencia a perceção do produto antes de qualquer interação. Saiba como usar isso a seu favor.",
    category: "Packaging",
    date: "2025-01-25",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=450&fit=crop",
  },
  {
    slug: "fulfillment-b2b-guia",
    title: "Fulfillment B2B: tudo o que uma empresa precisa de saber",
    excerpt:
      "Pick & pack, last-mile, gestão de devoluções e integração com ERPs — o guia completo para quem quer escalar a operação de merchandising.",
    category: "Fulfillment",
    date: "2025-02-01",
    readTime: "9 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=450&fit=crop",
  },
  {
    slug: "roi-corporate-gifting",
    title: "O ROI do Corporate Gifting: números reais de 200 empresas",
    excerpt:
      "Analisámos 200 programas de corporate gifting em Portugal e Espanha. Os resultados mostram um retorno médio de 3,4x sobre o investimento.",
    category: "Corporate Gifts",
    date: "2025-02-08",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=450&fit=crop",
  },
  {
    slug: "merch-sustentavel-b2b",
    title: "Merch sustentável: como escolher fornecedores com impacto real",
    excerpt:
      "Greenwashing ou impacto genuíno? Ensinamos a distinguir certificações reais de marketing vazio, e como auditar a cadeia de fornecimento.",
    category: "Sustentabilidade",
    date: "2025-02-15",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1542601906897-ecd9073b3cf0?w=800&h=450&fit=crop",
  },
  {
    slug: "welcome-kit-perfeito",
    title: "Como criar o welcome kit perfeito para novos colaboradores",
    excerpt:
      "Da escolha de produtos à embalagem e personalização — um guia passo a passo para criar uma primeira impressão inesquecível.",
    category: "Corporate Gifts",
    date: "2025-02-22",
    readTime: "7 min",
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=450&fit=crop",
  },
  {
    slug: "estrategia-merch-eventos",
    title: "Estratégia de merch para eventos: maximize o impacto da presença",
    excerpt:
      "Como transformar a sua participação num evento numa oportunidade de branding de longa duração — antes, durante e depois do evento.",
    category: "Branded Merch",
    date: "2025-03-01",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=450&fit=crop",
  },
  {
    slug: "comparar-fornecedores-merch",
    title: "7 critérios para comparar fornecedores de merch e não se arrepender",
    excerpt:
      "Preço, qualidade, prazo, amostras, certificações, capacidade de escala e suporte — o checklist definitivo antes de assinar qualquer contrato.",
    category: "Guias",
    date: "2025-03-08",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=800&h=450&fit=crop",
  },
  {
    slug: "drinkware-branding",
    title: "Drinkware com branding: o produto que mais aparece no dia a dia",
    excerpt:
      "Garrafas, tumblers e canecas com a sua marca viajam para reuniões, ginásios e cafés. Saiba como escolher o produto certo para o seu público.",
    category: "Branded Merch",
    date: "2025-03-15",
    readTime: "4 min",
    image:
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=800&h=450&fit=crop",
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CategoryBadge({ category }: { category: string }) {
  const color =
    CATEGORY_COLORS[category] ??
    "text-[#4DA3FF] border-[#4DA3FF]/25 bg-[#4DA3FF]/10";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold ${color}`}
    >
      {category}
    </span>
  );
}

export function BlogClientPage() {
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  const filtered =
    activeCategory === "Todos"
      ? posts
      : posts.filter((p) => p.category === activeCategory);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="max-w-xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
            Blog
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Insights & Tendências
          </h1>
          <p className="text-white/54 text-lg">
            Estratégias, tendências e guias de branding B2B para empresas que
            querem fazer a diferença.
          </p>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-[#4DA3FF] border-[#4DA3FF] text-[#07111F]"
                  : "border-white/[0.1] text-white/54 hover:text-white hover:border-white/25 bg-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-white/38 text-center py-20">
            Nenhum artigo encontrado nesta categoria.
          </p>
        )}

        {/* Featured post — full width */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block rounded-2xl border border-white/[0.07] hover:border-white/[0.14] bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden transition-all duration-300 hover:shadow-medium mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="aspect-video md:aspect-auto min-h-[220px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-7 md:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <CategoryBadge category={featured.category} />
                  <span className="text-white/20">·</span>
                  <span className="text-xs text-white/38">
                    {featured.readTime} leitura
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold text-white/90 group-hover:text-white mb-3 leading-snug transition-colors">
                  {featured.title}
                </h2>
                <p className="text-white/52 text-base leading-relaxed mb-5">
                  {featured.excerpt}
                </p>
                <p className="text-xs text-white/30">{formatDate(featured.date)}</p>
              </div>
            </div>
          </Link>
        )}

        {/* 3-column grid */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-2xl border border-white/[0.07] hover:border-white/[0.14] bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-medium"
              >
                <div className="aspect-video overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryBadge category={post.category} />
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-white/38">
                      {post.readTime} leitura
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-white/90 group-hover:text-white mb-2 leading-snug transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-white/48 leading-relaxed line-clamp-2">
                    {post.excerpt}
                  </p>
                  <p className="text-xs text-white/28 mt-3">
                    {formatDate(post.date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
