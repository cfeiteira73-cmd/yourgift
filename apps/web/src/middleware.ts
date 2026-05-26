import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/orders', '/quotes'];

// Public auth paths — never intercept these
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/confirm',
  '/auth/logout',
];

// Canonical domain: always redirect www → non-www
const CANONICAL_HOST = 'yourgift.pt';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') ?? '';

  // ── 1. Canonical domain redirect (www → non-www) ─────────────────────────
  if (
    process.env.NODE_ENV === 'production' &&
    (host === `www.${CANONICAL_HOST}` || host.startsWith(`www.${CANONICAL_HOST}:`))
  ) {
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, { status: 301 });
  }

  // ── 2. Skip auth routes entirely — let them handle themselves ─────────────
  const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (isPublicAuth) {
    return NextResponse.next();
  }

  // ── 3. Session check for protected routes ────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mutate request cookies so the new response carries them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild response with the updated request (for token refresh propagation)
          supabaseResponse = NextResponse.next({ request });
          // Also write to the response cookies
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

  // getUser() is required — do NOT use getSession() as it's not verified server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
