import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S16: B2B Marketplace ────────────────────────────────────────────
//
// Supplier marketplace where verified sellers list products for B2B buyers.
// AI-powered matching scores inquiries against listings.
//
// GET  ?mode=listings           — active marketplace listings
// GET  ?mode=listing&id=        — listing detail + inquiries
// GET  ?mode=inquiries          — all inquiries (admin view)
// GET  ?mode=search&q=          — full-text search listings
// POST { action:'publish' }     — create + publish listing
// POST { action:'update' }      — update listing
// POST { action:'inquire' }     — buyer sends inquiry (AI match score)
// POST { action:'reply' }       — seller replies to inquiry
// POST { action:'close' }       — close inquiry
// POST { action:'archive' }     — archive listing
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 200): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'listings';

  if (mode === 'listings') {
    const category = searchParams.get('category');
    const status = searchParams.get('status') ?? 'active';
    let q = supabase.from('omega_x_marketplace_listings')
      .select('id, seller_name, title, category, product_type, unit_price, currency, min_quantity, lead_time_days, tags, status, views_count, inquiries_count, created_at')
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    const { data } = await q;
    return NextResponse.json({ listings: data ?? [] });
  }

  if (mode === 'listing') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Increment view count (fire-and-forget — ignore if rpc not yet deployed)
    try { await supabase.rpc('increment_listing_views', { listing_id: id }); } catch { /* ok */ }

    const [listing, inquiries] = await Promise.all([
      supabase.from('omega_x_marketplace_listings').select('*').eq('id', id).single(),
      supabase.from('omega_x_marketplace_inquiries')
        .select('id, buyer_email, message, quantity, target_price, status, ai_match_score, created_at')
        .eq('listing_id', id).order('created_at', { ascending: false }),
    ]);

    if (listing.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ listing: listing.data, inquiries: inquiries.data ?? [] });
  }

  if (mode === 'inquiries') {
    const status = searchParams.get('status');
    let q = supabase.from('omega_x_marketplace_inquiries')
      .select('*, omega_x_marketplace_listings(title, seller_name)')
      .order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return NextResponse.json({ inquiries: data ?? [] });
  }

  if (mode === 'search') {
    const query = searchParams.get('q') ?? '';
    const { data } = await supabase.from('omega_x_marketplace_listings')
      .select('id, seller_name, title, category, unit_price, currency, min_quantity, lead_time_days, tags')
      .eq('status', 'active')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(20);
    return NextResponse.json({ listings: data ?? [], query });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'publish') {
    const { seller_id, seller_name, title, description, category, product_type,
      min_quantity, unit_price, currency = 'EUR', lead_time_days,
      samples_available, certifications, tags, images } = body;
    if (!seller_name || !title) return NextResponse.json({ error: 'seller_name and title required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_x_marketplace_listings').insert({
      seller_id, seller_name, title, description, category, product_type,
      min_quantity, unit_price, currency, lead_time_days,
      samples_available: samples_available ?? false,
      certifications: certifications ?? [],
      tags: tags ?? [],
      images: images ?? [],
      status: 'active',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing: data, action: 'published' });
  }

  if (action === 'update') {
    const { id, title, description, unit_price, status, tags, certifications } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (unit_price !== undefined) updates.unit_price = unit_price;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (certifications !== undefined) updates.certifications = certifications;
    const { data, error } = await supabase.from('omega_x_marketplace_listings')
      .update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing: data, action: 'updated' });
  }

  if (action === 'inquire') {
    const { listing_id, buyer_client_id, buyer_email, message, quantity, target_price } = body;
    if (!listing_id || !buyer_email) return NextResponse.json({ error: 'listing_id and buyer_email required' }, { status: 400 });

    // AI match score
    const { data: listing } = await supabase.from('omega_x_marketplace_listings')
      .select('title, description, min_quantity, unit_price, category').eq('id', listing_id).single();

    let aiScore = 50;
    if (listing) {
      const scoreText = await callClaude(
        'Avalias match entre comprador e produto B2B. Responde APENAS com um número 0-100.',
        `Produto: ${listing.title} (${listing.category})
Preço: €${listing.unit_price} min ${listing.min_quantity}u
Interesse do comprador: "${message ?? 'Sem mensagem'}", qty: ${quantity ?? '?'}, target: €${target_price ?? '?'}
Score de match (0-100):`,
        10,
      );
      const parsed = parseInt(scoreText.trim());
      if (!isNaN(parsed)) aiScore = Math.max(0, Math.min(100, parsed));
    }

    const { data, error } = await supabase.from('omega_x_marketplace_inquiries').insert({
      listing_id, buyer_client_id: buyer_client_id ?? null,
      buyer_email, message, quantity, target_price,
      status: 'open', ai_match_score: aiScore,
    }).select().single();

    // Update inquiry count (fire-and-forget — ignore if rpc not yet deployed)
    if (listing) {
      try { await supabase.rpc('increment_listing_inquiries', { listing_id }); } catch { /* ok */ }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inquiry: data, ai_match_score: aiScore, action: 'inquiry_sent' });
  }

  if (action === 'reply') {
    const { id } = body;
    const { data, error } = await supabase.from('omega_x_marketplace_inquiries')
      .update({ status: 'replied' }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inquiry: data, action: 'replied' });
  }

  if (action === 'close') {
    const { id, converted = false } = body;
    const { data, error } = await supabase.from('omega_x_marketplace_inquiries')
      .update({ status: converted ? 'converted' : 'closed' }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inquiry: data, action: converted ? 'converted' : 'closed' });
  }

  if (action === 'archive') {
    const { id } = body;
    const { data, error } = await supabase.from('omega_x_marketplace_listings')
      .update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing: data, action: 'archived' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
