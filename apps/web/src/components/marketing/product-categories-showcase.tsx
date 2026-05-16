"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  productCount: string;
  image: string;
  span?: "tall" | "wide" | "normal";
}

const CATEGORIES: Category[] = [
  {
    id: "corporate-gifts",
    name: "Corporate Gifts",
    productCount: "1.240 produtos",
    image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&h=1000&fit=crop",
    span: "tall",
  },
  {
    id: "branded-merch",
    name: "Branded Merch",
    productCount: "4.800 produtos",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=500&fit=crop",
    span: "wide",
  },
  {
    id: "apparel",
    name: "Apparel",
    productCount: "5.200 produtos",
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=500&fit=crop",
    span: "normal",
  },
  {
    id: "drinkware",
    name: "Drinkware",
    productCount: "2.100 produtos",
    image: "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=800&h=500&fit=crop",
    span: "normal",
  },
  {
    id: "tech-gadgets",
    name: "Tech & Gadgets",
    productCount: "1.900 produtos",
    image: "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=800&h=500&fit=crop",
    span: "wide",
  },
  {
    id: "desk-accessories",
    name: "Desk & Office",
    productCount: "1.600 produtos",
    image: "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=800&h=500&fit=crop",
    span: "normal",
  },
  {
    id: "packaging",
    name: "Packaging",
    productCount: "1.400 produtos",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=500&fit=crop",
    span: "normal",
  },
  {
    id: "eco-sustainable",
    name: "Eco & Sustentável",
    productCount: "1.760 produtos",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=500&fit=crop",
    span: "tall",
  },
];

function CategoryCard({
  category,
  index,
}: {
  category: Category;
  index: number;
}) {
  const heightClass =
    category.span === "tall"
      ? "row-span-2"
      : "row-span-1";
  const colSpanClass =
    category.span === "wide"
      ? "col-span-2 sm:col-span-2"
      : "col-span-1";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      className={`${heightClass} ${colSpanClass} relative overflow-hidden rounded-2xl group cursor-pointer min-h-[180px]`}
    >
      <Link href={`/catalog?category=${category.id}`} className="block h-full">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={category.image}
          alt={category.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F]/90 via-[#07111F]/30 to-transparent" />
        <div className="absolute inset-0 bg-[#07111F]/20 group-hover:bg-[#07111F]/10 transition-colors duration-500" />

        {/* Ring border */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-[#4DA3FF]/40 transition-all duration-500" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[11px] font-semibold text-[#74E7FF] uppercase tracking-wider mb-1">
            {category.productCount}
          </p>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white leading-tight">
              {category.name}
            </h3>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-sm rounded-full p-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductCategoriesShowcase() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-[#07111F]">
      {/* Background accent */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-8 blur-[150px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(77,163,255,0.3) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-3">
              Catálogo completo
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">
              20.000+ produtos,{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4DA3FF, #74E7FF, #63E6BE)",
                }}
              >
                10 categorias
              </span>
            </h2>
            <p className="text-white/50 text-base max-w-lg">
              De t-shirts a tech gadgets, de gift boxes a packaging premium — tudo personalizado com a tua marca.
            </p>
          </div>
          <Link
            href="/catalog"
            className="flex items-center gap-2 text-sm font-semibold text-[#4DA3FF] hover:text-[#74E7FF] transition-colors flex-shrink-0"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Mosaic grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[200px] gap-3">
          {CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat.id} category={cat} index={i} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-white/40 mb-4">
            Não encontras o que precisas? Temos acesso a{" "}
            <strong className="text-white/60">200.000+ produtos</strong> através dos nossos parceiros internacionais.
          </p>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#63E6BE] hover:text-white transition-colors"
          >
            Pedir produto específico
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
