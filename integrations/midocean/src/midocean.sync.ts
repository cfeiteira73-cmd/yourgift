/**
 * Midocean → Database sync
 * Run: npx ts-node integrations/midocean/src/midocean.sync.ts
 * Or via API: POST /api/v1/admin/sync/midocean
 */

import { MidoceanClient } from './midocean.client';
import type { MidoceanProduct, MidoceanVariant } from './midocean.types';

export interface SyncResult {
  productsUpserted: number;
  variantsUpserted: number;
  stockUpdated: number;
  errors: string[];
  durationMs: number;
}

function extractImages(assets: MidoceanProduct['digital_assets']): string[] {
  return assets
    .filter((a) => a.type === 'image')
    .map((a) => a.url_highress ?? a.url);
}

function variantImages(variant: MidoceanVariant): string[] {
  return variant.digital_assets
    .filter((a) => a.type === 'image')
    .map((a) => a.url_highress ?? a.url);
}

/**
 * Transform Midocean product into the shape expected by the Prisma Product model.
 * Prices come from getPriceList(); pass a price map for accurate pricing.
 */
export function transformProduct(
  p: MidoceanProduct,
  priceMap: Map<string, number> = new Map(),
  stockMap: Map<string, number> = new Map(),
) {
  const firstVariantSku = p.variants[0]?.sku ?? '';
  const basePrice = priceMap.get(firstVariantSku) ?? 0;

  return {
    supplierRef: p.master_code,
    supplier: 'midocean' as const,
    title: p.product_name,
    description: p.long_description || p.short_description,
    category: p.category_code,
    basePrice,
    images: extractImages(p.digital_assets),
    printAreas: {
      positions: parseInt(p.number_of_print_positions, 10) || 1,
      printable: p.printable === 'yes',
    },
    variants: p.variants
      .filter((v) => v.plc_status_description === 'COLLECTION') // active only
      .map((v) => ({
        sku: v.sku,
        color: v.color_description,
        colorGroup: v.color_group,
        colorCode: v.color_code,
        gtin: v.gtin,
        price: priceMap.get(v.sku) ?? basePrice,
        stock: stockMap.get(v.sku) ?? 0,
        images: variantImages(v),
        categoryLevel1: v.category_level1,
        categoryLevel2: v.category_level2,
        categoryLevel3: v.category_level3,
      })),
  };
}

export class MidoceanSyncService {
  private client: MidoceanClient;

  constructor(apiKey: string) {
    this.client = new MidoceanClient(apiKey);
  }

  async sync(
    upsertProduct: (data: ReturnType<typeof transformProduct>) => Promise<void>,
  ): Promise<SyncResult> {
    const start = Date.now();
    const result: SyncResult = {
      productsUpserted: 0,
      variantsUpserted: 0,
      stockUpdated: 0,
      errors: [],
      durationMs: 0,
    };

    console.log('[Midocean Sync] Fetching catalogue...');
    const [products, stockMap, priceList] = await Promise.all([
      this.client.getProducts('en'),
      this.client.getStockMap(),
      this.client.getPriceList('EUR'),
    ]);

    const priceMap = new Map(priceList.map((p) => [p.sku, p.net_price]));
    console.log(`[Midocean Sync] ${products.length} products · ${stockMap.size} stock entries · ${priceMap.size} prices`);

    for (const raw of products) {
      try {
        const data = transformProduct(raw, priceMap, stockMap);
        await upsertProduct(data);
        result.productsUpserted++;
        result.variantsUpserted += data.variants.length;
        result.stockUpdated += data.variants.filter((v) => v.stock > 0).length;
      } catch (err) {
        result.errors.push(`${raw.master_code}: ${String(err)}`);
      }
    }

    result.durationMs = Date.now() - start;
    console.log(`[Midocean Sync] Done in ${result.durationMs}ms — ${result.productsUpserted} products, ${result.errors.length} errors`);
    return result;
  }
}
