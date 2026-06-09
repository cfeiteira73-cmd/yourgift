// ── Makito Supplier Image Proxy ───────────────────────────────────────────────
//
// Makito asset URLs (https://apis.makito.es/catalog/assets/...) require Bearer
// token. This proxy fetches them server-side and streams to the browser.
//
// Issues fixed:
//   1. Makito returns 'application/octet-stream' — override to image/jpeg
//   2. Images are 1–2MB — use streaming to avoid memory + timeout issues
//   3. Token caching in serverless — re-auth per request on miss
//
// Security: only proxies from apis.makito.es/catalog/assets/
// Cache: 1h CDN + 24h stale
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Use Node.js runtime for larger payloads

const MAKITO_CLIENT_ID = process.env.MAKITO_CLIENT_ID ?? '';
const MAKITO_CLIENT_SECRET = process.env.MAKITO_CLIENT_SECRET ?? '';
const MAKITO_BASE_URL = process.env.MAKITO_BASE_URL ?? 'https://apis.makito.es';

// In-memory token cache (valid per serverless instance lifetime)
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
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _token = data.token ?? null;
    _tokenExpiry = Date.now() + 55 * 60 * 1000;
    return _token;
  } catch {
    return null;
  }
}

/** Infer image content-type from URL extension (Makito returns octet-stream) */
function inferContentType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml',
  };
  return map[ext ?? ''] ?? 'image/jpeg'; // default to jpeg for Makito photos
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Security: only allow Makito catalog assets
  if (!url.startsWith('https://apis.makito.es/catalog/assets/')) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  const token = await getMakitoToken();
  if (!token) {
    // Makito not configured — return transparent 1px placeholder
    const placeholder = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    return new NextResponse(placeholder, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  try {
    // Stream the image — avoids loading 1-2MB into memory all at once
    const imgRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000), // 30s for large images
    });

    if (imgRes.status === 401) {
      // Token expired mid-request — clear cache and retry once
      _token = null;
      const newToken = await getMakitoToken();
      if (!newToken) return NextResponse.json({ error: 'Auth failed' }, { status: 502 });

      const retryRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${newToken}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!retryRes.ok) return NextResponse.json({ error: `Supplier error ${retryRes.status}` }, { status: 502 });

      return new NextResponse(retryRes.body, {
        status: 200,
        headers: {
          'Content-Type': inferContentType(url),
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'X-Supplier': 'makito',
        },
      });
    }

    if (!imgRes.ok) {
      return NextResponse.json({ error: `Supplier returned ${imgRes.status}` }, { status: 502 });
    }

    // Stream response body directly — memory-efficient for large images
    return new NextResponse(imgRes.body, {
      status: 200,
      headers: {
        // Override octet-stream with correct image type
        'Content-Type': inferContentType(url),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Supplier': 'makito',
        ...(imgRes.headers.get('content-length')
          ? { 'Content-Length': imgRes.headers.get('content-length')! }
          : {}),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[makito-image-proxy] Error:', msg);
    return NextResponse.json({ error: 'Failed to fetch supplier image', detail: msg }, { status: 502 });
  }
}
