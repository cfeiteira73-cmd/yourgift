import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA PROTOCOL — S3: Visual Product Builder — Catalog API ─────────────────
//
// Lightweight catalog proxy for client-side pages.
// Wraps Supabase products + variants with auth check.
// Supports: search, category, limit, offset, single product by id.
//
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_GROUP_PREFIXES: Record<string, string[]> = {
  apparel:    ['MOBTEX'],
  bags:       ['MOBT&B'],
  drinkware:  ['MOBH&L_DRI', 'MOBH&L_CUP', 'MOBH&L_GLA', 'MOBH&L_THE', 'MOBH&L_WIA'],
  home:       ['MOBH&L'],
  office:     ['MOBOFF'],
  tech:       ['MOBS&I', 'MOBT&W', 'MOBOFF_COM'],
  writing:    ['MOBWRI'],
  leisure:    ['MOBL&G'],
  personal:   ['MOBPER'],
  tools:      ['MOBTLL'],
  stationery: ['MOBP&S'],
  kitchen:    ['MOBH&L_KAC', 'MOBK&G'],
  seasonal:   ['MOBXMS'],
};

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const id       = searchParams.get('id');
  const search   = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? 'all';
  const limit    = Math.min(48, Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10)));
  const offset   = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

  // Single product fetch
  if (id) {
    const { data, error } = await supabase
      .from('products')
      .select('id,supplier_ref,title,description,category,supplier,base_price,images,product_variants(id,sku,color,color_group,color_code,price,stock,images)')
      .eq('id', id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ product: normalizeProduct(data as Record<string, unknown>) });
  }

  // List products
  let query = supabase
    .from('products')
    .select('id,supplier_ref,title,description,category,supplier,base_price,images', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('updated_at', { ascending: false });

  // Category filter
  if (category !== 'all' && CATEGORY_GROUP_PREFIXES[category]) {
    const prefixes = CATEGORY_GROUP_PREFIXES[category];
    const orParts = prefixes.map(p => `category.ilike.${p}*`).join(',');
    query = query.or(orParts);
  }

  // Text search
  if (search.trim()) {
    const esc = search.trim().replace(/[%_]/g, '\\$&');
    query = query.or(`title.ilike.*${esc}*,description.ilike.*${esc}*,supplier_ref.ilike.*${esc}*`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    products: (data ?? []).map((r: Record<string, unknown>) => normalizeProduct(r)),
    total: count ?? 0,
    limit,
    offset,
  });
  } catch (error) {
    console.error('[catalog] GET error:', error);
    return NextResponse.json({ error: 'Catalog unavailable' }, { status: 500 });
  }
}

function normalizeProduct(row: Record<string, unknown>) {
  const variants = (row.product_variants as Record<string, unknown>[] | null) ?? [];
  return {
    id: row.id,
    supplierRef: row.supplier_ref,
    title: row.title,
    description: row.description,
    category: row.category,
    supplier: row.supplier,
    basePrice: row.base_price ?? 0,
    images: (row.images as string[]) ?? [],
    variants: variants.map(v => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      colorGroup: v.color_group,
      colorCode: v.color_code,
      price: v.price ?? 0,
      stock: v.stock ?? 0,
      images: (v.images as string[]) ?? [],
    })),
  };
}
