/**
 * TEMPORARY FIX ENDPOINT — DELETE AFTER USE
 *
 * Fixes: Google OAuth OIDC audience mismatch in Supabase.
 * Root cause: Supabase has Client ID stored as short form
 *   "201831206854-5u1hu5kadfmpn5u0dsp0bbpvc19osdus"
 * but Google's OIDC token includes the full form
 *   "201831206854-5u1hu5kadfmpn5u0dsp0bbpvc19osdus.apps.googleusercontent.com"
 * causing: "oidc: expected audience X got [X.apps.googleusercontent.com]"
 *
 * This endpoint calls GoTrue's admin config API with the service role key
 * to update the Google Client ID to the full form.
 *
 * Usage: GET /api/v1/auth/fix-google?secret=yourgift_fix_2026
 */
import { NextResponse, type NextRequest } from 'next/server';

const FIX_SECRET = 'yourgift_fix_2026';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Full-form Google Client ID (with .apps.googleusercontent.com)
const GOOGLE_CLIENT_ID_FULL =
  '201831206854-5u1hu5kadfmpn5u0dsp0bbpvc19osdus.apps.googleusercontent.com';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (secret !== FIX_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not set' },
      { status: 500 },
    );
  }

  const adminUrl = `${SUPABASE_URL}/auth/v1/admin/config`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
  };

  // Step 1: GET current config
  let currentConfig: Record<string, unknown> = {};
  try {
    const getResp = await fetch(adminUrl, { headers });
    if (getResp.ok) {
      currentConfig = await getResp.json() as Record<string, unknown>;
    } else {
      const body = await getResp.text();
      return NextResponse.json({
        error: 'Failed to GET admin config',
        status: getResp.status,
        body,
        note: 'GoTrue admin config endpoint may not be accessible via service role key',
      });
    }
  } catch (err) {
    return NextResponse.json({ error: 'GET failed', detail: String(err) });
  }

  // Step 2: PATCH to update Google Client ID
  let patchResult: unknown = null;
  let patchStatus = 0;
  try {
    const patchResp = await fetch(adminUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        external_google_client_id: GOOGLE_CLIENT_ID_FULL,
      }),
    });
    patchStatus = patchResp.status;
    patchResult = await patchResp.json().catch(() => patchResp.text());
  } catch (err) {
    patchResult = String(err);
  }

  return NextResponse.json({
    currentConfig,
    patchStatus,
    patchResult,
    target: GOOGLE_CLIENT_ID_FULL,
    success: patchStatus >= 200 && patchStatus < 300,
  });
}
