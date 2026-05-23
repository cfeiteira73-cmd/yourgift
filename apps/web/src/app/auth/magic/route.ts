import { NextResponse } from 'next/server';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

/**
 * GET /auth/magic
 *
 * Alias route for Supabase magic-link emails. Supabase sends the user to
 * whatever `emailRedirectTo` is set, which should already point to
 * /auth/callback. This route acts as a safety alias in case the email
 * template or Supabase config sends users here instead, forwarding all
 * query params to the canonical callback handler.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = new URL('/auth/callback', APP_URL);

  url.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(callbackUrl.toString());
}
