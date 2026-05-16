"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Gift, Package, Store, Truck, Box } from "lucide-react";

const solutions = [
  {
    icon: <Gift className="h-6 w-6" />,
    title: "Corporate Gifts",
    description:
      "Presentes premium para clientes, parceiros e equipas. Curated selections que comunicam a sua marca com sofisticação.",
    href: "/corporate-gifts",
    accent: "#4DA3FF",
    tags: ["Welcome kits", "Holiday gifts", "Client appreciation"],
  },
  {
    icon: <Package className="h-6 w-6" />,
    title: "Branded Merchandise",
    description:
      "Merch de marca com qualidade internacional. Desde apparel a acessórios tech, com branding de precisão.",
    href: "/branded-merch",
    accent: "#74E7FF",
    tags: ["Apparel", "Tech & Gadgets", "Drinkware"],
    featured: true,
  },
  {
    icon: <Box className="h-6 w-6" />,
    title: "Packaging Premium",
    description:
      "Embalagens personalizadas que elevam a experiência de unboxing e reforçam a identidade visual da marca.",
    href: "/packaging",
    accent: "#63E6BE",
    tags: ["Caixas custom", "Tissue paper", "Bags premium"],
  },
  {
    icon: <Store className="h-6 w-6" />,
    title: "Company Stores",
    description:
      "Lojas privadas para equipas e departamentos — catálogo próprio, preços personalizados, branding dedicado.",
    href: "/company-stores",
    accent: "#4DA3FF",
    tags: ["Loja privada", "Permissões por equipa", "Reorder fácil"],
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: "Fulfillment",
    description:
      "Gestão completa de produção, armazenagem e envio — unitário ou em lote, nacional ou internacional.",
    href: "/fulfillment",
    accent: "#74E7FF",
    tags: ["Drop shipping", "Bulk shipping", "Stock management"],
  },
];

export function SolutionsGrid() {
  return (
    <section className="py-20 md:py-28 bg-[#0B1526]/50">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#63E6BE] mb-3">
            Soluções
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Tudo o que a sua marca precisa
          </h2>
          <p className="text-white/56 text-lg max-w-xl mx-auto">
            Cinco pilares integrados para gerir o universo de branding
            e merchandising da sua empresa.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {solutions.map((sol, i) => (
            <motion.div
              key={sol.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={sol.featured ? "md:col-span-2 lg:col-span-1" : ""}
            >
              <Link
                href={sol.href}
                className="group block h-full p-7 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-heavy"
              >
                {/* Icon */}
                <div
                  className="inline-flex p-3 rounded-xl mb-5 transition-colors duration-300"
                  style={{
                    backgroundColor: `${sol.accent}12`,
                    color: sol.accent,
                  }}
                >
                  {sol.icon}
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-2.5 group-hover:text-white transition-colors">
                  {sol.title}
                </h3>
                <p className="text-sm text-white/54 leading-relaxed mb-5">
                  {sol.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {sol.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full border"
                      style={{
                        borderColor: `${sol.accent}20`,
                        backgroundColor: `${sol.accent}08`,
                        color: `${sol.accent}cc`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div
                  className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
                  style={{ color: sol.accent }}
                >
                  Saber mais
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
