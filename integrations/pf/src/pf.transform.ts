import type { PFProduct } from './pf.types';

export interface TransformedPFProduct {
  supplierRef: string;
  supplier: 'pf_concept';
  title: string;
  description: string;
  category: string;
  basePrice: number;
  images: string[];
  printAreas: Record<string, unknown>;
  variants: Array<{
    sku: string;
    color: string | null;
    colorGroup: string | null;
    colorCode: string | null;
    gtin: string | null;
    price: number;
    stock: number;
    images: string[];
    categoryLevel1: string | null;
    categoryLevel2: string | null;
    categoryLevel3: string | null;
  }>;
}

export function transformPFProduct(product: PFProduct): TransformedPFProduct {
  const basePrice = product.basePrice ?? 0;

  return {
    supplierRef: `pf_${product.id}`,
    supplier: 'pf_concept',
    title: product.name,
    description: product.description ?? '',
    category: product.categoryPath?.[0] ?? product.mainCategoryName ?? 'Other',
    basePrice,
    images: (product.images ?? []).map((img) => img.url).filter(Boolean),
    printAreas: product.printingAreas ?? {},
    variants: (product.variants ?? []).map((v) => ({
      sku: v.sku,
      color: v.colorName ?? null,
      colorGroup: v.colorName ?? null,
      colorCode: v.colorHex ?? null,
      gtin: v.ean ?? null,
      price: v.price ?? basePrice,
      stock: v.stock ?? 0,
      images: (v.images ?? []).map((img) => img.url),
      categoryLevel1: product.categoryPath?.[0] ?? null,
      categoryLevel2: product.categoryPath?.[1] ?? null,
      categoryLevel3: product.categoryPath?.[2] ?? null,
    })),
  };
}
