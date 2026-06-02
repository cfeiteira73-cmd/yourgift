// ── Makito B2B API Types — Verified Against Real API Payloads ─────────────────
// Verified: 2026-06-02 | Source: GET /catalog/files, /stock/files, /price-list/files
// Base URL: https://apis.makito.es

// ── Shared ────────────────────────────────────────────────────────────────────

export interface MakitoPriceBreak {
  minQty: number;
  price: number;
}

export interface MakitoPrintTechnique {
  code: string;
  name: string;
  maxColors?: number;
  minQty?: number;
  setupCost?: number;
  unitCost?: number;
  dpiRequired?: number;
  colorMode?: string;
  maxWidth?: number;
  maxHeight?: number;
}

export interface MakitoPrintArea {
  id: string;
  name: string;
  positionCode: string;
  maxWidth: number;
  maxHeight: number;
  techniques: MakitoPrintTechnique[];
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// POST /access/auth/login

export interface MakitoLoginRequest {
  clientId: string;
  clientSecret: string;
}

export interface MakitoLoginResponse {
  token: string;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// GET /catalog/files?format=JSON&lang=en
// VERIFIED REAL PAYLOAD — do NOT change field names

export interface MakitoRealVariant {
  variant_reference: string;   // e.g. "5246ROJS/T" — THIS IS THE SKU
  variant_name: string;        // e.g. "Camara Deportiva Komir Rojo"
  variant_colorcode: string;   // e.g. "003"
  variant_size: string;        // e.g. "000"
  variant_image: string;       // full URL to principal image
  variant_thumbnail: string;   // full URL to thumbnail
}

export interface MakitoRealProduct {
  ref: string;                 // e.g. "15246" — MASTER PRODUCT CODE
  web_reference: string;       // e.g. "5246"
  name: string;                // e.g. "Komir"
  description: string;         // HTML string
  observations?: string;
  print_observations?: string;
  printcode?: string;          // e.g. "K(4)"
  length?: number | null;
  height?: number | null;
  width?: number | null;
  diameter?: number | null;
  weight?: number | false | null;
  material?: string | null;
  // Packaging fields (pf_, pi1_, pi2_, ptc_)
  pf_type?: string | null;
  pf_units?: number | null;
  pf_length?: number | null;
  pf_height?: number | null;
  pf_width?: number | null;
  pf_weight?: number | null;
  ptc_type?: string | null;
  ptc_units?: number | null;
  ptc_length?: number | null;
  ptc_height?: number | null;
  ptc_width?: number | null;
  ptc_weight?: number | null;
  pallet_units?: number | null;
  sizes?: string[] | null;
  brand?: string | null;
  web_new?: boolean;
  custom_code?: string | null;  // customs/HS code
  batteries?: string[];
  categories: string[];          // e.g. ["Production > PRODUCTS > Technology > ..."]
  image360link?: string | null;
  image: string;                 // primary image URL
  thumbnail_image: string;       // thumbnail URL
  detail_images: string[];       // array of detail image URLs
  variants: MakitoRealVariant[];
}

// ── Stock ─────────────────────────────────────────────────────────────────────
// GET /stock/files?format=JSON
// VERIFIED: material code is NUMERIC (e.g. "11011006000"), NOT variant_reference
// ⚠️ CRITICAL: material codes do NOT directly map to variant_reference
// They are internal SAP codes. Cross-reference not available via API.

export interface MakitoStockItem {
  material: string;       // internal numeric code e.g. "11011006000"
  quantity: number;
  availableDate?: string; // ISO-8601 for incoming stock (future availability)
}

export interface MakitoStockFile {
  generatedAt: string;
  stocks: MakitoStockItem[];
}

// ── Price List ────────────────────────────────────────────────────────────────
// GET /price-list/files?format=JSON
// VERIFIED: material is NUMERIC product code (e.g. "11011"), NOT variant_reference
// Prices are in EUR, amounts as strings (e.g. "3850.00")
// ⚠️ CRITICAL: material codes here are product-level, not variant-level

export interface MakitoPriceScale {
  quantity: string;   // e.g. "1", "500", "2000"
  amount: string;     // e.g. "3850.00" — ALWAYS A STRING
}

export interface MakitoPriceItem {
  material: string;       // internal numeric product code
  currency: string;       // "EUR"
  baseQuantity: string;   // e.g. "1000"
  scales: MakitoPriceScale[];
}

export interface MakitoPriceFile {
  generatedAt: string;
  priceList: MakitoPriceItem[];
}

// ── Orders ────────────────────────────────────────────────────────────────────
// POST /orders

export interface MakitoPrintingJob {
  area: string;
  technique: string;
  colors?: string;
  artworkUrl?: string;
}

export interface MakitoOrderItem {
  variant: string;      // variant_reference e.g. "5246ROJS/T"
  quantity: number;
  printingJobs?: MakitoPrintingJob[];
}

export interface MakitoOrderRequest {
  customerOrder: string;
  items: MakitoOrderItem[];
  deliveryAddress?: {
    company?: string;
    contact?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    regionCode?: string;
    phone?: string;
  };
  requestedDate?: string;
  notes?: string;
}

export interface MakitoOrderDocument {
  documentNumber: string;
  link: string;
}

export interface MakitoOrderResponse {
  documents: MakitoOrderDocument[];
}

export interface MakitoSalesOrder {
  id: string;
  customerOrder: string;
  status?: string;
  createdAt?: string;
  estimatedDeliveryDate?: string;
  items?: Array<{ variant: string; quantity: number; status?: string }>;
  [key: string]: unknown;
}

export interface MakitoSalesOrderListResponse {
  orders?: MakitoSalesOrder[];
  [key: string]: unknown;
}

export interface MakitoDelivery {
  documentNumber: string;
  customerOrder?: string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MakitoDeliveriesResponse {
  deliveries?: MakitoDelivery[];
  [key: string]: unknown;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export interface MakitoRegion {
  regionCode: string;
  regionName: string;
  countryCode: string;
}

export interface MakitoCountry {
  countryCode: string;
  countryName: string;
}

export interface MakitoColor {
  colorCode: string;
  colorName: string;
  [key: string]: unknown;
}
