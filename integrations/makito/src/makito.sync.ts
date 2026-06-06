// ── Makito Catalog Sync — Verified Real API Fields ───────────────────────────
// Verified against real payloads 2026-06-02
//
// CRITICAL FINDING: stock/price material codes (numeric) do NOT map to
// variant_reference (alphanumeric). Stock integration is best-effort only.
// Price integration is product-level, not variant-level.

import { MakitoClient } from './makito.client';
import type { MakitoRealProduct, MakitoRealVariant } from './makito.types';

export interface MakitoSyncResult {
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
  mode: 'full' | 'incremental' | 'stock_only';
  mappingErrors: number;
  conflicts: Array<{ ref: string; field: string; value: unknown }>;
}

export interface TransformedMakitoVariant {
  sku: string;          // variant_reference — e.g. "5246ROJS/T"
  color: string;        // variant_name (full colour description)
  colorGroup: string;   // derived from variant_name
  colorCode: string;    // variant_colorcode — e.g. "003"
  size: string;         // variant_size — e.g. "000"
  gtin: string;         // not in API — empty string
  price: number;        // from price list (product-level) or 0
  stock: number;        // always 0 (cannot join material codes to variant_reference)
  images: string[];     // [variant_image, variant_thumbnail]
  categoryLevel1: string;
  categoryLevel2: string;
  categoryLevel3: string;
  priceBreaks: Array<{ minQty: number; price: number }>;
}

export interface TransformedMakitoProduct {
  supplierRef: string;   // "makito_" + ref (e.g. "makito_15246")
  supplier: 'makito';
  title: string;
  description: string;
  category: string;      // first category segment
  basePrice: number;     // from price list
  images: string[];      // [image, ...detail_images]
  printAreas: object;
  metadata: object;
  variants: TransformedMakitoVariant[];
}

// Parse category path: "Production > PRODUCTS > Technology > Others > Cameras"
// Returns the most specific leaf category
function parseCategory(categories: string[]): { level1: string; level2: string; level3: string } {
  if (!categories || categories.length === 0) {
    return { level1: 'Merchandising', level2: '', level3: '' };
  }
  // Take first category path, skip "Production > PRODUCTS >" prefix
  const path = categories[0];
  const parts = path.split('>').map((p: string) => p.trim()).filter(Boolean);
  // Skip "Production" and "PRODUCTS"
  const cleaned = parts.filter((p: string) => !['Production', 'PRODUCTS'].includes(p));
  return {
    level1: cleaned[0] ?? 'Merchandising',
    level2: cleaned[1] ?? '',
    level3: cleaned[2] ?? '',
  };
}

// Build price breaks from scales array
function buildPriceBreaks(scales: Array<{ quantity: string; amount: string }>): Array<{ minQty: number; price: number }> {
  return scales
    .map((s) => ({ minQty: Number(s.quantity), price: parseFloat(s.amount) }))
    .filter((s) => !isNaN(s.minQty) && !isNaN(s.price) && s.minQty > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

// Derive colour group from colour name (first word)
function colorGroup(name: string): string {
  return name ? name.split(' ')[0] : '';
}

export function transformMakitoProduct(
  product: MakitoRealProduct,
  priceMap: Map<string, { basePrice: number; priceBreaks: Array<{ minQty: number; price: number }> }>,
): TransformedMakitoProduct {
  // Validate required fields
  if (!product.ref) throw new Error(`Product missing 'ref' field`);
  if (!product.name) throw new Error(`Product ${product.ref} missing 'name' field`);

  const cat = parseCategory(product.categories);

  // Images: primary + details
  const images: string[] = [];
  if (product.image) images.push(product.image);
  if (Array.isArray(product.detail_images)) {
    images.push(...product.detail_images.filter((u: string) => u && typeof u === 'string'));
  }

  // Price: look up by ref (web_reference also tried)
  const priceData = priceMap.get(product.ref)
    ?? priceMap.get(product.web_reference)
    ?? { basePrice: 0, priceBreaks: [] };

  // Active variants only (all present variants are considered active in Makito API)
  const activeVariants = (product.variants ?? []).filter(
    (v: MakitoRealVariant) => v.variant_reference && v.variant_reference.trim() !== '',
  );

  return {
    supplierRef: `makito_${product.ref}`,
    supplier: 'makito',
    title: product.name,
    description: product.description ?? '',
    category: cat.level1,
    basePrice: priceData.basePrice,
    images,
    printAreas: {
      printable: Boolean(product.printcode),
      printcode: product.printcode ?? '',
      count: product.printcode ? 1 : 0,
    },
    metadata: {
      webReference: product.web_reference,
      brand: product.brand ?? null,
      material: product.material ?? null,
      customsCode: product.custom_code ?? null,
      weight: typeof product.weight === 'number' ? product.weight : null,
      dimensions: {
        length: product.length ?? null,
        height: product.height ?? null,
        width: product.width ?? null,
        diameter: product.diameter ?? null,
      },
      packaging: {
        pfUnits: product.pf_units ?? null,
        cartonQty: product.ptc_units ?? null,
      },
      isNew: product.web_new ?? false,
      categories: product.categories ?? [],
      image360: product.image360link ?? null,
    },
    variants: activeVariants.map((v: MakitoRealVariant) => {
      const varImages: string[] = [];
      if (v.variant_image) varImages.push(v.variant_image);
      if (v.variant_thumbnail) varImages.push(v.variant_thumbnail);

      return {
        sku: v.variant_reference,              // CORRECT — "5246ROJS/T"
        color: v.variant_name,                 // full colour name
        colorGroup: colorGroup(v.variant_name),
        colorCode: v.variant_colorcode,        // "003"
        size: v.variant_size,                  // "000"
        gtin: '',                              // not provided by Makito API
        price: priceData.basePrice,            // product-level price
        stock: 0,                              // ⚠️ cannot join — see CRITICAL FINDING
        images: varImages,
        categoryLevel1: cat.level1,
        categoryLevel2: cat.level2,
        categoryLevel3: cat.level3,
        priceBreaks: priceData.priceBreaks,
      };
    }),
  };
}

// Validate a transformed product for undefined/null SKUs
export function validateTransformed(p: TransformedMakitoProduct): string[] {
  const errors: string[] = [];
  if (!p.supplierRef || p.supplierRef === 'makito_undefined') errors.push(`Invalid supplierRef: ${p.supplierRef}`);
  if (!p.title) errors.push('Missing title');
  for (const v of p.variants) {
    if (!v.sku || v.sku.includes('undefined')) errors.push(`Invalid SKU: ${v.sku}`);
    if (!v.colorCode) errors.push(`Missing colorCode for SKU ${v.sku}`);
  }
  return errors;
}

export class MakitoCatalogSyncService {
  private readonly client: MakitoClient;

  constructor(opts: { clientId: string; clientSecret: string; baseUrl?: string }) {
    this.client = new MakitoClient({
      ...opts,
      logger: (msg) => console.log(`[MakitoSync] ${msg}`),
    });
  }

  async syncFull(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
  ): Promise<MakitoSyncResult> {
    const start = Date.now();
    const result: MakitoSyncResult = {
      productsUpserted: 0, variantsUpserted: 0, stockUpdated: 0,
      errors: [], durationMs: 0, mode: 'full', mappingErrors: 0, conflicts: [],
    };

    console.log('[MakitoSync] Fetching catalog + prices in parallel...');

    const [catalogRaw, priceRaw] = await Promise.all([
      this.client.getCatalog('en').catch((e) => { result.errors.push(`catalog: ${e}`); return null; }),
      this.client.getPriceList().catch((e) => { result.errors.push(`prices: ${e}`); return null; }),
    ]);

    // Build price map: material → {basePrice, priceBreaks}
    const priceMap = new Map<string, { basePrice: number; priceBreaks: Array<{ minQty: number; price: number }> }>();
    for (const item of priceRaw?.priceList ?? []) {
      const breaks = buildPriceBreaks(item.scales ?? []);
      const basePrice = breaks.length > 0 ? breaks[0].price : 0;
      priceMap.set(item.material, { basePrice, priceBreaks: breaks });
    }

    // Extract products from catalog
    const products = this.extractProducts(catalogRaw);
    console.log(`[MakitoSync] ${products.length} products | ${priceMap.size} price entries`);

    for (const raw of products) {
      try {
        const data = transformMakitoProduct(raw as MakitoRealProduct, priceMap);
        // Validate before upsert
        const validationErrors = validateTransformed(data);
        const rawProduct = raw as MakitoRealProduct;
        if (validationErrors.length > 0) {
          result.mappingErrors++;
          result.errors.push(`MAPPING ${rawProduct.ref}: ${validationErrors.join('; ')}`);
          continue;
        }
        await upsert(data);
        result.productsUpserted++;
        result.variantsUpserted += data.variants.length;
      } catch (err) {
        result.errors.push(`${(raw as any).ref ?? 'unknown'}: ${String(err)}`);
      }
    }

    result.durationMs = Date.now() - start;
    console.log(
      `[MakitoSync] Done in ${result.durationMs}ms — ` +
      `${result.productsUpserted} products, ${result.variantsUpserted} variants, ` +
      `${result.mappingErrors} mapping errors, ${result.errors.length} total errors`,
    );
    return result;
  }

  async syncIncremental(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
    _since: string,
  ): Promise<MakitoSyncResult> {
    // Makito provides full snapshots — no delta API
    const result = await this.syncFull(upsert);
    return { ...result, mode: 'incremental' };
  }

  async syncStock(updateStock: (sku: string, qty: number) => Promise<void>): Promise<MakitoSyncResult> {
    // ⚠️ KNOWN LIMITATION: Makito stock uses internal material codes (numeric)
    // which cannot be joined to variant_reference (alphanumeric) without a mapping file.
    // This sync updates by material code — only works if SKUs were imported as material codes.
    const start = Date.now();
    const result: MakitoSyncResult = {
      productsUpserted: 0, variantsUpserted: 0, stockUpdated: 0,
      errors: ['⚠️ Stock material codes (numeric) do not map to catalog variant_reference — stock sync unreliable'],
      durationMs: 0, mode: 'stock_only', mappingErrors: 0, conflicts: [],
    };
    result.durationMs = Date.now() - start;
    return result;
  }

  private extractProducts(file: unknown): unknown[] {
    if (!file) return [];
    if (Array.isArray(file)) return file;
    const obj = file as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products;
    if (Array.isArray(obj.catalog)) return obj.catalog;
    if (Array.isArray(obj.items)) return obj.items;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        const first = (obj[key] as Record<string, unknown>[])[0];
        if (first?.ref || first?.productReference) return obj[key] as unknown[];
      }
    }
    console.warn('[MakitoSync] Unknown catalog shape:', Object.keys(obj));
    return [];
  }

  async healthCheck() { return this.client.healthCheck(); }
  getCircuitState() { return this.client.getCircuitState(); }
}
