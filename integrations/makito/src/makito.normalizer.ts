// ── Phase 4 — Product Normalizer — UPDATED TO REAL API FIELDS ────────────────
// Real Makito API fields as verified 2026-06-02

import type { MakitoRealProduct, MakitoRealVariant, MakitoPrintTechnique } from './makito.types';

export interface YourGiftProduct {
  supplierRef: string;
  supplier: 'makito';
  externalId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  brand?: string;
  material?: string;
  dimensions?: { l: number | null; w: number | null; h: number | null; unit: 'mm' };
  weight?: number;
  primaryImage?: string;
  images: string[];
  technicalSheets: string[];
  printAreas: NormalizedPrintArea[];
  isPrintable: boolean;
  printTechniques: string[];
  basePrice: number;
  currency: 'EUR';
  minQuantity: number;
  isEcoFriendly: boolean;
  certifications: string[];
  customsCode?: string;
  isNew: boolean;
  isBestSeller: boolean;
  isSustainable: boolean;
  variants: NormalizedVariant[];
  searchKeywords: string[];
  aiMetadata: AiProductMetadata;
}

export interface NormalizedPrintArea {
  id: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  unit: 'mm';
  techniques: NormalizedTechnique[];
}

export interface NormalizedTechnique {
  code: string;
  label: string;
  maxColors?: number;
  minQty?: number;
  setupCost?: number;
  unitCost?: number;
  dpiMin?: number;
  colorMode?: string;
}

export interface NormalizedVariant {
  sku: string;         // variant_reference
  gtin?: string;
  color: string;       // variant_name
  colorHex?: string;
  colorFamily: string; // first word of variant_name
  size?: string;       // variant_size
  price: number;
  priceBreaks: Array<{ minQty: number; price: number }>;
  stock: number;
  isAvailable: boolean;
  images: string[];
}

export interface AiProductMetadata {
  useCases: string[];
  targetAudience: string[];
  eventTypes: string[];
  industries: string[];
  priceSegment: 'economy' | 'mid' | 'premium';
  popularityScore: number;
}

function parseCategories(categories: string[]): { level1: string; level2: string } {
  if (!categories || !categories.length) return { level1: 'Merchandising', level2: '' };
  const parts = categories[0].split('>').map(p => p.trim()).filter(p => !['Production', 'PRODUCTS'].includes(p));
  return { level1: parts[0] ?? 'Merchandising', level2: parts[1] ?? '' };
}

function classifyPriceSegment(price: number): 'economy' | 'mid' | 'premium' {
  if (price < 2) return 'economy';
  if (price < 10) return 'mid';
  return 'premium';
}

function inferUseCases(product: MakitoRealProduct): string[] {
  const cat = (product.categories ?? []).join(' ').toLowerCase();
  const name = (product.name ?? '').toLowerCase();
  const useCases: string[] = [];
  if (cat.includes('bag') || cat.includes('backpack')) useCases.push('corporate_gifts', 'events');
  if (cat.includes('drink') || cat.includes('bottle')) useCases.push('sports', 'wellness');
  if (cat.includes('tech') || cat.includes('usb') || cat.includes('camera')) useCases.push('tech_promo', 'corporate');
  if (cat.includes('writing') || cat.includes('pen')) useCases.push('office', 'events');
  if (cat.includes('textile') || cat.includes('shirt') || cat.includes('apparel')) useCases.push('apparel', 'teamwear');
  if (useCases.length === 0) useCases.push('corporate_gifts', 'general');
  return [...new Set(useCases)];
}

function buildSearchKeywords(product: MakitoRealProduct): string[] {
  const keywords = new Set<string>();
  keywords.add(product.name.toLowerCase());
  (product.categories ?? []).forEach(c =>
    c.split('>').forEach(p => keywords.add(p.trim().toLowerCase()))
  );
  if (product.brand) keywords.add(product.brand.toLowerCase());
  if (product.material) keywords.add(product.material.toLowerCase());
  keywords.add('makito');
  keywords.add('merchandising');
  keywords.add('brindes');
  keywords.add(product.ref);
  keywords.add(product.web_reference);
  return [...keywords].filter(Boolean);
}

export function normalizeMakitoProduct(
  product: MakitoRealProduct,
  priceMap: Map<string, number>,
  _stockMap: Map<string, number>, // stock cannot be joined — see MakitoMappingReport.md
): YourGiftProduct {
  const basePrice = priceMap.get(product.ref) ?? priceMap.get(product.web_reference) ?? 0;
  const { level1, level2 } = parseCategories(product.categories);

  const images: string[] = [];
  if (product.image) images.push(product.image);
  if (Array.isArray(product.detail_images)) images.push(...product.detail_images.filter(Boolean));

  return {
    supplierRef: `makito_${product.ref}`,
    supplier: 'makito',
    externalId: product.ref,
    title: product.name,
    description: product.description ?? '',
    category: level1,
    subcategory: level2 || undefined,
    tags: [],
    brand: product.brand ?? undefined,
    material: product.material ?? undefined,
    dimensions: {
      l: product.length ?? null,
      w: product.width ?? null,
      h: product.height ?? null,
      unit: 'mm',
    },
    weight: typeof product.weight === 'number' ? product.weight : undefined,
    primaryImage: product.image || undefined,
    images,
    technicalSheets: [],
    printAreas: [], // print config fetched separately via /print-config/files
    isPrintable: Boolean(product.printcode),
    printTechniques: product.printcode ? [product.printcode] : [],
    basePrice,
    currency: 'EUR',
    minQuantity: 1,
    isEcoFriendly: false,
    certifications: [],
    customsCode: product.custom_code ?? undefined,
    isNew: product.web_new ?? false,
    isBestSeller: false,
    isSustainable: false,
    variants: product.variants.map((v: MakitoRealVariant) => ({
      sku: v.variant_reference,
      color: v.variant_name,
      colorFamily: v.variant_name.split(' ')[0] ?? v.variant_name,
      size: v.variant_size || undefined,
      price: basePrice,
      priceBreaks: [],
      stock: 0, // cannot join numeric material codes to variant_reference
      isAvailable: false, // unknown without stock join
      images: [v.variant_image, v.variant_thumbnail].filter(Boolean) as string[],
    })),
    searchKeywords: buildSearchKeywords(product),
    aiMetadata: {
      useCases: inferUseCases(product),
      targetAudience: ['b2b', 'corporate'],
      eventTypes: ['conferences', 'trade_shows', 'corporate_events'],
      industries: ['general'],
      priceSegment: classifyPriceSegment(basePrice),
      popularityScore: product.web_new ? 0.7 : 0.5,
    },
  };
}
