export type ProductCategory =
  | "corporate-gifts"
  | "branded-merch"
  | "packaging"
  | "onboarding-kits"
  | "event-kits"
  | "premium-accessories"
  | "tech-gadgets"
  | "apparel"
  | "stationery"
  | "drinkware";

export type BrandingMethod =
  | "embroidery"
  | "screen-print"
  | "laser-engraving"
  | "uv-print"
  | "debossing"
  | "heat-transfer"
  | "sublimation"
  | "digital-print";

export type Material =
  | "cotton"
  | "leather"
  | "bamboo"
  | "recycled"
  | "metal"
  | "glass"
  | "ceramic"
  | "wood"
  | "polyester";

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  color?: string;
  size?: string;
  priceModifier?: number;
  stock?: number;
  image?: string;
}

export interface BrandingOption {
  id: string;
  method: BrandingMethod;
  label: string;
  description: string;
  pricePerUnit: number;
  minQuantity: number;
  setupFee?: number;
  areas: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: ProductCategory;
  subcategory?: string;
  images: string[];
  variants: ProductVariant[];
  brandingOptions: BrandingOption[];
  material?: Material[];
  moq: number;
  leadTimeDays: number;
  priceFrom?: number;
  sustainable?: boolean;
  featured?: boolean;
  popular?: boolean;
  newArrival?: boolean;
  tags?: string[];
  specs?: Record<string, string>;
  faqs?: Array<{ question: string; answer: string }>;
  relatedProductIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductFilter {
  categories?: ProductCategory[];
  materials?: Material[];
  brandingMethods?: BrandingMethod[];
  priceMin?: number;
  priceMax?: number;
  moqMax?: number;
  leadTimeDays?: number;
  sustainable?: boolean;
  search?: string;
  sortBy?: "name" | "price-asc" | "price-desc" | "popular" | "newest";
}
