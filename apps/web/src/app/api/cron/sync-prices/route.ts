// ── Cron: Sync MidOcean supplier prices (run daily) ──────────────────────────
// Vercel Cron: schedule in vercel.json or via Vercel dashboard
// GET /api/cron/sync-prices — protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  const MIDOCEAN_KEY = process.env.MIDOCEAN_KEY ?? '';
  if (!MIDOCEAN_KEY) return NextResponse.json({ error: 'MIDOCEAN_KEY not configured' }, { status: 503 });

  const MARGIN = 1.35;
  const start = Date.now();
  let updatedVariants = 0;
  let updatedProducts = 0;
  const errors: string[] = [];

  try {
    // Fetch price list from MidOcean supplier
    const priceRes = await fetch('https://api.midocean.com/gateway/pricelist/2.0?currency=EUR', {
      headers: { 'x-Gateway-APIKey': MIDOCEAN_KEY, 'Accept': 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });

    if (!priceRes.ok) {
      return NextResponse.json({ error: `MidOcean price list failed: ${priceRes.status}` }, { status: 502 });
    }

    const priceData = await priceRes.json();
    const prices: Array<{ sku: string; price: string | number }> = priceData?.price ?? (Array.isArray(priceData) ? priceData : []);

    // Build price map (supplier cost → selling price with margin)
    const priceMap = new Map<string, number>();
    for (const item of prices) {
      const cost = typeof item.price === 'string'
        ? parseFloat(item.price.replace(',', '.'))
        : item.price;
      if (!isNaN(cost) && cost > 0) {
        priceMap.set(item.sku, Math.round(cost * MARGIN * 100) / 100);
      }
    }

    // Update variants in batches
    const allSkus = [...priceMap.keys()];
    for (let i = 0; i < allSkus.length; i += 300) {
      const batch = allSkus.slice(i, i + 300);
      const { data: variants } = await db.from('product_variants').select('id, sku').in('sku', batch);
      for (const v of (variants ?? [])) {
        const price = priceMap.get(v.sku);
        if (price) {
          await db.from('product_variants').update({ price }).eq('id', v.id);
          updatedVariants++;
        }
      }
    }

    // Update products base_price from cheapest variant
    const { data: products } = await db.from('products').select('id').eq('supplier', 'midocean');
    for (const p of (products ?? [])) {
      const { data: v } = await db.from('product_variants').select('price').eq('product_id', p.id).gt('price', 0).order('price', { ascending: true }).limit(1).single();
      if (v && v.price > 0) {
        await db.from('products').update({ base_price: v.price }).eq('id', p.id);
        updatedProducts++;
      }
    }

    // Log sync
    await db.from('sync_logs').insert({
      supplier: 'midocean_prices',
      products_upserted: updatedProducts,
      variants_upserted: updatedVariants,
      stock_updated: 0,
      errors,
      duration_ms: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      updatedVariants,
      updatedProducts,
      pricesProcessed: priceMap.size,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    console.error('[cron/sync-prices]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
