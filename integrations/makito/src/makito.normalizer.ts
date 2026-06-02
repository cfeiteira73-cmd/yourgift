// ── Phase 4 — Product Normalizer ──────────────────────────────────────────────
// Maps Makito products into YourGift universal product schema

import type { MakitoProduct, MakitoVariant, MakitoPrintTechnique } from './makito.types';

export interface YourGiftProduct {
  // Identity
  supplierRef: string;
  supplier: 'makito';
  externalId: string;

  // Content
  title: string;
  titlePt?: string;
  description: string;
  descriptionPt?: string;
  shortDescription?: string;

  // Taxonomy
  category: string;
  subcategory?: string;
  tags: string[];
  brand?: string;

  // Physical
  material?: string;
  dimensions?: { l: number; w: number; h: number; unit: 'mm' };
  weight?: number; // grams

  // Images
  primaryImage?: string;
  images: string[];
  technicalSheets: string[];

  // Print
  printAreas: NormalizedPrintArea[];
  isPrintable: boolean;
  printTechniques: string[];

  // Commerce
  basePrice: number;
  currency: 'EUR';
  minQuantity: number;

  // Sustainability
  isEcoFriendly: boolean;
  certifications: string[];
  recycledContent?: number;

  // Logistics
  customsCode?: string;
  countryOfOrigin?: string;
  packagingQty?: number;

  // Metadata
  isNew: boolean;
  isBestSeller: boolean;
  isSustainable: boolean;
  updatedAt: string;

  // Variants
  variants: NormalizedVariant[];

  // AI/Search
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
  sku: string;
  gtin?: string;
  color: string;
  colorHex?: string;
  colorFamily: string;
  size?: string;
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
  searchVector?: string;
}

function classifyPriceSegment(price: number): 'economy' | 'mid' | 'premium' {
  if (price < 2) return 'economy';
  if (price < 10) return 'mid';
  return 'premium';
}

function inferUseCases(product: MakitoProduct): string[] {
  const cat = (product.category + ' ' + (product.subcategory ?? '')).toLowerCase();
  const name = product.name.toLowerCase();
  const useCases: string[] = [];
  if (cat.includes('bag') || cat.includes('mochila')) useCases.push('corporate_gifts', 'events');
  if (cat.includes('drink') || cat.includes('bottle') || cat.includes('garrafa')) useCases.push('sports', 'wellness');
  if (cat.includes('tech') || cat.includes('usb') || cat.includes('charger')) useCases.push('tech_promo', 'corporate');
  if (cat.includes('pen') || cat.includes('caneta') || cat.includes('escrita')) useCases.push('office', 'events');
  if (cat.includes('textile') || cat.includes('têxtil') || cat.includes('shirt')) useCases.push('apparel', 'teamwear');
  if (cat.includes('sustainable') || product.isSustainable) useCases.push('eco_events', 'csr');
  if (useCases.length === 0) useCases.push('corporate_gifts', 'general');
  return [...new Set(useCases)];
}

function buildSearchKeywords(product: MakitoProduct): string[] {
  const keywords = new Set<string>();
  keywords.add(product.name.toLowerCase());
  keywords.add(product.category.toLowerCase());
  if (product.subcategory) keywords.add(product.subcategory.toLowerCase());
  if (product.brand) keywords.add(product.brand.toLowerCase());
  if (product.material) keywords.add(product.material.toLowerCase());
  if (product.tags) product.tags.forEach((t) => keywords.add(t.toLowerCase()));
  keywords.add('makito');
  keywords.add('merchandising');
  keywords.add('brindes');
  return [...keywords];
}

function normalizeTechnique(t: MakitoPrintTechnique): NormalizedTechnique {
  return {
    code: t.code,
    label: t.name,
    maxColors: t.maxColors,
    minQty: t.minQty,
    setupCost: t.setupCost,
    unitCost: t.unitCost,
    dpiMin: t.dpiRequired,
    colorMode: t.colorMode,
  };
}

export function normalizeMakitoProduct(
  product: MakitoProduct,
  priceMap: Map<string, number>,
  stockMap: Map<string, number>,
): YourGiftProduct {
  const firstSku = product.variants[0]?.sku ?? '';
  const basePrice = priceMap.get(firstSku) ?? product.variants[0]?.price ?? 0;

  const images = product.media
    .filter((m) => m.type === 'image')
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
    .map((m) => m.url);

  const technicalSheets = product.media
    .filter((m) => m.type === 'technical_sheet' || m.type === 'document')
    .map((m) => m.url);

  const techniques = new Set<string>();
  product.printAreas.forEach((pa) => pa.techniques.forEach((t) => techniques.add(t.code)));

  return {
    supplierRef: `makito_${product.reference}`,
    supplier: 'makito',
    externalId: product.reference,

    title: product.name,
    description: product.longDescription || product.shortDescription || '',
    shortDescription: product.shortDescription,

    category: product.category,
    subcategory: product.subcategory,
    tags: product.tags ?? [],
    brand: product.brand,

    material: product.material,
    dimensions: product.dimensions
      ? { ...product.dimensions, unit: 'mm' }
      : undefined,
    weight: product.weight,

    primaryImage: images[0],
    images,
    technicalSheets,

    printAreas: product.printAreas.map((pa) => ({
      id: pa.id,
      name: pa.name,
      maxWidth: pa.maxWidth,
      maxHeight: pa.maxHeight,
      unit: 'mm',
      techniques: pa.techniques.map(normalizeTechnique),
    })),
    isPrintable: product.printAreas.length > 0,
    printTechniques: [...techniques],

    basePrice,
    currency: 'EUR',
    minQuantity: 1,

    isEcoFriendly: product.sustainability.isRecycled || product.sustainability.isOrganic || false,
    certifications: product.sustainability.certifications ?? [],
    recycledContent: product.sustainability.recycledContent,

    customsCode: product.customsCode,
    countryOfOrigin: product.countryOfOrigin,
    packagingQty: product.packaging.cartonQty,

    isNew: product.isNew ?? false,
    isBestSeller: product.isBestSeller ?? false,
    isSustainable: product.isSustainable ?? false,
    updatedAt: product.updatedAt,

    variants: product.variants
      .filter((v) => v.status === 'active' || v.status === 'new')
      .map((v) => ({
        sku: v.sku,
        gtin: v.ean,
        color: v.colorName,
        colorHex: v.colorHex,
        colorFamily: v.colorFamily ?? v.colorName,
        size: v.size,
        price: priceMap.get(v.sku) ?? v.price ?? basePrice,
        priceBreaks: v.priceBreaks ?? [],
        stock: stockMap.get(v.sku) ?? v.stock ?? 0,
        isAvailable: (stockMap.get(v.sku) ?? v.stock ?? 0) > 0,
        images: v.media.filter((m) => m.type === 'image').map((m) => m.url),
      })),

    searchKeywords: buildSearchKeywords(product),
    aiMetadata: {
      useCases: inferUseCases(product),
      targetAudience: ['b2b', 'corporate'],
      eventTypes: ['conferences', 'trade_shows', 'corporate_events'],
      industries: ['general'],
      priceSegment: classifyPriceSegment(basePrice),
      popularityScore: product.isBestSeller ? 0.9 : product.isNew ? 0.7 : 0.5,
    },
  };
}
