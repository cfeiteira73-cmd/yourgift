// ── Makito Supplier Image Proxy ───────────────────────────────────────────────
//
// Makito's catalog asset URLs (https://apis.makito.es/catalog/assets/...)
// require Bearer token authentication. This proxy fetches images server-side
// using the stored Makito credentials and streams them to the client.
//
// Usage: GET /api/images/makito?url=https://apis.makito.es/catalog/assets/...
//
// Security: only allows proxying from apis.makito.es domain
// Caching: 1 hour CDN cache (images don't change frequently)
//
// Note: Makito is a SUPPLIER — this is a backend integration, not client-facing auth
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const MAKITO_CLIENT_ID = process.env.MAKITO_CLIENT_ID ?? '';
const MAKITO_CLIENT_SECRET = process.env.MAKITO_CLIENT_SECRET ?? '';
const MAKITO_BASE_URL = process.env.MAKITO_BASE_URL ?? 'https://apis.makito.es';

let _token: string | null = null;
let _tokenExpiry = 0;

async function getMakitoToken(): Promise<string | null> {
  if (_token && Date.now() < _tokenExpiry) return _token;
  if (!MAKITO_CLIENT_ID || !MAKITO_CLIENT_SECRET) return null;

  try {
    const res = await fetch(`${MAKITO_BASE_URL}/access/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: MAKITO_CLIENT_ID, clientSecret: MAKITO_CLIENT_SECRET }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _token = data.token;
    _tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 min (refresh before 1h expiry)
    return _token;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Security: only allow proxying from Makito's supplier domain
  if (!url.startsWith('https://apis.makito.es/catalog/assets/')) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  const token = await getMakitoToken();
  if (!token) {
    // Return a placeholder if Makito auth not configured
    return NextResponse.redirect('https://hzfzdjmprtlsnrpsjdgh.supabase.co/storage/v1/object/public/public/placeholder-product.jpg');
  }

  try {
    const imgRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgRes.ok) {
      return NextResponse.json({ error: `Supplier returned ${imgRes.status}` }, { status: 502 });
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Supplier': 'makito',
      },
    });
  } catch (err) {
    console.error('[makito-image-proxy]', err);
    return NextResponse.json({ error: 'Failed to fetch supplier image' }, { status: 502 });
  }
}
