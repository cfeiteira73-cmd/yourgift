/**
 * /auth/confirm — handles OTP token_hash magic links
 *
 * Supabase uses this URL pattern for:
 *  - Email confirmation links (signUp with email confirmation enabled)
 *  - Magic link OTPs sent via signInWithOtp
 *  - Password reset links
 *
 * URL form: /auth/confirm?token_hash=pkce_...&type=email&next=/dashboard
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
// EmailOtpType values: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

function sanitizeNext(next: string | null): string {
  if (!next) return '/dashboard';
  try {
    const url = new URL(next);
    if (url.origin !== 'null') return '/dashboard';
  } catch {
    // relative path — ok
  }
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get('next'));

  console.log('[auth/confirm] started', {
    hasToken: !!token_hash,
    type,
    next,
    ts: new Date().toISOString(),
  });

  if (!token_hash || !type) {
    console.warn('[auth/confirm] missing token_hash or type');
    return NextResponse.redirect(new URL('/auth/login?error=invalid_link', origin));
  }

  const redirectTarget = new URL(next, origin);
  const response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...(options ?? {}),
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            } as Parameters<typeof response.cookies.set>[2]);
          });
          console.log('[auth/confirm] cookies written', {
            count: cookiesToSet.length,
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    console.error('[auth/confirm] verifyOtp failed', {
      message: error.message,
      type,
    });
    const loginUrl = new URL('/auth/login', origin);
    loginUrl.searchParams.set('error', 'link_expired');
    loginUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(loginUrl);
  }

  if (!data.user) {
    console.error('[auth/confirm] no user after verifyOtp');
    return NextResponse.redirect(new URL('/auth/login?error=no_user', origin));
  }

  console.log('[auth/confirm] success', {
    userId: data.user.id,
    email: data.user.email,
    type,
  });

  return response;
}
