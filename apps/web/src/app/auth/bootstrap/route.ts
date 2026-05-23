import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /auth/bootstrap?next=/dashboard
// Attempts to restore session silently. Three outcomes:
// 1. Valid session → redirect to `next`
// 2. Refreshable session → refresh and redirect to `next`
// 3. No session → redirect to /auth/login?next=...&reason=session_expired
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

  // Sanitise next to prevent open-redirect
  const safeNext = rawNext.startsWith('/') ? rawNext : '/dashboard';

  const supabase = await createClient();

  // 1. Check active session
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${appUrl}${safeNext}`);
  }

  // 2. Attempt refresh
  const { data: { session } } = await supabase.auth.refreshSession();
  if (session) {
    return NextResponse.redirect(`${appUrl}${safeNext}`);
  }

  // 3. No session — send to login with reason
  const loginUrl = new URL('/auth/login', appUrl);
  loginUrl.searchParams.set('next', safeNext);
  loginUrl.searchParams.set('reason', 'session_expired');
  return NextResponse.redirect(loginUrl.toString());
}
