import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/orders', '/quotes', '/products', '/reports', '/account'];

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
    // We already tried to redirect to this path; break the loop
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

  // ── 6. Protect routes ─────────────────────────────────────────────────────
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('next', pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    // Mark where we came from so we can detect loops
    redirectResponse.cookies.set('redirectedFrom', pathname, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30,
      path: '/',
    });
    return redirectResponse;
  }

  // ── 7. Security headers ───────────────────────────────────────────────────
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
