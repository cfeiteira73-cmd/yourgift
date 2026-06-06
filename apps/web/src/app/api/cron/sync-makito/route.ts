// ── Cron: Sync Makito supplier catalog (run weekly) ──────────────────────────
// GET /api/cron/sync-makito — protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MARGIN = 1.35;

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function getMakitoToken(): Promise<string> {
  const clientId = process.env.MAKITO_CLIENT_ID ?? '';
  const clientSecret = process.env.MAKITO_CLIENT_SECRET ?? '';
  const baseUrl = process.env.MAKITO_BASE_URL ?? 'https://apis.makito.es';
  if (!clientId || !clientSecret) throw new Error('Makito credentials not configured');

  const res = await fetch(`${baseUrl}/access/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Makito auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error('No token in response');
  return data.token;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  const baseUrl = process.env.MAKITO_BASE_URL ?? 'https://apis.makito.es';
  const start = Date.now();
  let synced = 0, errors = 0;

  try {
    const token = await getMakitoToken();

    // Fetch catalog (large file, needs timeout)
    const catalogRes = await fetch(`${baseUrl}/catalog/files?format=JSON&lang=en`, {
      headers: { 'Authorization': `Bearer ${token}` },
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    if (!catalogRes.ok) return NextResponse.json({ error: `Catalog failed: ${catalogRes.status}` }, { status: 502 });
    const catalogRaw = await catalogRes.json();

    // Fetch prices
    const priceRes = await fetch(`${baseUrl}/price-list/files?format=JSON`, {
      headers: { 'Authorization': `Bearer ${token}` },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    });
    const priceData = priceRes.ok ? await priceRes.json() : { priceList: [] };

    // Build price map
    const priceMap = new Map<string, number>();
    for (const item of priceData.priceList ?? []) {
      const baseQty = Number(item.baseQuantity) || 1;
      const scales = item.scales ?? [];
      if (scales[0]) {
        const cost = parseFloat(String(scales[0].amount).replace(',', '.')) / baseQty;
        if (!isNaN(cost) && cost > 0) priceMap.set(item.material, Math.round(cost * MARGIN * 100) / 100);
      }
    }

    // Extract products
    const products = Array.isArray(catalogRaw) ? catalogRaw
      : Object.values(catalogRaw).find(v => Array.isArray(v)) as unknown[] ?? [];

    for (const p of products as Array<Record<string, unknown>>) {
      if (!p.ref || !p.name) { errors++; continue; }
      const cats = (p.categories as string[] | undefined) ?? [];
      const parts = (cats[0] ?? '').split('>').map((x: string) => x.trim()).filter((x: string) => !['Production','PRODUCTS'].includes(x));
      const category = parts[0] ?? 'Merchandising';
      const images = [p.image, ...((p.detail_images as string[]) ?? [])].filter(Boolean) as string[];
      const price = priceMap.get(p.ref as string) ?? priceMap.get(p.web_reference as string) ?? 0;

      const { error } = await db.from('products').upsert({
        supplier_ref: `makito_${p.ref}`,
        supplier: 'makito',
        title: p.name,
        description: p.description ?? '',
        category,
        base_price: price,
        images,
        print_areas: { printable: !!(p.printcode), printcode: p.printcode ?? '' },
        is_active: true,
      }, { onConflict: 'supplier_ref' });

      if (error) errors++;
      else synced++;
    }

    await db.from('sync_logs').insert({
      supplier: 'makito_catalog',
      products_upserted: synced,
      variants_upserted: 0,
      stock_updated: 0,
      errors: errors > 0 ? [`${errors} errors`] : [],
      duration_ms: Date.now() - start,
    });

    return NextResponse.json({ ok: true, synced, errors, durationMs: Date.now() - start });
  } catch (err) {
    console.error('[cron/sync-makito]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
