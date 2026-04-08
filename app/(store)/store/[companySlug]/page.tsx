"use client";

import { useState, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Leaf, ShoppingCart, Check, Package, ArrowRight, ExternalLink } from "lucide-react";

const STORE_PRODUCTS = [
  {
    id: "1",
    slug: "premium-leather-journal",
    name: "Premium Leather Journal",
    category: "corporate-gifts",
    categoryLabel: "Corporate Gifts",
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop",
  },
  {
    id: "2",
    slug: "insulated-tumbler-500ml",
    name: "Insulated Tumbler 500ml",
    category: "drinkware",
    categoryLabel: "Drinkware",
    priceFrom: 18,
    moq: 100,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image: "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=600&h=600&fit=crop",
  },
  {
    id: "3",
    slug: "bamboo-tech-organizer",
    name: "Bamboo Tech Organizer",
    category: "desk-accessories",
    categoryLabel: "Desk & Office",
    priceFrom: 22,
    moq: 25,
    leadTimeDays: 14,
    sustainable: true,
    popular: true,
    image: "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=600&h=600&fit=crop",
  },
  {
    id: "4",
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    category: "apparel",
    categoryLabel: "Apparel",
    priceFrom: 9,
    moq: 50,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop",
  },
  {
    id: "5",
    slug: "premium-gift-box-set",
    name: "Premium Gift Box Set",
    category: "corporate-gifts",
    categoryLabel: "Corporate Gifts",
    priceFrom: 35,
    moq: 20,
    leadTimeDays: 15,
    sustainable: true,
    popular: true,
    image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop",
  },
  {
    id: "6",
    slug: "wireless-charging-pad",
    name: "Wireless Charging Pad",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    priceFrom: 28,
    moq: 30,
    leadTimeDays: 12,
    sustainable: false,
    popular: false,
    image: "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=600&h=600&fit=crop",
  },
  {
    id: "7",
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag Premium",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    priceFrom: 6,
    moq: 100,
    leadTimeDays: 8,
    sustainable: true,
    popular: false,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop",
  },
  {
    id: "8",
    slug: "embroidered-cap",
    name: "Embroidered Cap — 6 Panel",
    category: "apparel",
    categoryLabel: "Apparel",
    priceFrom: 11,
    moq: 50,
    leadTimeDays: 14,
    sustainable: false,
    popular: true,
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop",
  },
  {
    id: "9",
    slug: "glass-water-bottle",
    name: "Borosilicate Glass Bottle",
    category: "drinkware",
    categoryLabel: "Drinkware",
    priceFrom: 16,
    moq: 50,
    leadTimeDays: 12,
    sustainable: true,
    popular: false,
    image: "https://images.unsplash.com/photo-1575474491497-e3baa3a2a400?w=600&h=600&fit=crop",
  },
];

const CATEGORIES = [
  { id: "all", label: "Todos" },
  { id: "corporate-gifts", label: "Corporate Gifts" },
  { id: "drinkware", label: "Drinkware" },
  { id: "desk-accessories", label: "Desk & Office" },
  { id: "apparel", label: "Apparel" },
  { id: "branded-merch", label: "Branded Merch" },
  { id: "tech-gadgets", label: "Tech & Gadgets" },
];

function formatCompanyName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

type Props = { params: Promise<{ companySlug: string }> };

export default function CompanyStorePage({ params }: Props) {
  const { companySlug } = use(params);
  const companyName = formatCompanyName(companySlug);
  const initials = getInitials(companyName);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, boolean>>({});
  const cartCount = Object.values(cart).filter(Boolean).length;

  const filtered =
    selectedCategory === "all"
      ? STORE_PRODUCTS
      : STORE_PRODUCTS.filter((p) => p.category === selectedCategory);

  function handleAdd(id: string) {
    setCart((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCart((prev) => ({ ...prev, [id]: false }));
    }, 1800);
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "rgb(7,17,31)" }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-[rgb(7,17,31)]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Company brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-lg"
              style={{
                background: "linear-gradient(135deg, #4DA3FF 0%, #63E6BE 100%)",
              }}
            >
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">
                {companyName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#63E6BE]" />
                <span className="text-[10px] text-[#63E6BE] font-semibold uppercase tracking-wide">
                  Loja Privada
                </span>
              </div>
            </div>
          </div>

          {/* Cart */}
          <button
            type="button"
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.09] text-white/80 hover:text-white text-sm font-medium transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Encomenda</span>
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#4DA3FF] text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Hero welcome */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(77,163,255,0.09) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-14 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">
              Bem-vindo à loja exclusiva
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">
              {companyName}
            </h1>
            <p className="text-white/52 text-base leading-relaxed">
              Seleciona os produtos que pretendes encomendar. Todos os artigos
              incluem o branding da tua empresa e são entregues conforme acordado.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-5">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                selectedCategory === cat.id
                  ? "bg-white text-[#07111F] border-white"
                  : "bg-white/[0.04] border-white/[0.1] text-white/60 hover:text-white hover:border-white/[0.2]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/36">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} disponíve{filtered.length !== 1 ? "is" : "l"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((product, i) => {
            const added = cart[product.id];
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: i * 0.045 }}
              >
                <div className="group block rounded-2xl border border-white/[0.07] hover:border-white/[0.13] bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-white/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Badges */}
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
                  <div className="p-4">
                    <p className="text-xs text-[#4DA3FF] font-medium mb-1.5">
                      {product.categoryLabel}
                    </p>
                    <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors mb-3">
                      {product.name}
                    </h3>

                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <span className="text-xs text-white/38">A partir de </span>
                        <span className="text-base font-bold text-white">
                          €{product.priceFrom}
                        </span>
                        <span className="text-xs text-white/38">/un</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/36">MOQ {product.moq}un</div>
                        <div className="text-xs text-white/36">{product.leadTimeDays}d produção</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdd(product.id)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        added
                          ? "bg-[#63E6BE]/15 border border-[#63E6BE]/30 text-[#63E6BE]"
                          : "bg-[#4DA3FF]/12 border border-[#4DA3FF]/25 text-[#4DA3FF] hover:bg-[#4DA3FF]/20 hover:border-[#4DA3FF]/40"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Adicionado
                        </>
                      ) : (
                        <>
                          <Package className="h-3.5 w-3.5" />
                          Adicionar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg">Nenhum produto nesta categoria</p>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="mt-4 text-sm text-[#4DA3FF] hover:underline"
            >
              Ver todos os produtos
            </button>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="border-t border-white/[0.06] bg-[#07111F]/80">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            Loja privada gerida por{" "}
            <Link
              href="/"
              className="text-white/50 hover:text-white/80 transition-colors underline underline-offset-2"
            >
              yourgift.pt
            </Link>
          </p>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            yourgift.pt
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
