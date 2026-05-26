import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const next = searchParams.get('next') ?? '/dashboard';

  // Sanitise `next` — only allow relative paths to prevent open-redirect
  const safeNext = next.startsWith('/') ? next : '/dashboard';

  // ── Error from OAuth provider (e.g. user denied consent) ─────────────────
  if (!code && error) {
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=${encodeURIComponent(error)}`,
    );
  }

  // ── No code and no error → unknown state ─────────────────────────────────
  if (!code) {
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=missing_code`,
    );
  }

  // ── Create redirect response FIRST so cookies are written to it ──────────
  // CRITICAL: response must exist before the Supabase client is created.
  // If you create the response AFTER exchangeCodeForSession(), the setAll()
  // callback has already run and written cookies to a stale response object.
  const response = NextResponse.redirect(`${APP_URL}${safeNext}`);

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2],
            ),
          );
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message);
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=callback_failed`,
    );
  }

  return response;
}
