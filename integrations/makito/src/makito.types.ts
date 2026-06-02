// ── Makito API Types ──────────────────────────────────────────────────────────
// Makito B2B promotional products API — OAuth2 client_credentials

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface MakitoTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number; // seconds
  scope?: string;
}

// ── Product Catalogue ─────────────────────────────────────────────────────────

export interface MakitoMedia {
  id: string;
  url: string;
  type: 'image' | 'document' | 'video' | 'technical_sheet';
  isPrimary?: boolean;
  sortOrder?: number;
  format?: string; // jpg, png, pdf
  width?: number;
  height?: number;
  dpi?: number;
}

export interface MakitoPrintArea {
  id: string;
  name: string;
  positionCode: string;
  maxWidth: number;   // mm
  maxHeight: number;  // mm
  techniques: MakitoPrintTechnique[];
}

export interface MakitoPrintTechnique {
  code: string;
  name: string;
  maxColors?: number;
  maxWidth?: number;
  maxHeight?: number;
  setupCost?: number;
  unitCost?: number;
  minQty?: number;
  dpiRequired?: number;
  colorMode?: 'CMYK' | 'Pantone' | 'RGB' | 'any';
}

export interface MakitoSustainability {
  isRecycled?: boolean;
  isOrganic?: boolean;
  isBiodegradable?: boolean;
  certifications?: string[];
  material?: string;
  recycledContent?: number; // percentage
}

export interface MakitoPackaging {
  individualBox?: boolean;
  polybag?: boolean;
  cartonQty?: number;
  weightGross?: number; // kg
  dimensions?: { l: number; w: number; h: number }; // cm
}

export interface MakitoVariant {
  id: string;
  sku: string;
  ean?: string;
  colorCode: string;
  colorName: string;
  colorHex?: string;
  colorFamily?: string;
  size?: string;
  price: number;
  priceBreaks?: Array<{ minQty: number; price: number }>;
  stock: number;
  nextStockDate?: string;
  nextStockQty?: number;
  status: 'active' | 'discontinued' | 'seasonal' | 'new';
  media: MakitoMedia[];
  weight?: number; // grams
  dimensions?: { l: number; w: number; h: number }; // mm
}

export interface MakitoProduct {
  id: string;
  reference: string; // master product code
  name: string;
  shortDescription?: string;
  longDescription?: string;
  brand?: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  material?: string;
  countryOfOrigin?: string;
  customsCode?: string;
  weight?: number;    // grams
  dimensions?: { l: number; w: number; h: number }; // mm
  printAreas: MakitoPrintArea[];
  sustainability: MakitoSustainability;
  packaging: MakitoPackaging;
  media: MakitoMedia[];
  variants: MakitoVariant[];
  updatedAt: string; // ISO date
  isNew?: boolean;
  isBestSeller?: boolean;
  isSustainable?: boolean;
}

export interface MakitoCatalogResponse {
  products: MakitoProduct[];
  totalCount: number;
  page: number;
  pageSize: number;
  lastModified: string;
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export interface MakitoStockItem {
  sku: string;
  available: number;
  reserved: number;
  nextArrival?: { date: string; qty: number };
  warehouseId?: string;
}

export interface MakitoStockResponse {
  items: MakitoStockItem[];
  generatedAt: string;
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface MakitoPriceBreak {
  minQty: number;
  unitPrice: number;
  setupCost: number;
}

export interface MakitoPriceItem {
  sku: string;
  currency: string;
  basePrice: number;
  priceBreaks: MakitoPriceBreak[];
  decorationPrices?: Record<string, number>; // technique → unit cost
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface MakitoOrderAddress {
  company: string;
  contact: string;
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  email?: string;
}

export interface MakitoOrderLine {
  sku: string;
  quantity: number;
  printPosition?: string;
  printTechnique?: string;
  artworkUrl?: string;
  artworkRef?: string;
  pantoneColors?: string[];
  mockupApproved?: boolean;
}

export interface MakitoOrderRequest {
  reference: string;         // your order ref — idempotency key
  deliveryAddress: MakitoOrderAddress;
  billingAddress?: MakitoOrderAddress;
  lines: MakitoOrderLine[];
  requestedDeliveryDate?: string;
  incoterms?: string;
  notes?: string;
}

export interface MakitoOrderResponse {
  orderId: string;
  reference: string;
  status: MakitoOrderStatus;
  estimatedDeliveryDate?: string;
  trackingNumber?: string;
  carrierCode?: string;
  trackingUrl?: string;
  createdAt: string;
  updatedAt: string;
  lines: Array<{ sku: string; qty: number; status: string }>;
}

export type MakitoOrderStatus =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'ARTWORK_REVIEW'
  | 'IN_PRODUCTION'
  | 'QUALITY_CONTROL'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ON_HOLD';

// ── Artwork Validation ────────────────────────────────────────────────────────

export interface MakitoArtworkValidationRequest {
  artworkUrl: string;
  printPositionId: string;
  technique: string;
  productReference: string;
}

export interface MakitoArtworkValidationResponse {
  valid: boolean;
  warnings: string[];
  errors: string[];
  dpi?: number;
  colorMode?: string;
  dimensions?: { w: number; h: number };
  suggestions?: string[];
}

// ── RFQ ───────────────────────────────────────────────────────────────────────

export interface MakitoRFQRequest {
  products: Array<{ sku: string; quantity: number }>;
  deliveryCountry: string;
  requestedDate?: string;
  includeDecoration?: boolean;
}

export interface MakitoRFQResponse {
  rfqId: string;
  validUntil: string;
  lines: Array<{
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    leadTimeDays: number;
    available: boolean;
  }>;
  shippingEstimate?: number;
  totalEstimate: number;
}

// ── Shipment ──────────────────────────────────────────────────────────────────

export interface MakitoShipmentEvent {
  timestamp: string;
  status: string;
  location?: string;
  description: string;
}

export interface MakitoShipmentTracking {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  carrierTrackingUrl?: string;
  estimatedDelivery?: string;
  status: string;
  events: MakitoShipmentEvent[];
}
