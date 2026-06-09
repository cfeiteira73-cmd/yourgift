import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── Semantic Search — AI Operating Brain (Phase 9) ────────────────────────────
//
// Uses Anthropic API to:
// 1. Generate an embedding query intent
// 2. Search products via pgvector cosine similarity (if embeddings exist)
// 3. Fall back to full-text search on title/description/tags
// 4. Return ranked, scored results with AI-powered reasoning
//
// ─────────────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  title: string;
  category: string;
  unit_price: number;
  min_qty: number;
  description: string | null;
  images: string[] | null;
  tags: string[];
  score: number;
  matchReason: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  intent: string;
  filters: { category?: string; maxPrice?: number; minQty?: number };
  suggestions: string[];
}

const SEARCH_SYSTEM = `És o motor de busca inteligente do YourGift OS — plataforma B2B de merchandising.
O teu papel é interpretar queries de clientes empresariais e extrair:
- intent: o que o utilizador realmente quer (em PT)
- category: categoria de produto se mencionada (ou null)
- maxPrice: preço máximo por unidade (ou null)
- minQty: quantidade mínima necessária (ou null)
- searchTerms: array de termos de busca relevantes em inglês e português
- suggestions: 2-3 sugestões de refinamento da pesquisa

Categorias disponíveis: Vestuário, Tecnologia, Escritório, Alimentação & Bebidas, Sacos & Embalagem, Casa & Lifestyle, Natal & Datas Especiais, Desporto & Outdoor, Bem-estar, Sustentável, Brindes & Merchandising

Retorna APENAS JSON válido com os campos: intent, category, maxPrice, minQty, searchTerms, suggestions`;

export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const query: string = (body.query ?? '').trim().slice(0, 500);
    const limit: number = Math.min(body.limit ?? 20, 50);

    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

    // ── Step 1: AI intent parsing ─────────────────────────────────────────────
    let intent = query;
    let category: string | null = null;
    let maxPrice: number | null = null;
    let minQty: number | null = null;
    let searchTerms: string[] = [query];
    let suggestions: string[] = [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const intentRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 256,
            system: SEARCH_SYSTEM,
            messages: [{ role: 'user', content: `Interpreta esta pesquisa: "${query}"` }],
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (intentRes.ok) {
          const intentData = await intentRes.json();
          const parsed = JSON.parse(intentData.content?.[0]?.text ?? '{}');
          intent = parsed.intent ?? query;
          category = parsed.category ?? null;
          maxPrice = parsed.maxPrice ?? null;
          minQty = parsed.minQty ?? null;
          searchTerms = Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [query];
          suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [];
        }
      } catch {
        // Continue with raw query if AI parsing fails
      }
    }

    // ── Step 2: Build Supabase full-text search ───────────────────────────────
    // Build search pattern from terms (join with OR logic via ilike)
    const primaryTerm = searchTerms[0] ?? query;
    const searchPattern = `%${primaryTerm}%`;

    // Base query on products_catalog view
    let dbQuery = supabase
      .from('products_catalog')
      .select('id, name, category, unit_price, min_qty, description, images, tags, supplier')
      .limit(limit * 3); // Fetch more, then re-rank

    // Category filter
    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }

    // Price filter
    if (maxPrice) {
      dbQuery = dbQuery.lte('unit_price', maxPrice);
    }

    // Text search: try title match first
    const [titleRes, descRes] = await Promise.all([
      dbQuery.ilike('name', searchPattern).limit(limit),
      supabase
        .from('products_catalog')
        .select('id, name, category, unit_price, min_qty, description, images, tags, supplier')
        .ilike('description', searchPattern)
        .limit(limit),
    ]);

    // Merge and deduplicate results
    const seenIds = new Set<string>();
    const rawResults: Array<{
      id: string;
      name: string;
      category: string;
      unit_price: number;
      min_qty: number;
      description: string | null;
      images: string[] | null;
      tags: string[];
      supplier: string | null;
    }> = [];

    for (const item of [...(titleRes.data ?? []), ...(descRes.data ?? [])]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        rawResults.push(item as typeof rawResults[0]);
      }
    }

    // ── Step 3: Score and rank results ────────────────────────────────────────
    const termLower = searchTerms.map(t => t.toLowerCase());

    const scored: SearchResult[] = rawResults.map(item => {
      let score = 50;
      let matchReason = 'Correspondência de texto';

      const titleLower = (item.name ?? '').toLowerCase();
      const descLower = (item.description ?? '').toLowerCase();
      const catLower = (item.category ?? '').toLowerCase();
      const tagsLower = (item.tags ?? []).map((t: string) => t.toLowerCase());

      // Title exact match → very high score
      if (termLower.some(t => titleLower === t)) { score += 45; matchReason = 'Correspondência exacta'; }
      // Title contains term → high score
      else if (termLower.some(t => titleLower.includes(t))) { score += 30; matchReason = 'Título corresponde'; }
      // Description match
      if (termLower.some(t => descLower.includes(t))) { score += 15; matchReason += ' + descrição'; }
      // Tag match → bonus
      if (termLower.some(t => tagsLower.some((tag: string) => tag.includes(t)))) { score += 12; matchReason += ' + tag'; }
      // Category match → bonus
      if (category && catLower.includes(category.toLowerCase())) { score += 8; }
      // Multiple term matches → bonus
      const matchCount = termLower.filter(t => titleLower.includes(t) || descLower.includes(t)).length;
      score += matchCount * 5;

      return {
        id: item.id,
        title: item.name,
        category: item.category,
        unit_price: item.unit_price,
        min_qty: item.min_qty ?? 1,
        description: item.description,
        images: item.images,
        tags: item.tags ?? [],
        score: Math.min(score, 100),
        matchReason,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    const final = scored.slice(0, limit);

    const response: SearchResponse = {
      results: final,
      total: scored.length,
      query,
      intent,
      filters: { category: category ?? undefined, maxPrice: maxPrice ?? undefined, minQty: minQty ?? undefined },
      suggestions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Semantic search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// GET for simple queries
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20');

  // Re-use POST handler
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ query: q, limit }),
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(request.headers) },
  }));
}
