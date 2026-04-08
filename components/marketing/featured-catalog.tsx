"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Leaf, ArrowRight } from "lucide-react";

const FEATURED_PRODUCTS = [
  {
    id: "1",
    slug: "premium-leather-journal",
    name: "Premium Leather Journal",
    categoryLabel: "Corporate Gifts",
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop",
  },
  {
    id: "2",
    slug: "insulated-tumbler-500ml",
    name: "Insulated Tumbler 500ml",
    categoryLabel: "Drinkware",
    priceFrom: 18,
    moq: 100,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=600&h=600&fit=crop",
  },
  {
    id: "3",
    slug: "bamboo-tech-organizer",
    name: "Bamboo Tech Organizer",
    categoryLabel: "Desk & Office",
    priceFrom: 22,
    moq: 25,
    leadTimeDays: 14,
    sustainable: true,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=600&h=600&fit=crop",
  },
  {
    id: "4",
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    categoryLabel: "Apparel",
    priceFrom: 9,
    moq: 50,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop",
  },
  {
    id: "5",
    slug: "premium-gift-box-set",
    name: "Premium Gift Box Set",
    categoryLabel: "Corporate Gifts",
    priceFrom: 35,
    moq: 20,
    leadTimeDays: 15,
    sustainable: true,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop",
  },
  {
    id: "6",
    slug: "wireless-charging-pad",
    name: "Wireless Charging Pad",
    categoryLabel: "Tech & Gadgets",
    priceFrom: 28,
    moq: 30,
    leadTimeDays: 12,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=600&h=600&fit=crop",
  },
];

type Filter = "all" | "popular" | "sustainable";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "popular", label: "Popular" },
  { id: "sustainable", label: "Sustentável" },
];

export function FeaturedCatalog() {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = FEATURED_PRODUCTS.filter((p) => {
    if (filter === "popular") return p.popular;
    if (filter === "sustainable") return p.sustainable;
    return true;
  });

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center max-w-xl mx-auto mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74E7FF] mb-4">
            Catálogo
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Produtos que fazem a diferença.
          </h2>
          <p className="text-white/52 text-base leading-relaxed">
            Cada artigo é personalizável com o branding da tua empresa. Qualidade
            premium, entrega rápida, sem complicações.
          </p>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${
                filter === f.id
                  ? "bg-white text-[#07111F] border-white"
                  : "bg-white/[0.04] border-white/[0.1] text-white/58 hover:text-white hover:border-white/[0.2]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {visible.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0 }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
              >
                <Link
                  href={`/catalog/${product.slug}`}
                  className="group block rounded-2xl border border-white/[0.07] hover:border-white/[0.14] bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-white/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {product.popular && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#74E7FF] text-[10px] font-semibold border border-[#74E7FF]/20">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Popular
                        </span>
                      )}
                      {product.sustainable && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#63E6BE] text-[10px] font-semibold border border-[#63E6BE]/20">
                          <Leaf className="h-2.5 w-2.5" />
                          Eco
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <p className="text-xs text-[#4DA3FF] font-medium mb-1.5">
                      {product.categoryLabel}
                    </p>
                    <h3 className="text-base font-semibold text-white/90 group-hover:text-white transition-colors mb-3">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-white/38">A partir de </span>
                        <span className="text-lg font-bold text-white">
                          €{product.priceFrom}
                        </span>
                        <span className="text-xs text-white/38"> /un</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/36">MOQ {product.moq}un</div>
                        <div className="text-xs text-white/36">{product.leadTimeDays}d</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Empty state */}
        {visible.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/30">Nenhum produto neste filtro</p>
          </div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex justify-center mt-12"
        >
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl border border-white/[0.14] bg-white/[0.05] hover:bg-white/[0.09] text-white font-semibold text-sm transition-all hover:scale-[1.02] hover:border-white/[0.24]"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
