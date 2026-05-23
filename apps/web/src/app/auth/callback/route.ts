import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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

  // ── Exchange PKCE code for session ────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(
              name,
              value,
              options as Parameters<typeof cookieStore.set>[2],
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

  return NextResponse.redirect(`${APP_URL}${safeNext}`);
}
