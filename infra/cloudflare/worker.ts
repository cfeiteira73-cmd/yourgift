/**
 * YourGift OS — Cloudflare Edge Worker
 *
 * Deployed at the edge in front of both services:
 *   - yourgift-api.onrender.com  (NestJS API)
 *   - www.yourgift.pt            (Next.js Web)
 *
 * Responsibilities:
 *   1. Block malicious patterns (SQLi, path traversal, empty UA)
 *   2. Rate-limit auth + API endpoints (in-memory per-isolation)
 *   3. Inject security response headers (CSP, HSTS, X-Frame, Permissions)
 *   4. Allow AI crawlers + Stripe IPs unconditionally
 *   5. Block known bad user agents
 *
 * Deploy:
 *   wrangler deploy --env production
 *
 * Secrets (set via wrangler secret put):
 *   None required — worker is stateless.
 *   For KV-based rate limiting enable the kv_namespaces block in wrangler.toml.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const RATE_LIMITS = {
  api: { windowMs: 60_000, max: 200 },   // 200 req/min per IP on /api/*
  auth: { windowMs: 60_000, max: 20 },   // 20 req/min per IP on /auth/*
  scim: { windowMs: 60_000, max: 60 },   // 60 req/min per IP on /scim/*
} as const;

// Stripe webhook IPs — never rate limit or block
// https://stripe.com/docs/ips
const STRIPE_IPS = new Set([
  '3.18.12.63', '3.130.192.231', '13.235.14.237', '13.235.122.149',
  '18.211.135.69', '35.154.171.200', '52.15.183.38', '54.187.174.169',
  '54.187.205.235', '54.187.216.72', '54.241.31.99', '54.241.31.102',
  '54.241.34.107', '3.219.195.60', '3.219.197.65', '34.207.128.139',
]);

// Known AI crawlers — allow access to /sitemap.xml, /llms.txt, /robots.txt
const AI_CRAWLERS = [
  'anthropic-ai', 'claude-web', 'chatgpt-user', 'gptbot', 'google-extended',
  'youbot', 'cohere-ai', 'perplexitybot', 'diffbot',
];

// Paths that should never be blocked regardless of heuristics
const ALLOWLISTED_PATHS = ['/api/v1/health', '/robots.txt', '/sitemap.xml', '/llms.txt'];

// SQLi / path traversal patterns (keep tight — no false positives)
const SQLI_PATTERN = /(\b(select|union|insert|drop|delete|update|exec|cast|convert)\b.*\b(from|into|where|table)\b)|('--|;\s*--|\/\*)/i;
const PATH_TRAVERSAL = /(\.\.(\/|\\)){2,}|%2e%2e(%2f|%5c)/i;

// Bad user agents (scrapers / vulnerability scanners)
const BAD_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nessus/i, /masscan/i, /zgrab/i,
  /python-requests\/[0-1]\./i,  // very old requests versions
  /go-http-client\/1\.1/i,       // raw Go http1.1 with no Accept headers
];

// Security response headers applied to every response
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.betterstack.com https://browser.sentry-cdn.com",
    "frame-src 'self' https://js.stripe.com",
    "img-src 'self' data: https://cdn.yourgift.pt https://*.supabase.co",
    "connect-src 'self' https://yourgift-api.onrender.com https://*.supabase.co https://api.stripe.com https://*.ingest.sentry.io https://uptime.betterstack.com",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  ].join('; '),
};

// ── In-memory rate limit store (per isolate, resets on cold start) ─────────────

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= max) return false; // blocked

  entry.count++;
  return true; // allowed
}

// Periodically purge expired entries (avoids unbounded memory growth)
function purgeExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blockResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
    },
  });
}

function applySecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  // Remove fingerprinting headers from origin
  newHeaders.delete('server');
  newHeaders.delete('x-powered-by');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function isAiCrawler(ua: string): boolean {
  const uaLower = ua.toLowerCase();
  return AI_CRAWLERS.some((bot) => uaLower.includes(bot));
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = getClientIp(request);
    const ua = request.headers.get('user-agent') ?? '';
    const method = request.method;

    // Purge stale rate limit entries ~1% of requests
    if (Math.random() < 0.01) purgeExpiredRateLimits();

    // ── 1. Always allow: health check, robots, sitemap, llms.txt ──────────────
    if (ALLOWLISTED_PATHS.includes(path)) {
      return applySecurityHeaders(await fetch(request));
    }

    // ── 2. Stripe IPs bypass all rules ────────────────────────────────────────
    if (STRIPE_IPS.has(ip)) {
      return applySecurityHeaders(await fetch(request));
    }

    // ── 3. Block empty / missing User-Agent (unless OPTIONS preflight) ─────────
    if (method !== 'OPTIONS' && !ua.trim()) {
      return blockResponse(403, 'Forbidden: missing User-Agent');
    }

    // ── 4. Block known bad user agents ────────────────────────────────────────
    if (BAD_UA_PATTERNS.some((p) => p.test(ua))) {
      return blockResponse(403, 'Forbidden: automated scanner detected');
    }

    // ── 5. AI crawlers: allow only public paths ────────────────────────────────
    if (isAiCrawler(ua)) {
      const publicOk = ['/sitemap.xml', '/llms.txt', '/robots.txt', '/enterprise', '/store'].some(
        (p) => path === p || path.startsWith(p + '/')
      );
      if (!publicOk && path.startsWith('/api/')) {
        return blockResponse(403, 'Forbidden: AI crawlers may not access the API');
      }
      // AI crawlers on public pages: allow, no rate limit
      return applySecurityHeaders(await fetch(request));
    }

    // ── 6. Inspect query string + URL for SQLi / path traversal ──────────────
    const fullUrl = url.pathname + url.search;
    if (SQLI_PATTERN.test(fullUrl) || PATH_TRAVERSAL.test(fullUrl)) {
      return blockResponse(400, 'Bad request: suspicious pattern detected');
    }

    // ── 7. Inspect request body for POST/PUT/PATCH (first 4KB only) ───────────
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded')) {
        try {
          // Clone request to read body without consuming it
          const clone = request.clone();
          const bodyText = await clone.text().then((t) => t.slice(0, 4096));
          if (SQLI_PATTERN.test(bodyText)) {
            return blockResponse(400, 'Bad request: suspicious payload detected');
          }
        } catch {
          // Body read failed — continue without blocking
        }
      }
    }

    // ── 8. Rate limiting ──────────────────────────────────────────────────────
    if (path.startsWith('/auth/') || path.startsWith('/api/v1/auth/')) {
      if (!checkRateLimit(`auth:${ip}`, RATE_LIMITS.auth.windowMs, RATE_LIMITS.auth.max)) {
        return blockResponse(429, 'Too many authentication attempts. Try again in 60 seconds.');
      }
    } else if (path.startsWith('/scim/')) {
      if (!checkRateLimit(`scim:${ip}`, RATE_LIMITS.scim.windowMs, RATE_LIMITS.scim.max)) {
        return blockResponse(429, 'Rate limit exceeded');
      }
    } else if (path.startsWith('/api/')) {
      if (!checkRateLimit(`api:${ip}`, RATE_LIMITS.api.windowMs, RATE_LIMITS.api.max)) {
        return blockResponse(429, 'Rate limit exceeded. Slow down and retry.');
      }
    }

    // ── 9. Forward request to origin ──────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(request);
    } catch {
      return blockResponse(502, 'Gateway error — origin unreachable');
    }

    // ── 10. Apply security headers to origin response ─────────────────────────
    return applySecurityHeaders(response);
  },
} satisfies ExportedHandler;
