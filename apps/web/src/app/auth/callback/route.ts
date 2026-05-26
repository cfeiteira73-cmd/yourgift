/**
 * /auth/callback — PKCE code exchange for session
 *
 * Called by Supabase after:
 *  - Magic link clicks
 *  - Google / Apple OAuth consent
 *  - Email confirmation links (signUp)
 *
 * CRITICAL: The redirect response must be created BEFORE the supabase client,
 * then cookies are written to that response via setAll. Writing to cookieStore
 * instead of the response silently drops the session (Next.js App Router bug).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

// Only allow relative paths — prevents open redirect attacks
function sanitizeNext(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  try {
    new URL(next); // if it parses as absolute URL, reject it
    return '/dashboard';
  } catch {
    return next; // relative path — safe
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const next = sanitizeNext(searchParams.get('next'));

  console.log('[auth/callback] started', {
    hasCode: !!code,
    hasError: !!error,
    next,
    origin,
    ts: new Date().toISOString(),
  });

  // Error from OAuth provider (e.g. user denied Google consent)
  if (!code && error) {
    console.warn('[auth/callback] provider error', { error });
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    console.warn('[auth/callback] no code param');
    return NextResponse.redirect(`${APP_URL}/auth/recover?reason=missing_code`);
  }

  // ── CRITICAL FIX: Create redirect response FIRST ───────────────────────────
  // The supabase client's setAll must write to THIS response's cookies.
  // Creating NextResponse.redirect() after setAll silently drops the session.
  const response = NextResponse.redirect(`${APP_URL}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read from the incoming request (not cookieStore)
        getAll() {
          return request.cookies.getAll();
        },
        // Write to the outgoing response (not cookieStore)
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
          console.log('[auth/callback] session cookies written to response', {
            count: cookiesToSet.length,
          });
        },
      },
    },
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession failed', {
      message: exchangeError.message,
      status: exchangeError.status,
    });
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=callback_failed`,
    );
  }

  if (!data.user) {
    console.error('[auth/callback] no user in session after exchange');
    return NextResponse.redirect(`${APP_URL}/auth/recover?reason=no_user`);
  }

  console.log('[auth/callback] success', {
    userId: data.user.id,
    email: data.user.email,
    redirectTo: `${APP_URL}${next}`,
  });

  return response;
}
