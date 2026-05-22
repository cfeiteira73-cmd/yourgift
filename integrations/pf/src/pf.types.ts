// PF Concept API types

export interface PFImage {
  url: string;
  type?: string;
}

export interface PFVariant {
  id: string;
  sku: string;
  colorName?: string;
  colorHex?: string;
  size?: string;
  ean?: string;
  stock?: number;
  price?: number;
  images?: PFImage[];
}

export interface PFProduct {
  id: string;
  name: string;
  description?: string;
  categoryPath?: string[];
  mainCategoryName?: string;
  images?: PFImage[];
  variants?: PFVariant[];
  printingAreas?: Record<string, unknown>;
  basePrice?: number;
}

export interface PFCatalogPage {
  products: PFProduct[];
  page: number;
  pageSize: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface PFSyncResult {
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
}
