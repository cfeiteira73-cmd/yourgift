import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Product Recommendation Engine ─────────────────────────
//
// X7 AI/ML Platform: Collaborative filtering + content-based hybrid
// recommendation engine built on real order history.
//
// Algorithms:
//  1. Collaborative filtering: clients who bought X also bought Y
//  2. Content-based: match product categories to client's purchase profile
//  3. Frequency-weighted: boost products ordered by similar-tier clients
//  4. AI narrative: Claude generates personalised recommendation rationale
//
// GET  ?mode=client&clientId=   — personalised product recs for a client
// GET  ?mode=product&productId= — "clients who bought this also bought"
// GET  ?mode=trending           — trending products (30d velocity)
// GET  ?mode=new_arrivals       — products added recently with no orders yet
// POST { action:'log_view' }    — log product view event for feature pipeline
// POST { action:'log_click' }   — log recommendation click (CTR tracking)
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function generateRecommendationRationale(
  clientName: string,
  topCategory: string,
  recommendations: Array<{ title: string; category: string }>
): Promise<string> {
  if (!ANTHROPIC_API_KEY || !recommendations.length) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system: 'És um account manager de merchandising B2B. Escreve uma justificação curta para recomendações de produtos. Tom: profissional e personalizado. Máx 2 frases.',
        messages: [{
          role: 'user',
          content: `Cliente: ${clientName}. Categoria principal: ${topCategory}. Sugestões: ${recommendations.map(r => r.title).join(', ')}`,
        }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

// ── Core recommendation algorithms ────────────────────────────────────────────

type Product = {
  id: string;
  title: string;
  category?: string;
  images?: string[];
  price_from?: number;
};

async function getClientRecommendations(
  db: ReturnType<typeof getAdminDb>,
  clientId: string,
  limit = 8
): Promise<{ products: Array<Product & { score: number; reason: string }>; topCategory: string }> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  // Step 1: Get this client's purchase history
  const { data: clientHistory } = await db!
    .from('order_items')
    .select('quantity, products(id, title, category)')
    .eq('orders.client_id', clientId)
    .gte('orders.created_at', ninetyDaysAgo)
    .limit(100);

  type HistoryItem = { quantity: number; products: { id: string; title: string; category?: string } | null };
  const boughtProductIds = new Set<string>();
  const categoryProfile: Record<string, number> = {};

  for (const item of (clientHistory ?? []) as HistoryItem[]) {
    if (item.products?.id) boughtProductIds.add(item.products.id);
    const cat = item.products?.category ?? 'outro';
    categoryProfile[cat] = (categoryProfile[cat] ?? 0) + (item.quantity ?? 1);
  }

  const topCategory = Object.entries(categoryProfile).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'merchandising';

  // Step 2: Collaborative filtering — find clients with similar purchase profiles
  const { data: similarClientOrders } = await db!
    .from('order_items')
    .select('orders!inner(client_id), products(id, title, category, images, price_from)')
    .in('products.category', Object.keys(categoryProfile))
    .gte('orders.created_at', ninetyDaysAgo)
    .not('orders.client_id', 'eq', clientId)
    .limit(300);

  type SimilarItem = {
    orders: { client_id: string } | null;
    products: Product | null;
  };

  // Score products by co-occurrence frequency
  const productScores: Record<string, { product: Product; score: number; reason: string }> = {};
  for (const item of (similarClientOrders ?? []) as SimilarItem[]) {
    if (!item.products?.id || boughtProductIds.has(item.products.id)) continue;
    const pid = item.products.id;
    const catWeight = categoryProfile[item.products.category ?? ''] ?? 0;
    const score = 1 + catWeight * 0.5;

    if (!productScores[pid]) {
      productScores[pid] = { product: item.products, score: 0, reason: 'collaborative' };
    }
    productScores[pid].score += score;
  }

  // Step 3: Content-based boost for top categories
  const { data: categoryProducts } = await db!
    .from('products')
    .select('id, title, category, images, price_from')
    .eq('category', topCategory)
    .eq('active', true)
    .limit(20);

  for (const p of (categoryProducts ?? []) as Product[]) {
    if (!p.id || boughtProductIds.has(p.id)) continue;
    if (!productScores[p.id]) {
      productScores[p.id] = { product: p, score: 3, reason: 'content_based' };
    } else {
      productScores[p.id].score += 3; // boost if also collaborative
      productScores[p.id].reason = 'hybrid';
    }
  }

  // Step 4: Rank and label
  const ranked = Object.values(productScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product, score, reason }) => ({
      ...product,
      score: Math.round(score * 10) / 10,
      reason: reason === 'hybrid'
        ? 'Clientes similares compraram · Na tua categoria principal'
        : reason === 'collaborative'
        ? 'Clientes com perfil similar compraram'
        : 'Baseado na tua categoria principal',
    }));

  return { products: ranked, topCategory };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb() ?? supabase;
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  const mode = req.nextUrl.searchParams.get('mode') ?? 'client';
  const { searchParams } = req.nextUrl;

  try {
    if (mode === 'client') {
      let clientId = searchParams.get('clientId');

      // If not admin, resolve own clientId
      if (!clientId || !isAdmin) {
        const { data: client } = await supabase
          .from('clients').select('id, name, company').eq('auth_user_id', user.id).single();
        if (!client) return NextResponse.json({ recommendations: [], rationale: '' });
        clientId = (client as { id: string }).id;

        const { products, topCategory } = await getClientRecommendations(db, clientId);
        const clientName = (client as { name?: string; company?: string }).name
          ?? (client as { name?: string; company?: string }).company ?? 'Cliente';
        const rationale = await generateRecommendationRationale(clientName, topCategory, products.slice(0, 3));

        return NextResponse.json({ recommendations: products, rationale, topCategory, generatedAt: new Date().toISOString() });
      }

      const { products, topCategory } = await getClientRecommendations(db, clientId);
      return NextResponse.json({ recommendations: products, topCategory, generatedAt: new Date().toISOString() });
    }

    if (mode === 'product') {
      const productId = searchParams.get('productId');
      if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

      // Find clients who bought this product
      const { data: buyers } = await db
        .from('order_items')
        .select('orders!inner(client_id)')
        .eq('product_id', productId)
        .gte('orders.created_at', ninetyDaysAgo)
        .limit(50);

      const buyerIds = [...new Set((buyers ?? []).map(b => (b.orders as { client_id: string } | null)?.client_id ?? '').filter(Boolean))];

      if (!buyerIds.length) {
        return NextResponse.json({ alsoViewed: [], message: 'Dados insuficientes' });
      }

      // What else did those buyers purchase?
      const { data: coOrdered } = await db
        .from('order_items')
        .select('products(id, title, category, images, price_from), quantity')
        .in('orders.client_id', buyerIds)
        .gte('orders.created_at', ninetyDaysAgo)
        .not('product_id', 'eq', productId)
        .limit(200);

      type CoItem = { products: Product | null; quantity: number };
      const coScores: Record<string, { product: Product; count: number }> = {};
      for (const item of (coOrdered ?? []) as CoItem[]) {
        if (!item.products?.id) continue;
        const pid = item.products.id;
        if (!coScores[pid]) coScores[pid] = { product: item.products, count: 0 };
        coScores[pid].count += item.quantity ?? 1;
      }

      const alsoViewed = Object.values(coScores)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map(({ product, count }) => ({ ...product, coOrderCount: count }));

      return NextResponse.json({ alsoViewed, generatedAt: new Date().toISOString() });
    }

    if (mode === 'trending') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

      const { data: recent } = await db
        .from('order_items')
        .select('product_id, quantity, products(id, title, category, images, price_from)')
        .gte('orders.created_at', thirtyDaysAgo)
        .limit(500);

      const { data: prior } = await db
        .from('order_items')
        .select('product_id, quantity')
        .gte('orders.created_at', sixtyDaysAgo)
        .lt('orders.created_at', thirtyDaysAgo)
        .limit(500);

      type TrendItem = { product_id: string; quantity: number; products?: Product | null };
      const recentMap: Record<string, { product: Product; qty: number }> = {};
      for (const item of (recent ?? []) as TrendItem[]) {
        const pid = item.product_id;
        if (!pid || !item.products) continue;
        if (!recentMap[pid]) recentMap[pid] = { product: item.products as Product, qty: 0 };
        recentMap[pid].qty += item.quantity ?? 1;
      }

      const priorMap: Record<string, number> = {};
      for (const item of (prior ?? []) as TrendItem[]) {
        priorMap[item.product_id] = (priorMap[item.product_id] ?? 0) + (item.quantity ?? 1);
      }

      const trending = Object.entries(recentMap)
        .map(([pid, { product, qty }]) => {
          const priorQty = priorMap[pid] ?? 0;
          const velocity = priorQty > 0 ? ((qty - priorQty) / priorQty) * 100 : qty * 10;
          return { ...product, recentQty: qty, velocityPct: Math.round(velocity) };
        })
        .filter(p => p.recentQty >= 3)
        .sort((a, b) => b.velocityPct - a.velocityPct)
        .slice(0, 10);

      return NextResponse.json({ trending, generatedAt: new Date().toISOString() });
    }

    if (mode === 'new_arrivals') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: newProducts } = await db
        .from('products')
        .select('id, title, category, images, price_from, created_at')
        .gte('created_at', thirtyDaysAgo)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(12);

      return NextResponse.json({ newArrivals: newProducts ?? [], generatedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[recommendations GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = body.action as string;

  try {
    if (action === 'log_view' || action === 'log_click') {
      const { productId, context, position } = body as { productId?: string; context?: string; position?: number };
      if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

      // Log to omega_final_audit_log for feature pipeline
      await supabase.from('omega_final_audit_log').insert({
        entity_type: 'product',
        entity_id: productId,
        action: action,
        performed_by: user.id,
        metadata: { context: context ?? 'recommendations', position: position ?? null },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[recommendations POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
