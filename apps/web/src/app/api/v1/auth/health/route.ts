/**
 * GET /api/v1/auth/health
 *
 * Returns a structured report of the auth system's configuration and state.
 * Use this to diagnose login failures without exposing sensitive data.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const CANONICAL_HOST = 'yourgift.pt';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? 'unknown';
  const origin = new URL(request.url).origin;
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Check Supabase env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  const supabaseConfigured = !!(supabaseUrl && supabaseKey);

  // Check Supabase session via server-side getUser()
  let sessionState: 'authenticated' | 'unauthenticated' | 'error' = 'unauthenticated';
  let userId: string | null = null;
  let userEmail: string | null = null;
  let sessionError: string | null = null;

  if (supabaseConfigured) {
    try {
      const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* health check — read-only */ },
        },
      });
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        sessionError = error.message;
        sessionState = 'error';
      } else if (data.user) {
        sessionState = 'authenticated';
        userId = data.user.id;
        userEmail = data.user.email ?? null;
      }
    } catch (err) {
      sessionError = err instanceof Error ? err.message : String(err);
      sessionState = 'error';
    }
  }

  // Check auth cookies presence
  const supabaseCookies = allCookies.filter((c) => c.name.startsWith('sb-'));
  const hasCookies = supabaseCookies.length > 0;

  // Callback URL validation
  const callbackUrl = `${origin}/auth/callback`;
  const confirmUrl = `${origin}/auth/confirm`;

  // Domain validation
  const isCanonical = host === CANONICAL_HOST || host.startsWith('localhost');
  const hasWwwMismatch = host.startsWith('www.');

  const report = {
    timestamp: new Date().toISOString(),
    domain: {
      current: host,
      canonical: CANONICAL_HOST,
      isCanonical,
      hasWwwMismatch,
      recommendation: hasWwwMismatch
        ? `Canonical redirect active: www.${CANONICAL_HOST} → ${CANONICAL_HOST}`
        : 'Domain is canonical — OK',
    },
    supabase: {
      configured: supabaseConfigured,
      url: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : null,
      keyPresent: !!supabaseKey,
    },
    callbacks: {
      pkceCallback: callbackUrl,
      otpConfirm: confirmUrl,
      instructions: [
        `Add to Supabase Dashboard → Auth → URL Configuration → Redirect URLs:`,
        callbackUrl,
        confirmUrl,
        `https://yourgift.pt/auth/callback`,
        `https://yourgift.pt/auth/confirm`,
      ],
    },
    session: {
      state: sessionState,
      userId: userId ? `${userId.slice(0, 8)}...` : null,
      userEmail: userEmail ? `${userEmail.slice(0, 3)}...@${userEmail.split('@')[1]}` : null,
      error: sessionError,
    },
    cookies: {
      supabaseCookiesPresent: hasCookies,
      count: supabaseCookies.length,
      names: supabaseCookies.map((c) => c.name),
    },
    authFlows: {
      magicLink: {
        ready: supabaseConfigured,
        endpoint: '/auth/login (mode=magic_link)',
        callbackUrl,
      },
      emailPassword: {
        ready: supabaseConfigured,
        endpoint: '/auth/login (mode=password)',
      },
      emailConfirmation: {
        ready: supabaseConfigured,
        confirmUrl,
        note: 'Used for signUp() email verification links',
      },
    },
    overallHealth:
      !supabaseConfigured
        ? 'DEGRADED — Supabase not configured'
        : sessionState === 'error'
        ? 'DEGRADED — Session check failed'
        : 'OK',
  };

  return NextResponse.json(report, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
