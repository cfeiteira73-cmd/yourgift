import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Inline type to avoid import issues with different @supabase/auth-js versions
type EmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

/**
 * GET /auth/confirm
 *
 * Handles Supabase OTP/token_hash flows:
 *  - Magic link emails (implicit flow, token_hash in URL)
 *  - Email confirmation after signUp (token_hash in URL)
 *
 * These differ from PKCE OAuth (/auth/callback) because there is no
 * `code` exchange — Supabase embeds a `token_hash` directly in the link.
 * This route verifies the OTP and sets the session cookie on the response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  // Sanitise `next` — only allow relative paths
  const safeNext = next.startsWith('/') ? next : '/dashboard';

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=missing_token`,
    );
  }

  // Create redirect response FIRST — cookies must be set on the response object
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

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    console.error('[auth/confirm] verifyOtp error:', error.message);
    return NextResponse.redirect(
      `${APP_URL}/auth/recover?reason=link_expired`,
    );
  }

  return response;
}
