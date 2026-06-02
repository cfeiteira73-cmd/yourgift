// ── Makito Catalog Sync — Real API ───────────────────────────────────────────
// Fetches full catalog, stock, and prices from real Makito B2B API endpoints

import { MakitoClient } from './makito.client';
import type {
  MakitoCatalogProduct,
  MakitoCatalogVariant,
  MakitoPriceItem,
  MakitoStockItem,
} from './makito.types';

export interface MakitoSyncResult {
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
  mode: 'full' | 'incremental' | 'stock_only';
  conflicts: Array<{ reference: string; field: string; existing: unknown; incoming: unknown }>;
}

export interface TransformedMakitoVariant {
  sku: string;          // variantReference
  color: string;
  colorGroup: string;
  colorCode: string;
  gtin: string;
  price: number;
  stock: number;
  images: string[];
  size?: string;
  categoryLevel1: string;
  categoryLevel2: string;
  categoryLevel3: string;
  priceBreaks: Array<{ minQty: number; price: number }>;
}

export interface TransformedMakitoProduct {
  supplierRef: string;   // "makito_{productReference}"
  supplier: 'makito';
  title: string;
  description: string;
  category: string;
  basePrice: number;
  images: string[];
  printAreas: object;
  metadata: object;
  variants: TransformedMakitoVariant[];
}

/** Build price breaks from Makito scale array */
function buildPriceBreaks(
  scales: Array<{ quantity: string | number; amount: string | number }>,
): Array<{ minQty: number; price: number }> {
  return scales
    .map((s) => ({ minQty: Number(s.quantity), price: Number(s.amount) }))
    .filter((s) => s.minQty > 0 && s.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

/** Find best price for a variant from the price list */
function findBasePrice(
  variantRef: string,
  productRef: string,
  priceMap: Map<string, MakitoPriceItem>,
): number {
  const item = priceMap.get(variantRef) ?? priceMap.get(productRef);
  if (!item || !item.scales.length) return 0;
  // First scale = lowest quantity price (most common use case)
  return Number(item.scales[0].amount ?? 0);
}

export function transformMakitoProduct(
  product: MakitoCatalogProduct,
  priceMap: Map<string, MakitoPriceItem>,
  stockMap: Map<string, number>,
): TransformedMakitoProduct {
  const basePrice = findBasePrice(
    product.variants[0]?.variantReference ?? '',
    product.productReference,
    priceMap,
  );

  const activeVariants = (product.variants ?? []).filter(
    (v) => v.active !== false && v.active !== 'false' && v.active !== '0',
  );

  return {
    supplierRef: `makito_${product.productReference}`,
    supplier: 'makito',
    title: product.productName,
    description: product.productDescription || product.shortDescription || '',
    category: product.category ?? 'Merchandising',
    basePrice,
    images: product.images ?? [],
    printAreas: {
      areas: (product.markingAreas ?? []).map((a) => ({
        areaCode: a.areaCode,
        areaName: a.areaDescription,
        maxWidth: a.maxWidth,
        maxHeight: a.maxHeight,
        techniques: a.techniques ?? [],
      })),
      count: product.markingAreas?.length ?? 0,
      printable: (product.printable === true || product.printable === 'true' || product.printable === 'yes'),
    },
    metadata: {
      brand: product.brand,
      material: product.material,
      colors: product.colors,
      measures: product.measures,
      weight: product.weight,
      countryOfOrigin: product.countryOfOrigin,
      customsCode: product.customsCode,
    },
    variants: activeVariants.map((v) => {
      const priceItem = priceMap.get(v.variantReference) ?? priceMap.get(product.productReference);
      const variantPrice = priceItem
        ? Number(priceItem.scales[0]?.amount ?? 0)
        : basePrice;
      const priceBreaks = priceItem ? buildPriceBreaks(priceItem.scales) : [];

      return {
        sku: v.variantReference,
        color: v.colorDescription,
        colorGroup: v.colorGroup ?? v.colorDescription,
        colorCode: v.colorCode,
        gtin: v.eanCode ?? '',
        price: variantPrice,
        stock: stockMap.get(v.variantReference) ?? 0,
        images: [],  // variant images fetched separately via /catalog/assets/{ref}/principal/{file}
        categoryLevel1: product.category ?? '',
        categoryLevel2: product.subcategory ?? '',
        categoryLevel3: '',
        priceBreaks,
      };
    }),
  };
}

export class MakitoCatalogSyncService {
  private readonly client: MakitoClient;

  constructor(opts: { clientId: string; clientSecret: string; baseUrl?: string }) {
    this.client = new MakitoClient({
      ...opts,
      logger: (msg) => console.log(`[MakitoSync] ${msg}`),
    });
  }

  /** Full sync: catalog + stock + prices in parallel */
  async syncFull(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
  ): Promise<MakitoSyncResult> {
    const start = Date.now();
    const result: MakitoSyncResult = {
      productsUpserted: 0,
      variantsUpserted: 0,
      stockUpdated: 0,
      errors: [],
      durationMs: 0,
      mode: 'full',
      conflicts: [],
    };

    console.log('[MakitoSync] Fetching catalog, stock and prices in parallel...');

    // Fetch all 3 files in parallel
    const [catalogFile, stockFile, priceFile] = await Promise.all([
      this.client.getCatalog('en').catch((e) => { result.errors.push(`catalog: ${e}`); return null; }),
      this.client.getStock().catch((e) => { result.errors.push(`stock: ${e}`); return null; }),
      this.client.getPriceList().catch((e) => { result.errors.push(`prices: ${e}`); return null; }),
    ]);

    // Build lookup maps
    const stockMap = new Map<string, number>(
      (stockFile?.stocks ?? []).map((s: MakitoStockItem) => [s.material, s.quantity]),
    );

    const priceMap = new Map<string, MakitoPriceItem>(
      (priceFile?.priceList ?? []).map((p: MakitoPriceItem) => [p.material, p]),
    );

    // Extract product list from catalog (API may return different shapes)
    const products = this.extractProducts(catalogFile);

    console.log(
      `[MakitoSync] ${products.length} products · ${stockMap.size} stock entries · ${priceMap.size} price entries`,
    );

    for (const raw of products) {
      try {
        const data = transformMakitoProduct(raw, priceMap, stockMap);
        await upsert(data);
        result.productsUpserted++;
        result.variantsUpserted += data.variants.length;
        result.stockUpdated += data.variants.filter((v) => v.stock > 0).length;
      } catch (err) {
        result.errors.push(`${raw.productReference}: ${String(err)}`);
      }
    }

    result.durationMs = Date.now() - start;
    console.log(
      `[MakitoSync] Done in ${result.durationMs}ms — ` +
      `${result.productsUpserted} products, ${result.variantsUpserted} variants, ` +
      `${result.errors.length} errors`,
    );

    return result;
  }

  /** Incremental sync: same as full but note API doesn't expose delta — re-syncs all */
  async syncIncremental(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
    _since: string,
  ): Promise<MakitoSyncResult> {
    // Makito API provides full file snapshots — no delta endpoint
    // Re-sync full and let upsert handle conflicts
    const result = await this.syncFull(upsert);
    return { ...result, mode: 'incremental' };
  }

  /** Stock-only sync — fastest, skips catalog */
  async syncStock(
    updateStock: (sku: string, qty: number) => Promise<void>,
  ): Promise<MakitoSyncResult> {
    const start = Date.now();
    const result: MakitoSyncResult = {
      productsUpserted: 0,
      variantsUpserted: 0,
      stockUpdated: 0,
      errors: [],
      durationMs: 0,
      mode: 'stock_only',
      conflicts: [],
    };

    try {
      const stockFile = await this.client.getStock();
      for (const item of stockFile.stocks ?? []) {
        try {
          await updateStock(item.material, item.quantity);
          result.stockUpdated++;
        } catch (err) {
          result.errors.push(`stock ${item.material}: ${String(err)}`);
        }
      }
    } catch (err) {
      result.errors.push(`stock fetch: ${String(err)}`);
    }

    result.durationMs = Date.now() - start;
    return result;
  }

  /** Extract product array from catalog response (handles different API response shapes) */
  private extractProducts(file: any): MakitoCatalogProduct[] {
    if (!file) return [];
    // Try known shapes
    if (Array.isArray(file)) return file;
    if (Array.isArray(file.products)) return file.products;
    if (Array.isArray(file.catalog)) return file.catalog;
    if (Array.isArray(file.items)) return file.items;
    // If it's an object with a single array key
    for (const key of Object.keys(file)) {
      if (Array.isArray(file[key]) && file[key].length > 0 && file[key][0]?.productReference) {
        return file[key];
      }
    }
    console.warn('[MakitoSync] Could not extract products from catalog response shape:', Object.keys(file));
    return [];
  }

  async healthCheck() {
    return this.client.healthCheck();
  }

  getCircuitState() {
    return this.client.getCircuitState();
  }
}
