import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── Admin-only emails — the full enterprise portal is restricted to these ──────
const ADMIN_EMAILS = [
  'geral@yourgift.pt',
  'geral@agencygroup.pt',
];

// ── Admin portal routes (full enterprise dashboard) ───────────────────────────
const ADMIN_ROUTES = [
  '/dashboard', '/orders', '/quotes', '/products', '/reports', '/assets', '/account',
  '/production', '/clients', '/billing', '/suppliers', '/marketing', '/integrations', '/settings',
  // OMEGA ABSOLUTE FINAL routes
  '/cockpit', '/strategist', '/financials', '/runbooks', '/configurator', '/artwork',
  '/procurement', '/inventory', '/qc', '/sales', '/executive', '/supply-chain',
  '/flags', '/org', '/infra', '/marketplace', '/ml', '/activity', '/ops',
  '/reconciliation', '/autopilot', '/intel', '/mobile',
  '/payments', '/disputes', '/postmortems', '/forecasting', '/control-tower',
  '/client-success', '/security', '/ecosystem', '/command',
  '/approvals', '/support', '/audit',
  // OMEGA WORLDCLASS routes
  '/ops-center',
];

// ── Client portal routes (simpler portal — future) ────────────────────────────
const CLIENT_ROUTES = ['/client-portal'];

// ── All protected routes (require auth) ───────────────────────────────────────
const PROTECTED = [...ADMIN_ROUTES, ...CLIENT_ROUTES];

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;

  // ── 1. Canonical domain: redirect bare domain to www ──────────────────────
  if (hostname === 'yourgift.pt') {
    const wwwUrl = request.nextUrl.clone();
    wwwUrl.hostname = 'www.yourgift.pt';
    return NextResponse.redirect(wwwUrl, { status: 301 });
  }

  // ── 2. Bypass ALL /auth/* routes (including /auth/confirm) ──────────────
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // ── 3. Bypass health + API routes ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── 4. Redirect loop protection ───────────────────────────────────────────
  const redirectedFrom = request.cookies.get('redirectedFrom')?.value;
  if (redirectedFrom === pathname) {
    const response = NextResponse.next();
    response.cookies.delete('redirectedFrom');
    return response;
  }

  // ── 5. Supabase session refresh ───────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2],
            ),
          );
        },
      },
    },
  );

  // getUser() also refreshes the session if the token is expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_ROUTES.some((p) => pathname.startsWith(p));
  const isClientRoute = CLIENT_ROUTES.some((p) => pathname.startsWith(p));
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  // ── 6. Auth gate — redirect unauthenticated users to login ───────────────
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('next', pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.set('redirectedFrom', pathname, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30,
      path: '/',
    });
    return redirectResponse;
  }

  // ── 7. Role gate — non-admin users cannot access admin routes ─────────────
  if (isAdminRoute && user && !isAdmin) {
    // Redirect to client portal
    const clientUrl = request.nextUrl.clone();
    clientUrl.pathname = '/client-portal';
    return NextResponse.redirect(clientUrl);
  }

  // ── 8. Admin users don't need the client portal — redirect to dashboard ───
  if (isClientRoute && user && isAdmin) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashUrl);
  }

  // ── 9. Security headers ───────────────────────────────────────────────────
  // Clickjacking
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  // MIME sniffing
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  // Referrer — don't leak full URL cross-origin
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Legacy XSS filter
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
  // DNS prefetch for performance
  supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
  // Disable dangerous browser APIs
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  // Content Security Policy — enterprise-grade, Next.js compatible
  // Note: unsafe-inline required for Next.js hydration scripts (no nonce infra).
  // The connect-src, frame-src, and img-src restrictions still provide real attack surface reduction.
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://cdn.midocean.com https://cdn1.midocean.com https://images.unsplash.com https://pf-concept.com https://*.pfconcept.com https://storage.googleapis.com https://apis.makito.es",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.exchangerate-api.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "upgrade-insecure-requests",
    ].join('; '),
  );
  // HSTS — force HTTPS (only on production HTTPS, not localhost)
  if (request.nextUrl.protocol === 'https:') {
    supabaseResponse.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
