/**
 * PF Concept → Database sync
 * Run: npx ts-node integrations/pf/src/pf.sync.ts
 * Or via API: POST /api/v1/admin/suppliers/pf-concept/sync
 */

import { PFConceptClient } from './pf.client';
import { transformPFProduct } from './pf.transform';
import type { TransformedPFProduct } from './pf.transform';
import type { PFSyncResult } from './pf.types';

export class PFSyncService {
  private client: PFConceptClient;

  constructor(apiKey: string, username: string) {
    this.client = new PFConceptClient(apiKey, username);
  }

  async sync(
    upsertProduct: (data: TransformedPFProduct) => Promise<void>,
  ): Promise<PFSyncResult> {
    const start = Date.now();
    const result: PFSyncResult = {
      productsUpserted: 0,
      variantsUpserted: 0,
      stockUpdated: 0,
      errors: [],
      durationMs: 0,
    };

    console.log('[PF Concept Sync] Fetching catalogue...');

    let products;
    try {
      products = await this.client.getCatalog();
    } catch (err) {
      result.errors.push(`Catalog fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      result.durationMs = Date.now() - start;
      return result;
    }

    console.log(`[PF Concept Sync] ${products.length} products fetched`);

    for (const raw of products) {
      try {
        const data = transformPFProduct(raw);
        await upsertProduct(data);
        result.productsUpserted++;
        result.variantsUpserted += data.variants.length;
        result.stockUpdated += data.variants.filter((v) => v.stock > 0).length;
      } catch (err) {
        result.errors.push(
          `Product ${raw.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    result.durationMs = Date.now() - start;
    console.log(
      `[PF Concept Sync] Done in ${result.durationMs}ms — ${result.productsUpserted} products, ${result.errors.length} errors`,
    );
    return result;
  }
}
