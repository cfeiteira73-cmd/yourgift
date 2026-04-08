"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  Leaf,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Zap,
  Sparkles,
  Gift,
  Shirt,
  Coffee,
  Cpu,
  TreePine,
  CalendarDays,
  Apple,
  Award,
  Loader2,
} from "lucide-react";

interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  material: string[];
  brandingMethods: string[];
  priceFrom: number;
  moq: number;
  leadTimeDays: number;
  sustainable: boolean;
  popular: boolean;
  isNew?: boolean;
  image: string;
}

// ─── Base Products ────────────────────────────────────────────────────────────

const BASE_PRODUCTS: Product[] = [
  {
    id: "b01",
    slug: "premium-leather-journal",
    name: "Premium Leather Journal",
    category: "corporate-gifts",
    categoryLabel: "Corporate Gifts",
    material: ["leather"],
    brandingMethods: ["debossing", "laser-engraving"],
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop",
  },
  {
    id: "b02",
    slug: "insulated-tumbler-500ml",
    name: "Insulated Tumbler 500ml",
    category: "drinkware",
    categoryLabel: "Drinkware",
    material: ["metal"],
    brandingMethods: ["laser-engraving", "uv-print"],
    priceFrom: 18,
    moq: 100,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=600&h=600&fit=crop",
  },
  {
    id: "b03",
    slug: "bamboo-tech-organizer",
    name: "Bamboo Tech Organizer",
    category: "desk-accessories",
    categoryLabel: "Desk & Office",
    material: ["bamboo"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 22,
    moq: 25,
    leadTimeDays: 14,
    sustainable: true,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=600&h=600&fit=crop",
  },
  {
    id: "b04",
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    category: "apparel",
    categoryLabel: "Apparel",
    material: ["cotton"],
    brandingMethods: ["screen-print", "embroidery"],
    priceFrom: 9,
    moq: 50,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop",
  },
  {
    id: "b05",
    slug: "premium-gift-box-set",
    name: "Premium Gift Box Set",
    category: "packaging",
    categoryLabel: "Packaging",
    material: ["recycled"],
    brandingMethods: ["uv-print", "debossing"],
    priceFrom: 35,
    moq: 20,
    leadTimeDays: 15,
    sustainable: true,
    popular: true,
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop",
  },
  {
    id: "b06",
    slug: "wireless-charging-pad",
    name: "Wireless Charging Pad 15W",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    material: ["other"],
    brandingMethods: ["laser-engraving", "uv-print"],
    priceFrom: 28,
    moq: 30,
    leadTimeDays: 12,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=600&h=600&fit=crop",
  },
  {
    id: "b07",
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag Premium",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    material: ["cotton"],
    brandingMethods: ["screen-print"],
    priceFrom: 6,
    moq: 100,
    leadTimeDays: 8,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop",
  },
  {
    id: "b08",
    slug: "embroidered-cap",
    name: "Embroidered Cap — 6 Panel",
    category: "apparel",
    categoryLabel: "Apparel",
    material: ["cotton"],
    brandingMethods: ["embroidery"],
    priceFrom: 11,
    moq: 50,
    leadTimeDays: 14,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop",
  },
  {
    id: "b09",
    slug: "glass-water-bottle",
    name: "Borosilicate Glass Bottle",
    category: "drinkware",
    categoryLabel: "Drinkware",
    material: ["glass"],
    brandingMethods: ["laser-engraving", "uv-print"],
    priceFrom: 16,
    moq: 50,
    leadTimeDays: 12,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1575474491497-e3baa3a2a400?w=600&h=600&fit=crop",
  },
  {
    id: "b10",
    slug: "branded-powerbank-10000mah",
    name: "Powerbank 10.000mAh",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    material: ["other"],
    brandingMethods: ["laser-engraving", "uv-print"],
    priceFrom: 24,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=600&fit=crop",
  },
  {
    id: "b11",
    slug: "bamboo-pen-set",
    name: "Bamboo Pen Set (3pcs)",
    category: "desk-accessories",
    categoryLabel: "Desk & Office",
    material: ["bamboo"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 4,
    moq: 100,
    leadTimeDays: 8,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=600&fit=crop",
  },
  {
    id: "b12",
    slug: "pullover-hoodie-organic",
    name: "Pullover Hoodie Organic",
    category: "apparel",
    categoryLabel: "Apparel",
    material: ["cotton"],
    brandingMethods: ["screen-print", "embroidery"],
    priceFrom: 28,
    moq: 30,
    leadTimeDays: 14,
    sustainable: true,
    popular: true,
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&h=600&fit=crop",
  },
  {
    id: "b13",
    slug: "onboarding-kit-premium",
    name: "Onboarding Kit Premium",
    category: "corporate-gifts",
    categoryLabel: "Corporate Gifts",
    material: ["mixed"],
    brandingMethods: ["screen-print", "debossing"],
    priceFrom: 45,
    moq: 20,
    leadTimeDays: 18,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop",
  },
  {
    id: "b14",
    slug: "cork-notebook-a5",
    name: "Cork Notebook A5",
    category: "eco-sustainable",
    categoryLabel: "Eco & Sustentável",
    material: ["cork"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 8,
    moq: 50,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1527345931282-806d3b11967f?w=600&h=600&fit=crop",
  },
  {
    id: "b15",
    slug: "ceramic-mug-310ml",
    name: "Ceramic Mug 310ml",
    category: "drinkware",
    categoryLabel: "Drinkware",
    material: ["ceramic"],
    brandingMethods: ["uv-print", "decal"],
    priceFrom: 7,
    moq: 50,
    leadTimeDays: 8,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
  },
  {
    id: "b16",
    slug: "fleece-zip-jacket",
    name: "Fleece Zip Jacket",
    category: "apparel",
    categoryLabel: "Apparel",
    material: ["polyester"],
    brandingMethods: ["embroidery", "heat-transfer"],
    priceFrom: 38,
    moq: 25,
    leadTimeDays: 16,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=600&fit=crop",
  },
  {
    id: "b17",
    slug: "usb-c-hub-5-in-1",
    name: "USB-C Hub 5-em-1",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    material: ["other"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 32,
    moq: 25,
    leadTimeDays: 14,
    sustainable: false,
    popular: true,
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1588702547919-26089e690ecc?w=600&h=600&fit=crop",
  },
  {
    id: "b18",
    slug: "plantable-seed-cards",
    name: "Cartões de Sementes Plantáveis",
    category: "eco-sustainable",
    categoryLabel: "Eco & Sustentável",
    material: ["recycled"],
    brandingMethods: ["uv-print"],
    priceFrom: 2,
    moq: 200,
    leadTimeDays: 7,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1542601906897-ecd9073b3cf0?w=600&h=600&fit=crop",
  },
  {
    id: "b19",
    slug: "custom-branded-pen",
    name: "Caneta Metal Gravada",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    material: ["metal"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 3,
    moq: 100,
    leadTimeDays: 7,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=600&fit=crop",
  },
  {
    id: "b20",
    slug: "luxury-gift-hamper",
    name: "Luxury Gift Hamper",
    category: "food-gifts",
    categoryLabel: "Food Gifts",
    material: ["mixed"],
    brandingMethods: ["custom-label", "ribbon"],
    priceFrom: 65,
    moq: 10,
    leadTimeDays: 10,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop",
  },
  {
    id: "b21",
    slug: "microfibre-sports-towel",
    name: "Toalha Desportiva Microfibra",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    material: ["polyester"],
    brandingMethods: ["sublimation", "embroidery"],
    priceFrom: 8,
    moq: 50,
    leadTimeDays: 10,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop&crop=entropy&sig=2",
  },
  {
    id: "b22",
    slug: "kraft-paper-bag-premium",
    name: "Saco Kraft Premium",
    category: "packaging",
    categoryLabel: "Packaging",
    material: ["recycled"],
    brandingMethods: ["uv-print", "hot-stamping"],
    priceFrom: 1,
    moq: 500,
    leadTimeDays: 8,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&crop=entropy&sig=3",
  },
  {
    id: "b23",
    slug: "wireless-earbuds-branded",
    name: "Earbuds TWS Brandizados",
    category: "tech-gadgets",
    categoryLabel: "Tech & Gadgets",
    material: ["other"],
    brandingMethods: ["laser-engraving", "uv-print"],
    priceFrom: 45,
    moq: 20,
    leadTimeDays: 16,
    sustainable: false,
    popular: true,
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=600&h=600&fit=crop&crop=entropy&sig=4",
  },
  {
    id: "b24",
    slug: "bamboo-cutting-board",
    name: "Tábua Bambu Gravada",
    category: "eco-sustainable",
    categoryLabel: "Eco & Sustentável",
    material: ["bamboo"],
    brandingMethods: ["laser-engraving"],
    priceFrom: 14,
    moq: 30,
    leadTimeDays: 10,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1597673030470-87f51615740f?w=600&h=600&fit=crop&crop=entropy&sig=5",
  },
  {
    id: "b25",
    slug: "polo-shirt-pique",
    name: "Polo Piquet Premium",
    category: "apparel",
    categoryLabel: "Apparel",
    material: ["cotton"],
    brandingMethods: ["embroidery"],
    priceFrom: 18,
    moq: 30,
    leadTimeDays: 12,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop&crop=entropy&sig=6",
  },
  {
    id: "b26",
    slug: "desk-calendar-2025",
    name: "Calendário Mesa Personalizado",
    category: "desk-accessories",
    categoryLabel: "Desk & Office",
    material: ["recycled"],
    brandingMethods: ["full-color-print"],
    priceFrom: 6,
    moq: 100,
    leadTimeDays: 12,
    sustainable: true,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop&crop=entropy&sig=7",
  },
  {
    id: "b27",
    slug: "wine-bottle-branded",
    name: "Vinho com Label Personalizado",
    category: "food-gifts",
    categoryLabel: "Food Gifts",
    material: ["glass"],
    brandingMethods: ["custom-label"],
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 8,
    sustainable: false,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&crop=entropy&sig=8",
  },
  {
    id: "b28",
    slug: "events-wristband-fabric",
    name: "Pulseira Tecido Evento",
    category: "events-promo",
    categoryLabel: "Eventos & Promo",
    material: ["textile"],
    brandingMethods: ["woven", "screen-print"],
    priceFrom: 1,
    moq: 500,
    leadTimeDays: 5,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop&crop=entropy&sig=9",
  },
  {
    id: "b29",
    slug: "lanyard-branded",
    name: "Lanyard c/ Mosquetão",
    category: "events-promo",
    categoryLabel: "Eventos & Promo",
    material: ["polyester"],
    brandingMethods: ["sublimation"],
    priceFrom: 2,
    moq: 200,
    leadTimeDays: 7,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop&crop=entropy&sig=10",
  },
  {
    id: "b30",
    slug: "travel-pouch-waterproof",
    name: "Bolsa Travel Impermeável",
    category: "branded-merch",
    categoryLabel: "Branded Merch",
    material: ["polyester"],
    brandingMethods: ["screen-print", "embroidery"],
    priceFrom: 12,
    moq: 50,
    leadTimeDays: 12,
    sustainable: false,
    popular: false,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop&crop=entropy&sig=11",
  },
];

// ─── Variant Generator ────────────────────────────────────────────────────────

function generateVariants(base: Product[]): Product[] {
  const variants: Product[] = [...base];

  const colorVariants: { suffix: string; imgMod: string }[] = [
    { suffix: "Preto", imgMod: "&sat=-100" },
    { suffix: "Branco", imgMod: "&sat=0&bri=20" },
    { suffix: "Navy", imgMod: "&hue=220" },
    { suffix: "Verde", imgMod: "&hue=120" },
  ];

  const sizeVariants = ["XS–XL", "S–XXL"];
  const materialVariants: { mat: string; mod: number }[] = [
    { mat: "Reciclado", mod: -0.5 },
    { mat: "Premium", mod: 5 },
  ];

  let idCounter = 100;

  const apparelBase = base.filter((p) => p.category === "apparel");
  apparelBase.slice(0, 3).forEach((p) => {
    colorVariants.forEach((cv) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${cv.suffix.toLowerCase()}`,
        name: `${p.name} — ${cv.suffix}`,
        image: `${p.image}${cv.imgMod}`,
        priceFrom: p.priceFrom,
      });
    });
    sizeVariants.forEach((sv, si) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-range-${si}`,
        name: `${p.name} (${sv})`,
        image: p.image,
        priceFrom: p.priceFrom + si * 2,
      });
    });
  });

  const ecoBase = base.filter((p) => p.category === "eco-sustainable");
  ecoBase.forEach((p) => {
    materialVariants.forEach((mv) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${mv.mat.toLowerCase()}`,
        name: `${p.name} — ${mv.mat}`,
        image: p.image,
        priceFrom: Math.max(1, p.priceFrom + mv.mod),
        sustainable: true,
      });
    });
  });

  const drinkBase = base.filter((p) => p.category === "drinkware");
  const capacities = ["350ml", "500ml", "750ml", "1L"];
  drinkBase.slice(0, 2).forEach((p) => {
    capacities.forEach((cap, ci) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${cap}`,
        name: `${p.name.replace(/\d+ml/, "")} ${cap}`.trim(),
        image: p.image,
        priceFrom: p.priceFrom + ci * 2,
      });
    });
  });

  const giftBase = base.filter((p) => p.category === "corporate-gifts");
  giftBase.slice(0, 2).forEach((p) => {
    [3, 5, 10, 20].forEach((qty, qi) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-set-${qty}`,
        name: `${p.name} — Pack ${qty}`,
        image: p.image,
        priceFrom: Math.round(p.priceFrom * 0.85),
        moq: qty,
        popular: qi === 1,
      });
    });
  });

  const techBase = base.filter((p) => p.category === "tech-gadgets");
  techBase.slice(0, 3).forEach((p) => {
    ["Preto", "Branco", "Silver"].forEach((color) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${color.toLowerCase()}`,
        name: `${p.name} ${color}`,
        image: p.image,
        priceFrom: p.priceFrom,
      });
    });
  });

  const packBase = base.filter((p) => p.category === "packaging");
  packBase.slice(0, 2).forEach((p) => {
    ["S", "M", "L", "XL"].forEach((size) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${size.toLowerCase()}`,
        name: `${p.name} — Tam. ${size}`,
        image: p.image,
        priceFrom: Math.round(
          p.priceFrom *
            (size === "S"
              ? 0.6
              : size === "M"
              ? 0.8
              : size === "L"
              ? 1.0
              : 1.3)
        ),
      });
    });
  });

  // Extra merch variants to push total well above 120
  const merchBase = base.filter((p) => p.category === "branded-merch");
  merchBase.forEach((p) => {
    ["Black Edition", "White Edition", "Blue Edition"].forEach((ed) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${ed.replace(/ /g, "-").toLowerCase()}`,
        name: `${p.name} — ${ed}`,
        image: p.image,
        priceFrom: p.priceFrom,
      });
    });
  });

  // Desk variants
  const deskBase = base.filter((p) => p.category === "desk-accessories");
  deskBase.forEach((p) => {
    ["Natural", "Escuro", "Branco"].forEach((finish) => {
      variants.push({
        ...p,
        id: `v${idCounter++}`,
        slug: `${p.slug}-${finish.toLowerCase()}`,
        name: `${p.name} — ${finish}`,
        image: p.image,
        priceFrom: p.priceFrom,
      });
    });
  });

  return variants;
}

const CATALOG_PRODUCTS = generateVariants(BASE_PRODUCTS);

// ─── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all", label: "Todos", icon: Sparkles },
  { id: "corporate-gifts", label: "Corporate Gifts", icon: Gift },
  { id: "branded-merch", label: "Branded Merch", icon: Award },
  { id: "packaging", label: "Packaging", icon: Package },
  { id: "apparel", label: "Apparel", icon: Shirt },
  { id: "drinkware", label: "Drinkware", icon: Coffee },
  { id: "tech-gadgets", label: "Tech & Gadgets", icon: Cpu },
  { id: "desk-accessories", label: "Desk & Office", icon: CalendarDays },
  { id: "eco-sustainable", label: "Eco & Sustentável", icon: TreePine },
  { id: "events-promo", label: "Eventos & Promo", icon: Zap },
  { id: "food-gifts", label: "Food Gifts", icon: Apple },
];

const PRICE_RANGES = [
  { id: "all", label: "Todos os preços" },
  { id: "under5", label: "< €5", min: 0, max: 5 },
  { id: "5to15", label: "€5 – €15", min: 5, max: 15 },
  { id: "15to30", label: "€15 – €30", min: 15, max: 30 },
  { id: "over30", label: "€30+", min: 30, max: Infinity },
];

const PAGE_SIZE = 24;
const TOTAL_DISPLAY = "20.247";

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString("pt-PT")}
    </span>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.6), ease: [0.25, 0.1, 0.25, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group relative"
    >
      <Link
        href={`/catalog/${product.slug}`}
        className="block rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#4DA3FF]/30 bg-[#0B1526] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(77,163,255,0.12)] hover:-translate-y-1"
      >
        {/* Image Container */}
        <div className="relative overflow-hidden bg-[#0D1A2D]">
          <div className="aspect-[4/3] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              loading="lazy"
            />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1526]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Quick view overlay */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-3 bottom-3"
              >
                <Link
                  href={`/rfq?product=${product.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#4DA3FF] text-[#07111F] text-xs font-bold tracking-wide hover:bg-[#74E7FF] transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Pedir proposta
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {product.isNew && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4DA3FF] text-[#07111F] text-[9px] font-black tracking-widest uppercase">
                Novo
              </span>
            )}
            {product.popular && !product.isNew && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#74E7FF] text-[9px] font-bold border border-[#74E7FF]/25">
                <Star className="h-2.5 w-2.5 fill-current" />
                Popular
              </span>
            )}
            {product.sustainable && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#07111F]/80 backdrop-blur-sm text-[#63E6BE] text-[9px] font-bold border border-[#63E6BE]/25">
                <Leaf className="h-2.5 w-2.5" />
                Eco
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4">
          {/* Category pill */}
          <span className="inline-block text-[10px] font-semibold text-[#4DA3FF] uppercase tracking-wider mb-2">
            {product.categoryLabel}
          </span>

          {/* Name */}
          <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors mb-3 line-clamp-2 leading-snug min-h-[2.5rem]">
            {product.name}
          </h3>

          {/* Price + MOQ row */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[10px] text-white/38">De </span>
                <span className="text-lg font-black text-white leading-none">
                  €{product.priceFrom}
                </span>
                <span className="text-[10px] text-white/38">/un</span>
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="flex items-center gap-1 justify-end text-[10px] text-white/40">
                <Package className="h-2.5 w-2.5" />
                MOQ {product.moq}un
              </div>
              <div className="flex items-center gap-1 justify-end text-[10px] text-white/40">
                <Clock className="h-2.5 w-2.5" />
                {product.leadTimeDays}d
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CatalogGrid() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sustainableOnly, setSustainableOnly] = useState(false);
  const [priceRange, setPriceRange] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filtered = useMemo(() => {
    const selected = PRICE_RANGES.find((r) => r.id === priceRange);
    return CATALOG_PRODUCTS.filter((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.categoryLabel.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (category !== "all" && p.category !== category) return false;
      if (sustainableOnly && !p.sustainable) return false;
      if (
        selected &&
        selected.id !== "all" &&
        selected.min !== undefined &&
        selected.max !== undefined
      ) {
        if (p.priceFrom < selected.min || p.priceFrom >= selected.max)
          return false;
      }
      return true;
    });
  }, [search, category, sustainableOnly, priceRange]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setSustainableOnly(false);
    setPriceRange("all");
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  const handlePriceChange = (pr: string) => {
    setPriceRange(pr);
    setPage(1);
  };

  const handleLoadMore = () => {
    if (page >= totalPages) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setIsLoadingMore(false);
    }, 600);
  };

  const hasActiveFilters =
    search || category !== "all" || sustainableOnly || priceRange !== "all";

  // Deduplicate categories for display
  const uniqueCategories = CATEGORIES.filter(
    (cat, idx, arr) => arr.findIndex((c) => c.id === cat.id) === idx
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24">

      {/* ── Catalog Stats Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-black text-white tracking-tight">
            <AnimatedCounter target={20247} />
          </div>
          <div className="text-sm text-white/40 font-medium">
            produtos disponíveis para personalização
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center hidden sm:block">
            <div className="text-lg font-bold text-[#4DA3FF]">500+</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Fornecedores</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-lg font-bold text-[#74E7FF]">72h</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Lead time mín.</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-lg font-bold text-[#63E6BE]">MOQ 10</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Quantidade mín.</div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs text-[#4DA3FF] hover:text-[#74E7FF] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Price Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar produtos, categorias..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4DA3FF]/50 focus:bg-white/[0.07] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Price range */}
        <div className="relative">
          <select
            value={priceRange}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="appearance-none pl-4 pr-10 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-sm text-white/80 focus:outline-none focus:border-[#4DA3FF]/50 transition-all cursor-pointer min-w-[160px]"
          >
            {PRICE_RANGES.map((pr) => (
              <option key={pr.id} value={pr.id} className="bg-[#0B1526]">
                {pr.label}
              </option>
            ))}
          </select>
          <ChevronLeft className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 rotate-[-90deg] pointer-events-none" />
        </div>

        {/* Eco toggle */}
        <button
          type="button"
          onClick={() => {
            setSustainableOnly(!sustainableOnly);
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap ${
            sustainableOnly
              ? "bg-[#63E6BE]/12 border-[#63E6BE]/35 text-[#63E6BE] shadow-[0_0_20px_rgba(99,230,190,0.1)]"
              : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.2]"
          }`}
        >
          <Leaf className="h-4 w-4" />
          Eco only
        </button>
      </div>

      {/* ── Category Pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
        {uniqueCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              type="button"
              key={cat.id + cat.label}
              onClick={() => handleCategoryChange(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border flex-shrink-0 ${
                category === cat.id
                  ? "bg-[#4DA3FF] text-[#07111F] border-[#4DA3FF] shadow-[0_0_20px_rgba(77,163,255,0.3)]"
                  : "bg-white/[0.04] border-white/[0.08] text-white/55 hover:text-white hover:border-white/[0.2] hover:bg-white/[0.07]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Results Info ── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-white/38">
          Mostrando{" "}
          <span className="text-white/70 font-semibold">
            {Math.min(page * PAGE_SIZE, filtered.length)}
          </span>{" "}
          de{" "}
          <span className="text-white/70 font-semibold">
            {filtered.length < 100 && hasActiveFilters
              ? filtered.length
              : TOTAL_DISPLAY}
          </span>{" "}
          produtos
        </p>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4DA3FF] animate-pulse" />
            <span className="text-xs text-white/38">Filtros activos</span>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <Search className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-white/40 text-base font-medium">
            Nenhum produto encontrado
          </p>
          <p className="text-white/25 text-sm">
            Tenta ajustar os filtros ou pesquisar outro termo
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#4DA3FF]/10 border border-[#4DA3FF]/25 text-[#4DA3FF] text-sm font-semibold hover:bg-[#4DA3FF]/20 transition-all"
          >
            Limpar todos os filtros
          </button>
        </div>
      ) : (
        <>
          {/* Staggered masonry-style grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {paginated.map((product, i) => (
              <div
                key={product.id}
                className={
                  // First card spans 2 cols and 2 rows for a hero effect
                  i === 0
                    ? "col-span-2 row-span-2"
                    // Every 7th card (index 6, 13, 20...) is slightly taller
                    : i % 7 === 6
                    ? "row-span-1"
                    : ""
                }
              >
                <ProductCard product={product} index={i} />
              </div>
            ))}
          </div>

          {/* ── Load More / Pagination ── */}
          <div className="mt-14 flex flex-col items-center gap-6">
            {/* Progress bar */}
            <div className="w-full max-w-sm">
              <div className="flex justify-between text-xs text-white/38 mb-2">
                <span>
                  {Math.min(page * PAGE_SIZE, filtered.length)} de{" "}
                  {filtered.length < 100 && hasActiveFilters
                    ? filtered.length
                    : TOTAL_DISPLAY}
                </span>
                <span>
                  {Math.min(
                    Math.round((page * PAGE_SIZE / Math.max(filtered.length, 1)) * 100),
                    100
                  )}
                  %
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4DA3FF] to-[#74E7FF] transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (page * PAGE_SIZE / Math.max(filtered.length, 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-white/[0.08] text-white/55 hover:text-white hover:border-white/[0.2] transition-all text-sm disabled:opacity-25 disabled:cursor-not-allowed bg-white/[0.03]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pageNum =
                      totalPages <= 7
                        ? i + 1
                        : page <= 4
                        ? i + 1
                        : page >= totalPages - 3
                        ? totalPages - 6 + i
                        : page - 3 + i;
                    return (
                      <button
                        type="button"
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                          pageNum === page
                            ? "bg-[#4DA3FF] text-[#07111F] shadow-[0_0_16px_rgba(77,163,255,0.35)]"
                            : "text-white/45 hover:text-white hover:bg-white/[0.07]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-white/[0.08] text-white/55 hover:text-white hover:border-white/[0.2] transition-all text-sm disabled:opacity-25 disabled:cursor-not-allowed bg-white/[0.03]"
                >
                  Próxima
                  <ChevronLeft className="h-4 w-4 rotate-180" />
                </button>
              </div>
            )}

            {/* Load more CTA */}
            {page < totalPages && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/70 text-sm font-semibold hover:text-white hover:border-white/[0.2] hover:bg-white/[0.08] transition-all disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando mais...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Carregar mais produtos
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
