import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { parseBody } from '@/lib/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Makito Integration Portal API ─────────────────────────
//
// Proxy layer between the Next.js portal and the NestJS Makito API.
// Exposes Makito data to the admin portal with auth gate + caching.
//
// GET  ?mode=stats              — supplier stats (products, variants, lastSync)
// GET  ?mode=health             — API health + circuit breaker state
// GET  ?mode=inventory          — inventory report with alerts
// GET  ?mode=scorecard          — supplier intelligence scorecard
// GET  ?mode=kpis&days=30       — executive KPIs
// GET  ?mode=products&q=        — search Makito products in DB
// GET  ?mode=order&id=          — order status (by Makito document number)
// GET  ?mode=deliveries&ref=    — delivery tracking by customerOrder ref
// POST { action:'sync_full' }   — trigger full catalog sync
// POST { action:'sync_stock' }  — trigger stock-only sync
// POST { action:'quote', items } — price + stock check (no RFQ endpoint in API)
// POST { action:'price', ... }  — calculate pricing with margin
// POST { action:'artwork_check', ... } — validate artwork specs
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function callMakitoAPI(path: string, opts: RequestInit = {}) {
  const adminToken = process.env.YOURGIFT_ADMIN_TOKEN;
  const res = await fetch(`${API_URL}/makito${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...opts.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Makito API ${res.status}: ${body}`);
  }
  return res.json();
}

// Makito has no RFQ endpoint — quote = price list + stock check
const QuoteSchema = z.object({
  action: z.literal('quote'),
  items: z.array(z.object({ variantRef: z.string(), quantity: z.number().int().positive() })),
});

const PriceSchema = z.object({
  action: z.literal('price'),
  sku: z.string(),
  quantity: z.number().int().positive(),
  basePrice: z.number().positive(),
  targetMarginPct: z.number().min(0).max(100).optional(),
});

const ArtworkSchema = z.object({
  action: z.literal('artwork_check'),
  artwork: z.object({
    dpi: z.number().optional(),
    colorMode: z.string().optional(),
    widthMm: z.number().optional(),
    heightMm: z.number().optional(),
    fileFormat: z.string().optional(),
    estimatedColors: z.number().optional(),
    hasTransparency: z.boolean().optional(),
  }),
  printAreaId: z.string(),
  techniqueCode: z.string(),
  maxWidth: z.number(),
  maxHeight: z.number(),
});

const SyncSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync_full') }),
  z.object({ action: z.literal('sync_stock') }),
  z.object({ action: z.literal('sync_incremental'), since: z.string() }),
]);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getAdminDb() ?? supabase;
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'stats';

  try {
    // ── Stats ────────────────────────────────────────────────────────────────
    if (mode === 'stats') {
      // Get directly from Supabase for speed (no API round-trip)
      const [products, variants, lastSync] = await Promise.all([
        db.from('products').select('id', { count: 'exact', head: true }).eq('supplier', 'makito'),
        db.from('product_variants').select('id', { count: 'exact', head: true })
          .eq('products.supplier', 'makito'),
        db.from('sync_logs').select('*').eq('supplier', 'makito')
          .order('created_at', { ascending: false }).limit(1).single(),
      ]);

      return NextResponse.json({
        supplier: 'makito',
        products: products.count ?? 0,
        variants: variants.count ?? 0,
        lastSync: lastSync.data ?? null,
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Health ────────────────────────────────────────────────────────────────
    if (mode === 'health') {
      try {
        const health = await callMakitoAPI('/health');
        return NextResponse.json(health);
      } catch {
        return NextResponse.json({ healthy: false, reason: 'API unreachable' });
      }
    }

    // ── Inventory ─────────────────────────────────────────────────────────────
    if (mode === 'inventory') {
      try {
        const report = await callMakitoAPI('/inventory');
        return NextResponse.json(report);
      } catch {
        // Fallback: build from Supabase directly
        const { data: variants } = await db
          .from('product_variants')
          .select('sku, stock, price, products(title)')
          .eq('products.supplier', 'makito')
          .order('stock', { ascending: true })
          .limit(100);

        const alerts = (variants ?? [])
          .filter((v: any) => (v.stock ?? 0) < 50)
          .map((v: any) => ({
            sku: v.sku,
            productTitle: v.products?.title ?? v.sku,
            currentStock: v.stock ?? 0,
            severity: (v.stock ?? 0) < 10 ? 'critical' : 'warning',
            recommendedAction: (v.stock ?? 0) < 10 ? 'reorder_now' : 'reorder_soon',
          }));

        return NextResponse.json({
          generatedAt: new Date().toISOString(),
          alerts,
          fallback: true,
        });
      }
    }

    // ── Scorecard ─────────────────────────────────────────────────────────────
    if (mode === 'scorecard') {
      const scorecard = await callMakitoAPI('/analytics/scorecard');
      return NextResponse.json(scorecard);
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────
    if (mode === 'kpis') {
      const days = searchParams.get('days') ?? '30';
      const kpis = await callMakitoAPI(`/analytics/kpis?days=${days}`);
      return NextResponse.json(kpis);
    }

    // ── Products search ───────────────────────────────────────────────────────
    if (mode === 'products') {
      const q = searchParams.get('q') ?? '';
      const category = searchParams.get('category');
      const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

      let query = db
        .from('products')
        .select('id, title, category, base_price, images, supplier')
        .eq('supplier', 'makito')
        .order('title')
        .limit(limit);

      if (q) query = query.ilike('title', `%${q}%`);
      if (category) query = query.eq('category', category);

      const { data } = await query;
      return NextResponse.json({ products: data ?? [], generatedAt: new Date().toISOString() });
    }

    // ── Order status ──────────────────────────────────────────────────────────
    if (mode === 'order') {
      const id = searchParams.get('id'); // Makito document number
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      const status = await callMakitoAPI(`/orders/${id}`);
      return NextResponse.json(status);
    }

    // ── Deliveries ────────────────────────────────────────────────────────────
    if (mode === 'deliveries') {
      const ref = searchParams.get('ref');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      const params = new URLSearchParams();
      if (ref) params.set('customerOrder', ref);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const deliveries = await callMakitoAPI(`/deliveries?${params}`);
      return NextResponse.json(deliveries);
    }

    // ── Metadata ──────────────────────────────────────────────────────────────
    if (mode === 'metadata') {
      const meta = await callMakitoAPI('/metadata');
      return NextResponse.json(meta);
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });

  } catch (err) {
    console.error('[makito GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = (rawBody as any)?.action;

  try {
    // ── Sync Full ─────────────────────────────────────────────────────────────
    if (action === 'sync_full') {
      const result = await callMakitoAPI('/sync/full', { method: 'POST' });
      return NextResponse.json(result);
    }

    // ── Sync Stock ────────────────────────────────────────────────────────────
    if (action === 'sync_stock') {
      const result = await callMakitoAPI('/sync/stock', { method: 'POST' });
      return NextResponse.json(result);
    }

    // ── Sync Incremental ──────────────────────────────────────────────────────
    if (action === 'sync_incremental') {
      const since = (rawBody as any).since;
      if (!since) return NextResponse.json({ error: 'since required' }, { status: 400 });
      const result = await callMakitoAPI('/sync/incremental', {
        method: 'POST',
        body: JSON.stringify({ since }),
      });
      return NextResponse.json(result);
    }

    // ── Quote (price + stock check — Makito has no RFQ endpoint) ─────────────
    if (action === 'quote') {
      const parsed = parseBody(QuoteSchema, rawBody);
      if (!parsed.ok) return parsed.response;
      const result = await callMakitoAPI('/quote', {
        method: 'POST',
        body: JSON.stringify({ items: parsed.data.items }),
      });
      return NextResponse.json(result);
    }

    // ── Price Calculation ─────────────────────────────────────────────────────
    if (action === 'price') {
      const parsed = parseBody(PriceSchema, rawBody);
      if (!parsed.ok) return parsed.response;
      const result = await callMakitoAPI('/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      return NextResponse.json(result);
    }

    // ── Artwork Check ─────────────────────────────────────────────────────────
    if (action === 'artwork_check') {
      const parsed = parseBody(ArtworkSchema, rawBody);
      if (!parsed.ok) return parsed.response;
      const result = await callMakitoAPI('/artwork/validate', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('[makito POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
