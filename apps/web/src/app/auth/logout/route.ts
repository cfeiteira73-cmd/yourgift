import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

async function handleLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${APP_URL}/`, { status: 302 });
}

// Support both GET (mobile browsers) and POST (form submissions)
export async function GET() {
  return handleLogout();
}

export async function POST() {
  return handleLogout();
}
