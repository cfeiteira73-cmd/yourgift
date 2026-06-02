// ── Makito B2B API Types — Real API v1 ───────────────────────────────────────
// Base URL: https://apis.makito.es
// Auth: POST /access/auth/login → { token }

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface MakitoLoginRequest {
  clientId: string;
  clientSecret: string;
}

export interface MakitoLoginResponse {
  token: string;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// GET /catalog/files?format=JSON&lang={es|en|fr}

export interface MakitoCatalogVariant {
  variantReference: string;   // e.g. "15246N"
  colorCode: string;
  colorDescription: string;
  colorGroup?: string;
  eanCode?: string;
  active?: boolean | string;
  netWeight?: number;
  grossWeight?: number;
}

export interface MakitoMarkingArea {
  areaCode: string;
  areaDescription: string;
  techniques?: string[];
  maxWidth?: number;
  maxHeight?: number;
  positionCode?: string;
}

export interface MakitoCatalogProduct {
  productReference: string;   // master code e.g. "15246"
  productName: string;
  productDescription?: string;
  shortDescription?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  material?: string;
  colors?: string;
  measures?: string;
  weight?: number;
  countryOfOrigin?: string;
  customsCode?: string;
  printable?: boolean | string;
  markingAreas?: MakitoMarkingArea[];
  variants: MakitoCatalogVariant[];
  images?: string[];
  [key: string]: unknown; // API may return additional fields
}

export interface MakitoCatalogFile {
  generatedAt?: string;
  products?: MakitoCatalogProduct[];
  [key: string]: unknown; // top-level key may vary
}

// ── Stock ─────────────────────────────────────────────────────────────────────
// GET /stock/files?format=JSON

export interface MakitoStockItem {
  material: string;         // variant reference / SKU
  quantity: number;
  availableDate?: string;   // ISO-8601 for incoming stock
  plant?: string;
  storageLocation?: string;
}

export interface MakitoStockFile {
  generatedAt?: string;
  stocks: MakitoStockItem[];
}

// ── Price List ────────────────────────────────────────────────────────────────
// GET /price-list/files?format=JSON

export interface MakitoPriceScale {
  quantity: string | number;
  amount: string | number;  // unit price at this quantity
}

export interface MakitoPriceItem {
  material: string;         // product or variant reference
  currency: string;         // e.g. "EUR"
  baseQuantity?: string | number;
  scales: MakitoPriceScale[];
}

export interface MakitoPriceFile {
  generatedAt: string;
  priceList: MakitoPriceItem[];
}

// ── Print Price List ──────────────────────────────────────────────────────────
// GET /print-price-list/files?format=JSON

export interface MakitoPrintPriceItem {
  technique: string;
  area?: string;
  setupCost?: string | number;
  unitPrice?: string | number;
  minQuantity?: string | number;
  colors?: string | number;
  [key: string]: unknown;
}

export interface MakitoPrintPriceFile {
  generatedAt?: string;
  printPrices: MakitoPrintPriceItem[];
}

// ── Print Config ──────────────────────────────────────────────────────────────
// GET /print-config/files?format=JSON&lang={es|en|fr}

export interface MakitoTechnique {
  techniqueCode: string;
  techniqueName: string;
  maxColors?: number;
  minQuantity?: number;
  dpiRequired?: number;
  colorMode?: string;
  maxWidth?: number;
  maxHeight?: number;
  setupCost?: number;
  unitCost?: number;
}

export interface MakitoPrintPosition {
  areaCode: string;
  areaName?: string;
  positionCode?: string;
  maxWidth?: number;   // mm
  maxHeight?: number;  // mm
  techniques: MakitoTechnique[];
}

export interface MakitoPrintConfigProduct {
  productReference: string;
  printPositions: MakitoPrintPosition[];
}

export interface MakitoPrintConfigFile {
  generatedAt?: string;
  printConfig?: MakitoPrintConfigProduct[];
  [key: string]: unknown;
}

// ── Orders ────────────────────────────────────────────────────────────────────
// POST /orders

export interface MakitoPrintingJob {
  area: string;        // area code
  technique: string;   // technique code
  colors?: string;     // e.g. "PMS 286 C, PMS 032 C"
  artworkUrl?: string;
  artworkRef?: string;
}

export interface MakitoOrderItem {
  variant: string;     // variantReference e.g. "15246N"
  quantity: number;
  printingJobs?: MakitoPrintingJob[];
}

export interface MakitoOrderRequest {
  customerOrder: string;   // your reference — idempotency key
  items: MakitoOrderItem[];
  // Delivery address and other fields may be required — check with Makito
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
  link: string;           // e.g. "https://apis.makito.es/orders/sales-order/12923148"
}

export interface MakitoOrderResponse {
  documents: MakitoOrderDocument[];
}

// ── Order Status ──────────────────────────────────────────────────────────────
// GET /orders/sales-order or /orders/sales-order/{id}

export interface MakitoSalesOrderItem {
  variant: string;
  quantity: number;
  status?: string;
  deliveredQuantity?: number;
}

export interface MakitoSalesOrder {
  id: string;              // documentNumber
  customerOrder: string;
  status?: string;
  createdAt?: string;
  estimatedDeliveryDate?: string;
  items?: MakitoSalesOrderItem[];
  [key: string]: unknown;
}

export interface MakitoSalesOrderListResponse {
  orders?: MakitoSalesOrder[];
  [key: string]: unknown;
}

// ── Deliveries ────────────────────────────────────────────────────────────────
// GET /orders/deliveries

export interface MakitoDelivery {
  documentNumber: string;
  customerOrder?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  status?: string;
  items?: Array<{ variant: string; quantity: number }>;
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
  isoCode?: string;
}

export interface MakitoColor {
  colorCode: string;
  colorName: string;
  pantoneRef?: string;
  hexCode?: string;
}
