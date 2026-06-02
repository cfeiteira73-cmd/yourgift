// ── Makito Catalog Sync ───────────────────────────────────────────────────────
// Full sync, incremental sync, stock-only sync, conflict detection

import { MakitoClient } from './makito.client';
import type { MakitoProduct, MakitoVariant } from './makito.types';

export interface MakitoSyncResult {
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
  mode: 'full' | 'incremental' | 'stock_only';
  conflicts: Array<{ reference: string; field: string; existing: unknown; incoming: unknown }>;
}

export interface TransformedMakitoProduct {
  supplierRef: string;
  supplier: 'makito';
  title: string;
  description: string;
  category: string;
  basePrice: number;
  images: string[];
  printAreas: object;
  metadata: object; // sustainability, packaging, brand, etc.
  variants: TransformedMakitoVariant[];
}

export interface TransformedMakitoVariant {
  sku: string;
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

function extractImages(product: MakitoProduct, variant?: MakitoVariant): string[] {
  const sources = variant ? variant.media : product.media;
  return sources
    .filter((m) => m.type === 'image')
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
    .map((m) => m.url)
    .slice(0, 8);
}

export function transformMakitoProduct(
  p: MakitoProduct,
  priceMap: Map<string, number> = new Map(),
  stockMap: Map<string, number> = new Map(),
): TransformedMakitoProduct {
  const firstVariantSku = p.variants[0]?.sku ?? '';
  const basePrice = priceMap.get(firstVariantSku) ?? p.variants[0]?.price ?? 0;

  return {
    supplierRef: `makito_${p.reference}`,
    supplier: 'makito',
    title: p.name,
    description: p.longDescription || p.shortDescription || '',
    category: p.category,
    basePrice,
    images: extractImages(p),
    printAreas: {
      positions: p.printAreas.length,
      areas: p.printAreas.map((a) => ({
        id: a.id,
        name: a.name,
        maxWidth: a.maxWidth,
        maxHeight: a.maxHeight,
        techniques: a.techniques.map((t) => t.code),
      })),
    },
    metadata: {
      brand: p.brand,
      material: p.material,
      countryOfOrigin: p.countryOfOrigin,
      customsCode: p.customsCode,
      sustainability: p.sustainability,
      packaging: p.packaging,
      isNew: p.isNew,
      isBestSeller: p.isBestSeller,
      isSustainable: p.isSustainable,
      tags: p.tags,
    },
    variants: p.variants
      .filter((v) => v.status === 'active' || v.status === 'new')
      .map((v) => ({
        sku: v.sku,
        color: v.colorName,
        colorGroup: v.colorFamily ?? v.colorName,
        colorCode: v.colorCode,
        gtin: v.ean ?? '',
        price: priceMap.get(v.sku) ?? v.price ?? basePrice,
        stock: stockMap.get(v.sku) ?? v.stock ?? 0,
        images: extractImages(p, v),
        size: v.size,
        categoryLevel1: p.category,
        categoryLevel2: p.subcategory ?? '',
        categoryLevel3: '',
        priceBreaks: v.priceBreaks ?? [],
      })),
  };
}

export class MakitoCatalogSyncService {
  private readonly client: MakitoClient;

  constructor(opts: { clientId: string; clientSecret: string; baseUrl?: string }) {
    this.client = new MakitoClient({ ...opts, logger: (m) => console.log(`[MakitoSync] ${m}`) });
  }

  /** Full catalog sync — fetches all products, stock, prices */
  async syncFull(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
  ): Promise<MakitoSyncResult> {
    return this.syncInternal(upsert, 'full');
  }

  /** Incremental sync — only products modified since lastSyncAt */
  async syncIncremental(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
    lastSyncAt: string,
  ): Promise<MakitoSyncResult> {
    return this.syncInternal(upsert, 'incremental', lastSyncAt);
  }

  /** Stock-only sync — faster, no product data fetched */
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
      const stockMap = await this.client.getStockMap();
      for (const [sku, qty] of stockMap) {
        try {
          await updateStock(sku, qty);
          result.stockUpdated++;
        } catch (err) {
          result.errors.push(`stock ${sku}: ${String(err)}`);
        }
      }
    } catch (err) {
      result.errors.push(`stock fetch failed: ${String(err)}`);
    }

    result.durationMs = Date.now() - start;
    return result;
  }

  private async syncInternal(
    upsert: (product: TransformedMakitoProduct) => Promise<void>,
    mode: 'full' | 'incremental',
    since?: string,
  ): Promise<MakitoSyncResult> {
    const start = Date.now();
    const result: MakitoSyncResult = {
      productsUpserted: 0,
      variantsUpserted: 0,
      stockUpdated: 0,
      errors: [],
      durationMs: 0,
      mode,
      conflicts: [],
    };

    console.log(`[MakitoSync] Starting ${mode} sync${since ? ` (since ${since})` : ''}`);

    // Fetch in parallel
    const [stockMap, priceMap] = await Promise.all([
      this.client.getStockMap().catch((e) => {
        result.errors.push(`stock fetch: ${e}`);
        return new Map<string, number>();
      }),
      this.client.getPriceMap('EUR').catch((e) => {
        result.errors.push(`price fetch: ${e}`);
        return new Map<string, number>();
      }),
    ]);

    // Paginated product fetch
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.getProducts({ page, pageSize, since });
        const { products, totalCount } = response;

        for (const raw of products) {
          try {
            const transformed = transformMakitoProduct(raw, priceMap, stockMap);
            await upsert(transformed);
            result.productsUpserted++;
            result.variantsUpserted += transformed.variants.length;
            result.stockUpdated += transformed.variants.filter((v) => v.stock > 0).length;
          } catch (err) {
            result.errors.push(`${raw.reference}: ${String(err)}`);
          }
        }

        hasMore = page * pageSize < totalCount;
        page++;
      } catch (err) {
        result.errors.push(`page ${page}: ${String(err)}`);
        hasMore = false;
      }
    }

    result.durationMs = Date.now() - start;
    console.log(
      `[MakitoSync] Done in ${result.durationMs}ms — ${result.productsUpserted} products, ` +
      `${result.variantsUpserted} variants, ${result.errors.length} errors`,
    );

    return result;
  }

  async healthCheck() {
    return this.client.healthCheck();
  }

  getCircuitState() {
    return this.client.getCircuitState();
  }
}
